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
  const [reminderTime1, setReminderTime1] = useState({ hour: 9, minute: 0 });
  const [reminderTime2, setReminderTime2] = useState({ hour: 20, minute: 0 });

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
        setReminderTime1(parsed.reminderTime1 || { hour: 9, minute: 0 });
        setReminderTime2(parsed.reminderTime2 || { hour: 20, minute: 0 });
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
      reminderTime1,
      reminderTime2,
    };
    
    await saveSettings(settings);
  };

  const handleDailyReminderToggle = async (enabled) => {
    setDailyReminderEnabled(enabled);
    
    if (enabled) {
      // Native Scheduling (falls native)
      await NotificationService.scheduleDailyBudgetReminders?.(reminderTime1, reminderTime2);
      Alert.alert(
        '⏰ Tägliche Erinnerungen aktiviert',
        `Du erhältst täglich um ${formatTime(reminderTime1)} und ${formatTime(reminderTime2)} eine Erinnerung!`
      );
    } else {
      await NotificationService.cancelDailyReminders();
      Alert.alert('🔕 Tägliche Erinnerung deaktiviert');
    }

    const settings = {
      notificationsEnabled,
      dailyReminderEnabled: enabled,
      reminderTime1,
      reminderTime2,
    };
    
    await saveSettings(settings);
    await syncScheduleWithServer(reminderTime1, reminderTime2);
  };

  const sendTestNotification = async () => {
    if (!notificationsEnabled) {
      Alert.alert('❌ Benachrichtigungen sind deaktiviert');
      return;
    }

    await NotificationService.sendBudgetNotification(25.50, 150.00, 6);
    Alert.alert('📱 Test-Benachrichtigung gesendet!');
  };

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const to2 = (n) => n.toString().padStart(2, '0');
  const formatTime = (t) => `${to2(t.hour)}:${to2(t.minute)}`;

  const onChangeTime = (idx, field, value) => {
    const num = parseInt(value.replace(/\\D/g, ''), 10);
    if (Number.isNaN(num)) return;
    if (idx === 1) {
      const next = { ...reminderTime1, [field]: clamp(num, field === 'hour' ? 0 : 0, field === 'hour' ? 23 : 59) };
      setReminderTime1(next);
      persist(next, reminderTime2);
    } else {
      const next = { ...reminderTime2, [field]: clamp(num, field === 'hour' ? 0 : 0, field === 'hour' ? 23 : 59) };
      setReminderTime2(next);
      persist(reminderTime1, next);
    }
  };

  const persist = async (t1, t2) => {
    const settings = {
      notificationsEnabled,
      dailyReminderEnabled,
      reminderTime1: t1,
      reminderTime2: t2,
    };
    await saveSettings(settings);
    if (dailyReminderEnabled) {
      await syncScheduleWithServer(t1, t2);
    }
  };

  const syncScheduleWithServer = async (t1, t2) => {
    try {
      const key = localStorage.getItem('db-sub-key');
      const token = localStorage.getItem('db-sub-token');
      const timezone = localStorage.getItem('db-timezone');
      if (!key || !token) return;
      await fetch('/.netlify/functions/updateSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          key,
          timezone,
          schedule: [formatTime(t1), formatTime(t2)]
        })
      });
    } catch (e) {
      console.log('schedule sync error', e);
    }
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
                    <>
                      <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Zeit 1 (HH:MM)</Text>
                        <View style={styles.timeInputs}>
                          <TouchableOpacity onPress={() => onChangeTime(1, 'hour', String((reminderTime1.hour + 23) % 24))}><Text style={styles.arrow}>▲</Text></TouchableOpacity>
                          <Text style={styles.timeDisplay}>{to2(reminderTime1.hour)}</Text>
                          <TouchableOpacity onPress={() => onChangeTime(1, 'hour', String((reminderTime1.hour + 1) % 24))}><Text style={styles.arrow}>▼</Text></TouchableOpacity>
                          <Text style={styles.colon}>:</Text>
                          <TouchableOpacity onPress={() => onChangeTime(1, 'minute', String((reminderTime1.minute + 59) % 60))}><Text style={styles.arrow}>▲</Text></TouchableOpacity>
                          <Text style={styles.timeDisplay}>{to2(reminderTime1.minute)}</Text>
                          <TouchableOpacity onPress={() => onChangeTime(1, 'minute', String((reminderTime1.minute + 1) % 60))}><Text style={styles.arrow}>▼</Text></TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Zeit 2 (HH:MM)</Text>
                        <View style={styles.timeInputs}>
                          <TouchableOpacity onPress={() => onChangeTime(2, 'hour', String((reminderTime2.hour + 23) % 24))}><Text style={styles.arrow}>▲</Text></TouchableOpacity>
                          <Text style={styles.timeDisplay}>{to2(reminderTime2.hour)}</Text>
                          <TouchableOpacity onPress={() => onChangeTime(2, 'hour', String((reminderTime2.hour + 1) % 24))}><Text style={styles.arrow}>▼</Text></TouchableOpacity>
                          <Text style={styles.colon}>:</Text>
                          <TouchableOpacity onPress={() => onChangeTime(2, 'minute', String((reminderTime2.minute + 59) % 60))}><Text style={styles.arrow}>▲</Text></TouchableOpacity>
                          <Text style={styles.timeDisplay}>{to2(reminderTime2.minute)}</Text>
                          <TouchableOpacity onPress={() => onChangeTime(2, 'minute', String((reminderTime2.minute + 1) % 60))}><Text style={styles.arrow}>▼</Text></TouchableOpacity>
                        </View>
                      </View>
                    </>
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
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    width: 20,
    textAlign: 'center',
    color: '#666',
  },
  timeDisplay: {
    width: 28,
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
  },
  colon: {
    fontSize: 16,
    color: '#333',
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