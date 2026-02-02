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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NotificationService from './NotificationService';

const SettingsModal = ({ visible, onClose }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);
  const [reminderTime1, setReminderTime1] = useState({ hour: 9, minute: 0 });
  const [reminderTime2, setReminderTime2] = useState({ hour: 20, minute: 0 });
  const [testStatus, setTestStatus] = useState('');
  const [serverStatus, setServerStatus] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        // Immer aktiv anzeigen, Button entfällt
        setNotificationsEnabled(true);
        setDailyReminderEnabled(true);
        setReminderTime1(parsed.reminderTime1 || { hour: 9, minute: 0 });
        setReminderTime2(parsed.reminderTime2 || { hour: 20, minute: 0 });
      } else {
        // Defaults initial speichern
        await saveSettings({
          notificationsEnabled: true,
          dailyReminderEnabled: true,
          reminderTime1,
          reminderTime2,
        });
      }
      // Server-Zeitplan synchronisieren + lesen
      await syncScheduleWithServer(reminderTime1, reminderTime2);
      await fetchServerSchedule();
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

    try {
      setTestStatus('Sende Testbenachrichtigung...');
      if (Platform.OS === 'web') {
        if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
          setTestStatus('Nicht unterstützt: Push in diesem Browser nicht verfügbar.');
          Alert.alert('❌ Nicht unterstützt', 'Push-Benachrichtigungen werden hier nicht unterstützt.');
          return;
        }
        if (Notification.permission !== 'granted') {
          setTestStatus('Berechtigung anfragen...');
          const perm = await Notification.requestPermission().catch(() => 'default');
          if (perm !== 'granted') {
            setTestStatus('Keine Berechtigung: Bitte Benachrichtigungen erlauben.');
            Alert.alert('❌ Keine Berechtigung', 'Bitte Benachrichtigungen in iOS/Safari erlauben.');
            return;
          }
        }

        const ensureKey = async (forceResubscribe = false) => {
          setTestStatus('Service Worker prüfen...');
          let reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            setTestStatus('Service Worker registrieren...');
            reg = await navigator.serviceWorker.register('/sw.js');
          }
          await navigator.serviceWorker.ready;
          reg = await navigator.serviceWorker.ready;
          if (!reg?.pushManager) {
            throw new Error('PushManager nicht verfügbar');
          }
          let sub = await reg.pushManager.getSubscription();
          if (sub && forceResubscribe) {
            try {
              await sub.unsubscribe();
            } catch {}
            sub = null;
          }
          if (!sub) {
            setTestStatus('Push-Subscription erstellen...');
            const res = await fetch('/.netlify/functions/publicVapidKey', { cache: 'no-store' });
            if (!res.ok) {
              const msg = await res.text();
              throw new Error(msg || `publicVapidKey fehlgeschlagen (${res.status})`);
            }
            const { publicKey } = await res.json();
            if (!publicKey) throw new Error('VAPID Public Key fehlt');
            const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
            const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const appServerKey = new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
            try {
              sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
            } catch (e) {
              throw new Error(`subscribe fehlgeschlagen: ${e?.message || 'unbekannt'}`);
            }
          }
          const timezone = localStorage.getItem('db-timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
          setTestStatus('Subscription am Server speichern...');
          const resp = await fetch('/.netlify/functions/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone, subscription: sub })
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || `subscribe failed (${resp.status})`);
          }
          const data = await resp.json().catch(() => ({}));
          if (data?.key) {
            localStorage.setItem('db-sub-key', data.key);
            if (data?.token) localStorage.setItem('db-sub-token', data.token);
            return data.key;
          }
          const existing = localStorage.getItem('db-sub-key');
          if (existing) return existing;
          throw new Error('Keine Push-Subscription verfügbar');
        };

        let key = await ensureKey();
        let res = await fetch('/.netlify/functions/testPush', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key })
        });
        if (res.status === 404) {
          key = await ensureKey(true);
          res = await fetch('/.netlify/functions/testPush', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
          });
        }
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || 'Test-Push fehlgeschlagen');
        }
        setTestStatus('Testbenachrichtigung gesendet ✅');
        Alert.alert('📱 Test-Benachrichtigung gesendet!');
      } else {
        await NotificationService.sendBudgetNotification(25.50, 150.00, 6);
        setTestStatus('Testbenachrichtigung gesendet ✅');
        Alert.alert('📱 Test-Benachrichtigung gesendet!');
      }
    } catch (e) {
      console.error('Test-Push Fehler:', e);
      setTestStatus(`Fehler: ${e?.message || 'Testbenachrichtigung konnte nicht gesendet werden.'}`);
      Alert.alert('❌ Fehler', e?.message || 'Test-Benachrichtigung konnte nicht gesendet werden.');
    }
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
    await fetchServerSchedule();
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

  const fetchServerSchedule = async () => {
    try {
      if (Platform.OS !== 'web') return;
      const key = localStorage.getItem('db-sub-key');
      const token = localStorage.getItem('db-sub-token');
      if (!key || !token) {
        setServerStatus('Server: keine Subscription');
        return;
      }
      const res = await fetch('/.netlify/functions/getSchedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ key })
      });
      if (!res.ok) {
        const msg = await res.text();
        setServerStatus(`Server-Fehler: ${msg || res.status}`);
        return;
      }
      const data = await res.json();
      const schedule = Array.isArray(data?.schedule) ? data.schedule.join(', ') : '—';
      const tz = data?.timezone || '—';
      setServerStatus(`Server: ${schedule} (TZ: ${tz})`);
    } catch (e) {
      setServerStatus('Server: Fehler beim Laden');
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
            <Text style={styles.modalTitle}>Erinnerungszeiten</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Zeiten direkt bearbeiten */}
            <View style={styles.settingSection}>
              <Text style={styles.sectionTitle}>🔔 Erinnerungszeiten</Text>
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
              <TouchableOpacity
                style={styles.testButton}
                onPress={sendTestNotification}
              >
                <Text style={styles.testButtonText}>🧪 Test-Benachrichtigung senden</Text>
              </TouchableOpacity>
              {!!testStatus && (
                <Text style={styles.testStatusText}>{testStatus}</Text>
              )}
              {!!serverStatus && (
                <Text style={styles.testStatusText}>{serverStatus}</Text>
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
  testStatusText: {
    marginTop: 10,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default SettingsModal; 