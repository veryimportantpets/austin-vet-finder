import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// This API generates speech synthesis data for the browser's Web Speech API
// The actual TTS happens client-side for better performance and no external dependencies

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, voice = 'default', rate = 1.0, pitch = 1.0 } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // For now, we return the text and speech parameters
    // The actual TTS happens in the browser using Web Speech API
    // This provides a consistent API if we want to add server-side TTS later

    // Break text into chunks for better TTS handling
    const chunks = splitTextIntoChunks(text, 500);

    return NextResponse.json({
      chunks,
      config: {
        voice,
        rate: Math.max(0.5, Math.min(2.0, rate)),
        pitch: Math.max(0.5, Math.min(2.0, pitch)),
      },
    });
  } catch (error) {
    console.error('Failed to process TTS:', error);
    return NextResponse.json(
      { error: 'Failed to process text for speech' },
      { status: 500 }
    );
  }
}

/**
 * Split text into manageable chunks for TTS
 * Tries to split at sentence boundaries
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a sentence boundary
    let splitPoint = -1;
    const searchArea = remaining.slice(0, maxLength);

    // Look for sentence endings
    const sentenceEnds = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    for (const end of sentenceEnds) {
      const lastIndex = searchArea.lastIndexOf(end);
      if (lastIndex > splitPoint) {
        splitPoint = lastIndex + end.length - 1;
      }
    }

    // Fallback to comma or space
    if (splitPoint === -1 || splitPoint < maxLength / 2) {
      const commaIndex = searchArea.lastIndexOf(', ');
      if (commaIndex > maxLength / 2) {
        splitPoint = commaIndex + 2;
      } else {
        const spaceIndex = searchArea.lastIndexOf(' ');
        splitPoint = spaceIndex > 0 ? spaceIndex : maxLength;
      }
    }

    chunks.push(remaining.slice(0, splitPoint).trim());
    remaining = remaining.slice(splitPoint).trim();
  }

  return chunks;
}
