import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getUnsentArticles } from '@/lib/digest/getUnsentArticles';
import { sendDigest } from '@/lib/digest/sendDigest';
import { generateTLDR } from '@/lib/digest/generateTLDR';
import { generateWeeklySummary } from '@/lib/digest/generateWeeklySummary';
import type { Frequency } from '@/types/database';

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret') ?? '';
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const toEmail = (formData.get('email') as string | null)?.trim() ?? '';
  const frequency = (formData.get('frequency') as string | null) ?? 'weekly';

  if (!toEmail) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (frequency !== 'daily' && frequency !== 'weekly') {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Find the user to get their subscriptions and unsubscribe token
  const { data: user } = await supabase
    .from('users')
    .select('id, unsubscribe_token, signed_up_at')
    .eq('email', toEmail.toLowerCase())
    .single();

  // If user not found, pick any active verified user's subscriptions as fallback
  let userId: string;
  let unsubscribeToken: string;
  let signedUpAt: string;

  if (user) {
    userId = user.id;
    unsubscribeToken = user.unsubscribe_token;
    signedUpAt = user.signed_up_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  } else {
    // Fallback: use first active verified user's subscriptions
    const { data: fallbackUser } = await supabase
      .from('users')
      .select('id, unsubscribe_token, signed_up_at')
      .eq('is_active', true)
      .eq('email_verified', true)
      .limit(1)
      .single();

    if (!fallbackUser) {
      return NextResponse.json({ error: 'No active users found to source articles from' }, { status: 404 });
    }

    userId = fallbackUser.id;
    unsubscribeToken = fallbackUser.unsubscribe_token;
    signedUpAt = fallbackUser.signed_up_at ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const groupedArticles = await getUnsentArticles(userId, signedUpAt, 50);

  if (groupedArticles.length === 0 || groupedArticles.reduce((s, g) => s + g.articles.length, 0) === 0) {
    // If no unsent articles, fetch the latest 50 articles regardless of sent status
    const { data: latestArticles } = await supabase
      .from('articles')
      .select(`id, headline, summary, url, tags, image_url, published_at, source_id, sources!inner(name)`)
      .gte('extraction_confidence', 0.5)
      .order('published_at', { ascending: false })
      .limit(50);

    if (!latestArticles || latestArticles.length === 0) {
      return NextResponse.json({ error: 'No articles available to send' }, { status: 404 });
    }

    const articles = latestArticles.map((a: {
      id: string; headline: string; summary: string; url: string;
      tags: string[]; image_url: string | null; published_at: string;
      source_id: string; sources: { name: string };
    }) => ({
      id: a.id, headline: a.headline, summary: a.summary, url: a.url,
      tags: a.tags || [], image_url: a.image_url, published_at: a.published_at,
      source_name: a.sources.name, source_id: a.source_id,
    }));

    const groupMap = new Map<string, { source_name: string; source_id: string; articles: typeof articles }>();
    for (const a of articles) {
      const g = groupMap.get(a.source_id);
      if (g) { g.articles.push(a); } else { groupMap.set(a.source_id, { source_name: a.source_name, source_id: a.source_id, articles: [a] }); }
    }
    const fallbackGroups = Array.from(groupMap.values());

    let result;
    if (frequency === 'weekly') {
      const articlesForSummary = articles.map((a: { headline: string; summary: string; source_name: string }) => ({ headline: a.headline, summary: a.summary, source_name: a.source_name }));
      const summary = await generateWeeklySummary(articlesForSummary);
      const dateRange = `Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
      result = await sendDigest(toEmail, unsubscribeToken, fallbackGroups, [], 'weekly' as Frequency, summary.themes, dateRange);
    } else {
      const takeaways = await generateTLDR(articles.slice(0, 30).map((a: { headline: string; summary: string }) => ({ headline: a.headline, summary: a.summary })));
      result = await sendDigest(toEmail, unsubscribeToken, fallbackGroups, takeaways, 'daily' as Frequency);
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? 'Failed to send' }, { status: 500 });
    }

    const redirectUrl = new URL('/ops', getBaseUrl(request));
    redirectUrl.searchParams.set('secret', secret);
    redirectUrl.searchParams.set('msg', `Test ${frequency} digest sent to ${toEmail} (using latest articles)`);
    return NextResponse.redirect(redirectUrl, 303);
  }

  // Send with actual unsent articles
  let result;
  if (frequency === 'weekly') {
    const allArticles = groupedArticles.flatMap(g => g.articles);
    const articlesForSummary = allArticles.map(a => ({ headline: a.headline, summary: a.summary, source_name: a.source_name }));
    const summary = await generateWeeklySummary(articlesForSummary);
    const dateRange = `Week of ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
    result = await sendDigest(toEmail, unsubscribeToken, groupedArticles, [], 'weekly' as Frequency, summary.themes, dateRange);
  } else {
    const allArticles = groupedArticles.flatMap(g => g.articles);
    const takeaways = await generateTLDR(allArticles.slice(0, 30).map(a => ({ headline: a.headline, summary: a.summary })));
    result = await sendDigest(toEmail, unsubscribeToken, groupedArticles, takeaways, 'daily' as Frequency);
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Failed to send' }, { status: 500 });
  }

  const redirectUrl = new URL('/ops', getBaseUrl(request));
  redirectUrl.searchParams.set('secret', secret);
  redirectUrl.searchParams.set('msg', `Test ${frequency} digest sent to ${toEmail}`);
  return NextResponse.redirect(redirectUrl, 303);
}
