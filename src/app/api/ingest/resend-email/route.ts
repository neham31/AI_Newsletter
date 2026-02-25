import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ingest/resend-email
 * DEBUG VERSION - Returns raw payload to verify deployment
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

    // DEBUG: Return raw payload immediately to verify code deployment
    return NextResponse.json({
      debug: 'resend-email-route-v2',
      received: rawPayload
    });
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
