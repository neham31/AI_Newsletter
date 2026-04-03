import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret') ?? '';
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const secret = querySecret || bearerSecret;

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Delete ingestion_log older than 90 days
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: ingestionDeleted, error: ingestionError } = await supabase
    .from('ingestion_log')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff90);

  if (ingestionError) {
    return NextResponse.json({ error: ingestionError.message }, { status: 500 });
  }

  // Delete articles older than 180 days not sent to any user in the past 180 days
  const cutoff180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch article IDs to protect (sent within past 180 days)
  const { data: protectedArticles } = await supabase
    .from('user_article_log')
    .select('article_id')
    .gte('sent_at', cutoff180);

  const protectedIds = (protectedArticles ?? []).map((r: { article_id: string }) => r.article_id);

  // Build delete query, excluding protected article IDs
  const baseQuery = supabase
    .from('articles')
    .delete({ count: 'exact' })
    .lt('ingested_at', cutoff180);

  const articlesQuery = protectedIds.length > 0
    ? baseQuery.not('id', 'in', `(${protectedIds.join(',')})`)
    : baseQuery;

  const { count: articlesDeleted, error: articlesError } = await articlesQuery;

  if (articlesError) {
    return NextResponse.json({ error: articlesError.message }, { status: 500 });
  }

  return NextResponse.json({
    ingestion_log_deleted: ingestionDeleted ?? 0,
    articles_deleted: articlesDeleted ?? 0,
  });
}
