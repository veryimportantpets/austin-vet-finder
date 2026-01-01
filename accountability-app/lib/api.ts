/**
 * API client for syncing data between accountability partners
 *
 * This can be implemented with:
 * 1. Supabase (recommended - easy setup, real-time sync)
 * 2. Firebase
 * 3. Custom Express/Node backend
 *
 * For now, this provides the interface that should be implemented.
 */

import { DayLog, User, FriendData } from '@/store/useStore';

// API Configuration - replace with your actual backend URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-api.com';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Register or update user profile
 */
export async function syncUserProfile(user: User): Promise<ApiResponse<User>> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to sync user profile:', error);
    return { success: false, error: 'Failed to sync profile' };
  }
}

/**
 * Sync daily log to server
 */
export async function syncDayLog(userId: string, log: DayLog): Promise<ApiResponse<DayLog>> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to sync day log:', error);
    return { success: false, error: 'Failed to sync log' };
  }
}

/**
 * Get friend's data by invite code
 */
export async function getFriendByCode(code: string): Promise<ApiResponse<FriendData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/friends/${code}`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to get friend:', error);
    return { success: false, error: 'Friend not found' };
  }
}

/**
 * Link with a friend using invite code
 */
export async function linkFriend(userId: string, friendCode: string): Promise<ApiResponse<FriendData>> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendCode }),
    });
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to link friend:', error);
    return { success: false, error: 'Failed to link friend' };
  }
}

/**
 * Get friend's latest logs
 */
export async function getFriendLogs(friendId: string): Promise<ApiResponse<DayLog[]>> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${friendId}/logs`);
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Failed to get friend logs:', error);
    return { success: false, error: 'Failed to get friend logs' };
  }
}

/**
 * Register push notification token for reminders
 */
export async function registerPushToken(userId: string, token: string): Promise<ApiResponse<void>> {
  try {
    await fetch(`${API_BASE_URL}/users/${userId}/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to register push token:', error);
    return { success: false, error: 'Failed to register for notifications' };
  }
}
