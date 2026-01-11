import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contentId, conversationId, message } = body;

    if (!contentId || !message) {
      return NextResponse.json(
        { error: 'Content ID and message are required' },
        { status: 400 }
      );
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

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.contentConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    if (!conversation) {
      conversation = await prisma.contentConversation.create({
        data: {
          contentId,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      },
    });

    // Build conversation history for Anthropic
    const systemPrompt = `You are a helpful assistant discussing an article or piece of content with the user. Your goal is to help them understand, learn from, and engage with the content deeply.

Here is the content being discussed:

Title: ${content.title || 'Untitled'}
Source: ${content.siteName || content.url}

Content:
${content.textContent.slice(0, 12000)}

---

Guidelines:
- Be conversational and engaging
- Help the user understand key concepts
- Answer questions about the content accurately
- Offer insights and connections to broader topics
- If asked about something not in the content, acknowledge it and provide general knowledge
- Keep responses concise but informative (2-4 paragraphs unless more detail is requested)`;

    const messages: { role: 'user' | 'assistant'; content: string }[] = conversation.messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add the new user message
    messages.push({ role: 'user', content: message });

    // Generate response with Anthropic
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : '';

    // Save assistant message
    const savedMessage = await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: assistantMessage,
      },
    });

    // Update conversation timestamp
    await prisma.contentConversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      conversationId: conversation.id,
      message: savedMessage,
    });
  } catch (error) {
    console.error('Failed to chat:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat' },
      { status: 500 }
    );
  }
}
