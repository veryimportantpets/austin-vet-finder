/**
 * Parse Scratchpay page text to extract veterinary providers
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');

interface Provider {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  source: 'scratchpay';
  fetchedAt: string;
}

function parseProviders(text: string): Provider[] {
  const providers: Provider[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Look for pattern: Name, "Veterinary", Address, "City, State, ZIP", "Find payment plan"
  for (let i = 0; i < lines.length - 3; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    const addressLine = lines[i + 2];
    const locationLine = lines[i + 3];

    // Check if this is a veterinary listing
    if (nextLine === 'Veterinary' || line.includes('Veterinary')) {
      let name: string;
      let address: string;
      let location: string;

      if (nextLine === 'Veterinary') {
        // Pattern: Name on line before "Veterinary"
        name = line;
        address = addressLine;
        location = locationLine;
      } else if (line === 'Veterinary') {
        // Pattern: "Veterinary" comes first (name might be on previous line)
        continue; // Skip, will be handled by previous iteration
      } else {
        continue;
      }

      // Skip header text
      if (name.includes('Find a Veterinary') || name.includes('Clinic Near You')) {
        continue;
      }

      // Skip navigation items
      if (name.includes('Login') || name.includes('For Borrowers') || name.includes('FAQs')) {
        continue;
      }

      // Parse location (City, State, ZIP)
      const locationMatch = location.match(/^([^,]+),\s*(\w{2}),?\s*(\d{5})?/);
      if (locationMatch) {
        const [, city, state, zip] = locationMatch;

        providers.push({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip || '',
          source: 'scratchpay',
          fetchedAt: new Date().toISOString(),
        });

        // Skip past this entry
        i += 4;
      }
    }
  }

  // Deduplicate by name
  const seen = new Set<string>();
  return providers.filter(p => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('Scratchpay Text Parser');
  console.log('='.repeat(60) + '\n');

  const textPath = path.join(DATA_DIR, 'scratchpay-page-text.txt');

  if (!fs.existsSync(textPath)) {
    console.log('❌ Page text file not found. Run fetch-scratchpay-providers.ts first.');
    process.exit(1);
  }

  const text = fs.readFileSync(textPath, 'utf-8');
  console.log(`Read ${text.length} characters from page text\n`);

  const providers = parseProviders(text);

  // Save results
  const outputPath = path.join(DATA_DIR, 'scratchpay-providers.json');
  fs.writeFileSync(outputPath, JSON.stringify(providers, null, 2));

  console.log('='.repeat(60));
  console.log(`Found ${providers.length} Scratchpay veterinary providers`);
  console.log('='.repeat(60) + '\n');

  if (providers.length > 0) {
    console.log('Providers:');
    providers.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   ${p.address}`);
      console.log(`   ${p.city}, ${p.state} ${p.zip}\n`);
    });

    console.log(`\nSaved to: ${outputPath}`);
  }
}

main().catch(console.error);
