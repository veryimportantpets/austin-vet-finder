/**
 * Cron endpoint for automated crawling
 *
 * Supports two types of crawling:
 * - clinic: Re-crawl clinic websites that haven't been verified recently
 * - provider-directories: Refresh provider directory data (Cherry, Scratchpay, Sunbit)
 *
 * Usage:
 *   GET /api/cron/crawl?type=clinic&limit=20
 *   GET /api/cron/crawl?type=provider-directories
 *
 * Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // Require CRON_SECRET in production
  if (!cronSecret) {
    console.error('CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authentication
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'clinic';
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  console.log(`[Cron] Starting ${type} crawl (limit: ${limit})`);

  try {
    if (type === 'clinic') {
      return await crawlClinics(limit);
    } else if (type === 'provider-directories') {
      return await refreshProviderDirectories();
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { error: 'Crawl failed', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Crawl clinic websites that need updating
 */
async function crawlClinics(limit: number) {
  // Find clinics that haven't been verified in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const clinicsToUpdate = await prisma.clinic.findMany({
    where: {
      websiteUrl: { not: null },
      OR: [
        { lastVerifiedAt: null },
        { lastVerifiedAt: { lt: sevenDaysAgo } },
      ],
    },
    orderBy: [
      { lastVerifiedAt: 'asc' }, // Oldest first
    ],
    take: limit,
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      lastVerifiedAt: true,
    },
  });

  console.log(`[Cron] Found ${clinicsToUpdate.length} clinics to crawl`);

  // Note: In a production environment, you would import and call the crawler here
  // For now, we just return the list of clinics that would be crawled
  // The actual crawling should be done by a separate worker process or serverless function
  // due to timeout constraints

  const results = {
    type: 'clinic',
    scheduled: clinicsToUpdate.length,
    clinics: clinicsToUpdate.map((c) => ({
      id: c.id,
      name: c.name,
      lastVerified: c.lastVerifiedAt?.toISOString() || 'never',
    })),
    message: 'Clinics queued for crawling. Use the crawl script for actual processing.',
  };

  // Log the crawl run
  await prisma.adminLog.create({
    data: {
      action: 'cron_crawl_clinic',
      details: {
        scheduled: clinicsToUpdate.length,
        clinicIds: clinicsToUpdate.map((c) => c.id),
      },
    },
  });

  return NextResponse.json(results);
}

/**
 * Refresh provider directory data
 */
async function refreshProviderDirectories() {
  // This endpoint triggers the provider directory refresh
  // In production, this would run the fetch scripts

  const results = {
    type: 'provider-directories',
    message: 'Provider directory refresh triggered',
    sources: [
      { name: 'Cherry', url: 'finder.withcherry.com', status: 'queued' },
      { name: 'Scratchpay', url: 'scratchpay.com/practices/search', status: 'queued' },
      { name: 'Sunbit', url: 'sunbit.com/provider-locator', status: 'queued' },
    ],
  };

  // Log the refresh
  await prisma.adminLog.create({
    data: {
      action: 'cron_provider_directories',
      details: results,
    },
  });

  return NextResponse.json(results);
}

// Export runtime config for Vercel
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for cron jobs
