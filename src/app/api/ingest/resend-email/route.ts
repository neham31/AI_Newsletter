import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Resend webhook payload wrapper
 * @see https://resend.com/docs/dashboard/webhooks/event-types#email-received
 */
interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    message_id?: string;
    created_at: string;
    // Inbound email content fields
    html?: string;
    text?: string;
  };
}

/**
 * Fetch email content from Resend API
 * For inbound emails, content must be fetched via API - it's not in the webhook payload
 */
async function fetchEmailContent(emailId: string): Promise<{ html: string; text: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[RESEND WEBHOOK] RESEND_API_KEY not configured');
    return { html: '', text: '' };
  }

  try {
    console.log(`[RESEND WEBHOOK] Fetching content for email: ${emailId}`);
    const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log(`[RESEND WEBHOOK] API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[RESEND WEBHOOK] Failed to fetch email content: ${response.status} - ${errorText}`);
      return { html: '', text: '' };
    }

    const data = await response.json();
    console.log(`[RESEND WEBHOOK] API response keys: ${Object.keys(data).join(', ')}`);

    return {
      html: data.html || data.body || '',
      text: data.text || '',
    };
  } catch (error) {
    console.error('[RESEND WEBHOOK] Error fetching email content:', error);
    return { html: '', text: '' };
  }
}

/**
 * POST /api/ingest/resend-email
 * Resend inbound webhook endpoint for receiving newsletter emails
 */
export async function POST(request: NextRequest) {
  try {
    // Parse JSON body (Resend sends application/json)
    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      console.error('[RESEND WEBHOOK] Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Log the entire raw payload for debugging
    console.log('[RESEND WEBHOOK] Raw payload:', JSON.stringify(rawPayload, null, 2));

    const payload = rawPayload as ResendWebhookPayload;

    // Log the webhook type for debugging
    console.log(`[RESEND WEBHOOK] Received event type: ${payload?.type}`);

    // Only process email.received events
    if (payload.type !== 'email.received') {
      console.log(`[RESEND WEBHOOK] Ignoring event type: ${payload.type}`);
      return NextResponse.json({ received: true, ignored: true });
    }

    const { data } = payload;
    if (!data) {
      console.error('[RESEND WEBHOOK] Missing data in payload');
      return NextResponse.json(
        { error: 'Missing data in payload' },
        { status: 400 }
      );
    }

    const { email_id, from, to, subject, message_id } = data;

    // Get recipient (first in array)
    const recipient: string | undefined = Array.isArray(to) ? to[0] : to;

    if (!recipient) {
      console.error('[RESEND WEBHOOK] Missing recipient');
      return NextResponse.json(
        { error: 'Missing recipient' },
        { status: 400 }
      );
    }

    console.log(`[RESEND WEBHOOK] Processing email to: ${recipient}, from: ${from}, subject: ${subject}`);

    const supabase = createServiceRoleClient();

    // Find source by intake_email
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id, name, is_active')
      .eq('intake_email', recipient.toLowerCase())
      .single();

    if (sourceError || !source) {
      console.warn(`[RESEND WEBHOOK] No source found for recipient: ${recipient}`);
      // Return 200 to acknowledge receipt
      return NextResponse.json({ received: true, matched: false });
    }

    if (!source.is_active) {
      console.warn(`[RESEND WEBHOOK] Source ${source.name} is inactive, skipping`);
      return NextResponse.json({ received: true, matched: false, inactive: true });
    }

    // Check for duplicate by message_id
    if (message_id) {
      const { data: existing } = await supabase
        .from('raw_emails')
        .select('id')
        .eq('message_id', message_id)
        .single();

      if (existing) {
        console.log(`[RESEND WEBHOOK] Duplicate email skipped: ${message_id}`);
        await supabase.from('ingestion_log').insert({
          source_id: source.id,
          type: 'duplicate_skipped',
          details: { message_id: message_id, reason: 'duplicate_email' },
        });
        return NextResponse.json({ received: true, duplicate: true });
      }
    }

    // Fetch email content from Resend API (not included in webhook payload)
    const emailContent = await fetchEmailContent(email_id);
    console.log(`[RESEND WEBHOOK] Content fetched - HTML: ${emailContent.html.length} chars, Text: ${emailContent.text.length} chars`);

    // Queue email for processing
    const { error: insertError } = await supabase.from('raw_emails').insert({
      source_id: source.id,
      recipient: recipient.toLowerCase(),
      sender: from || '',
      subject: subject || '',
      body_html: emailContent.html,
      body_plain: emailContent.text,
      message_id: message_id || null,
      processed: false,
    });

    if (insertError) {
      console.error('[RESEND WEBHOOK] Failed to queue email:', insertError);
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
        message_id: message_id,
        subject: subject,
        sender: from,
      },
    });

    console.log(`[RESEND WEBHOOK] Email queued from ${from} for source ${source.name}`);
    return NextResponse.json({ received: true, queued: true });
  } catch (error) {
    console.error('[RESEND WEBHOOK] Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
