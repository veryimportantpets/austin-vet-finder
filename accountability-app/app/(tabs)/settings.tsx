import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Colors } from '@/constants/colors';
import { useStore } from '@/store/useStore';

const EMOJI_OPTIONS = ['🧘', '🌟', '🌙', '🌸', '🔥', '💪', '🎯', '✨'];

export default function SettingsScreen() {
  const { currentUser, setCurrentUser, dailyReminderTime, meditationGoalMinutes } =
    useStore();

  const [name, setName] = useState(currentUser?.name || '');
  const [selectedEmoji, setSelectedEmoji] = useState(
    currentUser?.avatarEmoji || '🧘'
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState(dailyReminderTime);

  useEffect(() => {
    checkNotificationPermissions();
  }, []);

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        setNotificationsEnabled(true);
        scheduleReminder();
      } else {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive reminders.',
          [{ text: 'OK' }]
        );
      }
    } else {
      setNotificationsEnabled(false);
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const scheduleReminder = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hours, minutes] = reminderTime.split(':').map(Number);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time for your daily practice! 🧘",
        body: "Your friend is counting on you. Let's meditate and be present today.",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      },
    });
  };

  const handleSave = () => {
    setCurrentUser({
      id: currentUser?.id || `user_${Date.now()}`,
      name: name.trim() || 'Friend',
      avatarEmoji: selectedEmoji,
    });

    if (notificationsEnabled) {
      scheduleReminder();
    }

    Alert.alert('Saved!', 'Your settings have been updated.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>

          <View style={styles.avatarSection}>
            <View style={styles.currentAvatar}>
              <Text style={styles.currentAvatarEmoji}>{selectedEmoji}</Text>
            </View>
            <View style={styles.emojiPicker}>
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

          <Text style={styles.inputLabel}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={Colors.textDim}
          />
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={24} color={Colors.text} />
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingLabel}>Daily Reminders</Text>
                <Text style={styles.settingDescription}>
                  Get reminded to practice each day
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.backgroundLight, true: Colors.primary }}
              thumbColor={Colors.text}
            />
          </View>

          {notificationsEnabled && (
            <View style={styles.timePickerContainer}>
              <Text style={styles.inputLabel}>Reminder Time</Text>
              <View style={styles.timeOptions}>
                {['06:00', '07:00', '08:00', '09:00', '20:00', '21:00'].map(
                  (time) => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeOption,
                        reminderTime === time && styles.timeOptionSelected,
                      ]}
                      onPress={() => setReminderTime(time)}
                    >
                      <Text
                        style={[
                          styles.timeOptionText,
                          reminderTime === time && styles.timeOptionTextSelected,
                        ]}
                      >
                        {time}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          )}
        </View>

        {/* Goals Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Goals</Text>

          <View style={styles.goalItem}>
            <View style={styles.goalIcon}>
              <Ionicons name="leaf" size={20} color={Colors.primary} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalLabel}>Daily Meditation</Text>
              <Text style={styles.goalValue}>{meditationGoalMinutes} minutes</Text>
            </View>
          </View>

          <View style={styles.goalItem}>
            <View style={styles.goalIcon}>
              <Ionicons name="people" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.goalInfo}>
              <Text style={styles.goalLabel}>Phone-Free Kid Time</Text>
              <Text style={styles.goalValue}>At least once daily</Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.aboutItem}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.aboutText}>
              Based on research showing ~66 days to form lasting habits, this app
              helps you and your friend stay accountable to your New Year's
              resolutions.
            </Text>
          </View>

          <View style={styles.aboutItem}>
            <Ionicons name="heart-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.aboutText}>
              Remember: Missing a day doesn't erase your progress. Be kind to
              yourself and keep going!
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Resolve Together v1.0.0</Text>
          <Text style={styles.footerText}>Made with 💜 for your resolutions</Text>
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
  section: {
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  currentAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentAvatarEmoji: {
    fontSize: 40,
  },
  emojiPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  emojiOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiOptionSelected: {
    backgroundColor: Colors.primary,
  },
  emojiText: {
    fontSize: 24,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  timePickerContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.backgroundLight,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.backgroundLight,
  },
  timeOptionSelected: {
    backgroundColor: Colors.primary,
  },
  timeOptionText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  timeOptionTextSelected: {
    color: Colors.text,
    fontWeight: '600',
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalInfo: {
    flex: 1,
  },
  goalLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  goalValue: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  aboutItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  aboutText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 4,
  },
});
