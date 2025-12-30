import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get total views (all)
    const totalViews = await prisma.pageView.count();

    // Get human views (non-bot)
    const humanViews = await prisma.pageView.count({
      where: { isBot: false },
    });

    // Get bot views
    const botViews = await prisma.pageView.count({
      where: { isBot: true },
    });

    // Get views by bot type
    const botBreakdown = await prisma.pageView.groupBy({
      by: ['botType'],
      where: { isBot: true },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get views per clinic (humans only)
    const clinicViews = await prisma.pageView.groupBy({
      by: ['clinicId'],
      where: { isBot: false },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Create a map of clinic ID to human view count
    const clinicViewMap: Record<string, number> = {};
    for (const cv of clinicViews) {
      clinicViewMap[cv.clinicId] = cv._count.id;
    }

    // Get views over time (last 30 days, humans only)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentViews = await prisma.pageView.findMany({
      where: {
        isBot: false,
        viewedAt: { gte: thirtyDaysAgo },
      },
      select: {
        viewedAt: true,
      },
      orderBy: { viewedAt: 'asc' },
    });

    // Group by day
    const viewsByDay: Record<string, number> = {};
    for (const view of recentViews) {
      const day = view.viewedAt.toISOString().split('T')[0];
      viewsByDay[day] = (viewsByDay[day] || 0) + 1;
    }

    // Get unique visitors (by IP hash, humans only, last 30 days)
    const uniqueVisitors = await prisma.pageView.groupBy({
      by: ['ipHash'],
      where: {
        isBot: false,
        viewedAt: { gte: thirtyDaysAgo },
        ipHash: { not: null },
      },
    });

    // Get top referers (humans only)
    const topReferers = await prisma.pageView.groupBy({
      by: ['referer'],
      where: {
        isBot: false,
        referer: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return NextResponse.json({
      summary: {
        totalViews,
        humanViews,
        botViews,
        botPercentage: totalViews > 0 ? Math.round((botViews / totalViews) * 100) : 0,
        uniqueVisitors: uniqueVisitors.length,
      },
      botBreakdown: botBreakdown.map(b => ({
        type: b.botType || 'unknown',
        count: b._count.id,
      })),
      clinicViewMap,
      viewsByDay,
      topReferers: topReferers
        .filter(r => r.referer)
        .map(r => ({
          referer: r.referer,
          count: r._count.id,
        })),
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
