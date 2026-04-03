import { anthropic, logClaudeUsage } from '@/lib/ai/anthropic';

interface ArticleInput {
  headline: string;
  summary: string;
}

/**
 * Generates 3-5 key takeaway bullet points from a list of articles
 * Uses Claude Haiku for cost-efficient summarization
 *
 * @param articles - Array of articles with headline and summary
 * @param timeoutMs - Timeout in milliseconds (default 30000)
 * @returns Promise<string[]> - Array of bullet point strings
 */
export async function generateTLDR(
  articles: ArticleInput[],
  timeoutMs: number = 30000
): Promise<string[]> {
  if (!articles || articles.length === 0) {
    return [];
  }

  // Build article summaries for the prompt
  const articleSummaries = articles
    .map((a, i) => `${i + 1}. ${a.headline}\n   ${a.summary}`)
    .join('\n\n');

  const systemPrompt = `You are a concise news summarizer. Given a list of AI news articles, generate 3-5 key takeaways that capture the most important insights and trends. Each takeaway should be:
- A single, clear bullet point
- Under 100 characters
- Actionable or informative
- Distinct from other takeaways

Return ONLY a JSON array of strings, no other text. Example: ["Takeaway 1", "Takeaway 2", "Takeaway 3"]`;

  const userPrompt = `Here are today's AI news articles:\n\n${articleSummaries}\n\nGenerate 3-5 key takeaways as a JSON array of strings.`;

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TL;DR generation timed out')), timeoutMs);
    });

    // Create the API call promise
    const apiPromise = anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    // Race between timeout and API call
    const response = await Promise.race([apiPromise, timeoutPromise]);

    // Log usage
    void logClaudeUsage(
      response.model,
      response.usage.input_tokens,
      response.usage.output_tokens,
      'tldr'
    );

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.warn('No text content in TL;DR response');
      return [];
    }

    // Parse the response
    const takeaways = parseTakeawaysResponse(textContent.text);
    return takeaways;
  } catch (error) {
    console.error('TL;DR generation failed:', error);
    // Graceful degradation - return empty array on failure
    return [];
  }
}

/**
 * Parses Claude's response to extract takeaways array
 * Handles potential JSON wrapped in markdown code blocks
 */
function parseTakeawaysResponse(content: string): string[] {
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

    // Ensure it's an array of strings
    if (!Array.isArray(parsed)) {
      console.warn('TL;DR response is not an array');
      return [];
    }

    // Filter to strings only, limit to 5, and truncate each to 100 chars
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .slice(0, 5)
      .map((item) => item.slice(0, 100));
  } catch (parseError) {
    console.warn('Failed to parse TL;DR response as JSON:', parseError);
    return [];
  }
}
