/**
 * Migrate existing A/B/C/D/E financing tiers to new 1/2/N system
 *
 * New tier structure:
 * - Tier 1: Best BNPL (Cherry, Sunbit, Affirm, VetBilling) - no deferred interest
 * - Tier 2: Use Caution (Scratchpay, CareCredit) - deferred interest risk
 * - N: No financing detected
 *
 * Migration rules:
 * - A → 1 (unless has Scratchpay/CareCredit → 2)
 * - B → 1 (unless has Scratchpay/CareCredit → 2)
 * - C → 2
 * - D → 2
 * - E → N
 * - Check evidence for specific providers to determine final tier
 */

import prisma from '../lib/db';

const TIER1_PROVIDERS = ['CHERRY', 'SUNBIT', 'AFFIRM', 'VETBILLING'];
const TIER2_PROVIDERS = ['SCRATCHPAY', 'CARECREDIT'];

async function migrateTiers() {
  console.log('Starting tier migration...\n');

  // Get all clinics with their evidence
  const clinics = await prisma.clinic.findMany({
    include: {
      evidence: true,
    },
  });

  console.log(`Found ${clinics.length} clinics to process\n`);

  let migrated = 0;
  let unchanged = 0;
  const changes: { name: string; oldTier: string | null; newTier: string }[] = [];

  for (const clinic of clinics) {
    const oldTier = clinic.financingTier;

    // If already on new tier system, skip
    if (oldTier === '1' || oldTier === '2' || oldTier === 'N') {
      unchanged++;
      continue;
    }

    // Check evidence for financing providers
    const evidenceLabels = clinic.evidence.map((e) => e.label.toUpperCase());

    const hasTier1Provider = TIER1_PROVIDERS.some((p) =>
      evidenceLabels.some((l) => l.includes(p))
    );

    const hasTier2Provider = TIER2_PROVIDERS.some((p) =>
      evidenceLabels.some((l) => l.includes(p) || l.includes('CARE CREDIT'))
    );

    // Determine new tier
    let newTier: string;

    if (hasTier1Provider) {
      // Has Tier 1 provider, assign tier 1
      newTier = '1';
    } else if (hasTier2Provider) {
      // Has Tier 2 provider (Scratchpay/CareCredit), assign tier 2
      newTier = '2';
    } else {
      // Use legacy tier mapping
      switch (oldTier) {
        case 'A':
        case 'B':
          // Was good financing, but no specific provider found
          // Check if there's any financing evidence
          const hasFinancingEvidence = clinic.evidence.some(
            (e) => e.category === 'FINANCING'
          );
          newTier = hasFinancingEvidence ? '2' : 'N';
          break;
        case 'C':
        case 'D':
          newTier = '2';
          break;
        case 'E':
        default:
          newTier = 'N';
          break;
      }
    }

    // Update if changed
    if (newTier !== oldTier) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { financingTier: newTier },
      });

      changes.push({
        name: clinic.name,
        oldTier,
        newTier,
      });
      migrated++;
    } else {
      unchanged++;
    }
  }

  // Print results
  console.log('=== Migration Results ===\n');
  console.log(`Total clinics: ${clinics.length}`);
  console.log(`Migrated: ${migrated}`);
  console.log(`Unchanged: ${unchanged}\n`);

  if (changes.length > 0) {
    console.log('Changes made:\n');
    for (const change of changes) {
      console.log(
        `  ${change.name}: ${change.oldTier || 'null'} → ${change.newTier}`
      );
    }
  }

  console.log('\nMigration complete!');
}

// Run migration
migrateTiers()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
