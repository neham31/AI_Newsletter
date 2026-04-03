import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Anthropic client for Claude API calls
 * Initialized with ANTHROPIC_API_KEY environment variable
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Logs Claude API usage to the database and console.
 * Fire-and-forget — errors are caught and logged but not propagated.
 */
export async function logClaudeUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  callType: 'extraction' | 'tldr' | 'weekly_summary'
): Promise<void> {
  console.log(
    `[Claude] model=${model} input=${inputTokens} output=${outputTokens} type=${callType}`
  );
  try {
    const supabase = createServiceRoleClient();
    await supabase.from('claude_usage_log').insert({
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      call_type: callType,
    });
  } catch (err) {
    console.error('[Claude] Failed to log usage:', err);
  }
}

/**
 * Valid tags for article categorization
 */
export const VALID_TAGS = [
  'LLMs',
  'Image & Video Gen',
  'Audio & Speech',
  'Agents',
  'Open Source',
  'Research',
  'Regulation & Policy',
  'Funding & M&A',
  'Product Launch',
  'Developer Tools',
  'Benchmarks',
  'Robotics',
  'Enterprise AI',
  'AI Safety',
  'Startups',
] as const;

export type ValidTag = (typeof VALID_TAGS)[number];

/**
 * Extracted article data from newsletter content
 */
export interface ExtractedArticle {
  headline: string;
  summary: string;
  url: string;
  tags: string[];
  image_url: string | null;
  published_at: string;
  confidence: number;
}

/**
 * Result of article extraction
 */
export interface ExtractionResult {
  articles: ExtractedArticle[];
  source_name: string;
  extraction_date: string;
  success: boolean;
  error?: string;
}

/**
 * System prompt for Claude extraction
 */
const SYSTEM_PROMPT = `You are a precise news extraction engine. Extract individual AI news items from the newsletter HTML below. Return ONLY valid JSON, no other text.`;

/**
 * Builds the user prompt for extraction
 */
function buildUserPrompt(
  sourceName: string,
  receivedDate: string,
  bodyHtml: string
): string {
  return `Source newsletter: ${sourceName}
Date received: ${receivedDate}

HTML content:
${bodyHtml}

Extract each distinct news item as a JSON array. For each item return:
{
  "headline": "Clear, concise headline (max 120 chars)",
  "summary": "2-3 sentence summary of the news item. Be factual and specific.",
  "url": "The direct link from the newsletter HTML (use the newsletter redirect URL as-is — do not try to guess or reconstruct the original article URL). If multiple links exist for an item, prefer the most specific one.",
  "tags": ["tag1", "tag2"],
  "image_url": "URL of associated image if present, null otherwise",
  "published_at": "ISO 8601 date if mentioned, otherwise use ${receivedDate}",
  "confidence": 0.95
}

Valid tags (use 1-3 per item):
- "LLMs"
- "Image & Video Gen"
- "Audio & Speech"
- "Agents"
- "Open Source"
- "Research"
- "Regulation & Policy"
- "Funding & M&A"
- "Product Launch"
- "Developer Tools"
- "Benchmarks"
- "Robotics"
- "Enterprise AI"
- "AI Safety"
- "Startups"

Rules:
- Extract ALL distinct news items, typically 5-15 per newsletter.
- Each item must have a unique URL. Skip items without a clear link.
- Summaries should be self-contained — understandable without reading the original.
- Set confidence < 0.7 if extraction was ambiguous.
- Do NOT include newsletter meta-content (subscription promos, sponsor ads, "share with a friend" blocks, footer links).
- Do NOT include sponsored/advertisement sections.

Return ONLY a valid JSON array, with no markdown code blocks or other text.`;
}

/**
 * Stricter retry prompt when first attempt returns invalid JSON
 */
const RETRY_SYSTEM_PROMPT = `You are a precise news extraction engine. You returned invalid JSON in your previous response. Return ONLY a valid JSON array, with no markdown code blocks, no explanatory text, no other content. Just the JSON array.`;

/**
 * Parses Claude's response to extract articles
 * Handles potential JSON wrapped in markdown code blocks
 */
function parseArticlesResponse(content: string): ExtractedArticle[] {
  let jsonStr = content.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();

  const parsed = JSON.parse(jsonStr);

  // Ensure it's an array
  if (!Array.isArray(parsed)) {
    throw new Error('Response is not an array');
  }

  // Validate and normalize each article
  return parsed.map((item: Record<string, unknown>) => ({
    headline: String(item.headline || '').slice(0, 120),
    summary: String(item.summary || ''),
    url: String(item.url || ''),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    image_url: item.image_url ? String(item.image_url) : null,
    published_at: String(item.published_at || new Date().toISOString()),
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
  }));
}

/**
 * Strips HTML boilerplate tags to reduce token usage before sending to Claude.
 * Removes <style>, <head>, <script>, and <noscript> blocks which contain no useful content.
 */
export function stripHtmlBoilerplate(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
}

/**
 * Extracts articles from newsletter HTML content using Claude
 *
 * @param htmlContent - The raw HTML content of the newsletter
 * @param sourceName - The name of the newsletter source
 * @param receivedDate - The date the email was received (ISO 8601)
 * @returns Promise<ExtractionResult> - Extracted articles with metadata
 */
export async function extractArticles(
  htmlContent: string,
  sourceName: string,
  receivedDate?: string
): Promise<ExtractionResult> {
  const extractionDate = receivedDate || new Date().toISOString();

  // Strip HTML boilerplate before truncation to reduce token usage
  const strippedHtml = stripHtmlBoilerplate(htmlContent);

  // Truncate HTML if too long (keep under token limits)
  const maxHtmlLength = 50000; // ~12.5k tokens assuming 4 chars/token
  const truncatedHtml =
    strippedHtml.length > maxHtmlLength
      ? strippedHtml.slice(0, maxHtmlLength) + '\n... [truncated]'
      : strippedHtml;

  try {
    // First attempt
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(sourceName, extractionDate, truncatedHtml),
        },
      ],
    });

    // Log usage
    void logClaudeUsage(
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
      'extraction'
    );

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    try {
      const articles = parseArticlesResponse(textContent.text);

      // Filter out low-confidence articles and those without URLs
      const validArticles = articles.filter(
        (article) => article.url && article.confidence >= 0.5
      );

      return {
        articles: validArticles,
        source_name: sourceName,
        extraction_date: extractionDate,
        success: true,
      };
    } catch (parseError) {
      // Retry with stricter prompt
      console.warn(
        'First extraction attempt returned invalid JSON, retrying...'
      );

      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: RETRY_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(sourceName, extractionDate, truncatedHtml),
          },
          {
            role: 'assistant',
            content: textContent.text,
          },
          {
            role: 'user',
            content:
              'That was invalid JSON. Please return ONLY a valid JSON array with no other text.',
          },
        ],
      });

      // Log retry usage
      void logClaudeUsage(
        retryResponse.model,
        retryResponse.usage.input_tokens,
        retryResponse.usage.output_tokens,
        'extraction'
      );

      const retryTextContent = retryResponse.content.find(
        (block) => block.type === 'text'
      );
      if (!retryTextContent || retryTextContent.type !== 'text') {
        throw new Error('No text content in retry response');
      }

      const retryArticles = parseArticlesResponse(retryTextContent.text);
      const validRetryArticles = retryArticles.filter(
        (article) => article.url && article.confidence >= 0.5
      );

      return {
        articles: validRetryArticles,
        source_name: sourceName,
        extraction_date: extractionDate,
        success: true,
      };
    }
  } catch (error) {
    console.error('Article extraction failed:', error);

    return {
      articles: [],
      source_name: sourceName,
      extraction_date: extractionDate,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}
