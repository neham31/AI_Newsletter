import { createServiceRoleClient } from '@/lib/supabase/server';
import { getUnsentArticles } from '@/lib/digest/getUnsentArticles';
import { sendDigest } from '@/lib/digest/sendDigest';
import { generateTLDR } from '@/lib/digest/generateTLDR';
import type { Frequency } from '@/types/database';

/**
 * Result of the digest sending job
 */
export interface SendDigestsResult {
  usersProcessed: number;
  emailsSent: number;
  articlesIncluded: number;
  skippedNoArticles: number;
  errors: number;
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends digest emails to all eligible users
 *
 * @param frequency - 'daily' or 'weekly'
 * @param batchSize - Number of users to process per batch (default 50)
 * @returns SendDigestsResult - Statistics about the job
 */
export async function sendDigests(
  frequency: Frequency,
  batchSize: number = 50
): Promise<SendDigestsResult> {
  const result: SendDigestsResult = {
    usersProcessed: 0,
    emailsSent: 0,
    articlesIncluded: 0,
    skippedNoArticles: 0,
    errors: 0,
  };

  const supabase = createServiceRoleClient();

  // Fetch eligible users
  // Users who are:
  // 1. Active
  // 2. Email verified
  // 3. Match the requested frequency
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, unsubscribe_token, signed_up_at')
    .eq('is_active', true)
    .eq('email_verified', true)
    .eq('frequency', frequency)
    .limit(batchSize);

  if (usersError) {
    console.error('Failed to fetch users:', usersError);
    return result;
  }

  if (!users || users.length === 0) {
    console.log(`No users found for ${frequency} digest`);
    return result;
  }

  // Generate a batch ID for this run (UUID format)
  const batchId = crypto.randomUUID();

  // Generate TLDR once for the whole batch (cached by date+frequency)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cacheKey = `${today}-${frequency}`;

  let batchTakeaways: string[] = [];

  const { data: cachedEntry } = await supabase
    .from('digest_cache')
    .select('takeaways')
    .eq('cache_key', cacheKey)
    .single();

  if (cachedEntry) {
    batchTakeaways = cachedEntry.takeaways;
  } else {
    // Fetch a sample of today's articles for TLDR generation
    const { data: todayArticles } = await supabase
      .from('articles')
      .select('headline, summary')
      .gte('ingested_at', `${today}T00:00:00Z`)
      .order('ingested_at', { ascending: false })
      .limit(30);

    if (todayArticles && todayArticles.length > 0) {
      batchTakeaways = await generateTLDR(todayArticles);

      await supabase
        .from('digest_cache')
        .insert({ cache_key: cacheKey, takeaways: batchTakeaways });
    }
  }

  // Process users with rate limiting (10 emails/second = 100ms between emails)
  for (const user of users) {
    result.usersProcessed++;

    try {
      // Get unsent articles for this user
      const groupedArticles = await getUnsentArticles(
        user.id,
        user.signed_up_at || user.id, // Use signed_up_at or fall back to ID creation time
        20
      );

      // Calculate total articles
      const totalArticles = groupedArticles.reduce(
        (sum, group) => sum + group.articles.length,
        0
      );

      if (totalArticles === 0) {
        result.skippedNoArticles++;
        continue;
      }

      // Send the digest
      const sendResult = await sendDigest(
        user.email,
        user.unsubscribe_token,
        groupedArticles,
        batchTakeaways
      );

      if (!sendResult.success) {
        console.error(`Failed to send digest to ${user.email}:`, sendResult.error);
        result.errors++;
        continue;
      }

      result.emailsSent++;
      result.articlesIncluded += totalArticles;

      // Log sent articles to prevent re-sending
      const articleIds = groupedArticles.flatMap((g) =>
        g.articles.map((a) => a.id)
      );

      const articleLogEntries = articleIds.map((articleId) => ({
        user_id: user.id,
        article_id: articleId,
        sent_at: new Date().toISOString(),
        digest_batch_id: batchId,
      }));

      const { error: logError } = await supabase
        .from('user_article_log')
        .insert(articleLogEntries);

      if (logError) {
        console.error(`Failed to log sent articles for ${user.email}:`, logError);
        // Don't count as error since email was sent successfully
      }

      // Update user's last_email_sent_at
      await supabase
        .from('users')
        .update({ last_email_sent_at: new Date().toISOString() })
        .eq('id', user.id);

      // Rate limit: 100ms delay between emails (10 emails/second)
      await delay(100);
    } catch (error) {
      console.error(`Error processing digest for ${user.email}:`, error);
      result.errors++;
    }
  }

  return result;
}
