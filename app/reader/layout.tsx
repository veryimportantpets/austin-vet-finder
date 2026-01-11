import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Content Saver | Save, Summarize & Listen',
  description:
    'Save articles from the web, get AI-powered summaries, and listen with text-to-speech. Have conversations with AI to learn from your saved content.',
  openGraph: {
    title: 'Content Saver',
    description: 'Save articles, get AI summaries, and listen on the go',
    type: 'website',
  },
};

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
