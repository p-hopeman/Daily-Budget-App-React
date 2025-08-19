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
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={['#4CAF50', '#45A049']}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Einstellungen</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Benachrichtigungen */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>🔔 Benachrichtigungen</Text>
              
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Benachrichtigungen aktivieren</Text>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationsToggle}
                  trackColor={{ false: '#767577', true: '#4CAF50' }}
                  thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
                />
              </View>

              {notificationsEnabled && (
                <>
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Tägliche Erinnerung</Text>
                    <Switch
                      value={dailyReminderEnabled}
                      onValueChange={handleDailyReminderToggle}
                      trackColor={{ false: '#767577', true: '#4CAF50' }}
                      thumbColor={dailyReminderEnabled ? '#fff' : '#f4f3f4'}
                    />
                  </View>

                  {dailyReminderEnabled && (
                    <View style={styles.settingRow}>
                      <Text style={styles.settingLabel}>Erinnerungszeit</Text>
                      <View style={styles.timeSelector}>
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
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.testButton}
                    onPress={sendTestNotification}
                  >
                    <Text style={styles.testButtonText}>🧪 Test-Benachrichtigung senden</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Info */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>ℹ️ Info</Text>
              <Text style={styles.infoText}>
                Benachrichtigungen helfen dir dabei, dein Budget im Blick zu behalten.
                Du erhältst Updates bei Transaktionen und tägliche Erinnerungen.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    padding: 5,
  },
  modalBody: {
    padding: 20,
  },
  settingSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  timeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  timeOptionSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#666',
  },
  timeOptionTextSelected: {
    color: 'white',
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default SettingsModal; 