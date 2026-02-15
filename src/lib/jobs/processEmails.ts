import { createServiceRoleClient } from '@/lib/supabase/server';
import { extractArticles } from '@/lib/ai/anthropic';
import { normalizeUrl, hashUrl } from '@/lib/utils/url';

/**
 * Result of processing emails
 */
export interface ProcessEmailsResult {
  processed: number;
  articlesExtracted: number;
  duplicatesSkipped: number;
  errors: number;
}

/**
 * Processes unprocessed raw emails by extracting articles using Claude
 *
 * @param limit - Maximum number of emails to process in this batch
 * @returns ProcessEmailsResult - Statistics about the processing run
 */
export async function processEmails(
  limit: number = 10
): Promise<ProcessEmailsResult> {
  const result: ProcessEmailsResult = {
    processed: 0,
    articlesExtracted: 0,
    duplicatesSkipped: 0,
    errors: 0,
  };

  const supabase = createServiceRoleClient();

  // Fetch unprocessed emails
  const { data: emails, error: fetchError } = await supabase
    .from('raw_emails')
    .select('id, source_id, subject, body_html, body_plain, received_at')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (fetchError) {
    console.error('Failed to fetch unprocessed emails:', fetchError);
    return result;
  }

  if (!emails || emails.length === 0) {
    console.log('No unprocessed emails to process');
    return result;
  }

  // Get source names for logging
  const sourceIds = Array.from(
    new Set(emails.map((e: { source_id: string }) => e.source_id))
  );
  const { data: sources } = await supabase
    .from('sources')
    .select('id, name')
    .in('id', sourceIds);

  const sourceMap = new Map<string, string>(
    (sources || []).map((s: { id: string; name: string }) => [s.id, s.name])
  );

  for (const email of emails) {
    const sourceName = sourceMap.get(email.source_id) || 'Unknown Source';

    try {
      // Use HTML if available, fall back to plain text
      const content = email.body_html || email.body_plain || '';

      if (!content) {
        console.warn(`Email ${email.id} has no content, skipping`);
        await markEmailProcessed(supabase, email.id);
        await logIngestion(supabase, email.source_id, 'extraction_failed', {
          email_id: email.id,
          reason: 'no_content',
        });
        result.errors++;
        continue;
      }

      // Extract articles using Claude
      const extractionResult = await extractArticles(
        content,
        sourceName,
        String(email.received_at)
      );

      if (!extractionResult.success) {
        console.error(
          `Extraction failed for email ${email.id}:`,
          extractionResult.error
        );
        await logIngestion(supabase, email.source_id, 'extraction_failed', {
          email_id: email.id,
          error: extractionResult.error,
        });
        // Mark as processed to avoid infinite retries (manual review needed)
        await markEmailProcessed(supabase, email.id);
        result.errors++;
        continue;
      }

      // Insert extracted articles
      for (const article of extractionResult.articles) {
        const normalizedUrl = normalizeUrl(article.url);
        const urlHash = hashUrl(article.url);

        // Check for duplicate
        const { data: existing } = await supabase
          .from('articles')
          .select('id')
          .eq('url_hash', urlHash)
          .single();

        if (existing) {
          result.duplicatesSkipped++;
          continue;
        }

        // Insert article
        const { error: insertError } = await supabase.from('articles').insert({
          source_id: email.source_id,
          headline: article.headline,
          summary: article.summary,
          url: normalizedUrl,
          url_hash: urlHash,
          tags: article.tags,
          image_url: article.image_url,
          published_at: article.published_at,
          ingested_at: new Date().toISOString(),
          raw_email_id: email.id,
          extraction_confidence: article.confidence,
        });

        if (insertError) {
          // Could be duplicate from race condition
          if (insertError.code === '23505') {
            result.duplicatesSkipped++;
          } else {
            console.error('Failed to insert article:', insertError);
            result.errors++;
          }
        } else {
          result.articlesExtracted++;
        }
      }

      // Mark email as processed
      await markEmailProcessed(supabase, email.id);
      result.processed++;

      // Log success
      await logIngestion(supabase, email.source_id, 'extraction_success', {
        email_id: email.id,
        articles_extracted: extractionResult.articles.length,
        duplicates_skipped: result.duplicatesSkipped,
      });
    } catch (error) {
      console.error(`Error processing email ${email.id}:`, error);
      await logIngestion(supabase, email.source_id, 'extraction_failed', {
        email_id: email.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.errors++;
    }
  }

  return result;
}

/**
 * Marks an email as processed
 */
async function markEmailProcessed(
  supabase: ReturnType<typeof createServiceRoleClient>,
  emailId: string
): Promise<void> {
  await supabase
    .from('raw_emails')
    .update({ processed: true })
    .eq('id', emailId);
}

/**
 * Logs an ingestion event
 */
async function logIngestion(
  supabase: ReturnType<typeof createServiceRoleClient>,
  sourceId: string,
  type: string,
  details: Record<string, unknown>
): Promise<void> {
  await supabase.from('ingestion_log').insert({
    source_id: sourceId,
    type,
    details,
  });
}
