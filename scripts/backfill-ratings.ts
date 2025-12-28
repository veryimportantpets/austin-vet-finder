/**
 * Backfill Google ratings for clinics that have a placeId but no rating
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getPlaceDetails(apiKey: string, placeId: string) {
  const params = new URLSearchParams({
    key: apiKey,
    place_id: placeId,
    fields: 'rating,user_ratings_total',
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  );
  const data = await response.json();

  if (data.status !== 'OK') return null;
  return data.result;
}

async function backfillRatings() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY not set');
    process.exit(1);
  }

  // Find clinics with placeId but no rating
  const clinicsToUpdate = await prisma.clinic.findMany({
    where: {
      placeId: { not: null },
      rating: null,
    },
    select: { id: true, name: true, placeId: true },
  });

  console.log(`Found ${clinicsToUpdate.length} clinics needing rating update\n`);

  let updated = 0;
  for (const clinic of clinicsToUpdate) {
    const details = await getPlaceDetails(apiKey, clinic.placeId!);

    if (details && details.rating) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          rating: details.rating,
          ratingCount: details.user_ratings_total || null,
        },
      });
      console.log(
        `Updated: ${clinic.name.slice(0, 40).padEnd(42)} -> ${details.rating} (${details.user_ratings_total || 0} reviews)`
      );
      updated++;
    } else {
      console.log(`No rating: ${clinic.name.slice(0, 40)}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nUpdated ${updated} clinics with ratings`);
}

backfillRatings()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
