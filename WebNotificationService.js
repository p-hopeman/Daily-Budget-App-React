import { Platform } from 'react-native';

class WebNotificationService {
  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'default';
  }

  // Prüfe ob Web Notifications unterstützt werden
  isWebNotificationSupported() {
    return this.isSupported;
  }

  // Fordere Notification-Berechtigung an
  async requestPermission() {
    if (!this.isSupported) {
      console.log('Web Notifications werden nicht unterstützt');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('✅ Web Notifications berechtigt!');
        return true;
      } else {
        console.log('❌ Web Notifications abgelehnt');
        return false;
      }
    } catch (error) {
      console.error('Fehler beim Anfordern der Notification-Berechtigung:', error);
      return false;
    }
  }

  // Sende Browser-Notification
  async sendNotification(title, body, options = {}) {
    if (!this.isSupported || this.permission !== 'granted') {
      console.log('Web Notifications nicht verfügbar oder nicht berechtigt');
      return null;
    }

    try {
      const defaultOptions = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'daily-budget-app',
        requireInteraction: false,
        silent: false,
        ...options
      };

      const notification = new Notification(title, {
        body,
        ...defaultOptions
      });

      // Auto-close nach 5 Sekunden (außer requireInteraction ist true)
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      // Event Listeners
      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) {
          options.onClick();
        }
      };

      notification.onerror = (error) => {
        console.error('Notification Error:', error);
      };

      return notification;
    } catch (error) {
      console.error('Fehler beim Senden der Web Notification:', error);
      return null;
    }
  }

  // Budget-Update Notification
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

    return await this.sendNotification(title, body, {
      tag: 'budget-update',
      data: { 
        dailyBudget, 
        remainingBudget, 
        remainingDays,
        changeAmount,
        isExpense,
        type: 'budget_update'
      }
    });
  }

  // Tägliche Erinnerung (Browser-Version)
  async sendDailyReminderNotification(dailyBudget, timeOfDay = 'morning') {
    const budgetEmoji = this.getBudgetStatusEmoji(dailyBudget);
    const title = `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}`;
    
    const messages = {
      morning: '🌅 Guten Morgen! Wie ist dein Budget heute?',
      evening: '🌙 Guten Abend! Wie lief dein Budget-Tag?'
    };

    return await this.sendNotification(title, messages[timeOfDay] || messages.morning, {
      tag: 'daily-reminder',
      requireInteraction: true,
      data: { 
        type: 'daily_reminder',
        timeOfDay,
        dailyBudget
      }
    });
  }

  // Niedrig-Budget Warnung
  async sendLowBudgetWarning(dailyBudget, threshold = 5) {
    if (dailyBudget <= threshold) {
      const budgetEmoji = this.getBudgetStatusEmoji(dailyBudget);
      const title = `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}`;
      
      return await this.sendNotification(title, '⚠️ Niedriges Budget! Aufpassen mit den Ausgaben.', {
        tag: 'low-budget-warning',
        requireInteraction: true,
        data: { 
          type: 'low_budget_warning',
          dailyBudget,
          threshold
        }
      });
    }
  }

  // Motivations-Notification
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
      const title = `${budgetEmoji} Tagesbudget: ${this.formatCurrency(dailyBudget)}`;

      return await this.sendNotification(title, randomMessage, {
        tag: 'motivation',
        data: { 
          type: 'motivation',
          dailyBudget
        }
      });
    }
  }

  // Teste Web Notifications
  async sendTestNotification() {
    return await this.sendNotification(
      '📱 Test-Benachrichtigung',
      'Web Notifications funktionieren! 🎉',
      {
        tag: 'test',
        requireInteraction: true
      }
    );
  }

  // Helper: Budget Status Emoji
  getBudgetStatusEmoji(dailyBudget) {
    if (dailyBudget <= 0) return '🔴';
    if (dailyBudget <= 5) return '🟠';
    if (dailyBudget <= 15) return '🟡';
    if (dailyBudget <= 30) return '🟢';
    return '💚';
  }

  // Helper: Format Currency
  formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  // Setup automatische tägliche Erinnerungen (vereinfacht für Web)
  setupDailyReminders(dailyBudget, morningTime = 8, eveningTime = 20) {
    // Für Web: Verwende setTimeout/setInterval oder lokale Scheduler
    // Hinweis: Für persistente Erinnerungen über Browser-Sessions hinweg 
    // würde man Service Workers verwenden
    
    console.log(`📅 Tägliche Web-Erinnerungen würden um ${morningTime}:00 und ${eveningTime}:00 aktiviert`);
    console.log('💡 Für persistente Erinnerungen über Browser-Sessions hinweg, öffne die App regelmäßig');
  }

  // Prüfe aktuellen Permission-Status
  getPermissionStatus() {
    return this.permission;
  }
}

export default WebNotificationService; 