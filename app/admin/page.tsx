'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCcw,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  Globe,
  Eye,
  Search,
  Loader2,
  Bot,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Stats {
  totalClinics: number;
  crawledClinics: number;
  totalPages: number;
  recentCrawls: any[];
}

interface Analytics {
  summary: {
    totalViews: number;
    humanViews: number;
    botViews: number;
    botPercentage: number;
    uniqueVisitors: number;
  };
  botBreakdown: { type: string; count: number }[];
  clinicViewMap: Record<string, number>;
  viewsByDay: Record<string, number>;
  topReferers: { referer: string; count: number }[];
}

interface Clinic {
  id: string;
  name: string;
  websiteUrl: string | null;
  lastVerifiedAt: string | null;
  financingTier: string | null;
  transparencyScore: number | null;
  viewCount: number;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [crawling, setCrawling] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Simple password check (in production, use proper auth)
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Password is set via ADMIN_PASSWORD env var, defaults to 'admin123' for dev
    if (password === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123')) {
      setAuthenticated(true);
      fetchData();
    } else {
      setError('Invalid password');
    }
  };
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, clinicsRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/clinics'),
        fetch('/api/admin/analytics'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (clinicsRes.ok) setClinics((await clinicsRes.json()).clinics);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const triggerCrawl = async (clinicId?: string) => {
    setCrawling(clinicId || 'all');
    try {
      const response = await fetch('/api/admin/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      });
      
      if (response.ok) {
        // Refresh data after crawl
        setTimeout(fetchData, 2000);
      }
    } catch (err) {
      console.error('Failed to trigger crawl:', err);
    } finally {
      setCrawling(null);
    }
  };
  
  const filteredClinics = clinics.filter(clinic => 
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-sage-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-sage-50">
      <header className="bg-white border-b border-sage-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-sage-900">
            Admin Dashboard
          </h1>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sage-100 rounded-lg">
                  <Database className="w-5 h-5 text-sage-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-sage-900">
                    {stats?.totalClinics || 0}
                  </p>
                  <p className="text-sm text-sage-500">Total clinics</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-sage-900">
                    {analytics?.summary.humanViews ?? clinics.reduce((sum, c) => sum + c.viewCount, 0)}
                  </p>
                  <p className="text-sm text-sage-500">Real views</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Bot className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-sage-900">
                    {analytics?.summary.botViews ?? 0}
                  </p>
                  <p className="text-sm text-sage-500">Bot views ({analytics?.summary.botPercentage ?? 0}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sky-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-sage-900">
                    {analytics?.summary.uniqueVisitors ?? 0}
                  </p>
                  <p className="text-sm text-sage-500">Unique visitors (30d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bot Traffic Breakdown */}
        {analytics && analytics.botBreakdown.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Bot Traffic Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {analytics.botBreakdown.slice(0, 10).map((bot) => (
                  <div key={bot.type} className="bg-sage-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-sage-700 truncate">{bot.type}</p>
                    <p className="text-lg font-semibold text-sage-900">{bot.count}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-sage-500 mt-3">
                These views are excluded from your "Real views" count.
              </p>
            </CardContent>
          </Card>
        )}
        
        {/* Bulk Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Crawl Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button 
                onClick={() => triggerCrawl()}
                disabled={crawling !== null}
              >
                {crawling === 'all' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Crawl all clinics
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/api/admin/export'}
              >
                Export data (JSON)
              </Button>
            </div>
            <p className="text-sm text-sage-500 mt-3">
              Crawling respects robots.txt and rate limits (1 request per 2 seconds per domain).
            </p>
          </CardContent>
        </Card>
        
        {/* Clinics Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Clinics</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-400" />
                <Input
                  placeholder="Search clinics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-sage-100">
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Website</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Tier</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Transparency</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Last Verified</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Real Views</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-sage-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClinics.map((clinic) => (
                    <tr key={clinic.id} className="border-b border-sage-50 hover:bg-sage-50/50">
                      <td className="py-3 px-4">
                        <a 
                          href={`/clinic/${clinic.id}`}
                          className="font-medium text-sage-800 hover:text-sage-600"
                        >
                          {clinic.name}
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        {clinic.websiteUrl ? (
                          <a 
                            href={clinic.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-sage-500 hover:text-sage-700 truncate max-w-[200px] block"
                          >
                            {new URL(clinic.websiteUrl).hostname}
                          </a>
                        ) : (
                          <span className="text-sage-400 text-sm">No website</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={`tier${clinic.financingTier || 'E'}` as any}>
                          {clinic.financingTier || 'E'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-sage-600">
                          {clinic.transparencyScore || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {clinic.lastVerifiedAt ? (
                          <span className="text-sm text-sage-500">
                            {new Date(clinic.lastVerifiedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <Badge variant="outline">Never</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-sage-500">
                          {analytics?.clinicViewMap[clinic.id] ?? clinic.viewCount}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => triggerCrawl(clinic.id)}
                          disabled={crawling === clinic.id || !clinic.websiteUrl}
                        >
                          {crawling === clinic.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCcw className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredClinics.length === 0 && (
                <p className="text-center py-8 text-sage-500">
                  {searchQuery ? 'No clinics match your search.' : 'No clinics found.'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
