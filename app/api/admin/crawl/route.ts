import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { crawlClinic } from '@/lib/crawler';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { clinicId } = await request.json();
    
    if (clinicId) {
      // Crawl single clinic
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
      });
      
      if (!clinic?.websiteUrl) {
        return NextResponse.json({ error: 'Clinic not found or no website' }, { status: 404 });
      }
      
      // Run crawl in background
      crawlClinic(clinic.id, clinic.websiteUrl).catch(console.error);
      
      return NextResponse.json({ message: 'Crawl started', clinicId });
    } else {
      // Crawl all clinics with websites
      const clinics = await prisma.clinic.findMany({
        where: { websiteUrl: { not: null } },
        select: { id: true, websiteUrl: true },
      });
      
      // Start crawls in sequence (to respect rate limits)
      for (const clinic of clinics) {
        if (clinic.websiteUrl) {
          crawlClinic(clinic.id, clinic.websiteUrl).catch(console.error);
        }
      }
      
      return NextResponse.json({ 
        message: 'Crawls started', 
        count: clinics.length 
      });
    }
  } catch (error) {
    console.error('Failed to trigger crawl:', error);
    return NextResponse.json({ error: 'Failed to trigger crawl' }, { status: 500 });
  }
}
