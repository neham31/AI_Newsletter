import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Article with source information for digest assembly
 */
export interface DigestArticle {
  id: string;
  headline: string;
  summary: string;
  url: string;
  tags: string[];
  image_url: string | null;
  published_at: string;
  source_name: string;
  source_id: string;
}

/**
 * Articles grouped by source for digest display
 */
export interface GroupedArticles {
  source_name: string;
  source_id: string;
  articles: DigestArticle[];
}

/**
 * Gets unsent articles for a user, grouped by source
 *
 * @param userId - The user's ID
 * @param signedUpAt - The user's signup date (don't include articles before this)
 * @param limit - Maximum total articles to return (default 50)
 * @returns Articles grouped by source, ready for digest assembly
 */
export async function getUnsentArticles(
  userId: string,
  signedUpAt: string,
  limit: number = 50
): Promise<GroupedArticles[]> {
  const supabase = createServiceRoleClient();

  // Get user's subscribed source IDs
  const { data: subscriptions, error: subError } = await supabase
    .from('user_subscriptions')
    .select('source_id')
    .eq('user_id', userId);

  console.log('[getUnsentArticles] userId:', userId, 'signedUpAt:', signedUpAt);
  console.log('[getUnsentArticles] subscriptions:', subscriptions?.length || 0, subError ? `error: ${subError.message}` : '');

  if (subError || !subscriptions || subscriptions.length === 0) {
    return [];
  }

  const subscribedSourceIds = subscriptions.map(
    (s: { source_id: string }) => s.source_id
  );
  console.log('[getUnsentArticles] sourceIds:', subscribedSourceIds);

  // Get articles that:
  // 1. Are from subscribed sources
  // 2. Were published after user signed up
  // 3. Have not been sent to this user
  // 4. Have confidence >= 0.5
  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select(
      `
      id,
      headline,
      summary,
      url,
      tags,
      image_url,
      published_at,
      source_id,
      sources!inner (
        name
      )
    `
    )
    .in('source_id', subscribedSourceIds)
    .gte('published_at', signedUpAt)
    .gte('extraction_confidence', 0.5)
    .order('published_at', { ascending: false })
    .limit(limit * 2); // Fetch extra in case some are already sent

  console.log('[getUnsentArticles] articles found:', articles?.length || 0, articlesError ? `error: ${articlesError.message}` : '');

  if (articlesError || !articles) {
    console.error('Failed to fetch articles:', articlesError);
    return [];
  }

  // Get IDs of articles already sent to this user
  const articleIds = articles.map((a: { id: string }) => a.id);
  const { data: sentArticles } = await supabase
    .from('user_article_log')
    .select('article_id')
    .eq('user_id', userId)
    .in('article_id', articleIds);

  const sentArticleIds = new Set(
    (sentArticles || []).map((s: { article_id: string }) => s.article_id)
  );

  // Filter out sent articles and transform
  const unsentArticles: DigestArticle[] = articles
    .filter((a: { id: string }) => !sentArticleIds.has(a.id))
    .slice(0, limit)
    .map(
      (a: {
        id: string;
        headline: string;
        summary: string;
        url: string;
        tags: string[];
        image_url: string | null;
        published_at: string;
        source_id: string;
        sources: { name: string };
      }) => ({
        id: a.id,
        headline: a.headline,
        summary: a.summary,
        url: a.url,
        tags: a.tags || [],
        image_url: a.image_url,
        published_at: a.published_at,
        source_name: a.sources.name,
        source_id: a.source_id,
      })
    );

  // Group by source
  const groupedMap = new Map<string, GroupedArticles>();

  for (const article of unsentArticles) {
    const existing = groupedMap.get(article.source_id);
    if (existing) {
      existing.articles.push(article);
    } else {
      groupedMap.set(article.source_id, {
        source_name: article.source_name,
        source_id: article.source_id,
        articles: [article],
      });
    }
  }

  return Array.from(groupedMap.values());
}
