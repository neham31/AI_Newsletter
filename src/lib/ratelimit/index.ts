import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Creates an Upstash Redis client
 * Returns null if environment variables are not configured
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

/**
 * Rate limiter for subscribe endpoint
 * Limits to 5 requests per IP per minute
 * Returns null if Redis is not configured (rate limiting disabled)
 */
export function createSubscribeRateLimiter(): Ratelimit | null {
  const redis = createRedisClient();

  if (!redis) {
    console.warn('Rate limiting disabled: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured');
    return null;
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute
    analytics: true,
    prefix: 'ratelimit:subscribe',
  });
}

/**
 * Gets the client IP from a request
 * Checks common headers for proxied requests
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For header (most common for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback to a generic identifier
  return 'unknown';
}

/**
 * Result of rate limit check
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Checks rate limit for a given identifier
 * Returns success=true if under limit, success=false if exceeded
 */
export async function checkRateLimit(
  rateLimiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitResult> {
  if (!rateLimiter) {
    // Rate limiting disabled, allow all requests
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }

  const result = await rateLimiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
