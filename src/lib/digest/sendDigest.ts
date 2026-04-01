import { sendEmail } from '@/lib/email/resend';
import { DigestEmail } from '@/emails/DigestEmail';
import type { GroupedArticles } from './getUnsentArticles';

/**
 * Result of sending a digest email
 */
export interface SendDigestResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Sends a digest email to a user
 *
 * @param userEmail - The user's email address
 * @param unsubscribeToken - The user's unsubscribe token for footer links
 * @param groupedArticles - Articles grouped by source
 * @returns SendDigestResult - Result of the send operation
 */
export async function sendDigest(
  userEmail: string,
  unsubscribeToken: string,
  groupedArticles: GroupedArticles[],
  keyTakeaways: string[] = []
): Promise<SendDigestResult> {
  // Calculate total article count
  const articleCount = groupedArticles.reduce(
    (sum, group) => sum + group.articles.length,
    0
  );

  if (articleCount === 0) {
    return {
      success: true,
      // No email sent, but not an error
    };
  }

  // Format date for display
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const preferencesUrl = `${baseUrl}/preferences?token=${encodeURIComponent(unsubscribeToken)}`;

  // Build subject line
  const subject = `Your explAI.in Digest - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${articleCount} ${articleCount === 1 ? 'story' : 'stories'})`;

  // Send email
  const result = await sendEmail({
    to: userEmail,
    subject,
    react: DigestEmail({
      date: dateStr,
      articleCount,
      groupedArticles,
      unsubscribeUrl,
      preferencesUrl,
      keyTakeaways,
    }),
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  return {
    success: result.success,
    emailId: result.id,
    error: result.error,
  };
}
