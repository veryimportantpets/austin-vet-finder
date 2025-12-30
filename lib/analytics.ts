import { createHash } from 'crypto';

// Common bot user-agent patterns
const BOT_PATTERNS: { pattern: RegExp; type: string }[] = [
  // Search engines
  { pattern: /googlebot/i, type: 'googlebot' },
  { pattern: /bingbot/i, type: 'bingbot' },
  { pattern: /yandexbot/i, type: 'yandexbot' },
  { pattern: /baiduspider/i, type: 'baiduspider' },
  { pattern: /duckduckbot/i, type: 'duckduckbot' },

  // Social media crawlers
  { pattern: /facebookexternalhit/i, type: 'facebook' },
  { pattern: /twitterbot/i, type: 'twitter' },
  { pattern: /linkedinbot/i, type: 'linkedin' },
  { pattern: /slackbot/i, type: 'slack' },
  { pattern: /telegrambot/i, type: 'telegram' },
  { pattern: /whatsapp/i, type: 'whatsapp' },
  { pattern: /discordbot/i, type: 'discord' },

  // SEO/Marketing tools
  { pattern: /ahrefsbot/i, type: 'ahrefs' },
  { pattern: /semrushbot/i, type: 'semrush' },
  { pattern: /mj12bot/i, type: 'majestic' },
  { pattern: /dotbot/i, type: 'moz' },
  { pattern: /rogerbot/i, type: 'moz' },
  { pattern: /screaming frog/i, type: 'screamingfrog' },

  // Monitoring/Uptime
  { pattern: /pingdom/i, type: 'pingdom' },
  { pattern: /uptimerobot/i, type: 'uptimerobot' },
  { pattern: /statuscake/i, type: 'statuscake' },
  { pattern: /newrelicpinger/i, type: 'newrelic' },
  { pattern: /site24x7/i, type: 'site24x7' },

  // Generic bot patterns
  { pattern: /bot\b/i, type: 'generic-bot' },
  { pattern: /spider/i, type: 'spider' },
  { pattern: /crawler/i, type: 'crawler' },
  { pattern: /scraper/i, type: 'scraper' },
  { pattern: /headless/i, type: 'headless' },
  { pattern: /phantom/i, type: 'phantomjs' },
  { pattern: /selenium/i, type: 'selenium' },
  { pattern: /puppeteer/i, type: 'puppeteer' },
  { pattern: /playwright/i, type: 'playwright' },

  // HTTP libraries (often used for scraping)
  { pattern: /python-requests/i, type: 'python-requests' },
  { pattern: /python-urllib/i, type: 'python-urllib' },
  { pattern: /axios/i, type: 'axios' },
  { pattern: /node-fetch/i, type: 'node-fetch' },
  { pattern: /go-http-client/i, type: 'go-http' },
  { pattern: /java\//i, type: 'java' },
  { pattern: /curl/i, type: 'curl' },
  { pattern: /wget/i, type: 'wget' },
  { pattern: /libwww/i, type: 'libwww' },

  // Security scanners
  { pattern: /nmap/i, type: 'nmap' },
  { pattern: /nikto/i, type: 'nikto' },
  { pattern: /sqlmap/i, type: 'sqlmap' },
  { pattern: /burp/i, type: 'burpsuite' },

  // Cloud/CDN
  { pattern: /cloudflare/i, type: 'cloudflare' },
  { pattern: /amazonaws/i, type: 'aws' },

  // Preview generators
  { pattern: /preview/i, type: 'preview' },
  { pattern: /thumb/i, type: 'thumbnail' },

  // RSS readers
  { pattern: /feedfetcher/i, type: 'feedfetcher' },
  { pattern: /feedly/i, type: 'feedly' },
];

// Suspicious patterns that might indicate bots even without "bot" in UA
const SUSPICIOUS_PATTERNS = [
  /^$/,                          // Empty user agent
  /^-$/,                         // Just a dash
  /^mozilla\/4\.0$/i,            // Very old browser string
  /compatible;$/,                // Truncated UA string
];

export interface BotDetectionResult {
  isBot: boolean;
  botType: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect if a user agent belongs to a bot
 */
export function detectBot(userAgent: string | null): BotDetectionResult {
  if (!userAgent || userAgent.trim() === '') {
    return { isBot: true, botType: 'empty-ua', confidence: 'high' };
  }

  // Check against known bot patterns
  for (const { pattern, type } of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, botType: type, confidence: 'high' };
    }
  }

  // Check suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, botType: 'suspicious-ua', confidence: 'medium' };
    }
  }

  // Additional heuristics for likely bots
  // Very short user agents are suspicious
  if (userAgent.length < 20) {
    return { isBot: true, botType: 'short-ua', confidence: 'low' };
  }

  // No browser identifier is suspicious
  const hasBrowserId = /mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent);
  if (!hasBrowserId) {
    return { isBot: true, botType: 'no-browser-id', confidence: 'low' };
  }

  return { isBot: false, botType: null, confidence: 'high' };
}

/**
 * Create a privacy-preserving hash of an IP address
 * Uses a daily rotating salt so IPs can't be tracked long-term
 */
export function hashIP(ip: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const salt = process.env.IP_SALT || 'cost-vet-analytics';
  const dailySalt = `${salt}-${today}`;

  return createHash('sha256')
    .update(ip + dailySalt)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Extract the real client IP from various headers
 * Handles proxies, load balancers, and CDNs
 */
export function getClientIP(headers: Headers): string {
  // Check common proxy headers in order of reliability
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (original client)
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Vercel-specific
  const vercelForwardedFor = headers.get('x-vercel-forwarded-for');
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }

  return 'unknown';
}
