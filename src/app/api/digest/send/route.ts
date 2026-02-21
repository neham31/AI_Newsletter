import { NextRequest, NextResponse } from 'next/server';
import { sendDigests } from '@/lib/jobs/sendDigests';
import type { Frequency } from '@/types/database';
import { validateCronSecret } from '@/lib/auth/cron';

/**
 * POST /api/digest/send
 * Cron endpoint to send digest emails
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

    // Get frequency from query params
    const { searchParams } = new URL(request.url);
    const frequencyParam = searchParams.get('frequency');

    if (!frequencyParam || (frequencyParam !== 'daily' && frequencyParam !== 'weekly')) {
      return NextResponse.json(
        { error: 'Invalid or missing frequency parameter. Must be "daily" or "weekly".' },
        { status: 400 }
      );
    }

    const frequency: Frequency = frequencyParam;

    // Optional batch size
    const batchSizeParam = searchParams.get('batchSize');
    const batchSize = batchSizeParam ? parseInt(batchSizeParam, 10) : 50;

    // Send digests
    const result = await sendDigests(frequency, batchSize);

    return NextResponse.json({
      success: true,
      frequency,
      ...result,
    });
  } catch (error) {
    console.error('Error in digest/send cron:', error);
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
