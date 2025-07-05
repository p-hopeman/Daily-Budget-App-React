import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Konfiguriere Notification-Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  constructor() {
    this.expoPushToken = null;
  }

  // Registriere für Push Notifications
  async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('daily-budget', {
        name: 'Daily Budget',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        alert('Benachrichtigungen sind erforderlich für Budget-Updates!');
        return;
      }

      try {
        const projectId = ''; // In Expo Go nicht benötigt
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        console.log('Push token:', token);
      } catch (e) {
        console.log('Token error:', e);
        // In Expo Go funktioniert das manchmal nicht - ist aber OK für lokale Notifications
      }
    } else {
      alert('Push notifications funktionieren nur auf echten Geräten!');
    }

    this.expoPushToken = token;
    return token;
  }

  // Formatiere Währung
  formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  // Bestimme Budget-Status und Farbe
  getBudgetStatus(dailyBudget) {
    if (dailyBudget < 0) {
      return { status: '🔴 Warnung', color: 'red' };
    } else if (dailyBudget < 10) {
      return { status: '🟡 Achtung', color: 'orange' };
    } else {
      return { status: '🟢 Gut', color: 'green' };
    }
  }

  // Sende sofortige Budget-Benachrichtigung
  async sendBudgetNotification(dailyBudget, remainingBudget, remainingDays) {
    const budgetStatus = this.getBudgetStatus(dailyBudget);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${budgetStatus.status} Tagesbudget: ${this.formatCurrency(dailyBudget)}`,
        body: `Verbleibendes Budget: ${this.formatCurrency(remainingBudget)} für ${remainingDays} Tage`,
        data: { 
          dailyBudget, 
          remainingBudget, 
          remainingDays,
          type: 'budget_update'
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Sofort senden
    });
  }

  // Plane tägliche Budget-Erinnerung
  async scheduleDailyBudgetReminder(hour = 9, minute = 0) {
    // Lösche vorherige tägliche Erinnerungen
    await this.cancelDailyReminders();

    // Plane neue tägliche Benachrichtigung
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Daily Budget Check',
        body: 'Öffne die App um dein heutiges Budget zu sehen!',
        data: { type: 'daily_reminder' },
        sound: true,
      },
      trigger: {
        hour: hour,
        minute: minute,
        repeats: true,
      },
      identifier: 'daily-budget-reminder',
    });

    console.log(`Tägliche Erinnerung geplant für ${hour}:${minute < 10 ? '0' : ''}${minute}`);
  }

  // Plane Budget-Warnung bei niedrigem Budget
  async scheduleLowBudgetWarning(dailyBudget, thresholdAmount = 5) {
    if (dailyBudget <= thresholdAmount) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⚠️ Niedriges Tagesbudget!',
          body: `Nur noch ${this.formatCurrency(dailyBudget)} heute verfügbar`,
          data: { 
            type: 'low_budget_warning',
            dailyBudget,
            threshold: thresholdAmount
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Sofort senden
      });
    }
  }

  // Sende Motivations-Benachrichtigung bei gutem Budget
  async sendMotivationNotification(dailyBudget) {
    if (dailyBudget > 20) {
      const motivationMessages = [
        '🎉 Super! Du liegst gut im Budget!',
        '💪 Weiter so! Deine Finanzen sind auf Kurs!',
        '🌟 Excellent budgeting! Du rockst das!',
        '🚀 Du bist ein Budget-Pro!',
      ];

      const randomMessage = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];

      await Notifications.scheduleNotificationAsync({
        content: {
          title: randomMessage,
          body: `Tagesbudget: ${this.formatCurrency(dailyBudget)} - Gönn dir was Schönes! 😊`,
          data: { 
            type: 'motivation',
            dailyBudget
          },
          sound: true,
        },
        trigger: null,
      });
    }
  }

  // Lösche alle geplanten Benachrichtigungen
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Alle geplanten Benachrichtigungen gelöscht');
  }

  // Lösche nur tägliche Erinnerungen
  async cancelDailyReminders() {
    await Notifications.cancelScheduledNotificationAsync('daily-budget-reminder');
  }

  // Zeige alle geplanten Benachrichtigungen (Debug)
  async getScheduledNotifications() {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log('Geplante Benachrichtigungen:', notifications);
    return notifications;
  }

  // Handle Notification Response (wenn User auf Benachrichtigung tippt)
  addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Handle Notification Received (wenn App im Vordergrund ist)
  addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  }
}

export default new NotificationService(); 