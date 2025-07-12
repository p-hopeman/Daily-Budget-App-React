import { Platform } from 'react-native';

class WebNotificationService {
  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'default';
    this.isIOSStandalone = window.navigator.standalone === true;
    this.isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }

  // Prüfe ob Web Notifications unterstützt werden
  isWebNotificationSupported() {
    // iOS Web Notifications funktionieren nur in PWA-Modus oder iOS 16.4+
    if (this.isIOSSafari && !this.isIOSStandalone) {
      const userAgent = navigator.userAgent;
      const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/);
      if (match) {
        const version = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        // iOS 16.4 = Version 16, Minor 4
        if (version < 16 || (version === 16 && minor < 4)) {
          console.log('iOS Version zu alt für Web Notifications. Benötigt iOS 16.4+');
          return false;
        }
      }
    }
    return this.isSupported;
  }

  // Fordere Notification-Berechtigung an
  async requestPermission() {
    if (!this.isSupported) {
      console.log('Web Notifications werden nicht unterstützt');
      return false;
    }

    // Spezielle Behandlung für iOS
    if (this.isIOSSafari && !this.isIOSStandalone) {
      console.log('💡 Hinweis: Für beste Erfahrung auf iOS die Website zum Home-Bildschirm hinzufügen');
    }

    if (this.permission === 'granted') {
      return true;
    }

    try {
      // Für iOS: Berechtigung muss durch User-Interaktion ausgelöst werden
      const permission = await Notification.requestPermission();
      this.permission = permission;
      
      if (permission === 'granted') {
        console.log('✅ Web Notifications berechtigt!');
        return true;
      } else if (permission === 'denied') {
        console.log('❌ Web Notifications dauerhaft abgelehnt');
        return false;
      } else {
        console.log('⏸️ Web Notifications vorerst abgelehnt');
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
        icon: '/assets/icon.png',
        badge: '/assets/icon.png',
        tag: 'daily-budget-app',
        requireInteraction: false,
        silent: false,
        timestamp: Date.now(),
        ...options
      };

      const notification = new Notification(title, {
        body,
        ...defaultOptions
      });

      // Auto-close nach 8 Sekunden für iOS (länger als Standard)
      if (!defaultOptions.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, this.isIOSSafari ? 8000 : 5000);
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

      notification.onshow = () => {
        console.log('Notification wurde angezeigt');
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

  // Teste Web Notifications mit iOS-spezifischer Info
  async sendTestNotification() {
    let message = 'Web Notifications funktionieren! 🎉';
    
    if (this.isIOSSafari && !this.isIOSStandalone) {
      message = 'Web Notifications aktiv! 🎉\n💡 Tipp: App zum Home-Bildschirm hinzufügen für beste Erfahrung';
    }

    return await this.sendNotification(
      '📱 Test-Benachrichtigung',
      message,
      {
        tag: 'test',
        requireInteraction: true,
        data: { type: 'test' }
      }
    );
  }

  // Prüfe iOS-spezifische Einstellungen
  checkIOSSettings() {
    if (this.isIOSSafari) {
      return {
        isStandalone: this.isIOSStandalone,
        hasNotificationSupport: this.isSupported,
        permissionStatus: this.permission,
        recommendation: !this.isIOSStandalone ? 
          'Füge die App zum Home-Bildschirm hinzu für optimale Benachrichtigungen' : 
          'Perfekt eingerichtet! 🎉'
      };
    }
    return null;
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