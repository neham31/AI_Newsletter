import React from 'react';
import { render } from '@react-email/render';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getUnsentArticles } from '@/lib/digest/getUnsentArticles';
import { DigestEmail } from '@/emails/DigestEmail';
import { WeeklyDigestEmail } from '@/emails/WeeklyDigestEmail';
import { PreviewFrame } from './PreviewFrame';
import type { GroupedArticles } from '@/lib/digest/getUnsentArticles';
import type { WeeklyTheme } from '@/lib/digest/generateWeeklySummary';

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

const s = {
  page: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f9f9f9', minHeight: '100vh', color: '#222', padding: '24px 16px' } as React.CSSProperties,
  container: { maxWidth: '900px', margin: '0 auto' } as React.CSSProperties,
  h1: { fontSize: '22px', margin: '0 0 4px' } as React.CSSProperties,
  subtitle: { color: '#666', fontSize: '13px', marginBottom: '24px' } as React.CSSProperties,
  section: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', marginBottom: '20px' } as React.CSSProperties,
  h2: { fontSize: '15px', fontWeight: 600, margin: '0 0 16px', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '8px' } as React.CSSProperties,
  form: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, alignItems: 'flex-end' },
  fieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  label: { fontSize: '12px', color: '#555', fontWeight: 500 } as React.CSSProperties,
  input: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '13px', minWidth: '260px' } as React.CSSProperties,
  select: { padding: '7px 10px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '13px', background: '#fff' } as React.CSSProperties,
  btn: { padding: '8px 16px', borderRadius: '5px', border: '1px solid #aac', background: '#e8f0fe', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#224' } as React.CSSProperties,
  meta: { fontSize: '12px', color: '#666', marginBottom: '12px' } as React.CSSProperties,
  msgWarn: { padding: '10px 14px', borderRadius: '5px', marginBottom: '16px', fontSize: '13px', background: '#fff8e1', border: '1px solid #ffe082', color: '#7b5800' } as React.CSSProperties,
  backLink: { fontSize: '13px', color: '#556', textDecoration: 'none', display: 'inline-block', marginBottom: '16px' } as React.CSSProperties,
};

async function getLatestArticles(limit: number): Promise<GroupedArticles[]> {
  const supabase = createServiceRoleClient();
  const { data: articles, error } = await supabase
    .from('articles')
    .select(`
      id,
      headline,
      summary,
      url,
      tags,
      image_url,
      published_at,
      source_id,
      sources!inner ( name )
    `)
    .gte('extraction_confidence', 0.5)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error || !articles) return [];

  const groupedMap = new Map<string, GroupedArticles>();
  for (const a of articles as Array<{
    id: string; headline: string; summary: string; url: string;
    tags: string[]; image_url: string | null; published_at: string;
    source_id: string; sources: { name: string };
  }>) {
    const existing = groupedMap.get(a.source_id);
    const article = {
      id: a.id,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      tags: a.tags || [],
      image_url: a.image_url,
      published_at: a.published_at,
      source_name: a.sources.name,
      source_id: a.source_id,
    };
    if (existing) {
      existing.articles.push(article);
    } else {
      groupedMap.set(a.source_id, {
        source_name: a.sources.name,
        source_id: a.source_id,
        articles: [article],
      });
    }
  }
  return Array.from(groupedMap.values());
}

export default async function PreviewDigestPage({ searchParams }: PageProps) {
  const secret = typeof searchParams.secret === 'string' ? searchParams.secret : '';
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <h1 style={s.h1}>401 Unauthorized</h1>
          <p style={s.subtitle}>
            Missing or invalid admin secret. Provide <code>?secret=YOUR_ADMIN_SECRET</code> in the URL.
          </p>
        </div>
      </div>
    );
  }

  const emailParam = typeof searchParams.email === 'string' ? searchParams.email.trim() : '';
  const frequency = typeof searchParams.frequency === 'string' && searchParams.frequency === 'weekly' ? 'weekly' : 'daily';
  const opsUrl = `/ops?secret=${encodeURIComponent(secret)}`;

  let previewHtml: string | null = null;
  let previewMeta: string | null = null;
  let previewWarning: string | null = null;

  if (emailParam) {
    const supabase = createServiceRoleClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, email, unsubscribe_token, frequency, signed_up_at')
      .eq('email', emailParam)
      .single();

    const unsubToken = user?.unsubscribe_token ?? 'preview-unsub-token';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${unsubToken}`;
    const preferencesUrl = `${appUrl}/preferences?token=${unsubToken}`;

    if (frequency === 'weekly') {
      // For weekly, build a mock theme if no user found, or just show empty state
      let groupedArticles: GroupedArticles[] = [];
      let totalArticles = 0;

      if (user) {
        groupedArticles = await getUnsentArticles(user.id, user.signed_up_at, 50);
        previewMeta = `User found: ${user.email} (subscribed as ${user.frequency}). Showing ${groupedArticles.reduce((sum, g) => sum + g.articles.length, 0)} unsent articles as weekly preview.`;
      } else {
        groupedArticles = await getLatestArticles(50);
        previewWarning = `User "${emailParam}" not found. Showing latest articles from all sources as preview.`;
        previewMeta = `Showing ${groupedArticles.reduce((sum, g) => sum + g.articles.length, 0)} recent articles (no user context).`;
      }

      totalArticles = groupedArticles.reduce((sum, g) => sum + g.articles.length, 0);

      // Build mock weekly themes from sources for preview
      const themes: WeeklyTheme[] = groupedArticles.map(g => ({
        title: g.source_name,
        summary: g.articles.slice(0, 3).map(a => a.headline).join(' · '),
        sources: [g.source_name],
      }));

      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const dateRange = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      previewHtml = await render(
        React.createElement(WeeklyDigestEmail, {
          dateRange,
          articleCount: totalArticles,
          themes,
          unsubscribeUrl,
          preferencesUrl,
        })
      );
    } else {
      // Daily digest preview
      let groupedArticles: GroupedArticles[] = [];

      if (user) {
        groupedArticles = await getUnsentArticles(user.id, user.signed_up_at, 50);
        previewMeta = `User found: ${user.email} (subscribed as ${user.frequency}). Showing ${groupedArticles.reduce((sum, g) => sum + g.articles.length, 0)} unsent articles.`;
      } else {
        groupedArticles = await getLatestArticles(50);
        previewWarning = `User "${emailParam}" not found. Showing latest articles from all sources as preview.`;
        previewMeta = `Showing ${groupedArticles.reduce((sum, g) => sum + g.articles.length, 0)} recent articles (no user context).`;
      }

      const totalArticles = groupedArticles.reduce((sum, g) => sum + g.articles.length, 0);
      const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

      previewHtml = await render(
        React.createElement(DigestEmail, {
          date: dateStr,
          articleCount: totalArticles,
          groupedArticles,
          unsubscribeUrl,
          preferencesUrl,
          keyTakeaways: [],
        })
      );
    }
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <a href={opsUrl} style={s.backLink}>← Back to Ops Dashboard</a>
        <h1 style={s.h1}>Digest Preview</h1>
        <p style={s.subtitle}>Preview the digest email for any subscriber before it sends.</p>

        <div style={s.section}>
          <h2 style={s.h2}>Preview Controls</h2>
          <form method="GET" style={s.form}>
            <input type="hidden" name="secret" value={secret} />
            <div style={s.fieldGroup}>
              <label style={s.label} htmlFor="email">Subscriber Email</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="subscriber@example.com"
                defaultValue={emailParam}
                style={s.input}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label} htmlFor="frequency">Frequency</label>
              <select id="frequency" name="frequency" defaultValue={frequency} style={s.select}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <button type="submit" style={s.btn}>Preview</button>
          </form>
        </div>

        {emailParam && (
          <div style={s.section}>
            <h2 style={s.h2}>
              {frequency === 'weekly' ? 'Weekly Digest Preview' : 'Daily Digest Preview'}
              {emailParam && ` — ${emailParam}`}
            </h2>
            {previewWarning && <div style={s.msgWarn}>{previewWarning}</div>}
            {previewMeta && <p style={s.meta}>{previewMeta}</p>}
            {previewHtml ? (
              <PreviewFrame html={previewHtml} />
            ) : (
              <p style={{ color: '#999', fontSize: '13px' }}>No articles available to preview.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
