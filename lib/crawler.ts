import * as cheerio from 'cheerio';
import crypto from 'crypto';
import prisma from './db';

// Rate limiting: track last request time per domain
const domainLastRequest: Map<string, number> = new Map();
const RATE_LIMIT_MS = 2000; // 2 seconds between requests per domain

// Financing keywords for page prioritization
const FINANCING_KEYWORDS = [
  'payment', 'financ', 'carecredit', 'scratch', 'affirm', 'cherry',
  'vetbilling', 'billing', 'pay', 'cost', 'afford', 'plan', 'wellness',
  'monthly', 'installment', 'credit', 'lending', 'loan'
];

// Transparency keywords
const TRANSPARENCY_KEYWORDS = [
  'fee', 'price', 'pricing', 'cost', 'estimate', 'transparent',
  'rate', 'charge', 'exam', 'service', 'vaccine', 'spay', 'neuter',
  'dental', 'checkup', 'visit'
];

// URL path keywords that indicate high-value pages
const PRIORITY_URL_PATTERNS = [
  'wellness', 'payment', 'financ', 'pricing', 'cost', 'fee',
  'services', 'rates', 'plans', 'afford', 'new-client', 'new-patient',
  'preventive', 'packages', 'memberships'
];

// Known financing providers with their detection patterns
// Reorganized by new tier structure:
// - Tier 1: Best BNPL - Cherry, Sunbit, Affirm, VetBilling (no deferred interest)
// - Tier 2: Caution - Scratchpay, CareCredit (deferred interest risk)
const FINANCING_PATTERNS = {
  // Tier 1 providers (Best BNPL - no deferred interest, transparent fixed payments)
  CHERRY: /cherry\s*(payment|pay|financ|lending)?|withcherry\.com/i,
  SUNBIT: /\bsunbit\b|sunbit\.com/i,
  AFFIRM: /\baffirm\b|affirm\.com/i,
  VETBILLING: /vet\s*billing|vetbilling\.com/i,

  // Tier 1 alternatives (in-house 0% interest, wellness plans)
  IN_HOUSE_PAYMENT_PLAN: /(in-?house|internal)\s+(payment|financ|plan)|(payment\s+plan|installment).{0,50}(no\s+interest|0%|zero)|interest.?free\s+payment/i,
  WELLNESS_PLAN: /wellness\s+(plan|program|package|membership)|preventive\s+care\s+(plan|package)|monthly\s+(wellness|care)\s+plan/i,

  // Tier 2 providers (Caution - may have deferred interest)
  SCRATCHPAY: /scratch\s*pay|scratchpay\.com/i,
  CARECREDIT: /carecredit|care\s+credit/i,

  // Generic financing mentions (defaults to Tier 2 - unclear terms)
  FINANCING_AVAILABLE: /financing\s+(available|option|offer)|payment\s+(plan|option)s?\s+(available|offer)/i,
};

// Deferred interest detection
const DEFERRED_INTEREST_PATTERNS = [
  /no\s+interest\s+if\s+paid\s+in\s+full/i,
  /deferred\s+interest/i,
  /interest\s+will\s+be\s+charged.{0,50}promotional/i,
  /promo(tional)?\s+(period|offer).{0,50}interest/i,
  /special\s+financing.{0,30}(6|12|18|24)\s*months/i,
];

// Transparency detection patterns - enhanced
const TRANSPARENCY_PATTERNS = {
  PRICE_LIST: /(price|fee|cost|rate)\s*(list|sheet|schedule|table|guide|menu)|our\s+(prices|rates|fees)/i,
  EXAM_FEE: /(exam(ination)?|office\s+visit|new\s+(patient|client)|wellness\s+exam)\s*(fee|cost|price)?\s*[:\-–]?\s*\$\s*\d+/i,
  VACCINE_PRICE: /(vaccine|vaccination|rabies|distemper|bordetella)\s*[:\-–]?\s*\$\s*\d+/i,
  SPAY_NEUTER_PRICE: /(spay|neuter|alter)\s*(fee|cost|price)?\s*[:\-–]?\s*(from\s*)?\$\s*\d+/i,
  ESTIMATE_PROMISE: /(written|itemized|detailed)\s+(estimate|quote|treatment\s+plan)|(estimate|quote).{0,30}(before|prior|advance)|we\s+provide\s+estimates/i,
  TRANSPARENT_MENTION: /transparent\s+(pricing|cost|fee)|upfront\s+pricing|no\s+hidden\s+(fee|cost|charge)/i,
  WELLNESS_PRICING: /wellness\s+(plan|package).{0,50}\$\s*\d+|monthly.{0,20}\$\s*\d+/i,
};

// Price extraction patterns - more comprehensive
// These patterns capture specific dollar amounts for common services
// Added more flexible patterns like "How much does it cost? $X"
const PRICE_EXTRACTION_PATTERNS: {
  serviceType: string;
  patterns: RegExp[];
  serviceName?: string;
}[] = [
  // Exam fees
  {
    serviceType: 'exam',
    serviceName: 'Exam/Office visit',
    patterns: [
      /(?:exam(?:ination)?|office\s+visit|wellness\s+(?:exam|visit|check)|new\s+(?:patient|client)\s+(?:exam|visit)?|check[\s-]?up)[:\s]*(?:fee)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*(?:exam|office\s+visit)/gi,
      /(?:routine|annual|physical)\s+exam[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      // More flexible: "Exam ... cost? $X" pattern
      /(?:exam|office\s+visit|wellness\s+visit).{0,100}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Vaccines
  {
    serviceType: 'vaccines',
    serviceName: 'Vaccines',
    patterns: [
      /(?:rabies|dhpp|dhlpp|distemper|parvo|bordetella|lepto|fvrcp|felv)\s*(?:vaccine|vaccination|shot)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /vaccine[s]?\s*(?:from|starting\s+at)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*(?:per\s+)?(?:vaccine|vaccination)/gi,
      /(?:vaccine|vaccination).{0,100}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Spay/neuter
  {
    serviceType: 'spay_neuter',
    serviceName: 'Spay/Neuter',
    patterns: [
      /(?:spay|neuter|alter(?:ing)?)[:\s]*(?:from|starting\s+at)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /(?:cat|dog|feline|canine)\s+(?:spay|neuter)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*(?:spay|neuter)/gi,
      /(?:spay|neuter)\s+(?:surgery|procedure)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /(?:spay|neuter).{0,100}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Dental
  {
    serviceType: 'dental',
    serviceName: 'Dental cleaning',
    patterns: [
      /dental\s+(?:cleaning|prophy|prophylaxis)[:\s]*(?:from|starting\s+at)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /teeth\s+cleaning[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*dental\s+(?:cleaning|procedure)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*for\s+routine/gi,  // Emancipet style: "$225 for routine"
      /dental.{0,100}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Bloodwork/diagnostics
  {
    serviceType: 'bloodwork',
    serviceName: 'Bloodwork/Labs',
    patterns: [
      /(?:blood\s*work|blood\s+panel|cbc|chemistry\s+panel|lab\s*work)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /(?:diagnostic|pre[\s-]?surgical|senior)\s+(?:panel|bloodwork)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*(?:blood\s+panel|bloodwork)/gi,
    ],
  },
  // X-rays
  {
    serviceType: 'xray',
    serviceName: 'X-rays',
    patterns: [
      /(?:x[\s-]?ray|radiograph)[s]?[:\s]*(?:from|starting\s+at)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*(?:per\s+)?(?:x[\s-]?ray|radiograph)/gi,
    ],
  },
  // Emergency/Urgent care fees
  {
    serviceType: 'emergency',
    serviceName: 'Emergency/Urgent',
    patterns: [
      /emergency\s+(?:fee|exam|visit)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /after[\s-]?hours\s+(?:fee|exam)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*emergency\s+fee/gi,
      /urgent\s+care.{0,100}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Wellness plans (monthly)
  {
    serviceType: 'wellness_plan',
    serviceName: 'Wellness plan',
    patterns: [
      /wellness\s+(?:plan|package|program)[:\s]*\$\s*(\d+(?:\.\d{2})?)\s*(?:\/\s*)?(?:per\s+)?(?:month|mo)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*(?:\/\s*)?(?:per\s+)?month\s*(?:wellness|membership|plan)/gi,
      /monthly\s+(?:plan|membership|wellness)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Microchip
  {
    serviceType: 'microchip',
    serviceName: 'Microchip',
    patterns: [
      /microchip(?:ping)?[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /\$\s*(\d+(?:\.\d{2})?)\s*microchip/gi,
      /microchip.{0,50}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Heartworm test
  {
    serviceType: 'heartworm_test',
    serviceName: 'Heartworm test',
    patterns: [
      /heartworm\s+test.{0,200}(?:cost|price|fee)[?\s:]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /(?:hw|heartworm)\s+(?:screen|check)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
  // Fecal test
  {
    serviceType: 'fecal_test',
    serviceName: 'Fecal test',
    patterns: [
      /fecal\s+(?:test|exam|check)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
      /stool\s+(?:sample|test)[:\s]*\$\s*(\d+(?:\.\d{2})?)/gi,
    ],
  },
];

// Additional patterns for service-type detection from URL
const SERVICE_TYPE_FROM_URL: Record<string, string> = {
  'heartworm': 'heartworm_test',
  'dental': 'dental',
  'vaccine': 'vaccines',
  'spay': 'spay_neuter',
  'neuter': 'spay_neuter',
  'exam': 'exam',
  'microchip': 'microchip',
  'fecal': 'fecal_test',
  'bloodwork': 'bloodwork',
  'xray': 'xray',
  'x-ray': 'xray',
  'urgent': 'emergency',
  'emergency': 'emergency',
};

// User agent for crawling
const USER_AGENT = 'AffordabilityFinderBot/0.1 (Austin Vet Finder; contact: support@example.com)';

interface ExtractedPriceItem {
  serviceType: string;
  serviceName: string;
  minPrice: number;  // in cents
  maxPrice: number | null;
  snippet: string;
  sourceUrl: string;
}

interface CrawlResult {
  pages: PageResult[];
  signals: ExtractedSignals;
  prices: ExtractedPriceItem[];
}

interface PageResult {
  url: string;
  title: string;
  textContent: string;
  contentHash: string;
  httpStatus: number;
  hasFinancingKeywords: boolean;
  hasTransparencyKeywords: boolean;
}

interface ExtractedSignals {
  financingProviders: string[];
  inHousePaymentPlan: boolean;
  deferredInterest: boolean;
  hasPriceList: boolean;
  hasExamFee: boolean;
  hasEstimatePromise: boolean;
  transparencyScore: number;
  financingTier: string;
  affordabilityScore: number;
  confidence: number;
  evidence: EvidenceItem[];
}

interface EvidenceItem {
  category: 'FINANCING' | 'TRANSPARENCY';
  label: string;
  snippet: string;
  sourceUrl: string;
}

/**
 * Main crawl function for a single clinic
 */
export async function crawlClinic(clinicId: string, websiteUrl: string): Promise<void> {
  console.log(`Starting crawl for clinic ${clinicId}: ${websiteUrl}`);
  
  // Create crawl run record
  const crawlRun = await prisma.crawlRun.create({
    data: {
      clinicId,
      status: 'running',
    },
  });
  
  try {
    const result = await performCrawl(websiteUrl);
    
    // Save pages
    for (const page of result.pages) {
      await prisma.page.upsert({
        where: {
          clinicId_url: { clinicId, url: page.url },
        },
        create: {
          clinicId,
          url: page.url,
          title: page.title,
          textContent: page.textContent.slice(0, 50000), // Limit text storage
          contentHash: page.contentHash,
          httpStatus: page.httpStatus,
          hasFinancingKeywords: page.hasFinancingKeywords,
          hasTransparencyKeywords: page.hasTransparencyKeywords,
        },
        update: {
          title: page.title,
          textContent: page.textContent.slice(0, 50000),
          contentHash: page.contentHash,
          httpStatus: page.httpStatus,
          hasFinancingKeywords: page.hasFinancingKeywords,
          hasTransparencyKeywords: page.hasTransparencyKeywords,
          fetchedAt: new Date(),
        },
      });
    }
    
    // Save extracted signals
    await prisma.extractedSignal.create({
      data: {
        clinicId,
        financingProviders: result.signals.financingProviders,
        financingTier: result.signals.financingTier,
        inHousePaymentPlan: result.signals.inHousePaymentPlan,
        deferredInterest: result.signals.deferredInterest,
        transparencyScore: result.signals.transparencyScore,
        hasPriceList: result.signals.hasPriceList,
        hasExamFee: result.signals.hasExamFee,
        hasEstimatePromise: result.signals.hasEstimatePromise,
        affordabilityScore: result.signals.affordabilityScore,
        confidence: result.signals.confidence,
      },
    });
    
    // Save evidence
    await prisma.evidence.deleteMany({ where: { clinicId } }); // Clear old evidence
    for (const item of result.signals.evidence) {
      await prisma.evidence.create({
        data: {
          clinicId,
          category: item.category,
          label: item.label,
          snippet: item.snippet.slice(0, 500),
          sourceUrl: item.sourceUrl,
        },
      });
    }

    // Save extracted prices
    await prisma.extractedPrice.deleteMany({ where: { clinicId } }); // Clear old prices
    for (const price of result.prices) {
      await prisma.extractedPrice.create({
        data: {
          clinicId,
          serviceType: price.serviceType,
          serviceName: price.serviceName,
          minPrice: price.minPrice,
          maxPrice: price.maxPrice,
          snippet: price.snippet,
          sourceUrl: price.sourceUrl,
        },
      });
    }

    console.log(`Extracted ${result.prices.length} prices for clinic ${clinicId}`);
    
    // Update clinic with computed scores
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        financingTier: result.signals.financingTier,
        transparencyScore: result.signals.transparencyScore,
        affordabilityScore: result.signals.affordabilityScore,
        confidence: result.signals.confidence,
        lastVerifiedAt: new Date(),
      },
    });
    
    // Update crawl run as complete
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: 'completed',
        finishedAt: new Date(),
        pagesCrawled: result.pages.length,
      },
    });
    
    console.log(`Crawl completed for clinic ${clinicId}: ${result.pages.length} pages`);
  } catch (error) {
    console.error(`Crawl failed for clinic ${clinicId}:`, error);
    
    await prisma.crawlRun.update({
      where: { id: crawlRun.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errors: { message: String(error) },
      },
    });
  }
}

/**
 * Perform the actual web crawl
 */
/**
 * Normalize URL by removing fragments and cleaning up
 */
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    urlObj.hash = ''; // Remove fragment
    // Remove common tracking parameters
    urlObj.searchParams.delete('utm_source');
    urlObj.searchParams.delete('utm_medium');
    urlObj.searchParams.delete('utm_campaign');
    return urlObj.href;
  } catch {
    return url;
  }
}

async function performCrawl(startUrl: string): Promise<CrawlResult> {
  const baseUrl = new URL(startUrl);
  const visited = new Set<string>();
  const toVisit: { url: string; depth: number }[] = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const pages: PageResult[] = [];
  const maxPages = 50; // Increased to get more service pages
  const maxDepth = 3; // Increased depth to reach service pages
  
  // Try to fetch and parse sitemap first
  const sitemapUrls = await fetchSitemap(baseUrl.origin);
  for (const url of sitemapUrls.slice(0, 20)) {
    if (!visited.has(url)) {
      toVisit.push({ url, depth: 1 });
    }
  }
  
  while (toVisit.length > 0 && pages.length < maxPages) {
    const { url: rawUrl, depth } = toVisit.shift()!;
    const url = normalizeUrl(rawUrl);

    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);

    // Check if URL is on same domain
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== baseUrl.hostname) continue;
    } catch {
      continue;
    }
    
    // Rate limiting
    await rateLimitDelay(baseUrl.hostname);
    
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });
      
      if (!response.ok) continue;
      
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Extract main content (strip nav, footer, scripts)
      $('nav, footer, script, style, noscript, iframe').remove();
      const textContent = $('body').text()
        .replace(/\s+/g, ' ')
        .trim();
      
      const title = $('title').text().trim() || '';
      const contentHash = crypto.createHash('md5').update(textContent).digest('hex');
      
      // Check for relevant keywords
      const textLower = textContent.toLowerCase();
      const hasFinancingKeywords = FINANCING_KEYWORDS.some(k => textLower.includes(k));
      const hasTransparencyKeywords = TRANSPARENCY_KEYWORDS.some(k => textLower.includes(k));
      
      pages.push({
        url,
        title,
        textContent,
        contentHash,
        httpStatus: response.status,
        hasFinancingKeywords,
        hasTransparencyKeywords,
      });
      
      // Find links to follow (prioritize relevant pages)
      if (depth < maxDepth) {
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;

          try {
            const linkUrl = normalizeUrl(new URL(href, url).href);
            const linkPath = new URL(linkUrl).pathname.toLowerCase();

            // Skip already visited (after normalization)
            if (visited.has(linkUrl)) return;

            // Skip obviously irrelevant pages
            if (linkPath.includes('/blog/') || linkPath.includes('/events/') ||
                linkPath.includes('/news/') || linkPath.includes('/author/') ||
                linkPath.includes('/tag/') || linkPath.includes('/category/')) {
              return;
            }

            // Prioritize relevant pages - check URL path for high-value keywords
            const isHighPriority =
              linkPath.includes('service') ||
              linkPath.includes('pricing') ||
              linkPath.includes('cost') ||
              linkPath.includes('fee') ||
              linkPath.includes('wellness');

            const isRelevant =
              PRIORITY_URL_PATTERNS.some(k => linkPath.includes(k)) ||
              FINANCING_KEYWORDS.some(k => linkPath.includes(k)) ||
              TRANSPARENCY_KEYWORDS.some(k => linkPath.includes(k)) ||
              linkPath.includes('faq') ||
              linkPath.includes('new-client') ||
              linkPath.includes('client-info') ||
              linkPath.includes('about');

            // Add high priority pages first, then relevant, then others
            if (isHighPriority) {
              toVisit.unshift({ url: linkUrl, depth: depth + 1 });
            } else if (isRelevant) {
              toVisit.splice(Math.min(5, toVisit.length), 0, { url: linkUrl, depth: depth + 1 });
            } else {
              toVisit.push({ url: linkUrl, depth: depth + 1 });
            }
          } catch {
            // Invalid URL, skip
          }
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error);
    }
  }
  
  // Extract signals from all collected pages
  const signals = extractSignals(pages);

  // Extract prices from all collected pages
  const prices = extractPrices(pages);

  return { pages, signals, prices };
}

/**
 * Try to fetch and parse sitemap.xml
 */
async function fetchSitemap(origin: string): Promise<string[]> {
  const urls: string[] = [];
  
  try {
    const response = await fetch(`${origin}/sitemap.xml`, {
      headers: { 'User-Agent': USER_AGENT },
    });
    
    if (!response.ok) return urls;
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    $('loc').each((_, el) => {
      const url = $(el).text().trim();
      if (url) urls.push(url);
    });
  } catch {
    // Sitemap not available, that's okay
  }
  
  return urls;
}

/**
 * Rate limit requests per domain
 */
async function rateLimitDelay(domain: string): Promise<void> {
  const lastRequest = domainLastRequest.get(domain) || 0;
  const now = Date.now();
  const timeSince = now - lastRequest;
  
  if (timeSince < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - timeSince));
  }
  
  domainLastRequest.set(domain, Date.now());
}

/**
 * Extract financing and transparency signals from crawled pages
 */
function extractSignals(pages: PageResult[]): ExtractedSignals {
  const financingProviders = new Set<string>();
  let inHousePaymentPlan = false;
  let deferredInterest = false;
  let hasPriceList = false;
  let hasExamFee = false;
  let hasEstimatePromise = false;
  let transparentMention = false;
  const evidence: EvidenceItem[] = [];
  
  // Combine all page content for analysis
  for (const page of pages) {
    if (!page.hasFinancingKeywords && !page.hasTransparencyKeywords) continue;
    
    const text = page.textContent;
    
    // Check financing providers
    for (const [provider, pattern] of Object.entries(FINANCING_PATTERNS)) {
      const match = text.match(pattern);
      if (match) {
        financingProviders.add(provider);
        
        // Extract evidence snippet
        const snippet = extractSnippet(text, match.index!, match[0]);
        if (snippet && evidence.filter(e => e.label.includes(provider)).length < 2) {
          evidence.push({
            category: 'FINANCING',
            label: provider === 'IN_HOUSE_PAYMENT_PLAN' ? 'In-house payment plan' : provider,
            snippet,
            sourceUrl: page.url,
          });
        }
        
        if (provider === 'IN_HOUSE_PAYMENT_PLAN') {
          inHousePaymentPlan = true;
        }
      }
    }
    
    // Check for deferred interest
    for (const pattern of DEFERRED_INTEREST_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        deferredInterest = true;
        const snippet = extractSnippet(text, match.index!, match[0]);
        if (snippet && evidence.filter(e => e.label === 'Deferred interest risk').length === 0) {
          evidence.push({
            category: 'FINANCING',
            label: 'Deferred interest risk',
            snippet,
            sourceUrl: page.url,
          });
        }
        break;
      }
    }
    
    // Check transparency signals
    const priceListMatch = text.match(TRANSPARENCY_PATTERNS.PRICE_LIST);
    if (priceListMatch) {
      hasPriceList = true;
      const snippet = extractSnippet(text, priceListMatch.index!, priceListMatch[0]);
      if (snippet && evidence.filter(e => e.label === 'Price list').length === 0) {
        evidence.push({
          category: 'TRANSPARENCY',
          label: 'Price list',
          snippet,
          sourceUrl: page.url,
        });
      }
    }

    const examFeeMatch = text.match(TRANSPARENCY_PATTERNS.EXAM_FEE);
    if (examFeeMatch) {
      hasExamFee = true;
      const snippet = extractSnippet(text, examFeeMatch.index!, examFeeMatch[0]);
      if (snippet && evidence.filter(e => e.label === 'Exam fee disclosed').length === 0) {
        evidence.push({
          category: 'TRANSPARENCY',
          label: 'Exam fee disclosed',
          snippet,
          sourceUrl: page.url,
        });
      }
    }

    // Check for vaccine pricing (counts as transparency)
    const vaccineMatch = text.match(TRANSPARENCY_PATTERNS.VACCINE_PRICE);
    if (vaccineMatch) {
      const snippet = extractSnippet(text, vaccineMatch.index!, vaccineMatch[0]);
      if (snippet && evidence.filter(e => e.label === 'Vaccine price disclosed').length === 0) {
        evidence.push({
          category: 'TRANSPARENCY',
          label: 'Vaccine price disclosed',
          snippet,
          sourceUrl: page.url,
        });
      }
    }

    // Check for spay/neuter pricing
    const spayNeuterMatch = text.match(TRANSPARENCY_PATTERNS.SPAY_NEUTER_PRICE);
    if (spayNeuterMatch) {
      const snippet = extractSnippet(text, spayNeuterMatch.index!, spayNeuterMatch[0]);
      if (snippet && evidence.filter(e => e.label === 'Spay/neuter price disclosed').length === 0) {
        evidence.push({
          category: 'TRANSPARENCY',
          label: 'Spay/neuter price disclosed',
          snippet,
          sourceUrl: page.url,
        });
      }
    }

    // Check for wellness plan pricing (very high value signal)
    const wellnessPricingMatch = text.match(TRANSPARENCY_PATTERNS.WELLNESS_PRICING);
    if (wellnessPricingMatch) {
      hasPriceList = true; // Counts as a price list
      const snippet = extractSnippet(text, wellnessPricingMatch.index!, wellnessPricingMatch[0]);
      if (snippet && evidence.filter(e => e.label === 'Wellness plan pricing').length === 0) {
        evidence.push({
          category: 'TRANSPARENCY',
          label: 'Wellness plan pricing',
          snippet,
          sourceUrl: page.url,
        });
      }
    }

    const estimateMatch = text.match(TRANSPARENCY_PATTERNS.ESTIMATE_PROMISE);
    if (estimateMatch) {
      hasEstimatePromise = true;
      const snippet = extractSnippet(text, estimateMatch.index!, estimateMatch[0]);
      if (snippet && evidence.filter(e => e.label === 'Written estimates').length === 0) {
        evidence.push({
          category: 'TRANSPARENCY',
          label: 'Written estimates',
          snippet,
          sourceUrl: page.url,
        });
      }
    }

    if (TRANSPARENCY_PATTERNS.TRANSPARENT_MENTION.test(text)) {
      transparentMention = true;
    }
  }
  
  // Calculate transparency score
  let transparencyScore = 0;
  if (hasPriceList) transparencyScore += 60;
  if (hasExamFee) transparencyScore += 30;
  if (hasEstimatePromise) transparencyScore += 20;

  // Bonus points for specific price disclosures
  const vaccineEvidence = evidence.filter(e => e.label === 'Vaccine price disclosed');
  const spayNeuterEvidence = evidence.filter(e => e.label === 'Spay/neuter price disclosed');
  const wellnessEvidence = evidence.filter(e => e.label === 'Wellness plan pricing');

  if (vaccineEvidence.length > 0) transparencyScore += 15;
  if (spayNeuterEvidence.length > 0) transparencyScore += 15;
  if (wellnessEvidence.length > 0) transparencyScore += 20;

  if (transparentMention && transparencyScore === 0) transparencyScore += 10;
  transparencyScore = Math.min(100, transparencyScore);
  
  // Determine financing tier
  const financingTier = calculateFinancingTier(
    Array.from(financingProviders),
    inHousePaymentPlan,
    deferredInterest
  );
  
  // Calculate affordability score
  const tierScores: Record<string, number> = { A: 100, B: 75, C: 50, D: 25, E: 0 };
  const financingScore = tierScores[financingTier] || 0;
  const freshnessScore = 100; // Always fresh when just crawled
  
  const affordabilityScore = Math.round(
    financingScore * 0.55 +
    transparencyScore * 0.35 +
    freshnessScore * 0.10
  );
  
  // Calculate confidence based on evidence quality
  const confidence = calculateConfidence(pages, evidence);
  
  return {
    financingProviders: Array.from(financingProviders),
    inHousePaymentPlan,
    deferredInterest,
    hasPriceList,
    hasExamFee,
    hasEstimatePromise,
    transparencyScore,
    financingTier,
    affordabilityScore,
    confidence,
    evidence: evidence.slice(0, 10), // Max 10 evidence items
  };
}

/**
 * Extract a snippet around the matched text
 */
function extractSnippet(text: string, matchIndex: number, matchText: string): string {
  const contextChars = 80;
  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(text.length, matchIndex + matchText.length + contextChars);
  
  let snippet = text.slice(start, end).trim();
  
  // Add ellipsis if truncated
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  // Clean up whitespace
  snippet = snippet.replace(/\s+/g, ' ').trim();
  
  return snippet.slice(0, 200);
}

/**
 * Calculate the financing tier based on detected providers
 *
 * Tier 1: Best BNPL - Cherry, Sunbit, Affirm, VetBilling, in-house 0%, wellness plans
 *         (No deferred interest, transparent fixed payments)
 * Tier 2: Caution - Scratchpay, CareCredit, or unclear terms
 *         (May have deferred interest - interest accrues from day 1)
 * N: No financing detected
 */
function calculateFinancingTier(
  providers: string[],
  inHousePaymentPlan: boolean,
  deferredInterest: boolean
): string {
  // Tier 1: Best BNPL - Cherry, Sunbit, Affirm, VetBilling (no deferred interest)
  const tier1Providers = ['CHERRY', 'SUNBIT', 'AFFIRM', 'VETBILLING'];
  if (tier1Providers.some(p => providers.includes(p))) {
    return '1';
  }

  // Tier 1: In-house payment plans (0% interest)
  if (inHousePaymentPlan) {
    return '1';
  }

  // Note: WELLNESS_PLAN is an affordability signal but NOT a BNPL option
  // It doesn't affect the financing tier - it's tracked separately as evidence

  // Tier 2: Caution - Scratchpay, CareCredit (deferred interest risk)
  const tier2Providers = ['SCRATCHPAY', 'CARECREDIT'];
  if (tier2Providers.some(p => providers.includes(p))) {
    return '2';
  }

  // Tier 2: Has deferred interest detected
  if (deferredInterest) {
    return '2';
  }

  // Tier 2: Has some financing but unclear terms
  if (providers.includes('FINANCING_AVAILABLE') || providers.length > 0) {
    return '2';
  }

  // N: No financing detected
  return 'N';
}

/**
 * Calculate confidence score based on evidence quality
 */
function calculateConfidence(pages: PageResult[], evidence: EvidenceItem[]): number {
  let confidence = 0;

  // More pages crawled = higher confidence
  confidence += Math.min(0.3, pages.length * 0.02);

  // More evidence = higher confidence
  confidence += Math.min(0.4, evidence.length * 0.08);

  // Pages with relevant keywords = higher confidence
  const relevantPages = pages.filter(p => p.hasFinancingKeywords || p.hasTransparencyKeywords);
  confidence += Math.min(0.3, relevantPages.length * 0.05);

  return Math.min(1, Math.round(confidence * 100) / 100);
}

/**
 * Extract prices from crawled pages
 */
function extractPrices(pages: PageResult[]): ExtractedPriceItem[] {
  const prices: ExtractedPriceItem[] = [];
  const seenPrices = new Map<string, number>(); // serviceType -> lowest price seen

  console.log(`  [extractPrices] Processing ${pages.length} pages`);

  for (const page of pages) {
    // Only look at pages that might have pricing info
    if (!page.hasTransparencyKeywords && !page.textContent.includes('$')) continue;

    const text = page.textContent;
    const urlLower = page.url.toLowerCase();
    console.log(`  [extractPrices] Checking page: ${page.url.substring(0, 60)} (${text.length} chars)`);

    // First, try to detect service type from URL and look for "How much does it cost? $X" pattern
    let urlServiceType: string | null = null;
    for (const [keyword, serviceType] of Object.entries(SERVICE_TYPE_FROM_URL)) {
      if (urlLower.includes(keyword)) {
        urlServiceType = serviceType;
        break;
      }
    }

    // Universal pattern: "How much does it cost? $X" - common on Emancipet-style sites
    if (urlServiceType) {
      const costPattern = /(?:how\s+much|cost|price)[^$]*\$\s*(\d+(?:\.\d{2})?)/gi;
      let match;
      while ((match = costPattern.exec(text)) !== null) {
        const price = parseFloat(match[1]);
        console.log(`    [extractPrices] URL-based: Found $${price} for ${urlServiceType} (from URL)`);

        // Sanity check
        if (price >= 10 && price <= 2000) {
          const priceInCents = Math.round(price * 100);
          const existingLowest = seenPrices.get(urlServiceType);

          if (existingLowest === undefined || priceInCents < existingLowest) {
            seenPrices.set(urlServiceType, priceInCents);

            // Extract context
            const contextStart = Math.max(0, match.index - 50);
            const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
            let snippet = text.slice(contextStart, contextEnd).trim();
            if (contextStart > 0) snippet = '...' + snippet;
            if (contextEnd < text.length) snippet = snippet + '...';
            snippet = snippet.replace(/\s+/g, ' ').slice(0, 200);

            // Remove any existing price for this service type
            const existingIndex = prices.findIndex(p => p.serviceType === urlServiceType);
            if (existingIndex !== -1) {
              prices.splice(existingIndex, 1);
            }

            // Get service name from PRICE_EXTRACTION_PATTERNS
            const config = PRICE_EXTRACTION_PATTERNS.find(p => p.serviceType === urlServiceType);
            const serviceName = config?.serviceName || urlServiceType;

            prices.push({
              serviceType: urlServiceType,
              serviceName,
              minPrice: priceInCents,
              maxPrice: null,
              snippet,
              sourceUrl: page.url,
            });
          }
        }
        break; // Only take the first price from each page
      }
    }

    for (const priceConfig of PRICE_EXTRACTION_PATTERNS) {
      for (const pattern of priceConfig.patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(text)) !== null) {
          const priceStr = match[1];
          if (!priceStr) continue;

          const price = parseFloat(priceStr);
          console.log(`    [extractPrices] Found $${price} for ${priceConfig.serviceType}`);

          // Sanity check: prices should be reasonable
          // Exam fees: $20-$200, Vaccines: $15-$150, Spay/neuter: $50-$1000, etc.
          const minReasonable = priceConfig.serviceType === 'wellness_plan' ? 10 : 15;
          const maxReasonable = priceConfig.serviceType === 'dental' ? 2000 :
                               priceConfig.serviceType === 'emergency' ? 500 :
                               priceConfig.serviceType === 'spay_neuter' ? 1000 :
                               priceConfig.serviceType === 'bloodwork' ? 500 :
                               priceConfig.serviceType === 'xray' ? 500 :
                               priceConfig.serviceType === 'wellness_plan' ? 150 :
                               300;

          if (price < minReasonable || price > maxReasonable) continue;

          const priceInCents = Math.round(price * 100);

          // Only keep the lowest price for each service type
          const existingLowest = seenPrices.get(priceConfig.serviceType);
          if (existingLowest !== undefined && priceInCents >= existingLowest) {
            continue;
          }

          seenPrices.set(priceConfig.serviceType, priceInCents);

          // Extract context around the match
          const contextStart = Math.max(0, match.index - 50);
          const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
          let snippet = text.slice(contextStart, contextEnd).trim();
          if (contextStart > 0) snippet = '...' + snippet;
          if (contextEnd < text.length) snippet = snippet + '...';
          snippet = snippet.replace(/\s+/g, ' ').slice(0, 200);

          // Remove any existing price for this service type (keep lowest)
          const existingIndex = prices.findIndex(p => p.serviceType === priceConfig.serviceType);
          if (existingIndex !== -1) {
            prices.splice(existingIndex, 1);
          }

          prices.push({
            serviceType: priceConfig.serviceType,
            serviceName: priceConfig.serviceName || priceConfig.serviceType,
            minPrice: priceInCents,
            maxPrice: null,
            snippet,
            sourceUrl: page.url,
          });
        }
      }
    }
  }

  return prices;
}
