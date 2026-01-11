import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const content = await prisma.savedContent.findUnique({
      where: { id },
      include: {
        summaries: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    // Update last read time
    await prisma.savedContent.update({
      where: { id },
      data: { lastReadAt: new Date() },
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Failed to fetch content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { isFavorite, isArchived, tags } = body;

    const updateData: any = {};
    if (typeof isFavorite === 'boolean') updateData.isFavorite = isFavorite;
    if (typeof isArchived === 'boolean') updateData.isArchived = isArchived;
    if (Array.isArray(tags)) updateData.tags = tags;

    const content = await prisma.savedContent.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Failed to update content:', error);
    return NextResponse.json(
      { error: 'Failed to update content' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.savedContent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete content:', error);
    return NextResponse.json(
      { error: 'Failed to delete content' },
      { status: 500 }
    );
  }
}
