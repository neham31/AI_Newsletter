import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Resend inbound email webhook payload
 * @see https://resend.com/docs/dashboard/webhooks/event-types#email-received
 */
interface ResendInboundPayload {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Array<{ name: string; value: string }>;
}

/**
 * Extract Message-ID from headers array
 */
function getMessageId(headers?: Array<{ name: string; value: string }>): string | null {
  if (!headers) return null;
  const messageIdHeader = headers.find(
    (h) => h.name.toLowerCase() === 'message-id'
  );
  return messageIdHeader?.value || null;
}

/**
 * POST /api/ingest/resend-email
 * Resend inbound webhook endpoint for receiving newsletter emails
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body (Resend sends application/json)
    let payload: ResendInboundPayload;
    try {
      payload = await request.json();
    } catch {
      console.error('Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { from, to, subject, html, text, headers } = payload;

    // Get recipient (can be string or array)
    const recipient = Array.isArray(to) ? to[0] : to;

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
      // Return 200 to acknowledge receipt
      return NextResponse.json({ received: true, matched: false });
    }

    if (!source.is_active) {
      console.warn(`Source ${source.name} is inactive, skipping`);
      return NextResponse.json({ received: true, matched: false, inactive: true });
    }

    // Check for duplicate by message_id
    const messageId = getMessageId(headers);
    if (messageId) {
      const { data: existing } = await supabase
        .from('raw_emails')
        .select('id')
        .eq('message_id', messageId)
        .single();

      if (existing) {
        console.log(`Duplicate email skipped: ${messageId}`);
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
      sender: from || '',
      subject: subject || '',
      body_html: html || '',
      body_plain: text || '',
      message_id: messageId,
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
        sender: from,
      },
    });

    console.log(`Email queued from ${from} for source ${source.name}`);
    return NextResponse.json({ received: true, queued: true });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
