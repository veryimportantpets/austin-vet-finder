/**
 * Fetch Scratchpay providers for Austin, TX veterinary clinics
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
  phone?: string;
  category?: string;
  source: 'scratchpay';
  fetchedAt: string;
}

async function fetchScratchpayProviders(): Promise<Provider[]> {
  console.log('💳 Fetching Scratchpay providers for Austin, TX...\n');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    geolocation: { latitude: 30.2672, longitude: -97.7431 }, // Austin, TX
    permissions: ['geolocation'],
  });

  const page = await context.newPage();
  const providers: Provider[] = [];

  try {
    console.log('1. Loading Scratchpay search page...');
    await page.goto('https://scratchpay.com/practices/search', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(DATA_DIR, 'scratchpay-1-initial.png') });
    console.log('   Page loaded');

    // Click "Search by Address" tab if it exists
    console.log('2. Setting up search...');
    const addressTab = page.locator('text=Search by Address');
    if (await addressTab.count() > 0) {
      await addressTab.click();
      await page.waitForTimeout(500);
    }

    // Find and fill the autocomplete input
    const autocomplete = page.locator('#autocomplete');
    if (await autocomplete.count() > 0) {
      console.log('3. Entering Austin, TX...');
      await autocomplete.click();
      await autocomplete.fill('Austin, TX');
      await page.waitForTimeout(1500);

      // Select first autocomplete suggestion
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Select Veterinary from category dropdown
    console.log('4. Selecting Veterinary category...');
    const categorySelect = page.locator('select').filter({ hasText: 'All Categories' });
    if (await categorySelect.count() > 0) {
      await categorySelect.selectOption({ label: 'Veterinary' });
      await page.waitForTimeout(1000);
    }

    // Select larger distance
    const drivingRadio = page.locator('text=Driving');
    if (await drivingRadio.count() > 0) {
      await drivingRadio.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: path.join(DATA_DIR, 'scratchpay-2-after-search.png') });
    console.log('5. Waiting for results...');
    await page.waitForTimeout(3000);

    // Try to extract results from the page
    console.log('6. Extracting provider data...');

    // The Scratchpay page likely shows results on a map with a list
    // Let's look for the list items
    const extractedData = await page.evaluate(() => {
      const results: any[] = [];

      // Try to find result list items
      const listItems = document.querySelectorAll('[class*="result"], [class*="practice"], [class*="clinic"], li');

      listItems.forEach(item => {
        const text = item.textContent || '';
        // Filter out navigation items
        if (text.length < 10 || text.length > 500) return;
        if (text.includes('Borrower') || text.includes('Login') || text.includes('Cookie')) return;

        // Look for name-like headings
        const heading = item.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
        const name = heading?.textContent?.trim();

        // Look for address patterns
        const addressMatch = text.match(/\d+\s+[\w\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct)[\w\s,]*/i);
        const address = addressMatch ? addressMatch[0].trim() : undefined;

        // Look for phone
        const phoneMatch = text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        const phone = phoneMatch ? phoneMatch[0] : undefined;

        // Look for "Veterinary" category mention
        const isVet = text.toLowerCase().includes('vet');

        if (name && name.length > 3 && name.length < 80) {
          results.push({
            name,
            address,
            phone,
            isVet,
            rawText: text.slice(0, 200),
          });
        }
      });

      // Also check for any data in network responses or embedded JSON
      const bodyText = document.body.innerText;

      return {
        listResults: results,
        bodyText: bodyText.slice(0, 8000),
        url: window.location.href,
      };
    });

    console.log(`   Found ${extractedData.listResults.length} list items`);

    // Save page text for analysis
    fs.writeFileSync(
      path.join(DATA_DIR, 'scratchpay-page-text.txt'),
      extractedData.bodyText
    );

    // Filter to likely veterinary practices and add to providers
    for (const item of extractedData.listResults) {
      if (item.isVet || item.name.toLowerCase().includes('animal') || item.name.toLowerCase().includes('pet')) {
        providers.push({
          name: item.name,
          address: item.address || '',
          city: 'Austin',
          state: 'TX',
          phone: item.phone,
          category: 'Veterinary',
          source: 'scratchpay',
          fetchedAt: new Date().toISOString(),
        });
      }
    }

    // Take final screenshot
    await page.screenshot({ path: path.join(DATA_DIR, 'scratchpay-3-final.png'), fullPage: true });

    // If we found no results in the list, the results might be only on the map
    if (providers.length === 0) {
      console.log('7. No list results, checking for map markers...');

      // Click on map markers if they exist
      const mapMarkers = page.locator('[class*="marker"], [class*="pin"]');
      const markerCount = await mapMarkers.count();
      console.log(`   Found ${markerCount} potential map markers`);

      // Try clicking first few markers to see popup data
      for (let i = 0; i < Math.min(5, markerCount); i++) {
        try {
          await mapMarkers.nth(i).click();
          await page.waitForTimeout(1000);

          // Look for popup content
          const popupData = await page.evaluate(() => {
            const popup = document.querySelector('[class*="popup"], [class*="info"], [class*="tooltip"]');
            if (popup) {
              return popup.textContent;
            }
            return null;
          });

          if (popupData) {
            console.log(`   Marker ${i} popup: ${popupData.slice(0, 100)}`);
          }
        } catch {}
      }

      await page.screenshot({ path: path.join(DATA_DIR, 'scratchpay-4-markers.png'), fullPage: true });
    }

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: path.join(DATA_DIR, 'scratchpay-error.png') });
  } finally {
    await browser.close();
  }

  return providers;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Scratchpay Provider Fetcher');
  console.log('='.repeat(60) + '\n');

  const providers = await fetchScratchpayProviders();

  const outputPath = path.join(DATA_DIR, 'scratchpay-providers.json');
  fs.writeFileSync(outputPath, JSON.stringify(providers, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('Results');
  console.log('='.repeat(60));
  console.log(`Found ${providers.length} Scratchpay providers`);
  console.log(`Saved to: ${outputPath}`);

  if (providers.length > 0) {
    console.log('\nProviders found:');
    providers.forEach(p => console.log(`  - ${p.name} (${p.address || 'no address'})`));
  } else {
    console.log('\n⚠️  No providers extracted.');
    console.log('   Check screenshots in data/ for debugging.');
    console.log('   The search interface may be map-only with no list view.');
  }
}

main().catch(console.error);
