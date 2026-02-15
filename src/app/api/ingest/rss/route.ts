import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchFeed } from '@/lib/rss/parser';
import { normalizeUrl, hashUrl } from '@/lib/utils/url';

/**
 * Validates the cron secret to ensure only authorized calls
 */
function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * POST /api/ingest/rss
 * Cron endpoint to poll RSS feeds for blog sources
 * Validates CRON_SECRET header before processing
 */
export async function POST(request: NextRequest) {
  try {
    // Validate cron secret
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // Fetch all active blog sources with feed URLs
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('id, name, feed_url')
      .eq('is_active', true)
      .eq('type', 'blog')
      .not('feed_url', 'is', null);

    if (sourcesError) {
      console.error('Failed to fetch sources:', sourcesError);
      return NextResponse.json(
        { error: 'Failed to fetch sources' },
        { status: 500 }
      );
    }

    if (!sources || sources.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No blog sources with feed URLs found',
        sourcesProcessed: 0,
        articlesAdded: 0,
        duplicatesSkipped: 0,
      });
    }

    const results = {
      sourcesProcessed: 0,
      articlesAdded: 0,
      duplicatesSkipped: 0,
      errors: 0,
    };

    for (const source of sources) {
      if (!source.feed_url) continue;

      try {
        // Fetch and parse RSS feed
        const feedResult = await fetchFeed(source.feed_url);

        if (!feedResult.success) {
          console.error(
            `Failed to fetch RSS for ${source.name}:`,
            feedResult.error
          );
          await supabase.from('ingestion_log').insert({
            source_id: source.id,
            type: 'extraction_failed',
            details: {
              feed_url: source.feed_url,
              error: feedResult.error,
            },
          });
          results.errors++;
          continue;
        }

        results.sourcesProcessed++;

        // Process each feed item
        for (const item of feedResult.items) {
          if (!item.link) continue;

          const normalizedUrl = normalizeUrl(item.link);
          const urlHash = hashUrl(item.link);

          // Check for duplicate
          const { data: existing } = await supabase
            .from('articles')
            .select('id')
            .eq('url_hash', urlHash)
            .single();

          if (existing) {
            results.duplicatesSkipped++;
            continue;
          }

          // Create summary from description (first 3 sentences or 500 chars)
          let summary = item.description || '';
          if (summary.length > 500) {
            // Try to cut at sentence boundary
            const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
            summary = sentences.slice(0, 3).join(' ').trim();
            if (summary.length > 500) {
              summary = summary.slice(0, 497) + '...';
            }
          }

          // Derive tags from categories or leave empty
          const tags = item.categories.slice(0, 3);

          // Parse published date
          let publishedAt: string;
          try {
            publishedAt = item.pubDate
              ? new Date(item.pubDate).toISOString()
              : new Date().toISOString();
          } catch {
            publishedAt = new Date().toISOString();
          }

          // Insert article
          const { error: insertError } = await supabase.from('articles').insert({
            source_id: source.id,
            headline: item.title.slice(0, 500),
            summary,
            url: normalizedUrl,
            url_hash: urlHash,
            tags,
            image_url: item.imageUrl,
            published_at: publishedAt,
            ingested_at: new Date().toISOString(),
            extraction_confidence: 1.0, // RSS items are high confidence
          });

          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate
              results.duplicatesSkipped++;
            } else {
              console.error('Failed to insert RSS article:', insertError);
              results.errors++;
            }
          } else {
            results.articlesAdded++;
          }
        }

        // Log successful poll
        await supabase.from('ingestion_log').insert({
          source_id: source.id,
          type: 'rss_polled',
          details: {
            feed_url: source.feed_url,
            items_found: feedResult.items.length,
          },
        });
      } catch (error) {
        console.error(`Error processing RSS for ${source.name}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Error in RSS ingest cron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron
export async function GET(request: NextRequest) {
  return POST(request);
}
