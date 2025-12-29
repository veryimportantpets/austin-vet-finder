export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [totalClinics, crawledClinics, totalPages, recentCrawls] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.count({
        where: { lastVerifiedAt: { not: null } },
      }),
      prisma.page.count(),
      prisma.crawlRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
        include: {
          clinic: {
            select: { name: true },
          },
        },
      }),
    ]);
    
    return NextResponse.json({
      totalClinics,
      crawledClinics,
      totalPages,
      recentCrawls,
    });
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
