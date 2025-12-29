import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const tier = searchParams.get('tier');
    const minTransparency = searchParams.get('minTransparency');
    const sortBy = searchParams.get('sortBy') || 'affordabilityScore';
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Build where clause
    const where: any = {
      city: 'Austin',
    };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (tier && tier !== 'all') {
      where.financingTier = tier;
    }
    
    if (minTransparency) {
      where.transparencyScore = { gte: parseInt(minTransparency) };
    }
    
    // Build order by
    let orderBy: any = { affordabilityScore: 'desc' };
    switch (sortBy) {
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'financingTier':
        orderBy = { financingTier: 'asc' };
        break;
      case 'transparencyScore':
        orderBy = { transparencyScore: 'desc' };
        break;
    }
    
    const clinics = await prisma.clinic.findMany({
      where,
      include: {
        evidence: {
          orderBy: { fetchedAt: 'desc' },
          take: 6, // Max 3 per category
        },
        extractedSignals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy,
      take: limit,
    });
    
    return NextResponse.json({
      clinics,
      total: clinics.length,
    });
  } catch (error) {
    console.error('Failed to fetch clinics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinics' },
      { status: 500 }
    );
  }
}
