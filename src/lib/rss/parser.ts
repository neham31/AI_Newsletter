import Parser from 'rss-parser';

/**
 * RSS Parser instance with custom configuration
 */
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
    ],
  },
});

/**
 * Parsed RSS feed item
 */
export interface FeedItem {
  title: string;
  link: string;
  description: string | null;
  pubDate: string | null;
  imageUrl: string | null;
  categories: string[];
}

/**
 * Result of fetching an RSS feed
 */
export interface FeedResult {
  title: string;
  items: FeedItem[];
  success: boolean;
  error?: string;
}

/**
 * Extracts image URL from various RSS formats
 */
function extractImageUrl(item: Parser.Item): string | null {
  // Check enclosure
  const itemWithMedia = item as Parser.Item & {
    mediaContent?: { $?: { url?: string } };
    mediaThumbnail?: { $?: { url?: string } };
    enclosure?: { url?: string };
  };

  if (itemWithMedia.enclosure?.url) {
    const url = itemWithMedia.enclosure.url;
    if (url.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
      return url;
    }
  }

  // Check media:content
  if (itemWithMedia.mediaContent?.$?.url) {
    return itemWithMedia.mediaContent.$.url;
  }

  // Check media:thumbnail
  if (itemWithMedia.mediaThumbnail?.$?.url) {
    return itemWithMedia.mediaThumbnail.$.url;
  }

  return null;
}

/**
 * Fetches and parses an RSS feed
 *
 * @param feedUrl - The URL of the RSS feed
 * @returns Promise<FeedResult> - Parsed feed items with metadata
 */
export async function fetchFeed(feedUrl: string): Promise<FeedResult> {
  try {
    const feed = await parser.parseURL(feedUrl);

    const items: FeedItem[] = (feed.items || []).map((item) => ({
      title: item.title || 'Untitled',
      link: item.link || '',
      description: item.contentSnippet || item.content || item.summary || null,
      pubDate: item.pubDate || item.isoDate || null,
      imageUrl: extractImageUrl(item),
      categories: item.categories || [],
    }));

    return {
      title: feed.title || 'Unknown Feed',
      items,
      success: true,
    };
  } catch (error) {
    console.error(`Failed to fetch RSS feed ${feedUrl}:`, error);

    return {
      title: 'Unknown Feed',
      items: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
