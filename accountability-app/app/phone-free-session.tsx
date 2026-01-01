import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Gradients } from '@/constants/colors';
import { useStore } from '@/store/useStore';

export default function PhoneFreeSession() {
  const router = useRouter();
  const {
    isPhoneFreeMode,
    phoneFreeStartTime,
    startPhoneFreeTime,
    stopPhoneFreeTime,
  } = useStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Calculate elapsed time if session was already started
  useEffect(() => {
    if (isPhoneFreeMode && phoneFreeStartTime) {
      const elapsed = Math.floor((Date.now() - phoneFreeStartTime) / 1000);
      setElapsedSeconds(elapsed);
    }
  }, [isPhoneFreeMode, phoneFreeStartTime]);

  // Timer to track elapsed time
  useEffect(() => {
    if (isPhoneFreeMode) {
      const timer = setInterval(() => {
        if (phoneFreeStartTime) {
          const elapsed = Math.floor((Date.now() - phoneFreeStartTime) / 1000);
          setElapsedSeconds(elapsed);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isPhoneFreeMode, phoneFreeStartTime]);

  // Gentle pulse animation
  useEffect(() => {
    if (isPhoneFreeMode) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isPhoneFreeMode, pulseAnim]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startPhoneFreeTime();
  };

  const handleStop = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopPhoneFreeTime();
    router.back();
  };

  const handleClose = () => {
    router.back();
  };

  const getEncouragingMessage = () => {
    const minutes = Math.floor(elapsedSeconds / 60);
    if (minutes < 5) return "Great start! Put your phone away and enjoy this time.";
    if (minutes < 15) return "You're doing wonderful. These moments matter.";
    if (minutes < 30) return "Amazing focus! Your kids feel your presence.";
    if (minutes < 60) return "What a gift you're giving. Keep going!";
    return "Incredible! This quality time is priceless.";
  };

  return (
    <LinearGradient colors={Gradients.phoneFree} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!isPhoneFreeMode ? (
            // Not started
            <View style={styles.centerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="people" size={64} color={Colors.text} />
              </View>
              <Text style={styles.title}>Phone-Free Kid Time</Text>
              <Text style={styles.subtitle}>
                Start the timer, then put your phone away.{'\n'}
                Be fully present with your children.
              </Text>

              <View style={styles.tipsBox}>
                <Text style={styles.tipsTitle}>Tips for success:</Text>
                <Text style={styles.tipItem}>• Put your phone in another room</Text>
                <Text style={styles.tipItem}>• Turn on Do Not Disturb</Text>
                <Text style={styles.tipItem}>• Engage in an activity together</Text>
              </View>

              <TouchableOpacity style={styles.primaryButton} onPress={handleStart}>
                <Ionicons name="timer-outline" size={24} color={Colors.text} />
                <Text style={styles.primaryButtonText}>Start Timer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Timer running
            <View style={styles.centerContent}>
              <Animated.View
                style={[
                  styles.timerCircle,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <View style={styles.timerInner}>
                  <Text style={styles.timerText}>{formatTime(elapsedSeconds)}</Text>
                  <Text style={styles.timerLabel}>phone-free time</Text>
                </View>
              </Animated.View>

              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Session Active</Text>
              </View>

              <Text style={styles.encouragement}>{getEncouragingMessage()}</Text>

              <View style={styles.reminderBox}>
                <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.reminderText}>
                  Come back here when you're done to stop the timer
                </Text>
              </View>

              <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
                <Ionicons name="stop" size={24} color={Colors.text} />
                <Text style={styles.stopButtonText}>End Session</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerContent: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  tipsBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 32,
  },
  tipsTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipItem: {
    color: Colors.text,
    opacity: 0.8,
    fontSize: 14,
    lineHeight: 22,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  timerCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  timerInner: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.text,
  },
  timerLabel: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.7,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.warning,
  },
  statusText: {
    color: Colors.warning,
    fontSize: 14,
    fontWeight: '600',
  },
  encouragement: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 32,
  },
  reminderText: {
    color: Colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 8,
  },
  stopButtonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
});
