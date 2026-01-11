'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  BookOpen,
  Star,
  Archive,
  Clock,
  FileText,
  Twitter,
  Video,
  Mic,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';

interface SavedContent {
  id: string;
  url: string;
  title: string | null;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  contentType: string;
  readingTime: number | null;
  isFavorite: boolean;
  isArchived: boolean;
  savedAt: string;
  summaries: { id: string; summaryType: string }[];
}

const contentTypeIcons: Record<string, typeof FileText> = {
  article: FileText,
  tweet: Twitter,
  video: Video,
  podcast: Mic,
  blog: BookOpen,
};

export default function ReaderPage() {
  const [content, setContent] = useState<SavedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [urlToSave, setUrlToSave] = useState('');
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'archived'>('all');

  useEffect(() => {
    fetchContent();
  }, [filter]);

  async function fetchContent() {
    try {
      const params = new URLSearchParams();
      if (filter === 'favorites') params.set('favorites', 'true');
      if (filter === 'archived') params.set('archived', 'true');

      const res = await fetch(`/api/reader/content?${params}`);
      const data = await res.json();
      setContent(data.content || []);
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveContent() {
    if (!urlToSave.trim()) return;

    setSaving(true);
    setSaveError('');

    try {
      const res = await fetch('/api/reader/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlToSave }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setShowSaveModal(false);
      setUrlToSave('');
      fetchContent();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save content');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFavorite(id: string, isFavorite: boolean) {
    try {
      await fetch(`/api/reader/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !isFavorite }),
      });
      fetchContent();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  }

  const filteredContent = content.filter(item => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.siteName?.toLowerCase().includes(searchLower) ||
      item.excerpt?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sage-50 to-white">
      {/* Header */}
      <header className="border-b border-sage-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-sage-900">
                Content Saver
              </h1>
              <p className="text-sm text-sage-600">
                Save articles, get AI summaries, and listen on the go
              </p>
            </div>
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sage-900 text-white rounded-lg hover:bg-sage-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Save URL
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-400" />
            <input
              type="text"
              placeholder="Search your library..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-sage-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-sage-900 text-white'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              <BookOpen className="w-4 h-4 inline mr-2" />
              All
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'favorites'
                  ? 'bg-sage-900 text-white'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              <Star className="w-4 h-4 inline mr-2" />
              Favorites
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'archived'
                  ? 'bg-sage-900 text-white'
                  : 'bg-sage-100 text-sage-700 hover:bg-sage-200'
              }`}
            >
              <Archive className="w-4 h-4 inline mr-2" />
              Archived
            </button>
          </div>
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-sage-400" />
          </div>
        ) : filteredContent.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto text-sage-300 mb-4" />
            <h2 className="text-xl font-semibold text-sage-700 mb-2">
              {filter === 'all' ? 'Your library is empty' : `No ${filter} content`}
            </h2>
            <p className="text-sage-500 mb-6">
              {filter === 'all'
                ? 'Save your first article to get started'
                : `You haven't ${filter === 'favorites' ? 'starred' : 'archived'} any content yet`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowSaveModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-sage-900 text-white rounded-lg hover:bg-sage-800 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Save your first URL
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContent.map((item) => {
              const Icon = contentTypeIcons[item.contentType] || FileText;
              return (
                <Link
                  key={item.id}
                  href={`/reader/${item.id}`}
                  className="group block bg-white rounded-xl border border-sage-100 hover:border-sage-300 hover:shadow-lg transition-all overflow-hidden"
                >
                  {item.imageUrl && (
                    <div className="aspect-video bg-sage-100 overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs text-sage-500">
                        <Icon className="w-3 h-3" />
                        <span>{item.siteName || new URL(item.url).hostname}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleFavorite(item.id, item.isFavorite);
                        }}
                        className={`p-1 rounded ${
                          item.isFavorite ? 'text-amber-500' : 'text-sage-300 hover:text-sage-500'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <h3 className="font-semibold text-sage-900 mb-2 line-clamp-2 group-hover:text-sage-700">
                      {item.title || 'Untitled'}
                    </h3>
                    {item.excerpt && (
                      <p className="text-sm text-sage-600 line-clamp-2 mb-3">
                        {item.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-sage-400">
                      <div className="flex items-center gap-3">
                        {item.readingTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.readingTime} min
                          </span>
                        )}
                        {item.summaries.length > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <Sparkles className="w-3 h-3" />
                            Summarized
                          </span>
                        )}
                      </div>
                      <span>
                        {new Date(item.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Save URL Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold text-sage-900 mb-4">
              Save Content
            </h2>
            <p className="text-sage-600 mb-4">
              Paste the URL of an article, blog post, tweet, or other content you want to save.
            </p>
            <input
              type="url"
              placeholder="https://example.com/article..."
              value={urlToSave}
              onChange={(e) => setUrlToSave(e.target.value)}
              className="w-full px-4 py-3 border border-sage-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 mb-4"
              autoFocus
            />
            {saveError && (
              <p className="text-red-600 text-sm mb-4">{saveError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setUrlToSave('');
                  setSaveError('');
                }}
                className="px-4 py-2 text-sage-600 hover:text-sage-900"
              >
                Cancel
              </button>
              <button
                onClick={saveContent}
                disabled={saving || !urlToSave.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-sage-900 text-white rounded-lg hover:bg-sage-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
