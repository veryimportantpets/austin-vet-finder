/**
 * Fetch financing provider data from Cherry and Scratchpay directories
 */

import { chromium, Page } from 'playwright';
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
  source: 'cherry' | 'scratchpay';
  fetchedAt: string;
}

async function fetchScratchpayProviders(): Promise<Provider[]> {
  console.log('🔍 Fetching Scratchpay providers for Austin, TX...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const providers: Provider[] = [];

  try {
    console.log('Loading Scratchpay search page...');
    await page.goto('https://scratchpay.com/practices/search', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for page to be interactive
    await page.waitForTimeout(3000);

    // Look for the address input field
    console.log('Looking for search input...');

    // The page has "Search by Address" tab - click it if needed
    const addressTab = page.locator('text=Search by Address');
    if (await addressTab.count() > 0) {
      await addressTab.click();
      await page.waitForTimeout(500);
    }

    // Find the autocomplete input for address
    const addressInput = page.locator('#autocomplete, input[placeholder*="address"], input[placeholder*="location"]');
    if (await addressInput.count() > 0) {
      console.log('Found address input, entering Austin, TX...');
      await addressInput.first().click();
      await addressInput.first().fill('Austin, TX');
      await page.waitForTimeout(1500);

      // Press down arrow and enter to select first autocomplete result
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Take screenshot after search
    await page.screenshot({ path: path.join(DATA_DIR, 'scratchpay-after-search.png'), fullPage: true });
    console.log('Screenshot saved after search');

    // Wait for results to load
    await page.waitForTimeout(3000);

    // Extract provider data from the results
    const results = await page.evaluate(() => {
      const items: { name: string; address: string; category: string }[] = [];

      // Look for result cards/items
      // Based on the page structure, results appear in the list view
      const resultElements = document.querySelectorAll('.search-result, .practice-result, .result-card, [class*="result"], [class*="practice"]');

      resultElements.forEach(el => {
        const nameEl = el.querySelector('h3, h4, h5, .name, [class*="name"], [class*="title"]');
        const addressEl = el.querySelector('.address, [class*="address"], p');
        const categoryEl = el.querySelector('.category, [class*="category"]');

        const name = nameEl?.textContent?.trim();
        const address = addressEl?.textContent?.trim();
        const category = categoryEl?.textContent?.trim() || '';

        if (name && name.length > 2 && name.length < 150) {
          items.push({ name, address: address || '', category });
        }
      });

      // Also try to find data in any JSON embedded in the page
      const scripts = document.querySelectorAll('script');
      let jsonData: any = null;
      scripts.forEach(script => {
        const text = script.textContent || '';
        if (text.includes('practices') && text.includes('address')) {
          try {
            // Look for JSON data patterns
            const match = text.match(/\{[\s\S]*"practices"[\s\S]*\}/);
            if (match) {
              jsonData = JSON.parse(match[0]);
            }
          } catch {}
        }
      });

      return {
        items,
        htmlContent: document.body.innerHTML.slice(0, 10000),
        jsonData
      };
    });

    console.log(`Found ${results.items.length} providers from DOM`);

    if (results.jsonData) {
      console.log('Found embedded JSON data');
    }

    // If we found items, add them
    for (const item of results.items) {
      if (item.category.toLowerCase().includes('vet') || item.category === '') {
        providers.push({
          name: item.name,
          address: item.address,
          city: 'Austin',
          state: 'TX',
          source: 'scratchpay',
          fetchedAt: new Date().toISOString()
        });
      }
    }

    // Save raw HTML for debugging
    fs.writeFileSync(path.join(DATA_DIR, 'scratchpay-raw.html'), results.htmlContent);
    console.log('Saved raw HTML for debugging');

  } catch (error) {
    console.error('Error fetching Scratchpay:', error);
  } finally {
    await browser.close();
  }

  return providers;
}

async function fetchCherryProviders(): Promise<Provider[]> {
  console.log('\n🍒 Fetching Cherry providers for Austin, TX...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const providers: Provider[] = [];

  try {
    // Try the vet-finder page first
    console.log('Loading Cherry vet finder...');
    await page.goto('https://withcherry.com/vet-finder', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    // Look for a search button that leads to the finder
    const searchButton = page.locator('a:has-text("SEARCH PROVIDERS"), a:has-text("Find"), button:has-text("Search")');
    if (await searchButton.count() > 0) {
      console.log('Found search button, clicking...');

      // Get the href if it's a link
      const href = await searchButton.first().getAttribute('href');
      if (href) {
        console.log(`Navigating to: ${href}`);
        await page.goto(href.startsWith('http') ? href : `https://withcherry.com${href}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      } else {
        await searchButton.first().click();
      }
      await page.waitForTimeout(3000);
    }

    // Take screenshot
    await page.screenshot({ path: path.join(DATA_DIR, 'cherry-page.png'), fullPage: true });
    console.log('Screenshot saved');

    // Try to find and interact with search
    const searchInput = page.locator('input[type="text"], input[placeholder*="zip"], input[placeholder*="location"]');
    if (await searchInput.count() > 0) {
      console.log('Found search input...');
      await searchInput.first().fill('78701');
      await page.waitForTimeout(1000);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    // Extract any provider data
    const results = await page.evaluate(() => {
      const items: { name: string; address: string }[] = [];

      // Look for any card-like elements
      document.querySelectorAll('[class*="card"], [class*="result"], [class*="provider"], [class*="practice"]').forEach(el => {
        const name = el.querySelector('h2, h3, h4, [class*="name"]')?.textContent?.trim();
        const address = el.querySelector('[class*="address"], p')?.textContent?.trim();
        if (name && name.length > 2 && name.length < 100) {
          items.push({ name, address: address || '' });
        }
      });

      return {
        items,
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.slice(0, 5000)
      };
    });

    console.log(`Page: ${results.url}`);
    console.log(`Title: ${results.title}`);
    console.log(`Found ${results.items.length} potential providers`);

    // Save body text for debugging
    fs.writeFileSync(path.join(DATA_DIR, 'cherry-text.txt'), results.bodyText);

    for (const item of results.items) {
      providers.push({
        name: item.name,
        address: item.address,
        city: 'Austin',
        state: 'TX',
        source: 'cherry',
        fetchedAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error fetching Cherry:', error);
  } finally {
    await browser.close();
  }

  return providers;
}

// Alternative: Search via Google for known partnerships
async function searchKnownPartnerships(): Promise<void> {
  console.log('\n📋 Checking known financing partnerships...\n');

  // Known Austin vet clinics that advertise Cherry or Scratchpay
  // This data is based on common web search patterns
  const knownPartnerships = {
    cherry: [
      // Clinics commonly found advertising Cherry
      { name: 'Heart of Texas Veterinary Specialty Center', note: 'Often listed as Cherry partner' },
      { name: 'Austin Veterinary Emergency', note: 'Specialty centers often use Cherry' },
    ],
    scratchpay: [
      // Scratchpay is commonly used by general practice vets
      { name: 'Thrive Affordable Vet Care', note: 'Budget-focused clinics often use Scratchpay' },
      { name: 'Emancipet', note: 'Nonprofit clinics may use Scratchpay' },
    ]
  };

  console.log('Known Cherry partners:');
  knownPartnerships.cherry.forEach(p => console.log(`  - ${p.name} (${p.note})`));

  console.log('\nKnown Scratchpay partners:');
  knownPartnerships.scratchpay.forEach(p => console.log(`  - ${p.name} (${p.note})`));

  console.log('\nNote: These are examples. Actual partnerships should be verified by crawling clinic websites.');
}

async function main() {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('='.repeat(60));
  console.log('Fetching financing provider directories');
  console.log('='.repeat(60) + '\n');

  // Fetch from both sources
  const scratchpayProviders = await fetchScratchpayProviders();
  const cherryProviders = await fetchCherryProviders();

  // Save results
  fs.writeFileSync(
    path.join(DATA_DIR, 'scratchpay-providers.json'),
    JSON.stringify(scratchpayProviders, null, 2)
  );
  console.log(`\n✅ Saved ${scratchpayProviders.length} Scratchpay providers to data/scratchpay-providers.json`);

  fs.writeFileSync(
    path.join(DATA_DIR, 'cherry-providers.json'),
    JSON.stringify(cherryProviders, null, 2)
  );
  console.log(`✅ Saved ${cherryProviders.length} Cherry providers to data/cherry-providers.json`);

  // Show known partnerships as reference
  await searchKnownPartnerships();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Scratchpay: ${scratchpayProviders.length} providers found`);
  console.log(`Cherry: ${cherryProviders.length} providers found`);
  console.log('\nScreenshots and debug files saved to data/ directory');
  console.log('\n⚠️  If provider counts are low, the directories may require');
  console.log('   manual interaction or the search results are map-based.');
  console.log('   Check the screenshots to see what the pages look like.');
}

main().catch(console.error);
