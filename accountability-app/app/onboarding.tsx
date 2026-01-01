import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Gradients } from '@/constants/colors';
import { useStore } from '@/store/useStore';

const { width } = Dimensions.get('window');

const EMOJI_OPTIONS = ['🧘', '🌟', '🌙', '🌸', '🔥', '💪', '🎯', '✨'];

export default function OnboardingScreen() {
  const router = useRouter();
  const { setCurrentUser } = useStore();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🧘');

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCurrentUser({
      id: `user_${Date.now()}`,
      name: name.trim() || 'Friend',
      avatarEmoji: selectedEmoji,
    });
    router.replace('/(tabs)');
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="heart" size={64} color={Colors.primary} />
            </View>
            <Text style={styles.heading}>Resolve Together</Text>
            <Text style={styles.description}>
              Keep your New Year's resolutions with the help of a friend.
              Together, you'll build lasting habits.
            </Text>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.goalsContainer}>
              <View style={styles.goalCard}>
                <View style={styles.goalIconCircle}>
                  <Ionicons name="leaf" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.goalTitle}>Daily Meditation</Text>
                <Text style={styles.goalDescription}>
                  20 minutes of mindfulness each day
                </Text>
              </View>

              <View style={styles.goalCard}>
                <View style={styles.goalIconCircle}>
                  <Ionicons name="people" size={32} color={Colors.secondary} />
                </View>
                <Text style={styles.goalTitle}>Phone-Free Kid Time</Text>
                <Text style={styles.goalDescription}>
                  Be fully present with your children
                </Text>
              </View>
            </View>

            <Text style={styles.description}>
              These are your two goals for the year. Track them daily and watch
              your progress grow.
            </Text>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.insightCard}>
              <Ionicons name="bulb" size={32} color={Colors.streak} />
              <Text style={styles.insightTitle}>66 Days to a Habit</Text>
              <Text style={styles.insightText}>
                Research shows it takes about 66 days of consistent practice to
                form a lasting habit. We'll help you track your journey.
              </Text>
            </View>

            <View style={styles.insightCard}>
              <Ionicons name="people" size={32} color={Colors.primary} />
              <Text style={styles.insightTitle}>95% More Likely</Text>
              <Text style={styles.insightText}>
                Having an accountability partner increases your chance of
                success by up to 95%.
              </Text>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.heading}>What should we call you?</Text>

            <View style={styles.avatarSection}>
              <View style={styles.selectedAvatar}>
                <Text style={styles.selectedAvatarEmoji}>{selectedEmoji}</Text>
              </View>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.emojiOption,
                      selectedEmoji === emoji && styles.emojiOptionSelected,
                    ]}
                    onPress={() => setSelectedEmoji(emoji)}
                  >
                    <Text style={styles.emojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={Colors.textDim}
              autoCapitalize="words"
              autoFocus
            />
          </View>
        );
    }
  };

  return (
    <LinearGradient colors={[Colors.background, Colors.backgroundLight]} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.progressDot, i === step && styles.progressDotActive]}
            />
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>{renderStep()}</View>

        {/* Button */}
        <View style={styles.buttonContainer}>
          {step < 3 ? (
            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, !name.trim() && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={!name.trim()}
            >
              <Text style={styles.buttonText}>Let's Go!</Text>
              <Ionicons name="checkmark" size={20} color={Colors.text} />
            </TouchableOpacity>
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
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 20,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.card,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stepContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  goalsContainer: {
    gap: 16,
    marginBottom: 32,
    width: '100%',
  },
  goalCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  goalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  selectedAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedAvatarEmoji: {
    fontSize: 48,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  emojiOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiOptionSelected: {
    backgroundColor: Colors.primary,
  },
  emojiText: {
    fontSize: 24,
  },
  nameInput: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    color: Colors.text,
    fontSize: 18,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
});
