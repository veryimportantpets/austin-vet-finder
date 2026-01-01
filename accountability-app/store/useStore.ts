import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DayLog {
  date: string; // YYYY-MM-DD
  meditationCompleted: boolean;
  meditationMinutes: number;
  phoneFreeCompleted: boolean;
  phoneFreeMinutes: number;
}

export interface User {
  id: string;
  name: string;
  avatarEmoji: string;
}

export interface FriendData {
  user: User;
  logs: DayLog[];
  currentStreak: number;
  longestStreak: number;
}

interface AppState {
  // User info
  currentUser: User | null;
  friend: FriendData | null;

  // Daily logs
  logs: DayLog[];

  // Current session states
  isMeditating: boolean;
  meditationStartTime: number | null;
  isPhoneFreeMode: boolean;
  phoneFreeStartTime: number | null;

  // Settings
  dailyReminderTime: string; // HH:MM format
  meditationGoalMinutes: number;

  // Actions
  setCurrentUser: (user: User) => void;
  setFriend: (friend: FriendData) => void;

  // Meditation actions
  startMeditation: () => void;
  completeMeditation: (minutes: number) => void;
  cancelMeditation: () => void;

  // Phone-free actions
  startPhoneFreeTime: () => void;
  stopPhoneFreeTime: () => void;

  // Utility
  getTodayLog: () => DayLog | undefined;
  getCurrentStreak: () => number;
  getLongestStreak: () => number;
  getDaysToHabitMilestone: () => number;
  getWeeklyProgress: () => { meditation: number; phoneFree: number };
}

const getToday = () => new Date().toISOString().split('T')[0];

const calculateStreak = (logs: DayLog[]): number => {
  if (logs.length === 0) return 0;

  const sortedLogs = [...logs].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < sortedLogs.length; i++) {
    const logDate = new Date(sortedLogs[i].date);
    logDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(expectedDate.getDate() - i);

    // Check if both goals were met
    const log = sortedLogs[i];
    const completedBoth = log.meditationCompleted && log.phoneFreeCompleted;

    if (logDate.getTime() === expectedDate.getTime() && completedBoth) {
      streak++;
    } else if (i === 0 && logDate.getTime() < expectedDate.getTime()) {
      // Today hasn't been logged yet, check from yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (logDate.getTime() === yesterday.getTime() && completedBoth) {
        streak++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return streak;
};

const calculateLongestStreak = (logs: DayLog[]): number => {
  if (logs.length === 0) return 0;

  const sortedLogs = [...logs].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let maxStreak = 0;
  let currentStreak = 0;
  let lastDate: Date | null = null;

  for (const log of sortedLogs) {
    if (!log.meditationCompleted || !log.phoneFreeCompleted) {
      currentStreak = 0;
      lastDate = null;
      continue;
    }

    const logDate = new Date(log.date);

    if (lastDate === null) {
      currentStreak = 1;
    } else {
      const diffDays = Math.round(
        (logDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }

    lastDate = logDate;
    maxStreak = Math.max(maxStreak, currentStreak);
  }

  return maxStreak;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      friend: null,
      logs: [],
      isMeditating: false,
      meditationStartTime: null,
      isPhoneFreeMode: false,
      phoneFreeStartTime: null,
      dailyReminderTime: '08:00',
      meditationGoalMinutes: 20,

      setCurrentUser: (user) => set({ currentUser: user }),

      setFriend: (friend) => set({ friend }),

      startMeditation: () => set({
        isMeditating: true,
        meditationStartTime: Date.now()
      }),

      completeMeditation: (minutes) => {
        const today = getToday();
        const logs = get().logs;
        const existingLogIndex = logs.findIndex(l => l.date === today);

        if (existingLogIndex >= 0) {
          const updatedLogs = [...logs];
          updatedLogs[existingLogIndex] = {
            ...updatedLogs[existingLogIndex],
            meditationCompleted: true,
            meditationMinutes: updatedLogs[existingLogIndex].meditationMinutes + minutes,
          };
          set({
            logs: updatedLogs,
            isMeditating: false,
            meditationStartTime: null
          });
        } else {
          set({
            logs: [...logs, {
              date: today,
              meditationCompleted: true,
              meditationMinutes: minutes,
              phoneFreeCompleted: false,
              phoneFreeMinutes: 0,
            }],
            isMeditating: false,
            meditationStartTime: null,
          });
        }
      },

      cancelMeditation: () => set({
        isMeditating: false,
        meditationStartTime: null
      }),

      startPhoneFreeTime: () => set({
        isPhoneFreeMode: true,
        phoneFreeStartTime: Date.now()
      }),

      stopPhoneFreeTime: () => {
        const startTime = get().phoneFreeStartTime;
        if (!startTime) return;

        const minutes = Math.round((Date.now() - startTime) / 60000);
        const today = getToday();
        const logs = get().logs;
        const existingLogIndex = logs.findIndex(l => l.date === today);

        if (existingLogIndex >= 0) {
          const updatedLogs = [...logs];
          const newMinutes = updatedLogs[existingLogIndex].phoneFreeMinutes + minutes;
          updatedLogs[existingLogIndex] = {
            ...updatedLogs[existingLogIndex],
            phoneFreeCompleted: true,
            phoneFreeMinutes: newMinutes,
          };
          set({
            logs: updatedLogs,
            isPhoneFreeMode: false,
            phoneFreeStartTime: null
          });
        } else {
          set({
            logs: [...logs, {
              date: today,
              meditationCompleted: false,
              meditationMinutes: 0,
              phoneFreeCompleted: true,
              phoneFreeMinutes: minutes,
            }],
            isPhoneFreeMode: false,
            phoneFreeStartTime: null,
          });
        }
      },

      getTodayLog: () => {
        const today = getToday();
        return get().logs.find(l => l.date === today);
      },

      getCurrentStreak: () => calculateStreak(get().logs),

      getLongestStreak: () => calculateLongestStreak(get().logs),

      getDaysToHabitMilestone: () => {
        // Research shows ~66 days to form a habit
        const HABIT_MILESTONE = 66;
        const streak = calculateStreak(get().logs);
        return Math.max(0, HABIT_MILESTONE - streak);
      },

      getWeeklyProgress: () => {
        const logs = get().logs;
        const today = new Date();
        let meditationDays = 0;
        let phoneFreeDays = 0;

        for (let i = 0; i < 7; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          const log = logs.find(l => l.date === dateStr);

          if (log?.meditationCompleted) meditationDays++;
          if (log?.phoneFreeCompleted) phoneFreeDays++;
        }

        return { meditation: meditationDays, phoneFree: phoneFreeDays };
      },
    }),
    {
      name: 'resolve-together-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
