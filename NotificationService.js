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

  // Bestimme Budget-Status und Emoji
  getBudgetStatusEmoji(dailyBudget) {
    if (dailyBudget < 0) {
      return '🔴';
    } else if (dailyBudget < 10) {
      return '🟠';
    } else {
      return '🟢';
    }
  }

  // Sende sofortige Budget-Benachrichtigung
  async sendBudgetNotification(dailyBudget, remainingBudget, remainingDays) {
    const budgetEmoji = this.getBudgetStatusEmoji(dailyBudget);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}`,
        body: 'Budget aktualisiert',
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

  // Plane tägliche Budget-Erinnerung (morgens und abends)
  async scheduleDailyBudgetReminders(dailyBudget = null) {
    // Lösche vorherige tägliche Erinnerungen
    await this.cancelDailyReminders();

    const budgetEmoji = dailyBudget ? this.getBudgetStatusEmoji(dailyBudget) : '💰';
    const budgetText = dailyBudget ? 
      `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}` : 
      '💰 Tagesbudget anzeigen';

    // Morgens um 9:00 Uhr
    await Notifications.scheduleNotificationAsync({
      content: {
        title: budgetText,
        body: '🌅 Guten Morgen!',
        data: { type: 'morning_reminder', dailyBudget },
        sound: true,
      },
      trigger: {
        hour: 9,
        minute: 0,
        repeats: true,
      },
      identifier: 'morning-budget-reminder',
    });

    // Abends um 20:00 Uhr
    await Notifications.scheduleNotificationAsync({
      content: {
        title: budgetText,
        body: '🌙 Guten Abend!',
        data: { type: 'evening_reminder', dailyBudget },
        sound: true,
      },
      trigger: {
        hour: 20,
        minute: 0,
        repeats: true,
      },
      identifier: 'evening-budget-reminder',
    });

    console.log(`Tägliche Erinnerungen geplant mit Budget: ${budgetText}`);
  }

  // Erweiterte Budget-Benachrichtigung mit mehr Details
  async sendBudgetUpdateNotification(dailyBudget, remainingBudget, remainingDays, changeAmount = null, isExpense = false) {
    const budgetEmoji = this.getBudgetStatusEmoji(dailyBudget);
    
    const title = `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}`;
    
    let body;
    if (changeAmount) {
      body = isExpense ? 
        `➖ Ausgabe: ${this.formatCurrency(Math.abs(changeAmount))}` : 
        `➕ Einzahlung: ${this.formatCurrency(Math.abs(changeAmount))}`;
    } else {
      body = 'Budget aktualisiert';
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: { 
          dailyBudget, 
          remainingBudget, 
          remainingDays,
          changeAmount,
          isExpense,
          type: 'budget_update'
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Sofort senden
    });
  }

  // Plane Budget-Warnung bei niedrigem Budget
  async scheduleLowBudgetWarning(dailyBudget, thresholdAmount = 5) {
    if (dailyBudget <= thresholdAmount) {
      const budgetEmoji = this.getBudgetStatusEmoji(dailyBudget);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠️ Niedriges Budget: ${this.formatCurrency(dailyBudget)}`,
          body: 'Vorsicht bei weiteren Ausgaben!',
          data: { 
            type: 'low_budget_warning',
            dailyBudget
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
      const budgetEmoji = this.getBudgetStatusEmoji(dailyBudget);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}`,
          body: randomMessage,
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

  // Lösche tägliche Erinnerungen
  async cancelDailyReminders() {
    await Notifications.cancelScheduledNotificationAsync('morning-budget-reminder');
    await Notifications.cancelScheduledNotificationAsync('evening-budget-reminder');
    console.log('Tägliche Erinnerungen gelöscht');
  }

  // Plane tägliche Erinnerung zu bestimmter Zeit
  async scheduleDailyBudgetReminder(hour, minute) {
    await this.cancelDailyReminders();
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 Tagesbudget anzeigen',
        body: 'Zeit für dein Budget-Update!',
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
    
    console.log(`Tägliche Erinnerung um ${hour}:${minute.toString().padStart(2, '0')} geplant`);
  }
}

export default NotificationService; 