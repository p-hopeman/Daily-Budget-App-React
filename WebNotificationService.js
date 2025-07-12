// COMPLETELY DISABLED FOR DEBUGGING - ALL FUNCTIONS RETURN DUMMY VALUES
// This prevents complex notification logic from interfering with web app

export default class WebNotificationService {
  constructor() {
    console.log('WebNotificationService: DUMMY MODE - alle Funktionen deaktiviert');
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
    this.permission = this.isSupported ? Notification.permission : 'default';
    this.isIOSStandalone = false;
    this.isIOSSafari = false;
    this.serviceWorkerRegistration = null;
  }

  isWebNotificationSupported() {
    return this.isSupported;
  }

  async requestPermission() {
    console.log('DUMMY: requestPermission');
    return false;
  }

  async sendNotification(title, body, options = {}) {
    console.log('DUMMY: sendNotification', title, body);
    return null;
  }

  async sendBudgetUpdateNotification() {
    console.log('DUMMY: sendBudgetUpdateNotification');
    return null;
  }

  async sendDailyReminderNotification() {
    console.log('DUMMY: sendDailyReminderNotification');
    return null;
  }

  async sendLowBudgetWarning() {
    console.log('DUMMY: sendLowBudgetWarning');
    return null;
  }

  async sendMotivationNotification() {
    console.log('DUMMY: sendMotivationNotification');
    return null;
  }

  async sendTestNotification() {
    console.log('DUMMY: sendTestNotification');
    return null;
  }

  getBudgetStatusEmoji(dailyBudget) {
    if (dailyBudget <= 0) return '🔴';
    if (dailyBudget <= 5) return '🟠';
    if (dailyBudget <= 15) return '🟡';
    if (dailyBudget <= 30) return '🟢';
    return '💚';
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  setupDailyReminders() {
    console.log('DUMMY: setupDailyReminders');
  }

  getPermissionStatus() {
    return this.permission;
  }

  setServiceWorkerRegistration() {
    console.log('DUMMY: setServiceWorkerRegistration');
  }

  async sendServiceWorkerNotification() {
    console.log('DUMMY: sendServiceWorkerNotification');
    return null;
  }

  checkIOSSettings() {
    return {
      isStandalone: false,
      hasNotificationSupport: this.isSupported,
      permissionStatus: this.permission,
      hasServiceWorker: false,
      recommendation: 'Dummy mode - alle Funktionen deaktiviert'
    };
  }
} 