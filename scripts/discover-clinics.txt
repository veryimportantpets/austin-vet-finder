#!/usr/bin/env tsx
/**
 * Discover Austin veterinary clinics using Google Places API
 *
 * Enhanced to search multiple areas for comprehensive coverage.
 * Austin metro area is large (~300 sq miles), so we search multiple points.
 *
 * Prerequisites:
 *   - Set GOOGLE_PLACES_API_KEY environment variable
 *
 * Usage:
 *   npm run crawl:discover
 *   GOOGLE_PLACES_API_KEY=xxx npm run crawl:discover
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Austin area search points - covering different neighborhoods
// Each point will search a 10km radius to ensure overlap and coverage
const SEARCH_POINTS = [
  // Central Austin
  { name: 'Downtown', lat: 30.2672, lng: -97.7431 },
  { name: 'Hyde Park/North Loop', lat: 30.3074, lng: -97.7225 },
  { name: 'East Austin', lat: 30.2649, lng: -97.7092 },
  { name: 'South Austin', lat: 30.2241, lng: -97.7654 },
  { name: 'West Austin/Tarrytown', lat: 30.2950, lng: -97.7750 },

  // North Austin
  { name: 'North Austin/Domain', lat: 30.3975, lng: -97.7253 },
  { name: 'Mueller', lat: 30.2986, lng: -97.7025 },
  { name: 'Pflugerville area', lat: 30.4393, lng: -97.6200 },

  // South Austin extended
  { name: 'South Lamar/Barton Hills', lat: 30.2450, lng: -97.7950 },
  { name: 'Manchaca/Slaughter', lat: 30.1650, lng: -97.8300 },
  { name: 'Circle C/Mopac South', lat: 30.1700, lng: -97.8650 },

  // Northwest
  { name: 'Northwest Hills', lat: 30.3650, lng: -97.7550 },
  { name: 'Cedar Park border', lat: 30.4350, lng: -97.8200 },
  { name: 'Anderson Mill', lat: 30.4500, lng: -97.8000 },

  // Northeast
  { name: 'Windsor Park', lat: 30.3100, lng: -97.6850 },
  { name: 'Tech Ridge', lat: 30.4150, lng: -97.6650 },

  // Southwest
  { name: 'Oak Hill', lat: 30.2350, lng: -97.8550 },
  { name: 'Bee Cave/Lakeway border', lat: 30.3000, lng: -97.9400 },
  { name: 'Dripping Springs border', lat: 30.2000, lng: -97.9500 },

  // Southeast
  { name: 'Southeast Austin', lat: 30.2100, lng: -97.7200 },
  { name: 'Del Valle area', lat: 30.1700, lng: -97.6700 },
];

const SEARCH_RADIUS = 10000; // 10km radius per search point

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_phone_number?: string;
  website?: string;
  business_status?: string;
  rating?: number;
  user_ratings_total?: number;
}

async function searchPlaces(
  apiKey: string,
  lat: number,
  lng: number,
  pageToken?: string
): Promise<{ results: PlaceResult[]; nextPageToken?: string }> {
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  const params = new URLSearchParams({
    key: apiKey,
    location: `${lat},${lng}`,
    radius: String(SEARCH_RADIUS),
    type: 'veterinary_care',
    ...(pageToken ? { pagetoken: pageToken } : {}),
  });

  const response = await fetch(`${baseUrl}?${params}`);
  const data = await response.json();

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.log('    Rate limited, waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return searchPlaces(apiKey, lat, lng, pageToken);
    }
    throw new Error(`Places API error: ${data.status} - ${data.error_message || ''}`);
  }

  return {
    results: data.results || [],
    nextPageToken: data.next_page_token,
  };
}

async function getPlaceDetails(apiKey: string, placeId: string): Promise<PlaceResult | null> {
  const baseUrl = 'https://maps.googleapis.com/maps/api/place/details/json';

  const params = new URLSearchParams({
    key: apiKey,
    place_id: placeId,
    fields: 'place_id,name,formatted_address,geometry,formatted_phone_number,website,business_status,rating,user_ratings_total',
  });

  const response = await fetch(`${baseUrl}?${params}`);
  const data = await response.json();

  if (data.status === 'OVER_QUERY_LIMIT') {
    console.log('    Rate limited on details, waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    return getPlaceDetails(apiKey, placeId);
  }

  if (data.status !== 'OK') {
    return null;
  }

  return data.result;
}

function parseAddress(formattedAddress: string): {
  address: string;
  city: string;
  state: string;
  zip: string;
} {
  // Format: "123 Main St, Austin, TX 78701, USA"
  const parts = formattedAddress.split(', ');

  // Remove USA if present
  if (parts[parts.length - 1] === 'USA') {
    parts.pop();
  }

  // Extract state and zip from last part
  const stateZip = parts.pop() || '';
  const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/);
  const state = stateZipMatch?.[1] || 'TX';
  const zip = stateZipMatch?.[2] || '';

  const city = parts.pop() || 'Austin';
  const address = parts.join(', ');

  return { address, city, state, zip };
}

// Check if a clinic is within Austin metro area
function isInAustinMetro(city: string): boolean {
  const austinMetroCities = [
    'austin', 'round rock', 'cedar park', 'pflugerville', 'georgetown',
    'leander', 'kyle', 'buda', 'lakeway', 'bee cave', 'west lake hills',
    'rollingwood', 'sunset valley', 'manor', 'dripping springs',
    'lago vista', 'jonestown', 'volente', 'spicewood', 'del valle'
  ];
  return austinMetroCities.includes(city.toLowerCase());
}

// Validate website URL - skip suspicious/spam domains
function isValidWebsiteUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();

    // Suspicious TLDs commonly used for spam/phishing
    const suspiciousTLDs = ['.top', '.xyz', '.click', '.link', '.work', '.party', '.gq', '.ml', '.cf', '.tk'];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      console.log(`    (suspicious domain blocked: ${domain})`);
      return null;
    }

    // Suspicious patterns
    const suspiciousPatterns = ['usaglobaly', 'freehost', 'tempsite', 'redirect'];
    if (suspiciousPatterns.some(p => domain.includes(p))) {
      console.log(`    (suspicious pattern blocked: ${domain})`);
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error('Error: GOOGLE_PLACES_API_KEY environment variable not set\n');
    console.log('To use this script:');
    console.log('  1. Get an API key from Google Cloud Console');
    console.log('  2. Enable the Places API');
    console.log('  3. Run: GOOGLE_PLACES_API_KEY=your_key npm run crawl:discover\n');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Austin Vet Finder - Comprehensive Clinic Discovery');
  console.log('='.repeat(60));
  console.log(`\nSearching ${SEARCH_POINTS.length} areas across Austin metro...\n`);

  // Track all unique places by place_id
  const allPlaces: Map<string, PlaceResult> = new Map();

  // Search each area
  for (const point of SEARCH_POINTS) {
    console.log(`Searching: ${point.name} (${point.lat}, ${point.lng})`);

    let pageToken: string | undefined;
    let pageNum = 1;
    let areaCount = 0;

    do {
      // Wait before fetching next page (Google requires ~2 second delay)
      if (pageToken) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }

      try {
        const { results, nextPageToken } = await searchPlaces(apiKey, point.lat, point.lng, pageToken);

        for (const place of results) {
          if (!allPlaces.has(place.place_id)) {
            allPlaces.set(place.place_id, place);
            areaCount++;
          }
        }

        pageToken = nextPageToken;
        pageNum++;
      } catch (error) {
        console.error(`  Error searching ${point.name}:`, error);
        break;
      }
    } while (pageToken && pageNum <= 3);

    console.log(`  Found ${areaCount} new clinics (${allPlaces.size} total unique)`);

    // Small delay between areas to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Found ${allPlaces.size} unique veterinary clinics`);
  console.log('='.repeat(60));
  console.log('\nFetching details and saving to database...\n');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let processed = 0;

  for (const [placeId, place] of allPlaces) {
    processed++;
    const progress = `[${processed}/${allPlaces.size}]`;
    process.stdout.write(`${progress} ${place.name.slice(0, 35).padEnd(35)}... `);

    // Get detailed info (includes website, rating)
    const details = await getPlaceDetails(apiKey, placeId);

    if (!details) {
      console.log('(no details)');
      skipped++;
      continue;
    }

    // Skip permanently closed
    if (details.business_status === 'CLOSED_PERMANENTLY') {
      console.log('(closed)');
      skipped++;
      continue;
    }

    const { address, city, state, zip } = parseAddress(details.formatted_address || '');

    // Skip if not in Austin metro area
    if (!isInAustinMetro(city)) {
      console.log(`(outside metro: ${city})`);
      skipped++;
      continue;
    }

    // Check if clinic exists by place_id
    const existing = await prisma.clinic.findFirst({
      where: { placeId: placeId },
    });

    // Validate website URL (skip suspicious domains)
    const validatedWebsiteUrl = isValidWebsiteUrl(details.website);

    const clinicData = {
      name: details.name,
      address,
      city,
      state,
      zip,
      lat: details.geometry?.location?.lat,
      lng: details.geometry?.location?.lng,
      phone: details.formatted_phone_number || null,
      websiteUrl: validatedWebsiteUrl,
      placeId: placeId,
      source: 'google_places',
      rating: details.rating || null,
      ratingCount: details.user_ratings_total || null,
    };

    if (existing) {
      await prisma.clinic.update({
        where: { id: existing.id },
        data: clinicData,
      });
      console.log('updated');
      updated++;
    } else {
      await prisma.clinic.create({
        data: clinicData,
      });
      console.log('created');
      created++;
    }

    // Rate limit API calls
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Discovery Summary:');
  console.log('='.repeat(60));
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);

  // Show final stats
  const totalClinics = await prisma.clinic.count();
  const withWebsites = await prisma.clinic.count({
    where: { websiteUrl: { not: null } },
  });
  const withRatings = await prisma.clinic.count({
    where: { rating: { not: null } },
  });

  console.log(`\nDatabase Status:`);
  console.log(`  Total clinics: ${totalClinics}`);
  console.log(`  With websites: ${withWebsites}`);
  console.log(`  With Google ratings: ${withRatings}`);

  console.log('\nNext steps:');
  console.log('  1. Run "npm run crawl" to crawl clinic websites for pricing/financing');
  console.log('  2. Run "npm run crawl:match" to match with financing providers\n');
}

main()
  .catch((e) => {
    console.error('Discovery failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
