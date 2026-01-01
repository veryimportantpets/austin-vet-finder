import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useStore } from '@/store/useStore';

export default function ProgressScreen() {
  const {
    logs,
    getCurrentStreak,
    getLongestStreak,
    getDaysToHabitMilestone,
    getWeeklyProgress,
  } = useStore();

  const currentStreak = getCurrentStreak();
  const longestStreak = getLongestStreak();
  const daysToHabit = getDaysToHabitMilestone();
  const weeklyProgress = getWeeklyProgress();

  // Get last 7 days for the week view
  const getWeekData = () => {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const log = logs.find((l) => l.date === dateStr);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      days.push({
        day: dayName,
        date: dateStr,
        meditation: log?.meditationCompleted ?? false,
        phoneFree: log?.phoneFreeCompleted ?? false,
        isToday: i === 0,
      });
    }

    return days;
  };

  // Get monthly stats
  const getMonthlyStats = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let meditationDays = 0;
    let phoneFreeDays = 0;
    let perfectDays = 0;

    logs.forEach((log) => {
      const logDate = new Date(log.date);
      if (logDate >= startOfMonth) {
        if (log.meditationCompleted) meditationDays++;
        if (log.phoneFreeCompleted) phoneFreeDays++;
        if (log.meditationCompleted && log.phoneFreeCompleted) perfectDays++;
      }
    });

    return {
      meditationDays,
      phoneFreeDays,
      perfectDays,
      daysInMonth,
      daysSoFar: now.getDate(),
    };
  };

  const weekData = getWeekData();
  const monthlyStats = getMonthlyStats();

  const totalMeditationMinutes = logs.reduce(
    (sum, log) => sum + log.meditationMinutes,
    0
  );
  const totalPhoneFreeMinutes = logs.reduce(
    (sum, log) => sum + log.phoneFreeMinutes,
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your Progress</Text>

        {/* Streak Cards */}
        <View style={styles.streakRow}>
          <View style={styles.streakCard}>
            <Ionicons name="flame" size={28} color={Colors.streak} />
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Current Streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Ionicons name="trophy" size={28} color={Colors.primaryLight} />
            <Text style={styles.streakNumber}>{longestStreak}</Text>
            <Text style={styles.streakLabel}>Longest Streak</Text>
          </View>
        </View>

        {/* Habit Formation Progress */}
        <View style={styles.habitCard}>
          <View style={styles.habitHeader}>
            <Text style={styles.habitTitle}>Habit Formation Journey</Text>
            <Text style={styles.habitSubtitle}>
              Research shows ~66 days to form a lasting habit
            </Text>
          </View>
          <View style={styles.habitProgressContainer}>
            <View style={styles.habitProgressBar}>
              <View
                style={[
                  styles.habitProgressFill,
                  { width: `${Math.min(((66 - daysToHabit) / 66) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.habitProgressText}>
              {66 - daysToHabit}/66 days
            </Text>
          </View>
          {daysToHabit > 0 && (
            <Text style={styles.habitEncouragement}>
              {daysToHabit} more days to make this automatic!
            </Text>
          )}
          {daysToHabit === 0 && (
            <Text style={styles.habitSuccess}>
              You've formed a lasting habit! Keep going!
            </Text>
          )}
        </View>

        {/* This Week */}
        <View style={styles.weekCard}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.weekGrid}>
            {weekData.map((day, index) => (
              <View
                key={index}
                style={[styles.dayColumn, day.isToday && styles.dayColumnToday]}
              >
                <Text
                  style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}
                >
                  {day.day}
                </Text>
                <View style={styles.dayIcons}>
                  <View
                    style={[
                      styles.dayDot,
                      day.meditation
                        ? styles.dayDotMeditation
                        : styles.dayDotEmpty,
                    ]}
                  >
                    {day.meditation && (
                      <Ionicons name="leaf" size={12} color={Colors.text} />
                    )}
                  </View>
                  <View
                    style={[
                      styles.dayDot,
                      day.phoneFree
                        ? styles.dayDotPhoneFree
                        : styles.dayDotEmpty,
                    ]}
                  >
                    {day.phoneFree && (
                      <Ionicons name="people" size={12} color={Colors.text} />
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.weekSummary}>
            <Text style={styles.weekSummaryText}>
              Meditation: {weeklyProgress.meditation}/7 days
            </Text>
            <Text style={styles.weekSummaryText}>
              Phone-free: {weeklyProgress.phoneFree}/7 days
            </Text>
          </View>
        </View>

        {/* Monthly Stats */}
        <View style={styles.monthCard}>
          <Text style={styles.sectionTitle}>This Month</Text>
          <View style={styles.monthGrid}>
            <View style={styles.monthStat}>
              <Ionicons name="leaf" size={24} color={Colors.primary} />
              <Text style={styles.monthStatNumber}>
                {monthlyStats.meditationDays}
              </Text>
              <Text style={styles.monthStatLabel}>Meditation days</Text>
            </View>
            <View style={styles.monthStat}>
              <Ionicons name="people" size={24} color={Colors.secondary} />
              <Text style={styles.monthStatNumber}>
                {monthlyStats.phoneFreeDays}
              </Text>
              <Text style={styles.monthStatLabel}>Phone-free days</Text>
            </View>
            <View style={styles.monthStat}>
              <Ionicons name="star" size={24} color={Colors.streak} />
              <Text style={styles.monthStatNumber}>
                {monthlyStats.perfectDays}
              </Text>
              <Text style={styles.monthStatLabel}>Perfect days</Text>
            </View>
          </View>
        </View>

        {/* Total Time */}
        <View style={styles.totalCard}>
          <Text style={styles.sectionTitle}>All Time</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalItem}>
              <Text style={styles.totalNumber}>
                {Math.floor(totalMeditationMinutes / 60)}h{' '}
                {totalMeditationMinutes % 60}m
              </Text>
              <Text style={styles.totalLabel}>Total meditation</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalItem}>
              <Text style={styles.totalNumber}>
                {Math.floor(totalPhoneFreeMinutes / 60)}h{' '}
                {totalPhoneFreeMinutes % 60}m
              </Text>
              <Text style={styles.totalLabel}>Total phone-free time</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 24,
  },
  streakRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  streakCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  streakLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  habitCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  habitHeader: {
    marginBottom: 16,
  },
  habitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  habitSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  habitProgressContainer: {
    marginBottom: 8,
  },
  habitProgressBar: {
    height: 12,
    backgroundColor: Colors.backgroundLight,
    borderRadius: 6,
    overflow: 'hidden',
  },
  habitProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 6,
  },
  habitProgressText: {
    fontSize: 13,
    color: Colors.text,
    marginTop: 8,
    textAlign: 'right',
  },
  habitEncouragement: {
    fontSize: 14,
    color: Colors.primaryLight,
    marginTop: 8,
  },
  habitSuccess: {
    fontSize: 14,
    color: Colors.success,
    marginTop: 8,
  },
  weekCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayColumn: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
  },
  dayColumnToday: {
    backgroundColor: Colors.cardHighlight,
  },
  dayLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  dayLabelToday: {
    color: Colors.text,
    fontWeight: '600',
  },
  dayIcons: {
    gap: 6,
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayDotEmpty: {
    backgroundColor: Colors.backgroundLight,
  },
  dayDotMeditation: {
    backgroundColor: Colors.primary,
  },
  dayDotPhoneFree: {
    backgroundColor: Colors.secondary,
  },
  weekSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundLight,
  },
  weekSummaryText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  monthCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  monthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  monthStat: {
    alignItems: 'center',
  },
  monthStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
  },
  monthStatLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  totalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalItem: {
    flex: 1,
    alignItems: 'center',
  },
  totalDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.backgroundLight,
  },
  totalNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
