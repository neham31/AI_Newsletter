import { NextRequest } from 'next/server';

/**
 * Validates the cron secret to ensure only authorized calls
 * Supports both Authorization: Bearer and x-cron-secret headers
 */
export function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON AUTH] CRON_SECRET not configured in environment');
    return false;
  }

  // Check Authorization: Bearer header (Vercel cron standard)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    console.log('[CRON AUTH] Validated via Authorization header');
    return true;
  }

  // Check x-cron-secret header (alternative)
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    console.log('[CRON AUTH] Validated via x-cron-secret header');
    return true;
  }

  // Debug: log what we received vs expected (partial for security)
  console.error('[CRON AUTH] Failed validation', {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.slice(0, 20),
    hasCronHeader: !!cronHeader,
    cronHeaderPrefix: cronHeader?.slice(0, 8),
    expectedSecretPrefix: cronSecret.slice(0, 8),
  });

  return false;
}
