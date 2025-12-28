import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        phone: true,
        websiteUrl: true,
        financingTier: true,
        transparencyScore: true,
        lastVerifiedAt: true,
        evidence: {
          select: {
            id: true,
            category: true,
            label: true,
            snippet: true,
            sourceUrl: true,
          },
          orderBy: { fetchedAt: 'desc' },
        },
        _count: {
          select: {
            communityReports: true,
          },
        },
      },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(clinic);
  } catch (error) {
    console.error('Failed to fetch clinic:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinic' },
      { status: 500 }
    );
  }
}
