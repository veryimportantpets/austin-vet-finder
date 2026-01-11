'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  Archive,
  ExternalLink,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Pause,
  Play,
  MessageSquare,
  Send,
  Loader2,
  FileText,
  List,
  BookOpen,
  Baby,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

interface ContentSummary {
  id: string;
  summaryType: string;
  summary: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ContentConversation {
  id: string;
  title: string | null;
  messages: ChatMessage[];
  createdAt: string;
}

interface SavedContent {
  id: string;
  url: string;
  title: string | null;
  siteName: string | null;
  author: string | null;
  publishedAt: string | null;
  textContent: string;
  excerpt: string | null;
  imageUrl: string | null;
  contentType: string;
  readingTime: number | null;
  isFavorite: boolean;
  isArchived: boolean;
  savedAt: string;
  summaries: ContentSummary[];
  conversations: ContentConversation[];
}

const summaryTypes = [
  { id: 'brief', label: 'Brief', icon: FileText, description: '2-3 sentences' },
  { id: 'bullet_points', label: 'Key Points', icon: List, description: '5-8 bullets' },
  { id: 'detailed', label: 'Detailed', icon: BookOpen, description: '3-4 paragraphs' },
  { id: 'eli5', label: 'ELI5', icon: Baby, description: 'Simple explanation' },
];

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [content, setContent] = useState<SavedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'read' | 'summary' | 'chat'>('read');

  // Summary state
  const [selectedSummaryType, setSelectedSummaryType] = useState('brief');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [currentSummary, setCurrentSummary] = useState<ContentSummary | null>(null);

  // TTS state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [ttsText, setTtsText] = useState<'article' | 'summary'>('article');
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Content expansion
  const [showFullContent, setShowFullContent] = useState(false);

  useEffect(() => {
    fetchContent();
    return () => {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    };
  }, [id]);

  // Load and select best female voice
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function selectBestVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // Preferred female voices in order of preference (natural sounding)
      const preferredVoices = [
        'Samantha', // macOS - very natural
        'Karen', // macOS Australian
        'Victoria', // macOS
        'Zoe', // macOS
        'Google UK English Female',
        'Google US English',
        'Microsoft Zira',
        'Microsoft Eva',
        'Fiona', // macOS Scottish
        'Moira', // macOS Irish
        'Tessa', // macOS South African
      ];

      // Try to find a preferred voice
      for (const name of preferredVoices) {
        const voice = voices.find(v => v.name.includes(name));
        if (voice) {
          setSelectedVoice(voice);
          return;
        }
      }

      // Fallback: find any English female voice
      const femaleVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.toLowerCase().includes('female') ||
         v.name.match(/samantha|karen|victoria|zoe|fiona|moira|tessa|zira|eva|susan|kate|ava/i))
      );
      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        return;
      }

      // Last fallback: any English voice
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        setSelectedVoice(englishVoice);
      }
    }

    // Voices may load asynchronously
    selectBestVoice();
    window.speechSynthesis.onvoiceschanged = selectBestVoice;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (content?.summaries) {
      const summary = content.summaries.find(s => s.summaryType === selectedSummaryType);
      setCurrentSummary(summary || null);
    }
  }, [content, selectedSummaryType]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function fetchContent() {
    try {
      const res = await fetch(`/api/reader/content/${id}`);
      const data = await res.json();
      setContent(data.content);

      // Load existing conversation if any
      if (data.content?.conversations?.length > 0) {
        const latestConv = data.content.conversations[0];
        setConversationId(latestConv.id);
        setChatMessages(latestConv.messages);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite() {
    if (!content) return;
    try {
      await fetch(`/api/reader/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !content.isFavorite }),
      });
      setContent({ ...content, isFavorite: !content.isFavorite });
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }

  async function toggleArchive() {
    if (!content) return;
    try {
      await fetch(`/api/reader/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !content.isArchived }),
      });
      setContent({ ...content, isArchived: !content.isArchived });
    } catch (error) {
      console.error('Failed to toggle archive:', error);
    }
  }

  async function generateSummary(type: string) {
    if (!content) return;

    // Check if we already have this summary
    const existing = content.summaries.find(s => s.summaryType === type);
    if (existing) {
      setCurrentSummary(existing);
      return;
    }

    setGeneratingSummary(true);
    try {
      const res = await fetch('/api/reader/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId: id, summaryType: type }),
      });

      const data = await res.json();
      if (data.summary) {
        setCurrentSummary(data.summary);
        setContent({
          ...content,
          summaries: [...content.summaries, data.summary],
        });
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setGeneratingSummary(false);
    }
  }

  function speak(text: string) {
    if (typeof window === 'undefined') return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = 1.05; // Slightly higher pitch for warmer tone

    // Use selected female voice
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  }

  function toggleSpeech() {
    if (!content) return;

    if (isSpeaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      const text = ttsText === 'summary' && currentSummary
        ? currentSummary.summary
        : content.textContent;
      speak(text);
    }
  }

  function stopSpeech() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }

  async function sendChatMessage() {
    if (!chatMessage.trim() || !content) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: chatMessage,
      createdAt: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatMessage('');
    setSendingMessage(true);

    try {
      const res = await fetch('/api/reader/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: id,
          conversationId,
          message: chatMessage,
        }),
      });

      const data = await res.json();

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      if (data.message) {
        setChatMessages(prev => [...prev.slice(0, -1), { ...userMessage, id: `user-${Date.now()}` }, data.message]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setSendingMessage(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sage-50 to-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sage-400" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sage-50 to-white flex flex-col items-center justify-center">
        <h1 className="text-2xl font-semibold text-sage-900 mb-4">Content not found</h1>
        <Link href="/reader" className="text-sage-600 hover:text-sage-900">
          Return to library
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sage-50 to-white">
      {/* Header */}
      <header className="border-b border-sage-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link
              href="/reader"
              className="flex items-center gap-2 text-sage-600 hover:text-sage-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Library
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFavorite}
                className={`p-2 rounded-lg transition-colors ${
                  content.isFavorite
                    ? 'text-amber-500 bg-amber-50'
                    : 'text-sage-400 hover:text-sage-600 hover:bg-sage-100'
                }`}
              >
                <Star className={`w-5 h-5 ${content.isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={toggleArchive}
                className={`p-2 rounded-lg transition-colors ${
                  content.isArchived
                    ? 'text-sage-700 bg-sage-100'
                    : 'text-sage-400 hover:text-sage-600 hover:bg-sage-100'
                }`}
              >
                <Archive className="w-5 h-5" />
              </button>
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-sage-400 hover:text-sage-600 hover:bg-sage-100"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Article Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-sage-500 mb-2">
            <span>{content.siteName || new URL(content.url).hostname}</span>
            {content.author && (
              <>
                <span>&middot;</span>
                <span>{content.author}</span>
              </>
            )}
            {content.readingTime && (
              <>
                <span>&middot;</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {content.readingTime} min read
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-3xl font-semibold text-sage-900 mb-4">
            {content.title || 'Untitled'}
          </h1>
          {content.imageUrl && (
            <img
              src={content.imageUrl}
              alt=""
              className="w-full rounded-xl mb-6"
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-sage-200 mb-6">
          <button
            onClick={() => setActiveTab('read')}
            className={`px-4 py-3 font-medium transition-colors relative ${
              activeTab === 'read'
                ? 'text-sage-900'
                : 'text-sage-500 hover:text-sage-700'
            }`}
          >
            Read
            {activeTab === 'read' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'summary'
                ? 'text-sage-900'
                : 'text-sage-500 hover:text-sage-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Summarize
            {activeTab === 'summary' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'chat'
                ? 'text-sage-900'
                : 'text-sage-500 hover:text-sage-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Discuss
            {activeTab === 'chat' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-900" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'read' && (
          <div>
            {/* Voice Controls */}
            <div className="flex items-center gap-4 p-4 bg-sage-50 rounded-xl mb-6">
              <button
                onClick={toggleSpeech}
                className="flex items-center gap-2 px-4 py-2 bg-sage-900 text-white rounded-lg hover:bg-sage-800"
              >
                {isSpeaking ? (
                  isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  )
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    Listen
                  </>
                )}
              </button>
              {isSpeaking && (
                <button
                  onClick={stopSpeech}
                  className="flex items-center gap-2 px-4 py-2 text-sage-600 hover:text-sage-900"
                >
                  <VolumeX className="w-4 h-4" />
                  Stop
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-sage-600">Speed:</span>
                <select
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="px-2 py-1 border border-sage-200 rounded text-sm"
                >
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
            </div>

            {/* Article Content */}
            <div className="prose prose-sage max-w-none">
              <div className={`relative ${!showFullContent && content.textContent.length > 2000 ? 'max-h-[600px] overflow-hidden' : ''}`}>
                <p className="whitespace-pre-wrap text-sage-700 leading-relaxed">
                  {content.textContent}
                </p>
                {!showFullContent && content.textContent.length > 2000 && (
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
                )}
              </div>
              {content.textContent.length > 2000 && (
                <button
                  onClick={() => setShowFullContent(!showFullContent)}
                  className="flex items-center gap-2 text-sage-600 hover:text-sage-900 mt-4"
                >
                  {showFullContent ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Read full article
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div>
            {/* Summary Type Selector */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {summaryTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedSummaryType === type.id;
                const hasSummary = content.summaries.some(s => s.summaryType === type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedSummaryType(type.id);
                      generateSummary(type.id);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-sage-900 bg-sage-50'
                        : 'border-sage-200 hover:border-sage-400'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-sage-900' : 'text-sage-400'}`} />
                    <div className="font-medium text-sage-900">{type.label}</div>
                    <div className="text-xs text-sage-500">{type.description}</div>
                    {hasSummary && (
                      <span className="inline-block mt-2 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Generated
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Voice Controls for Summary */}
            {currentSummary && (
              <div className="flex items-center gap-4 p-4 bg-sage-50 rounded-xl mb-6">
                <button
                  onClick={() => {
                    setTtsText('summary');
                    if (!isSpeaking) {
                      speak(currentSummary.summary);
                    } else {
                      toggleSpeech();
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-sage-900 text-white rounded-lg hover:bg-sage-800"
                >
                  {isSpeaking && ttsText === 'summary' ? (
                    isPaused ? (
                      <>
                        <Play className="w-4 h-4" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4" />
                        Pause
                      </>
                    )
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      Listen to Summary
                    </>
                  )}
                </button>
                {isSpeaking && (
                  <button
                    onClick={stopSpeech}
                    className="flex items-center gap-2 px-4 py-2 text-sage-600 hover:text-sage-900"
                  >
                    <VolumeX className="w-4 h-4" />
                    Stop
                  </button>
                )}
              </div>
            )}

            {/* Summary Content */}
            {generatingSummary ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-sage-400" />
                <span className="ml-3 text-sage-600">Generating summary...</span>
              </div>
            ) : currentSummary ? (
              <div className="prose prose-sage max-w-none">
                <p className="whitespace-pre-wrap text-sage-700 leading-relaxed">
                  {currentSummary.summary}
                </p>
              </div>
            ) : (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 mx-auto text-sage-300 mb-4" />
                <p className="text-sage-600">
                  Select a summary type above to generate an AI summary
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-[600px]">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {chatMessages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto text-sage-300 mb-4" />
                  <h3 className="font-semibold text-sage-700 mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-sage-500 mb-6">
                    Ask questions about the article to deepen your understanding
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      'What are the main points?',
                      'Can you explain this in simpler terms?',
                      'What are the implications?',
                      'How does this relate to...',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setChatMessage(suggestion)}
                        className="px-3 py-1.5 text-sm bg-sage-100 text-sage-700 rounded-full hover:bg-sage-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-sage-900 text-white'
                          : 'bg-sage-100 text-sage-900'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => speak(msg.content)}
                          className="mt-2 text-xs text-sage-500 hover:text-sage-700 flex items-center gap-1"
                        >
                          <Volume2 className="w-3 h-3" />
                          Listen
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sendingMessage && (
                <div className="flex justify-start">
                  <div className="bg-sage-100 px-4 py-3 rounded-2xl">
                    <Loader2 className="w-5 h-5 animate-spin text-sage-400" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about this article..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                className="flex-1 px-4 py-3 border border-sage-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatMessage.trim() || sendingMessage}
                className="px-4 py-3 bg-sage-900 text-white rounded-xl hover:bg-sage-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
