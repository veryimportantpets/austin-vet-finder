import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

const SUMMARY_PROMPTS: Record<string, string> = {
  brief: `Provide a brief 2-3 sentence summary of this content. Focus on the main point and key takeaway.`,
  detailed: `Provide a detailed summary of this content in 3-4 paragraphs. Cover the main arguments, supporting evidence, and conclusions.`,
  bullet_points: `Summarize this content as a bulleted list of 5-8 key points. Each point should be concise but informative.`,
  eli5: `Explain this content like I'm 5 years old. Use simple language and analogies that anyone can understand. Keep it to 2-3 short paragraphs.`,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contentId, summaryType = 'brief' } = body;

    if (!contentId) {
      return NextResponse.json(
        { error: 'Content ID is required' },
        { status: 400 }
      );
    }

    // Check if summary already exists
    const existing = await prisma.contentSummary.findUnique({
      where: {
        contentId_summaryType: { contentId, summaryType },
      },
    });

    if (existing) {
      return NextResponse.json({
        summary: existing,
        cached: true,
      });
    }

    // Get the content
    const content = await prisma.savedContent.findUnique({
      where: { id: contentId },
    });

    if (!content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    // Generate summary with Anthropic
    const prompt = SUMMARY_PROMPTS[summaryType] || SUMMARY_PROMPTS.brief;
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nTitle: ${content.title || 'Untitled'}\n\nContent:\n${content.textContent.slice(0, 15000)}`,
        },
      ],
    });

    const summaryText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Save the summary
    const summary = await prisma.contentSummary.create({
      data: {
        contentId,
        summaryType,
        summary: summaryText,
        model: 'claude-sonnet-4-20250514',
      },
    });

    return NextResponse.json({
      summary,
      cached: false,
    });
  } catch (error) {
    console.error('Failed to generate summary:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
