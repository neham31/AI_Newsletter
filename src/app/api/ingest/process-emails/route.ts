import { NextRequest, NextResponse } from 'next/server';
import { processEmails } from '@/lib/jobs/processEmails';

/**
 * Validates the cron secret to ensure only authorized calls
 */
function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  // Check authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Also check x-cron-secret header (Vercel cron)
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * POST /api/ingest/process-emails
 * Cron endpoint to process queued raw emails
 * Validates CRON_SECRET header before processing
 */
export async function POST(request: NextRequest) {
  try {
    // Validate cron secret
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get optional limit from query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Process emails
    const result = await processEmails(limit);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error in process-emails cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
