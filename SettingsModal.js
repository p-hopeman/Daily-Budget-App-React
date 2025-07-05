import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './NotificationService';

const SettingsModal = ({ visible, onClose }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState({ hour: 9, minute: 0 });
  const [lowBudgetWarnings, setLowBudgetWarnings] = useState(true);
  const [motivationNotifications, setMotivationNotifications] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setNotificationsEnabled(parsed.notificationsEnabled || false);
        setDailyReminderEnabled(parsed.dailyReminderEnabled || false);
        setReminderTime(parsed.reminderTime || { hour: 9, minute: 0 });
        setLowBudgetWarnings(parsed.lowBudgetWarnings !== false);
        setMotivationNotifications(parsed.motivationNotifications !== false);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Einstellungen:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Fehler beim Speichern der Einstellungen:', error);
    }
  };

  const handleNotificationsToggle = async (enabled) => {
    if (enabled) {
      try {
        await NotificationService.registerForPushNotificationsAsync();
        setNotificationsEnabled(true);
        Alert.alert(
          '✅ Benachrichtigungen aktiviert',
          'Du erhältst jetzt Budget-Updates!'
        );
      } catch (error) {
        Alert.alert(
          '❌ Fehler',
          'Benachrichtigungen konnten nicht aktiviert werden. Bitte prüfe deine Einstellungen.'
        );
      }
    } else {
      await NotificationService.cancelAllNotifications();
      setNotificationsEnabled(false);
      setDailyReminderEnabled(false);
      Alert.alert(
        '🔕 Benachrichtigungen deaktiviert',
        'Du erhältst keine weiteren Budget-Updates.'
      );
    }

    const settings = {
      notificationsEnabled: enabled,
      dailyReminderEnabled: enabled ? dailyReminderEnabled : false,
      reminderTime,
      lowBudgetWarnings,
      motivationNotifications,
    };
    
    await saveSettings(settings);
  };

  const handleDailyReminderToggle = async (enabled) => {
    setDailyReminderEnabled(enabled);
    
    if (enabled) {
      await NotificationService.scheduleDailyBudgetReminder(
        reminderTime.hour,
        reminderTime.minute
      );
      Alert.alert(
        '⏰ Tägliche Erinnerung aktiviert',
        `Du erhältst täglich um ${reminderTime.hour}:${reminderTime.minute < 10 ? '0' : ''}${reminderTime.minute} eine Erinnerung!`
      );
    } else {
      await NotificationService.cancelDailyReminders();
      Alert.alert('🔕 Tägliche Erinnerung deaktiviert');
    }

    const settings = {
      notificationsEnabled,
      dailyReminderEnabled: enabled,
      reminderTime,
      lowBudgetWarnings,
      motivationNotifications,
    };
    
    await saveSettings(settings);
  };

  const sendTestNotification = async () => {
    if (!notificationsEnabled) {
      Alert.alert('❌ Benachrichtigungen sind deaktiviert');
      return;
    }

    await NotificationService.sendBudgetNotification(25.50, 150.00, 6);
    Alert.alert('📱 Test-Benachrichtigung gesendet!');
  };

  const changeReminderTime = (newHour) => {
    const newTime = { hour: newHour, minute: 0 };
    setReminderTime(newTime);
    
    if (dailyReminderEnabled) {
      NotificationService.scheduleDailyBudgetReminder(newHour, 0);
    }

    const settings = {
      notificationsEnabled,
      dailyReminderEnabled,
      reminderTime: newTime,
      lowBudgetWarnings,
      motivationNotifications,
    };
    
    saveSettings(settings);
  };

  const timeOptions = [
    { hour: 7, label: '7:00' },
    { hour: 8, label: '8:00' },
    { hour: 9, label: '9:00' },
    { hour: 10, label: '10:00' },
    { hour: 12, label: '12:00' },
    { hour: 18, label: '18:00' },
    { hour: 20, label: '20:00' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <LinearGradient colors={['#FAFAFF', '#F5F6FF']} style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={16} color="#666" />
            </TouchableOpacity>
            <Text style={styles.title}>⚙️ Einstellungen</Text>
          </View>

          {/* Haupteinstellungen */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Benachrichtigungen</Text>
            
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>📱 Push Benachrichtigungen</Text>
                <Text style={styles.settingDescription}>
                  Erhalte Updates zu deinem Budget
                </Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: '#E5E5E5', true: '#00C851' }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>⏰ Tägliche Erinnerung</Text>
                    <Text style={styles.settingDescription}>
                      Tägliche Budget-Erinnerung aktivieren
                    </Text>
                  </View>
                  <Switch
                    value={dailyReminderEnabled}
                    onValueChange={handleDailyReminderToggle}
                    trackColor={{ false: '#E5E5E5', true: '#00C851' }}
                    thumbColor={dailyReminderEnabled ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>

                {dailyReminderEnabled && (
                  <View style={styles.timeSelector}>
                    <Text style={styles.timeSelectorTitle}>🕘 Erinnerungszeit:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.timeOptions}>
                        {timeOptions.map((time) => (
                          <TouchableOpacity
                            key={time.hour}
                            style={[
                              styles.timeOption,
                              reminderTime.hour === time.hour && styles.timeOptionSelected
                            ]}
                            onPress={() => changeReminderTime(time.hour)}
                          >
                            <Text style={[
                              styles.timeOptionText,
                              reminderTime.hour === time.hour && styles.timeOptionTextSelected
                            ]}>
                              {time.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                )}

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>⚠️ Niedrig-Budget Warnungen</Text>
                    <Text style={styles.settingDescription}>
                      Warnung bei niedrigem Tagesbudget
                    </Text>
                  </View>
                  <Switch
                    value={lowBudgetWarnings}
                    onValueChange={(value) => {
                      setLowBudgetWarnings(value);
                      saveSettings({
                        notificationsEnabled,
                        dailyReminderEnabled,
                        reminderTime,
                        lowBudgetWarnings: value,
                        motivationNotifications,
                      });
                    }}
                    trackColor={{ false: '#E5E5E5', true: '#FFD700' }}
                    thumbColor={lowBudgetWarnings ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>

                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>🎉 Motivations-Nachrichten</Text>
                    <Text style={styles.settingDescription}>
                      Positive Nachrichten bei gutem Budget
                    </Text>
                  </View>
                  <Switch
                    value={motivationNotifications}
                    onValueChange={(value) => {
                      setMotivationNotifications(value);
                      saveSettings({
                        notificationsEnabled,
                        dailyReminderEnabled,
                        reminderTime,
                        lowBudgetWarnings,
                        motivationNotifications: value,
                      });
                    }}
                    trackColor={{ false: '#E5E5E5', true: '#00C851' }}
                    thumbColor={motivationNotifications ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>
              </>
            )}
          </View>

          {/* Test-Bereich */}
          {notificationsEnabled && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Test</Text>
              <TouchableOpacity
                style={styles.testButton}
                onPress={sendTestNotification}
              >
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                <Text style={styles.testButtonText}>Test-Benachrichtigung senden</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Info-Bereich */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ℹ️ Info</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                • Benachrichtigungen zeigen dein aktuelles Tagesbudget{'\n'}
                • Warnungen bei niedrigem Budget helfen beim Sparen{'\n'}
                • Motivations-Nachrichten feiern deine Erfolge{'\n'}
                • Alle Daten bleiben lokal auf deinem Gerät
              </Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  timeSelector: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  timeSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  timeOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  timeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  timeOptionSelected: {
    backgroundColor: '#00C851',
    borderColor: '#00C851',
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  timeOptionTextSelected: {
    color: 'white',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  infoBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default SettingsModal; 