import { createServiceRoleClient } from '@/lib/supabase/server';
import { getUnsentArticles } from '@/lib/digest/getUnsentArticles';
import { sendDigest } from '@/lib/digest/sendDigest';
import { generateTLDR } from '@/lib/digest/generateTLDR';
import { generateWeeklySummary } from '@/lib/digest/generateWeeklySummary';
import type { WeeklyTheme } from '@/lib/digest/generateWeeklySummary';
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
 * Returns the ISO week number for a given date as a zero-padded string.
 * Cache key format: YYYY-WW (e.g. 2026-14)
 */
function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  const year = d.getFullYear();
  return `${year}-${String(weekNum).padStart(2, '0')}`;
}

/**
 * Returns the Monday of the current week formatted as "Week of Month Day"
 */
function getWeekDateRange(date: Date): string {
  const d = new Date(date);
  // Get Monday of this week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `Week of ${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
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

  // Idempotency: skip users already sent a digest within the window.
  // Daily = 20h window, weekly = 144h (6 days) window.
  // Prevents double-sends when GitHub Actions and Vercel crons overlap.
  const idempotencyHours = frequency === 'weekly' ? 144 : 20;
  const cutoff = new Date(Date.now() - idempotencyHours * 60 * 60 * 1000).toISOString();

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, unsubscribe_token, signed_up_at')
    .eq('is_active', true)
    .eq('email_verified', true)
    .eq('frequency', frequency)
    .or(`last_email_sent_at.is.null,last_email_sent_at.lt.${cutoff}`)
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

  const today = new Date();

  // --- Weekly digest: generate thematic summary cached by ISO week ---
  if (frequency === 'weekly') {
    const weekKey = getISOWeekKey(today);
    const cacheKey = `weekly-${weekKey}`;
    const dateRange = getWeekDateRange(today);

    let weeklyThemes: WeeklyTheme[] = [];

    const { data: cachedEntry } = await supabase
      .from('digest_cache')
      .select('themes')
      .eq('cache_key', cacheKey)
      .single();

    if (cachedEntry?.themes) {
      weeklyThemes = cachedEntry.themes as WeeklyTheme[];
    } else {
      // Fetch the past 7 days of articles for theme generation
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString();

      const { data: weekArticles } = await supabase
        .from('articles')
        .select(`
          headline,
          summary,
          sources!inner (
            name
          )
        `)
        .gte('ingested_at', weekAgoStr)
        .order('ingested_at', { ascending: false })
        .limit(60);

      if (weekArticles && weekArticles.length > 0) {
        const articlesForSummary = weekArticles.map(
          (a: { headline: string; summary: string; sources: { name: string } }) => ({
            headline: a.headline,
            summary: a.summary,
            source_name: a.sources.name,
          })
        );

        const summary = await generateWeeklySummary(articlesForSummary);
        weeklyThemes = summary.themes;

        await supabase.from('digest_cache').insert({
          cache_key: cacheKey,
          takeaways: [],
          themes: weeklyThemes,
        });
      }
    }

    // Process weekly users
    for (const user of users) {
      result.usersProcessed++;

      try {
        const groupedArticles = await getUnsentArticles(
          user.id,
          user.signed_up_at || user.id,
          40
        );

        const totalArticles = groupedArticles.reduce(
          (sum, group) => sum + group.articles.length,
          0
        );

        if (totalArticles === 0) {
          result.skippedNoArticles++;
          continue;
        }

        const sendResult = await sendDigest(
          user.email,
          user.unsubscribe_token,
          groupedArticles,
          [],
          'weekly',
          weeklyThemes,
          dateRange
        );

        if (!sendResult.success) {
          console.error(`Failed to send weekly digest to ${user.email}:`, sendResult.error);
          result.errors++;
          continue;
        }

        result.emailsSent++;
        result.articlesIncluded += totalArticles;

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
        }

        await supabase
          .from('users')
          .update({ last_email_sent_at: new Date().toISOString() })
          .eq('id', user.id);

        await delay(100);
      } catch (error) {
        console.error(`Error processing weekly digest for ${user.email}:`, error);
        result.errors++;
      }
    }

    return result;
  }

  // --- Daily digest: generate TLDR cached by date ---
  const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const cacheKey = `${todayStr}-${frequency}`;

  let batchTakeaways: string[] = [];

  const { data: cachedEntry } = await supabase
    .from('digest_cache')
    .select('takeaways')
    .eq('cache_key', cacheKey)
    .single();

  if (cachedEntry) {
    batchTakeaways = cachedEntry.takeaways;
  } else {
    const { data: todayArticles } = await supabase
      .from('articles')
      .select('headline, summary')
      .gte('ingested_at', `${todayStr}T00:00:00Z`)
      .order('ingested_at', { ascending: false })
      .limit(30);

    if (todayArticles && todayArticles.length > 0) {
      batchTakeaways = await generateTLDR(todayArticles);

      await supabase
        .from('digest_cache')
        .insert({ cache_key: cacheKey, takeaways: batchTakeaways });
    }
  }

  // Process daily users with rate limiting (10 emails/second = 100ms between emails)
  for (const user of users) {
    result.usersProcessed++;

    try {
      const groupedArticles = await getUnsentArticles(
        user.id,
        user.signed_up_at || user.id,
        20
      );

      const totalArticles = groupedArticles.reduce(
        (sum, group) => sum + group.articles.length,
        0
      );

      if (totalArticles === 0) {
        result.skippedNoArticles++;
        continue;
      }

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
      }

      await supabase
        .from('users')
        .update({ last_email_sent_at: new Date().toISOString() })
        .eq('id', user.id);

      await delay(100);
    } catch (error) {
      console.error(`Error processing digest for ${user.email}:`, error);
      result.errors++;
    }
  }

  return result;
}
