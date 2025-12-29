/**
 * Propagate Emancipet pricing to all locations
 *
 * Emancipet uses standardized pricing across all locations.
 * The Austin Central location has the pricing data, but other locations don't.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(60));
  console.log('Emancipet Pricing Propagation');
  console.log('='.repeat(60));

  // Find the source clinic with pricing (any Emancipet location that has prices)
  const sourceClinic = await prisma.clinic.findFirst({
    where: {
      name: { contains: 'Emancipet', mode: 'insensitive' },
      extractedPrices: { some: {} }
    },
    include: {
      extractedPrices: true,
      evidence: true,
    },
  });

  if (!sourceClinic) {
    console.log('No Emancipet clinic with pricing found. Run the crawler first.');
    return;
  }

  console.log(`\nSource: ${sourceClinic.name}`);
  console.log(`  Prices: ${sourceClinic.extractedPrices.length}`);
  console.log(`  Evidence: ${sourceClinic.evidence.length}`);

  // Find all other Emancipet locations
  const targetClinics = await prisma.clinic.findMany({
    where: {
      name: { contains: 'Emancipet', mode: 'insensitive' },
      NOT: { id: sourceClinic.id },
    },
    include: {
      extractedPrices: true,
      evidence: true,
    },
  });

  console.log(`\nFound ${targetClinics.length} other Emancipet locations\n`);

  for (const target of targetClinics) {
    console.log(`Processing: ${target.name}`);

    // Skip if already has pricing
    if (target.extractedPrices.length > 0) {
      console.log('  Already has pricing, skipping');
      continue;
    }

    // Copy extracted prices
    for (const price of sourceClinic.extractedPrices) {
      await prisma.extractedPrice.create({
        data: {
          clinicId: target.id,
          serviceType: price.serviceType,
          serviceName: price.serviceName,
          minPrice: price.minPrice,
          maxPrice: price.maxPrice,
          sourceUrl: price.sourceUrl,
          snippet: price.snippet,
        },
      });
    }
    console.log(`  Copied ${sourceClinic.extractedPrices.length} prices`);

    // Copy relevant evidence (pricing-related)
    const pricingEvidence = sourceClinic.evidence.filter(e =>
      e.category === 'TRANSPARENCY' || e.snippet.includes('$')
    );

    for (const evidence of pricingEvidence) {
      await prisma.evidence.create({
        data: {
          clinicId: target.id,
          category: evidence.category,
          label: evidence.label,
          snippet: evidence.snippet,
          sourceUrl: 'emancipet.org (standardized pricing)',
        },
      });
    }
    console.log(`  Copied ${pricingEvidence.length} evidence items`);

    // Update transparency score
    await prisma.clinic.update({
      where: { id: target.id },
      data: {
        transparencyScore: sourceClinic.transparencyScore,
        financingTier: sourceClinic.financingTier || '1', // Emancipet is Tier 1 (Cherry)
      },
    });
    console.log(`  Updated transparency score and tier`);
  }

  // Also update the source clinic to have the placeId from one of the targets if missing
  if (!sourceClinic.placeId) {
    const targetWithPlaceId = targetClinics.find(t => t.placeId);
    if (targetWithPlaceId) {
      // Don't overwrite placeId, but we could merge these records
      console.log(`\nNote: Source clinic missing placeId. Consider merging with ${targetWithPlaceId.name}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done!');
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
