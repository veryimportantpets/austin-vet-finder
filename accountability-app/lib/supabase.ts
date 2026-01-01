/**
 * Supabase Client Configuration
 *
 * Supabase provides:
 * - PostgreSQL database for storing user data and logs
 * - Real-time subscriptions for instant friend updates
 * - Authentication (optional)
 * - Edge Functions for push notifications
 *
 * Setup:
 * 1. Create a Supabase project at https://supabase.com
 * 2. Run the SQL schema below in the SQL editor
 * 3. Add your project URL and anon key to .env
 */

// Example Supabase Schema (run this in Supabase SQL Editor):
/*

-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_emoji TEXT DEFAULT '🧘',
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  friend_id UUID REFERENCES users(id),
  push_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily logs table
CREATE TABLE daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  meditation_completed BOOLEAN DEFAULT FALSE,
  meditation_minutes INTEGER DEFAULT 0,
  phone_free_completed BOOLEAN DEFAULT FALSE,
  phone_free_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth strategy)
CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (true);

CREATE POLICY "Users can read daily logs" ON daily_logs
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own logs" ON daily_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own logs" ON daily_logs
  FOR UPDATE USING (true);

-- Real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE daily_logs;

*/

import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

// Simple Supabase client without the official SDK (to reduce bundle size)
// For production, consider using @supabase/supabase-js

class SupabaseClient {
  private baseUrl: string;
  private headers: HeadersInit;

  constructor(url: string, anonKey: string) {
    this.baseUrl = url;
    this.headers = {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  }

  async from(table: string) {
    return new SupabaseQuery(this.baseUrl, this.headers, table);
  }
}

class SupabaseQuery {
  private url: string;
  private headers: HeadersInit;
  private table: string;
  private queryParams: string[] = [];

  constructor(baseUrl: string, headers: HeadersInit, table: string) {
    this.url = `${baseUrl}/rest/v1/${table}`;
    this.headers = headers;
    this.table = table;
  }

  select(columns = '*') {
    this.queryParams.push(`select=${columns}`);
    return this;
  }

  eq(column: string, value: string) {
    this.queryParams.push(`${column}=eq.${value}`);
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    const order = options.ascending ? 'asc' : 'desc';
    this.queryParams.push(`order=${column}.${order}`);
    return this;
  }

  limit(count: number) {
    this.queryParams.push(`limit=${count}`);
    return this;
  }

  async execute() {
    const queryString = this.queryParams.length > 0 ? `?${this.queryParams.join('&')}` : '';
    const response = await fetch(`${this.url}${queryString}`, {
      headers: this.headers,
    });
    return response.json();
  }

  async insert(data: Record<string, unknown>) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async upsert(data: Record<string, unknown>) {
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async update(data: Record<string, unknown>) {
    const queryString = this.queryParams.length > 0 ? `?${this.queryParams.join('&')}` : '';
    const response = await fetch(`${this.url}${queryString}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    return response.json();
  }
}

export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper functions for common operations

export async function getOrCreateUser(localUserId: string, name: string, emoji: string) {
  const query = await supabase.from('users');

  // Try to get existing user
  const users = await query.select().eq('id', localUserId).execute();

  if (users && users.length > 0) {
    return users[0];
  }

  // Create new user
  const newQuery = await supabase.from('users');
  const newUser = await newQuery.insert({
    id: localUserId,
    name,
    avatar_emoji: emoji,
  });

  return newUser[0];
}

export async function syncLog(userId: string, date: string, log: {
  meditationCompleted: boolean;
  meditationMinutes: number;
  phoneFreeCompleted: boolean;
  phoneFreeMinutes: number;
}) {
  const query = await supabase.from('daily_logs');
  return query.upsert({
    user_id: userId,
    date,
    meditation_completed: log.meditationCompleted,
    meditation_minutes: log.meditationMinutes,
    phone_free_completed: log.phoneFreeCompleted,
    phone_free_minutes: log.phoneFreeMinutes,
  });
}

export async function getFriendByInviteCode(inviteCode: string) {
  const query = await supabase.from('users');
  const users = await query.select().eq('invite_code', inviteCode).execute();
  return users?.[0] || null;
}

export async function linkFriends(userId: string, friendId: string) {
  const query = await supabase.from('users');
  await query.eq('id', userId).update({ friend_id: friendId });

  const friendQuery = await supabase.from('users');
  await friendQuery.eq('id', friendId).update({ friend_id: userId });
}

export async function getFriendLogs(friendId: string, days = 30) {
  const query = await supabase.from('daily_logs');
  return query
    .select()
    .eq('user_id', friendId)
    .order('date', { ascending: false })
    .limit(days)
    .execute();
}
