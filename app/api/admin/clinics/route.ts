import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        lastVerifiedAt: true,
        financingTier: true,
        transparencyScore: true,
        viewCount: true,
      },
      orderBy: { name: 'asc' },
    });
    
    return NextResponse.json({ clinics });
  } catch (error) {
    console.error('Failed to fetch clinics:', error);
    return NextResponse.json({ error: 'Failed to fetch clinics' }, { status: 500 });
  }
}
