/**
 * Match financing providers to clinics in the database
 *
 * This script reads provider data from JSON files (if available) and/or
 * uses known partnerships to update clinic financing information.
 *
 * Uses new tier system:
 * - Tier 1: Cherry, Sunbit, Affirm, VetBilling (no deferred interest)
 * - Tier 2: Scratchpay, CareCredit (deferred interest risk)
 * - N: No financing detected
 *
 * Usage:
 *   npx tsx scripts/match-financing-providers.ts
 *   npx tsx scripts/match-financing-providers.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '..', 'data');
const isDryRun = process.argv.includes('--dry-run');

// Tier classification
// BNPL providers - true financing options
const TIER1_PROVIDERS = ['CHERRY', 'SUNBIT', 'AFFIRM', 'VETBILLING', 'IN_HOUSE_PAYMENT_PLAN'];
// Note: WELLNESS_PLAN is an affordability signal, not a BNPL option
const TIER2_PROVIDERS = ['SCRATCHPAY', 'CARECREDIT'];

interface ProviderData {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  source: 'cherry' | 'scratchpay' | 'sunbit';
}

// Known Austin vet clinic partnerships
// Add verified partnerships here as you discover them
// Use EXACT clinic names from the database for reliable matching
const KNOWN_PARTNERSHIPS: { clinicName: string; providers: string[]; notes?: string }[] = [
  // === WELLNESS PLANS (affordability signal, not BNPL) ===
  // Note: Wellness plans are tracked as evidence but don't affect BNPL tier
  // {
  //   clinicName: 'Banfield Pet Hospital - Mueller',
  //   providers: ['WELLNESS_PLAN'],
  //   notes: 'Optimum Wellness Plans - monthly payment wellness program'
  // },

  // === TIER 1: CHERRY PROVIDERS ===
  // Cherry finder at finder.withcherry.com (returns 403, data from web search)
  {
    clinicName: 'Emancipet - Austin Central',
    providers: ['CHERRY'],
    notes: 'Verified Cherry financing partner - no deferred interest'
  },
  {
    clinicName: 'Windsor Park Veterinary Clinic',
    providers: ['CHERRY'],
    notes: 'Verified on clinic website - accepts Cherry payments'
  },
  {
    clinicName: 'Northwest Austin Veterinary Center',
    providers: ['CHERRY'],
    notes: 'Offers Cherry financing options per clinic website'
  },
  {
    clinicName: 'Veterinary Specialist Partners',
    providers: ['CHERRY', 'SCRATCHPAY'],
    notes: 'Accepts Cherry and Scratchpay per vetsp.com'
  },

  // === TIER 2: SCRATCHPAY PROVIDERS (from scratchpay.com/practices/search) ===
  // Verified Dec 2024 - Note: Scratchpay may use deferred interest
  {
    clinicName: 'Thrive Affordable Vet Care - South Austin',
    providers: ['SCRATCHPAY'],
    notes: 'Thrive Pet Healthcare South Lamar - verified on Scratchpay directory'
  },
  {
    clinicName: 'Austin Urban Vet Center',
    providers: ['SCRATCHPAY'],
    notes: 'Verified on Scratchpay directory - 710 West 5th Street'
  },
  {
    clinicName: 'Modern Animal - South Lamar',
    providers: ['SCRATCHPAY'],
    notes: 'Verified on Scratchpay directory - 1100 South Lamar Boulevard'
  },
  {
    clinicName: 'Honnas Veterinary',
    providers: ['SCRATCHPAY'],
    notes: 'Verified on Scratchpay directory - 1615 South Lamar Boulevard'
  },
  {
    clinicName: 'Paz Veterinary - East',
    providers: ['SCRATCHPAY'],
    notes: 'Verified on Scratchpay directory - 3300 East 7th street'
  },
  {
    clinicName: 'Livewell Animal Hospital of Austin',
    providers: ['SCRATCHPAY'],
    notes: 'Verified on Scratchpay directory - 507 Pressler St'
  },
];

/**
 * Match clinic names - uses exact match first, then normalized match
 */
function normalizeClinicName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchClinicName(dbName: string, partnershipName: string): boolean {
  // Exact match (case insensitive)
  if (dbName.toLowerCase() === partnershipName.toLowerCase()) {
    return true;
  }

  // Normalized match (remove punctuation, normalize spaces)
  const normalizedDb = normalizeClinicName(dbName);
  const normalizedPartnership = normalizeClinicName(partnershipName);

  if (normalizedDb === normalizedPartnership) {
    return true;
  }

  // Check if one starts with the other (for partial matches like "Banfield" matching "Banfield Pet Hospital - Mueller")
  if (normalizedDb.startsWith(normalizedPartnership) || normalizedPartnership.startsWith(normalizedDb)) {
    // Only match if the shorter one is at least 10 chars (avoid matching too loosely)
    const shorter = normalizedDb.length < normalizedPartnership.length ? normalizedDb : normalizedPartnership;
    if (shorter.length >= 10) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate tier based on providers using new 1/2/N system
 * - Tier 1: Best BNPL (Cherry, Sunbit, Affirm, VetBilling) - no deferred interest
 * - Tier 2: Caution (Scratchpay, CareCredit) - deferred interest risk
 * - N: No financing detected
 */
function calculateTier(providers: string[]): string {
  // Check for Tier 1 first (best BNPL)
  if (TIER1_PROVIDERS.some(p => providers.includes(p))) {
    return '1';
  }

  // Check for Tier 2 (deferred interest risk)
  if (TIER2_PROVIDERS.some(p => providers.includes(p))) {
    return '2';
  }

  // Has something but unclear
  if (providers.length > 0) {
    return '2';
  }

  return 'N';
}

/**
 * Read provider data from JSON files
 */
function loadProviderFiles(): ProviderData[] {
  const providers: ProviderData[] = [];

  const files = [
    { path: 'cherry-providers.json', source: 'cherry' as const },
    { path: 'scratchpay-providers.json', source: 'scratchpay' as const },
    { path: 'sunbit-providers.json', source: 'sunbit' as const },
  ];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file.path);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(data)) {
          providers.push(...data.map((d: any) => ({ ...d, source: file.source })));
        }
      } catch (e) {
        console.error(`Error reading ${file.path}:`, e);
      }
    }
  }

  return providers;
}

/**
 * Get provider type from source
 */
function getProviderType(source: string): string {
  const mapping: Record<string, string> = {
    cherry: 'CHERRY',
    scratchpay: 'SCRATCHPAY',
    sunbit: 'SUNBIT',
  };
  return mapping[source] || source.toUpperCase();
}

async function main() {
  console.log('='.repeat(60));
  console.log('Financing Provider Matching Script (New Tier System)');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  // Get all clinics from database
  const clinics = await prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      financingTier: true,
      financingProviderMatches: true,
      extractedSignals: {
        select: { financingProviders: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  console.log(`\nFound ${clinics.length} clinics in database`);

  // Load provider data from files
  const fileProviders = loadProviderFiles();
  console.log(`Loaded ${fileProviders.length} providers from JSON files`);
  console.log(`Using ${KNOWN_PARTNERSHIPS.length} known partnerships`);

  let updatedCount = 0;
  let matchCreatedCount = 0;

  // Process known partnerships
  console.log('\n--- Processing Known Partnerships ---\n');

  for (const partnership of KNOWN_PARTNERSHIPS) {
    const matchingClinics = clinics.filter(c =>
      matchClinicName(c.name, partnership.clinicName)
    );

    if (matchingClinics.length === 0) {
      console.log(`❌ No match found for: ${partnership.clinicName}`);
      continue;
    }

    for (const clinic of matchingClinics) {
      const currentProviders = clinic.extractedSignals[0]?.financingProviders as string[] || [];
      const newProviders = [...new Set([...currentProviders, ...partnership.providers])];
      const newTier = calculateTier(newProviders);

      console.log(`✓ ${clinic.name}`);
      console.log(`  Current: Tier ${clinic.financingTier || 'N'}, Providers: ${currentProviders.join(', ') || 'none'}`);
      console.log(`  Updated: Tier ${newTier}, Providers: ${newProviders.join(', ')}`);

      if (!isDryRun) {
        // Create new extracted signal
        await prisma.extractedSignal.create({
          data: {
            clinicId: clinic.id,
            financingProviders: newProviders,
            financingTier: newTier,
            affordabilityScore: calculateAffordabilityScore(newTier, 0),
            confidence: 0.9, // High confidence for verified partnerships
          },
        });

        // Update clinic
        await prisma.clinic.update({
          where: { id: clinic.id },
          data: {
            financingTier: newTier,
            affordabilityScore: calculateAffordabilityScore(newTier, 0),
            lastVerifiedAt: new Date(),
          },
        });

        // Add evidence and FinancingProviderMatch for each provider
        for (const provider of partnership.providers) {
          // Add evidence
          await prisma.evidence.upsert({
            where: {
              id: `${clinic.id}-${provider}`, // Pseudo-unique key
            },
            create: {
              clinicId: clinic.id,
              category: 'FINANCING',
              label: provider.replace(/_/g, ' '),
              snippet: partnership.notes || `Verified ${provider} partnership`,
              sourceUrl: 'manual-verification',
            },
            update: {
              snippet: partnership.notes || `Verified ${provider} partnership`,
              fetchedAt: new Date(),
            },
          }).catch(() => {
            // If upsert fails (no unique constraint), create
            return prisma.evidence.create({
              data: {
                clinicId: clinic.id,
                category: 'FINANCING',
                label: provider.replace(/_/g, ' '),
                snippet: partnership.notes || `Verified ${provider} partnership`,
                sourceUrl: 'manual-verification',
              },
            });
          });

          // Create FinancingProviderMatch
          await prisma.financingProviderMatch.upsert({
            where: {
              clinicId_provider_source: {
                clinicId: clinic.id,
                provider: provider,
                source: 'manual-verification',
              },
            },
            create: {
              clinicId: clinic.id,
              provider: provider,
              source: 'manual-verification',
              confidence: 0.9,
              providerName: clinic.name,
              providerAddress: clinic.address,
              providerPhone: clinic.phone,
            },
            update: {
              matchedAt: new Date(),
              confidence: 0.9,
            },
          });
          matchCreatedCount++;
        }
      }

      updatedCount++;
    }
  }

  // Process file-based providers (if any)
  if (fileProviders.length > 0) {
    console.log('\n--- Processing File-Based Providers ---\n');

    for (const provider of fileProviders) {
      const matchingClinics = clinics.filter(c =>
        matchClinicName(c.name, provider.name)
      );

      if (matchingClinics.length === 0) continue;

      for (const clinic of matchingClinics) {
        const providerType = getProviderType(provider.source);
        const currentProviders = clinic.extractedSignals[0]?.financingProviders as string[] || [];

        if (currentProviders.includes(providerType)) continue;

        const newProviders = [...currentProviders, providerType];
        const newTier = calculateTier(newProviders);

        console.log(`✓ ${clinic.name} <- ${providerType} (from ${provider.source} file)`);

        if (!isDryRun) {
          await prisma.clinic.update({
            where: { id: clinic.id },
            data: {
              financingTier: newTier,
              lastVerifiedAt: new Date(),
            },
          });

          // Create FinancingProviderMatch
          const sourceUrl = provider.source === 'cherry' ? 'finder.withcherry.com' :
                           provider.source === 'scratchpay' ? 'scratchpay.com' :
                           provider.source === 'sunbit' ? 'sunbit.com' : provider.source;

          await prisma.financingProviderMatch.upsert({
            where: {
              clinicId_provider_source: {
                clinicId: clinic.id,
                provider: providerType,
                source: sourceUrl,
              },
            },
            create: {
              clinicId: clinic.id,
              provider: providerType,
              source: sourceUrl,
              confidence: 0.8,
              providerName: provider.name,
              providerAddress: provider.address,
              providerPhone: provider.phone,
            },
            update: {
              matchedAt: new Date(),
            },
          });
          matchCreatedCount++;
        }

        updatedCount++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Summary: ${updatedCount} clinics ${isDryRun ? 'would be' : ''} updated`);
  console.log(`         ${matchCreatedCount} provider matches ${isDryRun ? 'would be' : ''} created`);
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\nRun without --dry-run to apply changes');
  }
}

function calculateAffordabilityScore(tier: string, transparencyScore: number): number {
  // New tier scores (1, 2, N system)
  const tierScores: Record<string, number> = { '1': 100, '2': 50, 'N': 0 };
  const financingScore = tierScores[tier] || 0;
  return Math.round(financingScore * 0.55 + transparencyScore * 0.35 + 100 * 0.10);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
