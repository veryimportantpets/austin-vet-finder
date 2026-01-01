import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Gradients } from '@/constants/colors';
import { useStore } from '@/store/useStore';

const MEDITATION_DURATION = 20 * 60; // 20 minutes in seconds

export default function MeditationSession() {
  const router = useRouter();
  const { completeMeditation, meditationGoalMinutes } = useStore();

  const [isRunning, setIsRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(MEDITATION_DURATION);
  const [phase, setPhase] = useState<'ready' | 'breathing' | 'meditating' | 'complete'>('ready');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const breathAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Breathing animation for intro
  useEffect(() => {
    if (phase === 'breathing') {
      const breathCycle = Animated.loop(
        Animated.sequence([
          Animated.timing(breathAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(breathAnim, {
            toValue: 0,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      );
      breathCycle.start();

      // After 3 breath cycles (24 seconds), start meditation
      const transitionTimer = setTimeout(() => {
        setPhase('meditating');
        setIsRunning(true);
      }, 24000);

      return () => {
        breathCycle.stop();
        clearTimeout(transitionTimer);
      };
    }
  }, [phase, breathAnim]);

  // Subtle pulse animation during meditation
  useEffect(() => {
    if (phase === 'meditating') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 4000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [phase, pulseAnim]);

  // Timer countdown
  useEffect(() => {
    if (isRunning && secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setPhase('complete');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Vibration.vibrate([0, 200, 100, 200]);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('breathing');
  };

  const handlePause = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRunning(!isRunning);
  };

  const handleComplete = () => {
    const minutesCompleted = Math.ceil((MEDITATION_DURATION - secondsRemaining) / 60);
    completeMeditation(Math.max(minutesCompleted, meditationGoalMinutes));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleCancel = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    router.back();
  };

  const breathScale = breathAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const breathOpacity = breathAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <LinearGradient colors={Gradients.meditation} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Ready Phase */}
          {phase === 'ready' && (
            <View style={styles.centerContent}>
              <Ionicons name="leaf" size={64} color={Colors.text} style={styles.icon} />
              <Text style={styles.title}>Ready to meditate?</Text>
              <Text style={styles.subtitle}>
                Find a comfortable position.{'\n'}
                We'll start with a few deep breaths.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleStart}>
                <Text style={styles.primaryButtonText}>Begin</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Breathing Phase */}
          {phase === 'breathing' && (
            <View style={styles.centerContent}>
              <Animated.View
                style={[
                  styles.breathCircle,
                  {
                    transform: [{ scale: breathScale }],
                    opacity: breathOpacity,
                  },
                ]}
              />
              <Text style={styles.breathText}>
                {breathAnim._value < 0.5 ? 'Breathe in...' : 'Breathe out...'}
              </Text>
              <Text style={styles.breathSubtext}>Follow the circle</Text>
            </View>
          )}

          {/* Meditating Phase */}
          {phase === 'meditating' && (
            <View style={styles.centerContent}>
              <Animated.View
                style={[
                  styles.timerCircle,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Text style={styles.timerText}>{formatTime(secondsRemaining)}</Text>
                <Text style={styles.timerLabel}>remaining</Text>
              </Animated.View>

              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handlePause}
                >
                  <Ionicons
                    name={isRunning ? 'pause' : 'play'}
                    size={32}
                    color={Colors.text}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.meditationTip}>
                Focus on your breath. When your mind wanders, gently return.
              </Text>
            </View>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && (
            <View style={styles.centerContent}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={64} color={Colors.success} />
              </View>
              <Text style={styles.title}>Session Complete</Text>
              <Text style={styles.subtitle}>
                Wonderful! You completed {meditationGoalMinutes} minutes of meditation.
                {'\n'}Take a moment to notice how you feel.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
                <Text style={styles.primaryButtonText}>Done</Text>
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
  },
  icon: {
    marginBottom: 24,
    opacity: 0.9,
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
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  breathCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.text,
    marginBottom: 48,
  },
  breathText: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  breathSubtext: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.7,
  },
  timerCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
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
  controlsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meditationTip: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.7,
    textAlign: 'center',
    maxWidth: 280,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
});
