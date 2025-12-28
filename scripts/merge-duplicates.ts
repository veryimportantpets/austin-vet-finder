/**
 * Find and merge duplicate clinics
 *
 * The original clinics were added without placeId, and the discovery script
 * created new ones with placeId and ratings. This script merges them.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

function normalizeClinicName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 30);
}

async function findDuplicates() {
  const clinics = await prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      rating: true,
      ratingCount: true,
      placeId: true,
      websiteUrl: true,
      _count: { select: { evidence: true, extractedPrices: true, communityReports: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Group by normalized name
  const groups: Record<string, typeof clinics> = {};
  for (const c of clinics) {
    const key = normalizeClinicName(c.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }

  // Find groups with multiple entries (duplicates)
  const duplicates: Array<{ key: string; clinics: typeof clinics }> = [];
  for (const [key, items] of Object.entries(groups)) {
    if (items.length > 1) {
      duplicates.push({ key, clinics: items });
    }
  }

  return duplicates;
}

async function mergeDuplicates() {
  console.log('='.repeat(60));
  console.log('Duplicate Clinic Merger');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
  }

  const duplicates = await findDuplicates();
  console.log(`\nFound ${duplicates.length} duplicate groups\n`);

  let merged = 0;

  for (const { key, clinics } of duplicates) {
    console.log(`\nDuplicate group: ${key}`);

    // Find the "best" clinic (has placeId and rating)
    const withPlaceId = clinics.filter(c => c.placeId);
    const withoutPlaceId = clinics.filter(c => !c.placeId);

    if (withPlaceId.length === 0 || withoutPlaceId.length === 0) {
      console.log('  Skipping - no clear merge target');
      clinics.forEach(c => {
        console.log(`    - ${c.name.slice(0, 40)} (placeId: ${c.placeId ? 'yes' : 'no'})`);
      });
      continue;
    }

    // Keep the one with placeId, merge data from the one without
    const keep = withPlaceId[0];
    const remove = withoutPlaceId[0];

    console.log(`  Keep: ${keep.name.slice(0, 40)} (rating: ${keep.rating})`);
    console.log(`  Remove: ${remove.name.slice(0, 40)} (evidence: ${remove._count.evidence}, prices: ${remove._count.extractedPrices})`);

    if (!isDryRun) {
      // Transfer evidence from old to new
      if (remove._count.evidence > 0) {
        await prisma.evidence.updateMany({
          where: { clinicId: remove.id },
          data: { clinicId: keep.id },
        });
        console.log(`    Transferred ${remove._count.evidence} evidence items`);
      }

      // Transfer extracted prices
      if (remove._count.extractedPrices > 0) {
        await prisma.extractedPrice.updateMany({
          where: { clinicId: remove.id },
          data: { clinicId: keep.id },
        });
        console.log(`    Transferred ${remove._count.extractedPrices} prices`);
      }

      // Transfer community reports
      if (remove._count.communityReports > 0) {
        await prisma.communityReport.updateMany({
          where: { clinicId: remove.id },
          data: { clinicId: keep.id },
        });
        console.log(`    Transferred ${remove._count.communityReports} reports`);
      }

      // Transfer extracted signals
      await prisma.extractedSignal.updateMany({
        where: { clinicId: remove.id },
        data: { clinicId: keep.id },
      });

      // Transfer financing provider matches
      await prisma.financingProviderMatch.updateMany({
        where: { clinicId: remove.id },
        data: { clinicId: keep.id },
      });

      // Transfer pages
      await prisma.page.updateMany({
        where: { clinicId: remove.id },
        data: { clinicId: keep.id },
      });

      // Transfer crawl runs
      await prisma.crawlRun.updateMany({
        where: { clinicId: remove.id },
        data: { clinicId: keep.id },
      });

      // Copy over financingTier and transparencyScore if the new one doesn't have them
      if (!keep.rating && remove._count.evidence > 0) {
        const oldClinic = await prisma.clinic.findUnique({
          where: { id: remove.id },
          select: { financingTier: true, transparencyScore: true },
        });
        if (oldClinic) {
          await prisma.clinic.update({
            where: { id: keep.id },
            data: {
              financingTier: oldClinic.financingTier,
              transparencyScore: oldClinic.transparencyScore,
            },
          });
        }
      }

      // Delete the old clinic
      await prisma.clinic.delete({
        where: { id: remove.id },
      });
      console.log(`    Deleted old clinic`);
    }

    merged++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Merged ${merged} duplicate groups`);
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\nRun without --dry-run to apply changes');
  }
}

mergeDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
