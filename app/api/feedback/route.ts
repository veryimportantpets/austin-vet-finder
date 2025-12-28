import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createHash } from 'crypto';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

// Hash the IP address for privacy
function hashIP(ip: string): string {
  return createHash('sha256').update(ip + process.env.IP_SALT || 'austin-vet-finder').digest('hex').substring(0, 16);
}

// Rate limiting: max 5 submissions per IP per day
async function checkRateLimit(ipHash: string): Promise<boolean> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentCount = await prisma.communityReport.count({
    where: {
      ipHash,
      submittedAt: { gte: oneDayAgo },
    },
  });

  return recentCount < 5;
}

// Basic spam detection
function detectSpam(data: any): boolean {
  // Very fast submissions are suspicious
  // (This would need session tracking to implement properly)

  // Honeypot field check would go here

  return false;
}

export async function POST(request: Request) {
  try {
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIP = headersList.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIP || 'unknown';
    const userAgent = headersList.get('user-agent') || '';

    const ipHash = hashIP(ip);

    // Rate limit check
    const withinLimit = await checkRateLimit(ipHash);
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again tomorrow.' },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.clinicId || !body.workedWithOnCost || !body.receivedEstimate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate clinic exists
    const clinic = await prisma.clinic.findUnique({
      where: { id: body.clinicId },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic not found' },
        { status: 404 }
      );
    }

    // Validate enum values
    const validWorkedWithOnCost = ['offered_options', 'offered_plan', 'not_asked', 'felt_dismissed'];
    const validReceivedEstimate = ['written', 'verbal', 'none', 'dont_remember'];
    const validServiceTypes = ['exam', 'vaccines', 'spay_neuter', 'dental', 'emergency', 'other', null];

    if (!validWorkedWithOnCost.includes(body.workedWithOnCost)) {
      return NextResponse.json(
        { error: 'Invalid value for workedWithOnCost' },
        { status: 400 }
      );
    }

    if (!validReceivedEstimate.includes(body.receivedEstimate)) {
      return NextResponse.json(
        { error: 'Invalid value for receivedEstimate' },
        { status: 400 }
      );
    }

    if (body.serviceType && !validServiceTypes.includes(body.serviceType)) {
      return NextResponse.json(
        { error: 'Invalid value for serviceType' },
        { status: 400 }
      );
    }

    // Validate numeric fields
    if (body.amountPaid !== null && body.amountPaid !== undefined) {
      if (typeof body.amountPaid !== 'number' || body.amountPaid < 0 || body.amountPaid > 10000000) {
        return NextResponse.json(
          { error: 'Invalid amount paid' },
          { status: 400 }
        );
      }
    }

    if (body.visitYear !== null && body.visitYear !== undefined) {
      const currentYear = new Date().getFullYear();
      if (typeof body.visitYear !== 'number' || body.visitYear < 2010 || body.visitYear > currentYear) {
        return NextResponse.json(
          { error: 'Invalid visit year' },
          { status: 400 }
        );
      }
    }

    // Spam detection
    if (detectSpam(body)) {
      // Silently accept but flag
      await prisma.communityReport.create({
        data: {
          clinicId: body.clinicId,
          workedWithOnCost: body.workedWithOnCost,
          receivedEstimate: body.receivedEstimate,
          serviceType: body.serviceType || null,
          amountPaid: body.amountPaid || null,
          visitYear: body.visitYear || null,
          feltFair: body.feltFair ?? null,
          ipHash,
          userAgent: userAgent.substring(0, 255),
          flagged: true,
        },
      });

      return NextResponse.json({ success: true });
    }

    // Create the report
    const report = await prisma.communityReport.create({
      data: {
        clinicId: body.clinicId,
        workedWithOnCost: body.workedWithOnCost,
        receivedEstimate: body.receivedEstimate,
        serviceType: body.serviceType || null,
        amountPaid: body.amountPaid || null,
        visitYear: body.visitYear || null,
        feltFair: body.feltFair ?? null,
        ipHash,
        userAgent: userAgent.substring(0, 255),
      },
    });

    return NextResponse.json({
      success: true,
      id: report.id,
    });
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
