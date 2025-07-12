// COMPLETELY DISABLED FOR DEBUGGING - ALL FUNCTIONS RETURN DUMMY VALUES
// This prevents expo-notifications from being loaded and causing web errors

export default class NotificationService {
  constructor() {
    console.log('NotificationService: DUMMY MODE - alle Funktionen deaktiviert');
    this.expoPushToken = null;
  }
  
  async registerForPushNotificationsAsync() { 
    console.log('DUMMY: registerForPushNotificationsAsync'); 
    return null; 
  }
  
  formatCurrency(amount) { 
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }
  
  getBudgetStatusEmoji(dailyBudget) { 
    if (dailyBudget < 0) return '🔴';
    if (dailyBudget < 10) return '🟠';
    return '🟢';
  }
  
  async sendBudgetNotification() { 
    console.log('DUMMY: sendBudgetNotification'); 
  }
  
  async scheduleDailyBudgetReminders() { 
    console.log('DUMMY: scheduleDailyBudgetReminders'); 
  }
  
  async sendBudgetUpdateNotification() { 
    console.log('DUMMY: sendBudgetUpdateNotification'); 
  }
  
  async scheduleLowBudgetWarning() { 
    console.log('DUMMY: scheduleLowBudgetWarning'); 
  }
  
  async sendMotivationNotification() { 
    console.log('DUMMY: sendMotivationNotification'); 
  }
  
  async cancelAllNotifications() { 
    console.log('DUMMY: cancelAllNotifications'); 
  }
  
  async cancelDailyReminders() { 
    console.log('DUMMY: cancelDailyReminders'); 
  }
  
  async getScheduledNotifications() { 
    console.log('DUMMY: getScheduledNotifications'); 
    return []; 
  }
  
  addNotificationResponseListener() { 
    console.log('DUMMY: addNotificationResponseListener'); 
    return { remove: () => {} }; 
  }
  
  addNotificationReceivedListener() { 
    console.log('DUMMY: addNotificationReceivedListener'); 
    return { remove: () => {} }; 
  }
} 