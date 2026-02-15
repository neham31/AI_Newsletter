import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Validates Mailgun webhook signature
 * @see https://documentation.mailgun.com/en/latest/user_manual.html#webhooks-1
 */
function validateMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
  signingKey: string
): boolean {
  try {
    const encodedToken = createHmac('sha256', signingKey)
      .update(timestamp + token)
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const encodedBuffer = Buffer.from(encodedToken);

    if (signatureBuffer.length !== encodedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, encodedBuffer);
  } catch {
    return false;
  }
}

/**
 * POST /api/ingest/email
 * Mailgun webhook endpoint for receiving newsletter emails
 * Validates signature and queues email for processing
 */
export async function POST(request: NextRequest) {
  try {
    // Parse form data (Mailgun sends multipart/form-data)
    const formData = await request.formData();

    // Get signature fields
    const timestamp = formData.get('timestamp') as string;
    const token = formData.get('token') as string;
    const signature = formData.get('signature') as string;

    // Validate required signature fields
    if (!timestamp || !token || !signature) {
      console.error('Missing signature fields');
      return NextResponse.json(
        { error: 'Missing signature fields' },
        { status: 400 }
      );
    }

    // Validate Mailgun signature
    const signingKey = process.env.MAILGUN_SIGNING_KEY;
    if (!signingKey) {
      console.error('MAILGUN_SIGNING_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!validateMailgunSignature(timestamp, token, signature, signingKey)) {
      console.error('Invalid Mailgun signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Extract email data
    const recipient = formData.get('recipient') as string;
    const sender = formData.get('sender') as string;
    const subject = formData.get('subject') as string;
    const bodyHtml = formData.get('body-html') as string;
    const bodyPlain = formData.get('body-plain') as string;
    const messageId = formData.get('Message-Id') as string;

    if (!recipient) {
      console.error('Missing recipient');
      return NextResponse.json(
        { error: 'Missing recipient' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Find source by intake_email
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id, name, is_active')
      .eq('intake_email', recipient.toLowerCase())
      .single();

    if (sourceError || !source) {
      console.warn(`No source found for recipient: ${recipient}`);
      // Return 200 to acknowledge receipt (don't want Mailgun to retry)
      return NextResponse.json({ received: true, matched: false });
    }

    if (!source.is_active) {
      console.warn(`Source ${source.name} is inactive, skipping`);
      return NextResponse.json({ received: true, matched: false, inactive: true });
    }

    // Check for duplicate by message_id
    if (messageId) {
      const { data: existing } = await supabase
        .from('raw_emails')
        .select('id')
        .eq('message_id', messageId)
        .single();

      if (existing) {
        console.log(`Duplicate email skipped: ${messageId}`);
        // Log duplicate skip
        await supabase.from('ingestion_log').insert({
          source_id: source.id,
          type: 'duplicate_skipped',
          details: { message_id: messageId, reason: 'duplicate_email' },
        });
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    // Queue email for processing
    const { error: insertError } = await supabase.from('raw_emails').insert({
      source_id: source.id,
      recipient: recipient.toLowerCase(),
      sender: sender || '',
      subject: subject || '',
      body_html: bodyHtml || '',
      body_plain: bodyPlain || '',
      message_id: messageId || null,
      processed: false,
    });

    if (insertError) {
      console.error('Failed to queue email:', insertError);
      return NextResponse.json(
        { error: 'Failed to queue email' },
        { status: 500 }
      );
    }

    // Log email receipt
    await supabase.from('ingestion_log').insert({
      source_id: source.id,
      type: 'email_received',
      details: {
        message_id: messageId,
        subject: subject,
        sender: sender,
      },
    });

    return NextResponse.json({ received: true, queued: true });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
