import { anthropic, logClaudeUsage } from '@/lib/ai/anthropic';

interface ArticleInput {
  headline: string;
  summary: string;
  source_name: string;
}

export interface WeeklyTheme {
  title: string;
  summary: string;
  sources: string[];
}

export interface WeeklySummary {
  themes: WeeklyTheme[];
}

/**
 * Generates 3-5 thematic summaries from a week's worth of articles
 * Uses Claude Haiku for cost-efficient summarization
 *
 * @param articles - Array of articles with headline, summary, and source_name
 * @param timeoutMs - Timeout in milliseconds (default 45000)
 * @returns Promise<WeeklySummary> - Themes with titles, summaries, and source attribution
 */
export async function generateWeeklySummary(
  articles: ArticleInput[],
  timeoutMs: number = 45000
): Promise<WeeklySummary> {
  if (!articles || articles.length === 0) {
    return { themes: [] };
  }

  // Build article summaries for the prompt
  const articleSummaries = articles
    .map((a, i) => `${i + 1}. [${a.source_name}] ${a.headline}\n   ${a.summary}`)
    .join('\n\n');

  const systemPrompt = `You are a concise AI news analyst. Given a list of AI news articles from the past week, identify 3-5 key themes that capture the most important developments. For each theme:
- Write a clear, descriptive title (5-10 words)
- Write a 2-3 sentence summary of the theme covering the key developments
- List which sources covered this theme

Prefer themes that are covered by multiple sources — cross-source coverage indicates importance.
Do NOT include individual article URLs or links.

Return ONLY a JSON object in this exact format, no other text:
{
  "themes": [
    {
      "title": "Theme title here",
      "summary": "2-3 sentence summary here.",
      "sources": ["Source Name 1", "Source Name 2"]
    }
  ]
}`;

  const userPrompt = `Here are this week's AI news articles:\n\n${articleSummaries}\n\nIdentify 3-5 key themes as a JSON object.`;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Weekly summary generation timed out')), timeoutMs);
    });

    const apiPromise = anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const response = await Promise.race([apiPromise, timeoutPromise]);

    // Log usage
    void logClaudeUsage(
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
      'weekly_summary'
    );

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.warn('No text content in weekly summary response');
      return { themes: [] };
    }

    return parseWeeklySummaryResponse(textContent.text);
  } catch (error) {
    console.error('Weekly summary generation failed:', error);
    return { themes: [] };
  }
}

/**
 * Parses Claude's response to extract the weekly summary
 * Handles potential JSON wrapped in markdown code blocks
 */
function parseWeeklySummaryResponse(content: string): WeeklySummary {
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

  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed.themes || !Array.isArray(parsed.themes)) {
      console.warn('Weekly summary response missing themes array');
      return { themes: [] };
    }

    // Validate and sanitize themes
    const themes: WeeklyTheme[] = parsed.themes
      .filter(
        (t: unknown): t is WeeklyTheme =>
          typeof t === 'object' &&
          t !== null &&
          typeof (t as WeeklyTheme).title === 'string' &&
          typeof (t as WeeklyTheme).summary === 'string' &&
          Array.isArray((t as WeeklyTheme).sources)
      )
      .slice(0, 5)
      .map((t: WeeklyTheme) => ({
        title: t.title.slice(0, 100),
        summary: t.summary.slice(0, 500),
        sources: t.sources
          .filter((s: unknown): s is string => typeof s === 'string')
          .slice(0, 10),
      }));

    return { themes };
  } catch (parseError) {
    console.warn('Failed to parse weekly summary response as JSON:', parseError);
    return { themes: [] };
  }
}
