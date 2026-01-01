import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useStore } from '@/store/useStore';

export default function TogetherScreen() {
  const { currentUser, friend, logs, getCurrentStreak, getTodayLog } = useStore();
  const [showInvite, setShowInvite] = useState(false);

  const todayLog = getTodayLog();
  const myStreak = getCurrentStreak();

  // Mock friend data for demo (in production, this would come from backend)
  const mockFriend = friend || {
    user: { id: '2', name: 'Sarah', avatarEmoji: '🌟' },
    logs: [
      { date: new Date().toISOString().split('T')[0], meditationCompleted: true, meditationMinutes: 20, phoneFreeCompleted: false, phoneFreeMinutes: 0 },
    ],
    currentStreak: 5,
    longestStreak: 12,
  };

  const friendTodayLog = mockFriend.logs.find(
    (l) => l.date === new Date().toISOString().split('T')[0]
  );

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Resolve Together! Let's keep each other accountable for our New Year's resolutions. Download the app and use my invite code: ${currentUser?.id || 'FRIEND123'}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const renderUserCard = (
    name: string,
    emoji: string,
    streak: number,
    meditationDone: boolean,
    phoneFreeDone: boolean,
    isMe: boolean
  ) => (
    <View style={[styles.userCard, isMe && styles.userCardMe]}>
      <View style={styles.userHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarEmoji}>{emoji}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {name} {isMe && <Text style={styles.youLabel}>(You)</Text>}
          </Text>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color={Colors.streak} />
            <Text style={styles.streakText}>{streak} day streak</Text>
          </View>
        </View>
      </View>

      <View style={styles.todayStatus}>
        <Text style={styles.todayLabel}>Today</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusIcon,
                meditationDone ? styles.statusIconDone : styles.statusIconPending,
              ]}
            >
              <Ionicons
                name={meditationDone ? 'checkmark' : 'leaf-outline'}
                size={16}
                color={meditationDone ? Colors.success : Colors.textMuted}
              />
            </View>
            <Text style={styles.statusLabel}>Meditation</Text>
          </View>
          <View style={styles.statusItem}>
            <View
              style={[
                styles.statusIcon,
                phoneFreeDone ? styles.statusIconDone : styles.statusIconPending,
              ]}
            >
              <Ionicons
                name={phoneFreeDone ? 'checkmark' : 'people-outline'}
                size={16}
                color={phoneFreeDone ? Colors.success : Colors.textMuted}
              />
            </View>
            <Text style={styles.statusLabel}>Phone-free</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Together</Text>
        <Text style={styles.subtitle}>
          Stay accountable with your friend. You're in this together!
        </Text>

        {/* Comparison Cards */}
        <View style={styles.cardsContainer}>
          {renderUserCard(
            currentUser?.name || 'You',
            currentUser?.avatarEmoji || '🧘',
            myStreak,
            todayLog?.meditationCompleted ?? false,
            todayLog?.phoneFreeCompleted ?? false,
            true
          )}

          <View style={styles.vsContainer}>
            <View style={styles.vsLine} />
            <View style={styles.vsBadge}>
              <Ionicons name="heart" size={20} color={Colors.error} />
            </View>
            <View style={styles.vsLine} />
          </View>

          {friend ? (
            renderUserCard(
              mockFriend.user.name,
              mockFriend.user.avatarEmoji,
              mockFriend.currentStreak,
              friendTodayLog?.meditationCompleted ?? false,
              friendTodayLog?.phoneFreeCompleted ?? false,
              false
            )
          ) : (
            <TouchableOpacity
              style={styles.inviteCard}
              onPress={() => setShowInvite(true)}
            >
              <Ionicons name="person-add" size={32} color={Colors.textMuted} />
              <Text style={styles.inviteTitle}>Invite Your Friend</Text>
              <Text style={styles.inviteText}>
                Share your journey with a friend for better accountability
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Invite Modal */}
        {showInvite && (
          <View style={styles.inviteSection}>
            <Text style={styles.sectionTitle}>Invite a Friend</Text>
            <Text style={styles.inviteDescription}>
              Share your invite code or send them a link to join you.
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your Invite Code</Text>
              <Text style={styles.code}>{currentUser?.id || 'FRIEND123'}</Text>
            </View>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={Colors.text} />
              <Text style={styles.shareButtonText}>Share Invite</Text>
            </TouchableOpacity>

            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Text style={styles.joinLabel}>Have a friend's code?</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.codeInput}
                placeholder="Enter code"
                placeholderTextColor={Colors.textDim}
              />
              <TouchableOpacity style={styles.joinButton}>
                <Text style={styles.joinButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Encouragement */}
        <View style={styles.encouragementCard}>
          <Ionicons name="sparkles" size={24} color={Colors.streak} />
          <Text style={styles.encouragementTitle}>Keep each other going!</Text>
          <Text style={styles.encouragementText}>
            Studies show that having an accountability partner increases your
            chance of success by up to 95%. You've got this!
          </Text>
        </View>

        {/* Weekly Comparison */}
        {friend && (
          <View style={styles.comparisonCard}>
            <Text style={styles.sectionTitle}>This Week's Progress</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonName}>You</Text>
                <View style={styles.progressDots}>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        i < 5 ? styles.progressDotFilled : null,
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.comparisonStats}>5/7 days</Text>
              </View>
              <View style={styles.comparisonItem}>
                <Text style={styles.comparisonName}>{mockFriend.user.name}</Text>
                <View style={styles.progressDots}>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.progressDot,
                        i < 4 ? styles.progressDotFilled : null,
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.comparisonStats}>4/7 days</Text>
              </View>
            </View>
          </View>
        )}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: 24,
  },
  cardsContainer: {
    marginBottom: 24,
  },
  userCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
  },
  userCardMe: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  userInfo: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  youLabel: {
    color: Colors.textMuted,
    fontWeight: 'normal',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  streakText: {
    fontSize: 13,
    color: Colors.streak,
  },
  todayStatus: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 12,
  },
  todayLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusIconPending: {
    backgroundColor: Colors.card,
  },
  statusLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.card,
  },
  vsBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  inviteCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.cardHighlight,
    borderStyle: 'dashed',
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 4,
  },
  inviteText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  inviteSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  inviteDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
  },
  codeBox: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  code: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  shareButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.backgroundLight,
  },
  orText: {
    color: Colors.textMuted,
    fontSize: 13,
    marginHorizontal: 12,
  },
  joinLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
  },
  joinButton: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  joinButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  encouragementCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  encouragementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  encouragementText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  comparisonCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  comparisonItem: {
    alignItems: 'center',
  },
  comparisonName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.backgroundLight,
  },
  progressDotFilled: {
    backgroundColor: Colors.primary,
  },
  comparisonStats: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
