/**
 * Fetch Cherry financing providers for Austin, TX veterinary clinics
 * Uses Playwright to interact with the map-based finder interface
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');

interface Provider {
  name: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  category?: string;
  source: 'cherry';
  fetchedAt: string;
}

async function fetchCherryProviders(): Promise<Provider[]> {
  console.log('🍒 Fetching Cherry providers for Austin, TX veterinary clinics...\n');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false, // Run with visible browser for debugging
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const providers: Provider[] = [];

  try {
    // Go directly to the Cherry finder
    console.log('1. Loading Cherry finder...');
    await page.goto('https://finder.withcherry.com/', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for the page to fully load
    await page.waitForTimeout(3000);
    console.log('   Page loaded');

    // Take initial screenshot
    await page.screenshot({ path: path.join(DATA_DIR, 'cherry-1-initial.png') });

    // Look for location/zip input
    console.log('2. Looking for search input...');

    // Try different input selectors
    const inputSelectors = [
      'input[placeholder*="zip"]',
      'input[placeholder*="Zip"]',
      'input[placeholder*="location"]',
      'input[placeholder*="Location"]',
      'input[placeholder*="city"]',
      'input[placeholder*="address"]',
      'input[type="text"]',
      'input[type="search"]',
    ];

    let searchInput = null;
    for (const selector of inputSelectors) {
      const input = page.locator(selector).first();
      if (await input.count() > 0) {
        searchInput = input;
        console.log(`   Found input with selector: ${selector}`);
        break;
      }
    }

    if (searchInput) {
      // Enter Austin ZIP code
      console.log('3. Entering Austin, TX 78701...');
      await searchInput.click();
      await searchInput.fill('78701');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: path.join(DATA_DIR, 'cherry-2-after-search.png') });
    }

    // Look for category/industry selector (to filter to veterinary)
    console.log('4. Looking for veterinary category filter...');
    const vetButtons = [
      'button:has-text("Veterinary")',
      'button:has-text("Vet")',
      'a:has-text("Veterinary")',
      '[data-category="veterinary"]',
      'text=Veterinary',
    ];

    for (const selector of vetButtons) {
      const btn = page.locator(selector).first();
      if (await btn.count() > 0) {
        console.log(`   Found vet filter: ${selector}`);
        await btn.click();
        await page.waitForTimeout(2000);
        break;
      }
    }

    await page.screenshot({ path: path.join(DATA_DIR, 'cherry-3-filtered.png') });

    // Wait for results to load
    console.log('5. Waiting for results...');
    await page.waitForTimeout(3000);

    // Try to extract provider data from various possible structures
    console.log('6. Extracting provider data...');

    const extractedData = await page.evaluate(() => {
      const results: any[] = [];

      // Try various selectors for result cards
      const cardSelectors = [
        '[class*="provider"]',
        '[class*="result"]',
        '[class*="card"]',
        '[class*="listing"]',
        '[class*="practice"]',
        '[class*="clinic"]',
      ];

      for (const selector of cardSelectors) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
          cards.forEach(card => {
            const text = card.textContent || '';
            // Look for name (usually in heading elements)
            const heading = card.querySelector('h1, h2, h3, h4, h5, h6, [class*="name"], [class*="title"]');
            const name = heading?.textContent?.trim();

            // Look for address
            const addressEl = card.querySelector('[class*="address"], address, p');
            const address = addressEl?.textContent?.trim();

            // Look for phone
            const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
            const phone = phoneMatch ? phoneMatch[0] : undefined;

            if (name && name.length > 3 && name.length < 100) {
              results.push({ name, address, phone, cardText: text.slice(0, 200) });
            }
          });

          if (results.length > 0) break;
        }
      }

      // Also try to find any JSON data in the page
      const scripts = document.querySelectorAll('script');
      let jsonData: any = null;
      scripts.forEach(script => {
        const content = script.textContent || '';
        if (content.includes('provider') || content.includes('practice') || content.includes('clinic')) {
          // Look for JSON-like structures
          const matches = content.match(/\[\s*\{[^[\]]*"name"[^[\]]*\}\s*\]/g);
          if (matches) {
            try {
              jsonData = JSON.parse(matches[0]);
            } catch {}
          }
        }
      });

      return {
        cardResults: results,
        jsonData,
        pageText: document.body.innerText.slice(0, 5000),
        pageTitle: document.title,
        url: window.location.href,
      };
    });

    console.log(`   Found ${extractedData.cardResults.length} card results`);
    console.log(`   Page title: ${extractedData.pageTitle}`);
    console.log(`   URL: ${extractedData.url}`);

    // Save page text for debugging
    fs.writeFileSync(
      path.join(DATA_DIR, 'cherry-page-text.txt'),
      extractedData.pageText
    );

    // Process extracted data
    for (const item of extractedData.cardResults) {
      providers.push({
        name: item.name,
        address: item.address || '',
        city: 'Austin',
        state: 'TX',
        phone: item.phone,
        source: 'cherry',
        fetchedAt: new Date().toISOString(),
      });
    }

    // Take final screenshot
    await page.screenshot({ path: path.join(DATA_DIR, 'cherry-4-final.png'), fullPage: true });

    // If we didn't find results, try scrolling and waiting
    if (providers.length === 0) {
      console.log('7. No results found, trying to scroll and load more...');

      // Scroll down to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(DATA_DIR, 'cherry-5-scrolled.png'), fullPage: true });
    }

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: path.join(DATA_DIR, 'cherry-error.png') });
  } finally {
    await browser.close();
  }

  return providers;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Cherry Provider Fetcher');
  console.log('='.repeat(60) + '\n');

  const providers = await fetchCherryProviders();

  // Save results
  const outputPath = path.join(DATA_DIR, 'cherry-providers.json');
  fs.writeFileSync(outputPath, JSON.stringify(providers, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('Results');
  console.log('='.repeat(60));
  console.log(`Found ${providers.length} Cherry providers`);
  console.log(`Saved to: ${outputPath}`);

  if (providers.length > 0) {
    console.log('\nProviders found:');
    providers.forEach(p => console.log(`  - ${p.name}`));
  } else {
    console.log('\n⚠️  No providers extracted from the page.');
    console.log('   Check the screenshots in data/ directory to see what the page looks like.');
    console.log('   The Cherry finder may require manual interaction or use a different data source.');
  }
}

main().catch(console.error);
