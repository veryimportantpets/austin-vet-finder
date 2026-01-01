import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '@/constants/colors';
import { useStore } from '@/store/useStore';

export default function TodayScreen() {
  const router = useRouter();
  const {
    currentUser,
    getTodayLog,
    getCurrentStreak,
    getDaysToHabitMilestone,
    isPhoneFreeMode,
  } = useStore();

  const todayLog = getTodayLog();
  const streak = getCurrentStreak();
  const daysToHabit = getDaysToHabitMilestone();

  const meditationDone = todayLog?.meditationCompleted ?? false;
  const phoneFreeDone = todayLog?.phoneFreeCompleted ?? false;
  const bothDone = meditationDone && phoneFreeDone;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getMotivationalMessage = () => {
    if (bothDone) {
      return "Amazing! You've completed both goals today. 🎉";
    }
    if (streak >= 7) {
      return `${streak} day streak! You're building a strong habit.`;
    }
    if (streak > 0) {
      return `${streak} day streak. Keep it going!`;
    }
    if (daysToHabit <= 66) {
      return `${daysToHabit} days to make this a lasting habit.`;
    }
    return "Every journey begins with a single step.";
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{currentUser?.name || 'Friend'}</Text>
          </View>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={20} color={Colors.streak} />
              <Text style={styles.streakText}>{streak}</Text>
            </View>
          )}
        </View>

        {/* Motivational message */}
        <Text style={styles.motivation}>{getMotivationalMessage()}</Text>

        {/* Progress toward habit formation */}
        {daysToHabit > 0 && daysToHabit <= 66 && (
          <View style={styles.habitProgress}>
            <Text style={styles.habitLabel}>Progress to lasting habit</Text>
            <View style={styles.habitBar}>
              <View
                style={[
                  styles.habitFill,
                  { width: `${((66 - daysToHabit) / 66) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.habitDays}>
              {66 - daysToHabit}/66 days
            </Text>
          </View>
        )}

        {/* Main action cards */}
        <View style={styles.cardsContainer}>
          {/* Meditation Card */}
          <TouchableOpacity
            style={[styles.card, meditationDone && styles.cardCompleted]}
            onPress={() => !meditationDone && router.push('/meditation-session')}
            disabled={meditationDone}
          >
            <LinearGradient
              colors={meditationDone ? [Colors.card, Colors.card] : Gradients.meditation}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, meditationDone && styles.iconCircleCompleted]}>
                  {meditationDone ? (
                    <Ionicons name="checkmark" size={28} color={Colors.success} />
                  ) : (
                    <Ionicons name="leaf-outline" size={28} color={Colors.text} />
                  )}
                </View>
                <Text style={styles.cardTime}>20 min</Text>
              </View>

              <Text style={styles.cardTitle}>Meditation</Text>
              <Text style={styles.cardSubtitle}>
                {meditationDone
                  ? `Completed! ${todayLog?.meditationMinutes} min today`
                  : 'Tap to start your session'}
              </Text>

              {!meditationDone && (
                <View style={styles.startButton}>
                  <Text style={styles.startButtonText}>Start</Text>
                  <Ionicons name="play" size={16} color={Colors.text} />
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Phone-Free Card */}
          <TouchableOpacity
            style={[styles.card, phoneFreeDone && styles.cardCompleted]}
            onPress={() => router.push('/phone-free-session')}
          >
            <LinearGradient
              colors={phoneFreeDone ? [Colors.card, Colors.card] : Gradients.phoneFree}
              style={styles.cardGradient}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, phoneFreeDone && styles.iconCircleCompleted]}>
                  {phoneFreeDone ? (
                    <Ionicons name="checkmark" size={28} color={Colors.success} />
                  ) : isPhoneFreeMode ? (
                    <Ionicons name="phone-portrait-outline" size={28} color={Colors.warning} />
                  ) : (
                    <Ionicons name="people-outline" size={28} color={Colors.text} />
                  )}
                </View>
                {isPhoneFreeMode && (
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Active</Text>
                  </View>
                )}
              </View>

              <Text style={styles.cardTitle}>Phone-Free Kid Time</Text>
              <Text style={styles.cardSubtitle}>
                {isPhoneFreeMode
                  ? 'Session in progress...'
                  : phoneFreeDone
                  ? `Done! ${todayLog?.phoneFreeMinutes} min today`
                  : 'Be present with your kids'}
              </Text>

              {!phoneFreeDone && !isPhoneFreeMode && (
                <View style={styles.startButton}>
                  <Text style={styles.startButtonText}>Start Timer</Text>
                  <Ionicons name="timer-outline" size={16} color={Colors.text} />
                </View>
              )}

              {isPhoneFreeMode && (
                <View style={[styles.startButton, { backgroundColor: Colors.warning }]}>
                  <Text style={styles.startButtonText}>View Session</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick tip</Text>
          <Text style={styles.tipsText}>
            {!meditationDone
              ? "Find a quiet spot, sit comfortably, and focus on your breath. It's okay if your mind wanders - gently bring it back."
              : !phoneFreeDone
              ? "Put your phone in another room during kid time. Out of sight, out of mind!"
              : "Rest well tonight. Tomorrow is another opportunity to grow."}
          </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  streakText: {
    color: Colors.streak,
    fontWeight: 'bold',
    fontSize: 16,
  },
  motivation: {
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  habitProgress: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  habitLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
  },
  habitBar: {
    height: 8,
    backgroundColor: Colors.backgroundLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  habitFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  habitDays: {
    color: Colors.text,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardCompleted: {
    opacity: 0.8,
  },
  cardGradient: {
    padding: 20,
    minHeight: 160,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  cardTime: {
    color: Colors.text,
    fontSize: 14,
    opacity: 0.8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.8,
    marginBottom: 16,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'flex-start',
    gap: 6,
  },
  startButtonText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  liveText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  tipsContainer: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  tipsTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
