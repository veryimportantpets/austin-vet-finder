import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { extractContent } from '@/lib/content-extractor';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Check if URL already exists
    const existing = await prisma.savedContent.findUnique({
      where: { url },
    });

    if (existing) {
      return NextResponse.json({
        content: existing,
        message: 'Content already saved',
      });
    }

    // Extract content from URL
    const extracted = await extractContent(url);

    // Save to database
    const content = await prisma.savedContent.create({
      data: {
        url: extracted.url,
        title: extracted.title,
        siteName: extracted.siteName,
        author: extracted.author,
        publishedAt: extracted.publishedAt,
        textContent: extracted.textContent,
        excerpt: extracted.excerpt,
        imageUrl: extracted.imageUrl,
        contentType: extracted.contentType,
        readingTime: extracted.readingTime,
      },
    });

    return NextResponse.json({
      content,
      message: 'Content saved successfully',
    });
  } catch (error) {
    console.error('Failed to save content:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save content' },
      { status: 500 }
    );
  }
}
