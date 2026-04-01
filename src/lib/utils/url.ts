import { createHash } from 'crypto';

/**
 * Parameters to strip from URLs during normalization
 * These are common tracking parameters that don't affect content
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  'ref',
  'source',
  'mc_cid',
  'mc_eid',
  'fbclid',
  'gclid',
  'msclkid',
  '_ga',
  '_gl',
];

/**
 * Normalizes a URL for deduplication purposes
 *
 * Operations:
 * - Lowercases the hostname only (path/query/fragment case is preserved)
 * - Removes www. prefix from hostname
 * - Removes trailing slashes from pathname
 * - Removes URL fragments (#section)
 * - Removes tracking query parameters (utm_*, ref, source, mc_cid, mc_eid, etc.)
 * - Sorts remaining query parameters for consistency
 *
 * @param url - The URL to normalize
 * @returns The normalized URL string
 */
export function normalizeUrl(url: string): string {
  try {
    // Parse the URL (preserve original case for path/query/fragment)
    const parsed = new URL(url);

    // Only lowercase the hostname (paths may contain case-sensitive tokens)
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove www. prefix from hostname
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.slice(4);
    }

    // Remove trailing slashes from pathname (but keep root /)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Remove URL fragment
    parsed.hash = '';

    // Remove tracking parameters (case-insensitive matching)
    const searchParams = new URLSearchParams(parsed.search);
    const keysToDelete: string[] = [];
    searchParams.forEach((_, key) => {
      const keyLower = key.toLowerCase();
      if (keyLower.startsWith('utm_') || TRACKING_PARAMS.includes(keyLower)) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      searchParams.delete(key);
    }

    // Sort remaining parameters for consistency
    searchParams.sort();

    // Rebuild the URL
    parsed.search = searchParams.toString();

    return parsed.toString();
  } catch {
    // If URL parsing fails, return the original unchanged
    return url;
  }
}

/**
 * Generates a SHA-256 hash of a normalized URL
 *
 * This is used for efficient deduplication in the database.
 * The URL should be normalized before hashing for consistent results.
 *
 * @param url - The URL to hash (will be normalized first)
 * @returns A SHA-256 hash as a lowercase hex string
 */
export function hashUrl(url: string): string {
  const normalized = normalizeUrl(url);
  return createHash('sha256').update(normalized).digest('hex');
}
