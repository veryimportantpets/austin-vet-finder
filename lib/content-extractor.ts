import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (compatible; ContentSaver/1.0)';

export interface ExtractedContent {
  url: string;
  title: string | null;
  siteName: string | null;
  author: string | null;
  publishedAt: Date | null;
  textContent: string;
  excerpt: string | null;
  imageUrl: string | null;
  contentType: 'article' | 'tweet' | 'video' | 'podcast' | 'blog';
  readingTime: number;
}

/**
 * Detect content type from URL
 */
function detectContentType(url: string): ExtractedContent['contentType'] {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return 'tweet';
  }
  if (urlLower.includes('youtube.com') || urlLower.includes('vimeo.com')) {
    return 'video';
  }
  if (urlLower.includes('spotify.com') || urlLower.includes('podcast')) {
    return 'podcast';
  }
  if (urlLower.includes('medium.com') || urlLower.includes('substack.com') || urlLower.includes('blog')) {
    return 'blog';
  }

  return 'article';
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Extract clean text content from HTML
 */
function extractTextContent($: cheerio.CheerioAPI): string {
  // Remove unwanted elements
  $('script, style, nav, header, footer, aside, .sidebar, .comments, .advertisement, .ad, .social-share, .related-posts, noscript, iframe').remove();

  // Try to find the main content area
  const mainSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    'main',
    '.post',
    '.article',
  ];

  let content = '';
  for (const selector of mainSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text();
      break;
    }
  }

  // Fallback to body
  if (!content) {
    content = $('body').text();
  }

  // Clean up whitespace
  return content.replace(/\s+/g, ' ').trim();
}

/**
 * Extract metadata from HTML
 */
function extractMetadata($: cheerio.CheerioAPI, url: string): Partial<ExtractedContent> {
  const getMetaContent = (selectors: string[]): string | null => {
    for (const selector of selectors) {
      const content = $(selector).attr('content');
      if (content) return content;
    }
    return null;
  };

  // Title
  const title = getMetaContent([
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]) || $('title').text().trim() || null;

  // Site name
  const siteName = getMetaContent([
    'meta[property="og:site_name"]',
  ]) || new URL(url).hostname.replace('www.', '');

  // Author
  const author = getMetaContent([
    'meta[name="author"]',
    'meta[property="article:author"]',
  ]) || $('[rel="author"]').text().trim() || null;

  // Published date
  let publishedAt: Date | null = null;
  const dateStr = getMetaContent([
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
  ]);
  if (dateStr) {
    try {
      publishedAt = new Date(dateStr);
    } catch {
      // Invalid date, ignore
    }
  }

  // Image
  const imageUrl = getMetaContent([
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]);

  // Excerpt/Description
  const excerpt = getMetaContent([
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);

  return {
    title,
    siteName,
    author,
    publishedAt,
    imageUrl,
    excerpt,
  };
}

/**
 * Extract content from a URL
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract metadata
  const metadata = extractMetadata($, url);

  // Extract main text content
  const textContent = extractTextContent($);

  if (!textContent || textContent.length < 100) {
    throw new Error('Could not extract meaningful content from this URL');
  }

  // Detect content type
  const contentType = detectContentType(url);

  // Calculate reading time
  const readingTime = calculateReadingTime(textContent);

  return {
    url,
    title: metadata.title ?? null,
    siteName: metadata.siteName ?? null,
    author: metadata.author ?? null,
    publishedAt: metadata.publishedAt ?? null,
    textContent,
    excerpt: metadata.excerpt ?? textContent.slice(0, 300) + '...',
    imageUrl: metadata.imageUrl ?? null,
    contentType,
    readingTime,
  };
}
