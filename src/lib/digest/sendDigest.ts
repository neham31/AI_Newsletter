import { sendEmail } from '@/lib/email/resend';
import { DigestEmail } from '@/emails/DigestEmail';
import { WeeklyDigestEmail } from '@/emails/WeeklyDigestEmail';
import type { GroupedArticles } from './getUnsentArticles';
import type { WeeklyTheme } from './generateWeeklySummary';

/**
 * Result of sending a digest email
 */
export interface SendDigestResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Sends a digest email to a user.
 * For daily frequency, sends DigestEmail with key takeaways.
 * For weekly frequency, sends WeeklyDigestEmail with thematic summaries.
 *
 * @param userEmail - The user's email address
 * @param unsubscribeToken - The user's unsubscribe token for footer links
 * @param groupedArticles - Articles grouped by source
 * @param keyTakeaways - Daily TLDR takeaways (used for daily digest)
 * @param frequency - 'daily' or 'weekly' (default 'daily')
 * @param weeklyThemes - Weekly thematic summaries (used for weekly digest)
 * @param weeklyDateRange - Date range string for weekly email header (e.g. 'Week of March 31')
 * @returns SendDigestResult - Result of the send operation
 */
export async function sendDigest(
  userEmail: string,
  unsubscribeToken: string,
  groupedArticles: GroupedArticles[],
  keyTakeaways: string[] = [],
  frequency: 'daily' | 'weekly' = 'daily',
  weeklyThemes: WeeklyTheme[] = [],
  weeklyDateRange?: string
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

  // Build URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
  const preferencesUrl = `${baseUrl}/preferences?token=${encodeURIComponent(unsubscribeToken)}`;

  const today = new Date();

  if (frequency === 'weekly') {
    const dateRange = weeklyDateRange ?? `Week of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    const subject = `Your explAI.in Weekly Summary — ${dateRange} (${articleCount} ${articleCount === 1 ? 'story' : 'stories'} reviewed)`;

    const result = await sendEmail({
      to: userEmail,
      subject,
      react: WeeklyDigestEmail({
        dateRange,
        articleCount,
        themes: weeklyThemes,
        unsubscribeUrl,
        preferencesUrl,
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

  // Daily digest
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Your explAI.in Digest - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${articleCount} ${articleCount === 1 ? 'story' : 'stories'})`;

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
