import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const contentType = searchParams.get('type');
    const archived = searchParams.get('archived') === 'true';
    const favorites = searchParams.get('favorites') === 'true';
    const tag = searchParams.get('tag');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: any = {
      isArchived: archived,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { textContent: { contains: search, mode: 'insensitive' } },
        { siteName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (contentType && contentType !== 'all') {
      where.contentType = contentType;
    }

    if (favorites) {
      where.isFavorite = true;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const [content, total] = await Promise.all([
      prisma.savedContent.findMany({
        where,
        include: {
          summaries: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { savedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.savedContent.count({ where }),
    ]);

    return NextResponse.json({
      content,
      total,
      hasMore: offset + content.length < total,
    });
  } catch (error) {
    console.error('Failed to fetch content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}
