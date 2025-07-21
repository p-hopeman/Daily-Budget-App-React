import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  AppState,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import NotificationService from './NotificationService';
import WebNotificationService from './WebNotificationService';
import PWAService from './PWAService';

const { width, height } = Dimensions.get('window');

// Plattform-spezifische NotificationService-Instanz
const isWeb = Platform.OS === 'web';
const notificationService = isWeb ? new WebNotificationService() : new NotificationService();
const pwaService = isWeb ? new PWAService() : null;

export default function App() {
  const [dailyBudget, setDailyBudget] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [remainingDays, setRemainingDays] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [showingAddTransaction, setShowingAddTransaction] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');
  const [isDeposit, setIsDeposit] = useState(true);
  const [showingSettings, setShowingSettings] = useState(false);

  // Lade Daten beim App-Start und initialisiere Notifications
  useEffect(() => {
    loadData();
    calculateRemainingDays();
    initializeNotifications();
    
    // Timer für tägliche Aktualisierung
    const interval = setInterval(() => {
      calculateRemainingDays();
      calculateDailyBudget();
    }, 60000); // Jede Minute prüfen

    return () => clearInterval(interval);
  }, []);

  // Initialisiere Notification-System (plattform-spezifisch)
  const initializeNotifications = async () => {
    try {
      if (isWeb) {
        // PWA initialisieren (Service Worker + Manifest)
        if (pwaService) {
          const pwaInitialized = await pwaService.initialize();
          console.log('PWA Status:', pwaService.getStatus());
          
          if (pwaInitialized && pwaService.registration) {
            console.log('✅ PWA erfolgreich initialisiert!');
            // Verknüpfe Service Worker mit Notification Service
            if (notificationService.setServiceWorkerRegistration) {
              notificationService.setServiceWorkerRegistration(pwaService.registration);
            }
          }
        }
        
        // Web Notifications prüfen (aber nicht automatisch aktivieren)
        if (notificationService.isWebNotificationSupported()) {
          const permissionStatus = notificationService.getPermissionStatus();
          console.log('Web Notifications Status:', permissionStatus);
          
          if (permissionStatus === 'granted') {
            console.log('✅ Web Notifications bereits aktiviert!');
            // Sende Willkommens-Notification nur wenn bereits berechtigt
            setTimeout(() => {
              const iosSettings = notificationService.checkIOSSettings();
              let message = 'Web-Benachrichtigungen sind aktiv! Du erhältst Budget-Updates auch im Browser.';
              
              if (iosSettings && !iosSettings.isStandalone) {
                message = 'Benachrichtigungen aktiv! 🎉\n\n💡 Tipp: Tippe auf das 🔔-Symbol für PWA-Setup.';
              }
              
              notificationService.sendNotification(
                '🎉 Daily Budget App',
                message,
                { requireInteraction: true }
              );
            }, 2000);
          } else if (permissionStatus === 'default') {
            // 🔔 AUTO-SETUP: Automatische Permission-Request (basierend auf Schritt 2 Learning)
            console.log('🔔 AUTO-SETUP: Frage automatisch nach Notification-Permission...');
            setTimeout(async () => {
              try {
                const permission = await Notification.requestPermission();
                console.log('🔔 AUTO-SETUP: Permission erhalten:', permission);
                
                if (permission === 'granted') {
                  console.log('✅ AUTO-SETUP: Notifications automatisch aktiviert!');
                  // Sende Willkommens-Notification
                  const notification = new Notification('🎉 Willkommen!', {
                    body: 'Benachrichtigungen sind jetzt aktiv! Du erhältst Budget-Updates.',
                    icon: '/favicon.ico',
                    requireInteraction: true
                  });
                } else {
                  console.log('❌ AUTO-SETUP: Permission verweigert');
                }
              } catch (error) {
                console.error('🔔 AUTO-SETUP Fehler:', error);
              }
            }, 3000); // Nach 3 Sekunden automatisch fragen
          } else {
            console.log('Web Notifications noch nicht aktiviert. Tippe auf 🔔 zum Aktivieren.');
          }
        } else {
          console.log('Web Notifications werden nicht unterstützt');
        }
      } else {
        // Native Notifications (Expo) initialisieren
        await notificationService.registerForPushNotificationsAsync();
      }
      
      console.log('Notifications erfolgreich initialisiert!');
    } catch (error) {
      console.error('Fehler beim Initialisieren der Notifications:', error);
    }
  };

  // Aktualisiere tägliche Erinnerungen mit aktuellem Budget
  const updateDailyReminders = async () => {
    try {
      if (dailyBudget !== null && dailyBudget !== undefined) {
        if (isWeb) {
          // Web-Version: Setup für lokale Erinnerungen
          notificationService.setupDailyReminders(dailyBudget);
        } else {
          // Native Version: Schedule push notifications
          await notificationService.scheduleDailyBudgetReminders(dailyBudget);
        }
        console.log(`Tägliche Erinnerungen aktualisiert mit Budget: ${dailyBudget}`);
      }
    } catch (error) {
      console.error('Fehler beim Aktualisieren der täglichen Erinnerungen:', error);
    }
  };

  // Berechne Tagesbudget wenn sich Budget oder Tage ändern
  useEffect(() => {
    calculateDailyBudget();
  }, [remainingBudget, remainingDays]);

  // Aktualisiere tägliche Erinnerungen wenn sich das Tagesbudget ändert
  useEffect(() => {
    if (dailyBudget !== null && dailyBudget !== undefined && !isNaN(dailyBudget)) {
      updateDailyReminders();
    }
  }, [dailyBudget]);

  // App Focus Handler - behebt Bug beim Wechseln zwischen Apps
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        // App ist wieder aktiv - Daten neu laden
        loadData();
        calculateRemainingDays();
      }
    };

    // Listener für App State Changes hinzufügen
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove?.();
    };
  }, []);

  const loadData = async () => {
    try {
      const budgetData = await AsyncStorage.getItem('remainingBudget');
      const transactionData = await AsyncStorage.getItem('transactions');
      
      // Setze Budget (triggert useEffect für Tagesbudget-Berechnung)
      if (budgetData) {
        setRemainingBudget(parseFloat(budgetData));
      } else {
        setRemainingBudget(0); // Fallback wenn keine Daten vorhanden
      }
      
      // Setze Transaktionen
      if (transactionData) {
        setTransactions(JSON.parse(transactionData));
      } else {
        setTransactions([]); // Fallback für leere Transaktionen
      }
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      // Fallback bei Fehlern
      setRemainingBudget(0);
      setTransactions([]);
    }
  };

  const saveData = async (newBudget, newTransactions) => {
    try {
      await AsyncStorage.setItem('remainingBudget', newBudget.toString());
      await AsyncStorage.setItem('transactions', JSON.stringify(newTransactions));
    } catch (error) {
      console.error('Fehler beim Speichern der Daten:', error);
    }
  };

  const calculateRemainingDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDay = now.getDate();
    const remaining = daysInMonth - currentDay + 1;
    setRemainingDays(remaining);
  };

  const calculateDailyBudget = () => {
    const newDailyBudget = remainingDays > 0 ? remainingBudget / remainingDays : 0;
    setDailyBudget(newDailyBudget);
  };

  const updateRemainingBudget = (amount) => {
    const newBudget = isDeposit ? remainingBudget + amount : remainingBudget - amount;
    setRemainingBudget(newBudget);
    return newBudget;
  };

  const addTransaction = async () => {
    const cleanAmount = transactionAmount.replace(',', '.');
    const amount = parseFloat(cleanAmount);
    
    if (!amount || amount <= 0) {
      Alert.alert('Fehler', 'Bitte geben Sie einen gültigen Betrag ein.');
      return;
    }

    if (!transactionDescription.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie eine Beschreibung ein.');
      return;
    }

    const newTransaction = {
      id: Date.now().toString(),
      amount: amount,
      description: transactionDescription,
      date: new Date().toISOString(),
      isExpense: !isDeposit
    };

    const newTransactions = [newTransaction, ...transactions];
    const newBudget = updateRemainingBudget(amount);
    
    setTransactions(newTransactions);
    saveData(newBudget, newTransactions);
    
    // Berechne neues Tagesbudget und sende Notification
    const newDailyBudget = remainingDays > 0 ? newBudget / remainingDays : 0;
    
    try {
      // Sende Budget-Update-Notification
      await notificationService.sendBudgetUpdateNotification(
        newDailyBudget,
        newBudget,
        remainingDays,
        amount,
        !isDeposit // isExpense
      );
      
      // Prüfe auf niedrig-Budget-Warnung
      if (newDailyBudget <= 5) {
        if (isWeb) {
          await notificationService.sendLowBudgetWarning(newDailyBudget);
        } else {
          await notificationService.scheduleLowBudgetWarning(newDailyBudget);
        }
      }
      
      // Sende Motivations-Notification bei gutem Budget
      if (newDailyBudget > 20) {
        await notificationService.sendMotivationNotification(newDailyBudget);
      }
    } catch (error) {
      console.error('Fehler beim Senden der Notification:', error);
    }
    
    setTransactionAmount('');
    setTransactionDescription('');
    setShowingAddTransaction(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('de-DE', {
      day: 'numeric',
      month: 'short',
    }).format(date);
  };

  const getBudgetColor = () => {
    if (dailyBudget < 0) return '#FF4D4D';
    if (dailyBudget < 10) return '#FFD700';
    return '#00C851';
  };

  const getGradientColors = () => {
    if (dailyBudget < 0) {
      return ['#FF4D4D', '#FFB3B3', '#FFCCCC', '#FFF0F0', '#FFFFFF', '#FFFFFF'];
    } else if (dailyBudget < 10) {
      return ['#FFD700', '#FFE066', '#FFEB99', '#FFF5CC', '#FFFFFF', '#FFFFFF'];
    } else {
      return ['#00C851', '#66E066', '#99E699', '#CCF2CC', '#FFFFFF', '#FFFFFF'];
    }
  };

  const getRecentTransactions = () => {
    return transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={getGradientColors()}
        locations={[0, 0.1, 0.2, 0.25, 0.3, 1.0]}
        style={styles.gradient}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.headerRow}>
              <View style={styles.headerSpacer} />
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  console.log('🔔 Button wurde geklickt!');
                  Alert.alert('🔔 Debug', 'Button funktioniert!', [
                    {
                      text: 'Test Notification',
                      onPress: async () => {
                        console.log('Teste Benachrichtigungen...');
                        try {
                          if (isWeb) {
                            console.log('Web-Plattform erkannt');
                            console.log('Notification-Support:', 'Notification' in window);
                            console.log('Permission Status:', Notification.permission);
                            
                            if ('Notification' in window) {
                              if (Notification.permission === 'default') {
                                console.log('Fordere Berechtigung an...');
                                const permission = await Notification.requestPermission();
                                console.log('Permission Antwort:', permission);
                                
                                if (permission === 'granted') {
                                  console.log('Sende Test-Notification...');
                                  const notification = new Notification('🎉 Test erfolgreich!', {
                                    body: 'Benachrichtigungen funktionieren jetzt!',
                                    icon: '/favicon.ico'
                                  });
                                  Alert.alert('✅ Erfolgreich', 'Benachrichtigungen sind aktiv!');
                                } else {
                                  Alert.alert('❌ Abgelehnt', 'Benachrichtigungen wurden abgelehnt.');
                                }
                              } else if (Notification.permission === 'granted') {
                                console.log('Sende Test-Notification...');
                                const notification = new Notification('🎉 Test erfolgreich!', {
                                  body: 'Benachrichtigungen funktionieren bereits!',
                                  icon: '/favicon.ico'
                                });
                                Alert.alert('✅ Bereits aktiv', 'Benachrichtigungen sind bereits aktiv!');
                              } else {
                                Alert.alert('❌ Blockiert', 'Benachrichtigungen sind blockiert. Aktiviere sie in den Browser-Einstellungen.');
                              }
                            } else {
                              Alert.alert('❌ Nicht unterstützt', 'Dieser Browser unterstützt keine Benachrichtigungen.');
                            }
                          } else {
                            Alert.alert('Info', 'Native App - Benachrichtigungen bereits konfiguriert');
                          }
                        } catch (error) {
                          console.error('Fehler:', error);
                          Alert.alert('❌ Fehler', `Fehler beim Aktivieren: ${error.message}`);
                        }
                      }
                    },
                    { text: 'Abbrechen', style: 'cancel' }
                  ]);
                }}
              >
                <Ionicons 
                  name={isWeb ? "notifications-outline" : "settings-outline"} 
                  size={24} 
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.statusText}>VERFÜGBAR</Text>
            <Text style={styles.mainAmount}>{formatCurrency(dailyBudget)}</Text>
            <Text style={styles.subtitle}>Tagesbudget</Text>
            {isWeb && (
              <View style={styles.notificationContainer}>
                <Text style={styles.notificationHint}>
                  💡 Tippe auf 🔔 für Benachrichtigungen
                </Text>
                
                {/* 🔧 SCHRITT 2: SAFARI Button */}
                <TouchableOpacity 
                  style={styles.safariButton}
                  onPress={async () => {
                    console.log('🔧 SCHRITT 2: SAFARI Test startet...');
                    
                    try {
                      // 1. Service Worker Registration prüfen/registrieren
                      if ('serviceWorker' in navigator) {
                        console.log('🔧 Service Worker unterstützt');
                        
                        let registration;
                        try {
                          registration = await navigator.serviceWorker.register('/sw.js');
                          console.log('🔧 Service Worker registriert:', registration);
                        } catch (swError) {
                          console.error('🔧 Service Worker Registration Fehler:', swError);
                          Alert.alert('❌ Service Worker Fehler', swError.message);
                          return;
                        }
                        
                        // 2. Permission-Handling
                        if ('Notification' in window) {
                          console.log('🔧 Notification API verfügbar');
                          
                          let permission = Notification.permission;
                          console.log('🔧 Aktuelle Permission:', permission);
                          
                          if (permission === 'default') {
                            console.log('🔧 Fordere Permission an...');
                            permission = await Notification.requestPermission();
                            console.log('🔧 Neue Permission:', permission);
                          }
                          
                          if (permission === 'granted') {
                            console.log('✅ Permission erteilt, starte Push-Subscription Test...');
                            
                            // 3. Push-Subscription Test mit Safari/Chrome Endpoint-Erkennung
                            try {
                              if ('PushManager' in window) {
                                console.log('🔧 PushManager verfügbar');
                                
                                // Prüfe bestehende Subscription
                                let subscription = await registration.pushManager.getSubscription();
                                console.log('🔧 Bestehende Subscription:', subscription);
                                
                                if (!subscription) {
                                  console.log('🔧 Erstelle neue Push-Subscription...');
                                  
                                  // VAPID Public Key (sollte von Server kommen, hier Demo-Key)
                                  const vapidPublicKey = 'BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9flJ_ZJnUP-xwAEFMhD6-g9J9Pb0Vd2pfIcKxElR9LmJIgKVFXUE';
                                  
                                  try {
                                    subscription = await registration.pushManager.subscribe({
                                      userVisibleOnly: true,
                                      applicationServerKey: vapidPublicKey
                                    });
                                    console.log('🔧 Neue Subscription erstellt:', subscription);
                                  } catch (subError) {
                                    console.error('🔧 Subscription Fehler:', subError);
                                    Alert.alert('❌ Push-Subscription Fehler', subError.message);
                                    return;
                                  }
                                }
                                
                                // 4. Endpoint-Erkennung (Safari vs Chrome)
                                const endpoint = subscription.endpoint;
                                console.log('🔧 Push Endpoint:', endpoint);
                                
                                let provider = 'unbekannt';
                                if (endpoint.includes('fcm.googleapis.com')) {
                                  provider = 'Chrome/Firebase';
                                } else if (endpoint.includes('web.push.apple.com')) {
                                  provider = 'Safari/Apple';
                                } else if (endpoint.includes('mozilla.com')) {
                                  provider = 'Firefox';
                                }
                                
                                console.log('🔧 Push Provider erkannt:', provider);
                                
                                // 5. Test-Notification senden
                                const testNotification = new Notification('🔧 SCHRITT 2 ERFOLG!', {
                                  body: `Push-Subscription aktiv!\\nProvider: ${provider}\\nEndpoint verfügbar ✅`,
                                  icon: '/favicon.ico',
                                  requireInteraction: true,
                                  tag: 'schritt-2-test'
                                });
                                
                                testNotification.onclick = () => {
                                  console.log('🔧 Test-Notification geklickt');
                                  testNotification.close();
                                };
                                
                                // Erfolgsmeldung
                                Alert.alert(
                                  '✅ SCHRITT 2 ERFOLGREICH!', 
                                  `Service Worker: ✅ Registriert\\nPermission: ✅ ${permission}\\nPush-Subscription: ✅ Aktiv\\nProvider: ${provider}\\n\\n🎉 Safari Push Notifications sind jetzt funktionsbereit!`,
                                  [{ text: 'Perfekt!' }]
                                );
                                
                              } else {
                                console.error('🔧 PushManager nicht verfügbar');
                                Alert.alert('❌ Push nicht unterstützt', 'PushManager ist in diesem Browser nicht verfügbar.');
                              }
                            } catch (pushError) {
                              console.error('🔧 Push-Test Fehler:', pushError);
                              Alert.alert('❌ Push-Test Fehler', pushError.message);
                            }
                          } else {
                            Alert.alert('❌ Permission verweigert', `Notification Permission: ${permission}\\n\\nBitte erlaube Benachrichtigungen in den Browser-Einstellungen.`);
                          }
                        } else {
                          Alert.alert('❌ Nicht unterstützt', 'Notification API ist nicht verfügbar.');
                        }
                      } else {
                        Alert.alert('❌ Nicht unterstützt', 'Service Worker sind nicht verfügbar.');
                      }
                    } catch (error) {
                      console.error('🔧 SCHRITT 2 Gesamtfehler:', error);
                      Alert.alert('❌ SCHRITT 2 Fehler', error.message);
                    }
                  }}
                >
                  <Text style={styles.safariButtonText}>
                    🔧 SCHRITT 2: SAFARI
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>VERBLEIBENDES{'\n'}BUDGET</Text>
              <Text style={styles.statValue}>{formatCurrency(remainingBudget)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>VERBLEIBENDE{'\n'}TAGE</Text>
              <Text style={styles.statValue}>{remainingDays}</Text>
            </View>
          </View>

          {/* Recent Transactions */}
          {transactions.length > 0 && (
            <View style={styles.transactionsSection}>
              <View style={styles.transactionsHeader}>
                <Text style={styles.transactionsTitle}>LETZTE TRANSAKTIONEN</Text>
                <View style={styles.transactionBadge}>
                  <Text style={styles.transactionBadgeText}>{transactions.length}</Text>
                </View>
              </View>
              
              <View style={styles.transactionsList}>
                {getRecentTransactions().map((transaction) => (
                  <View key={transaction.id} style={styles.transactionCard}>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDate}>
                        {formatDate(transaction.date)}
                      </Text>
                      <Text style={styles.transactionDescription}>
                        {transaction.description}
                      </Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      { color: transaction.isExpense ? '#E53E3E' : '#00A651' }
                    ]}>
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Floating Action Buttons */}
        <View style={styles.floatingButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.depositButton]}
            onPress={() => {
              setIsDeposit(true);
              setShowingAddTransaction(true);
            }}
          >
            <Ionicons name="add" size={18} color="white" />
            <Text style={styles.actionButtonText}>Einzahlung</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.expenseButton]}
            onPress={() => {
              setIsDeposit(false);
              setShowingAddTransaction(true);
            }}
          >
            <Ionicons name="remove" size={18} color="white" />
            <Text style={styles.actionButtonText}>Auszahlung</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Transaction Modal */}
      <Modal
        visible={showingAddTransaction}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <LinearGradient
          colors={['#FAFAFF', '#F5F6FF']}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowingAddTransaction(false)}
              >
                <Ionicons name="close" size={16} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Icon und Titel */}
            <View style={styles.modalTitleSection}>
              <View style={[
                styles.modalIcon,
                { backgroundColor: isDeposit ? '#00C851' : '#FF4D4D' }
              ]}>
                <Ionicons 
                  name={isDeposit ? "add" : "remove"} 
                  size={32} 
                  color="white" 
                />
              </View>
              <Text style={styles.modalTitle}>
                {isDeposit ? 'Neue Einzahlung' : 'Neue Auszahlung'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Betrag</Text>
                <TextInput
                  style={styles.amountInput}
                  value={transactionAmount}
                  onChangeText={setTransactionAmount}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#ccc"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Beschreibung</Text>
                <TextInput
                  style={styles.descriptionInput}
                  value={transactionDescription}
                  onChangeText={setTransactionDescription}
                  placeholder="Wofür war das?"
                  placeholderTextColor="#ccc"
                />
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.addButton,
                  { 
                    backgroundColor: isDeposit ? '#00A651' : '#E53E3E',
                    opacity: (transactionAmount && transactionDescription) ? 1 : 0.5
                  }
                ]}
                onPress={addTransaction}
                disabled={!transactionAmount || !transactionDescription}
              >
                <Text style={styles.addButtonText}>Hinzufügen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  headerSpacer: {
    width: 40, // Same width as settings button for centering
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  mainAmount: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#4a4a4a',
  },
  notificationHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF6B6B',
    marginTop: 8,
    textAlign: 'center',
  },
  notificationContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  safariButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  safariButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  transactionsSection: {
    paddingHorizontal: 24,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 1.0,
  },
  transactionBadge: {
    backgroundColor: '#808080',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  transactionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 12,
    fontWeight: '500',
    color: '#808080',
    marginBottom: 4,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 120,
  },
  floatingButtons: {
    position: 'absolute',
    bottom: 34,
    left: 24,
    right: 24,
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  depositButton: {
    backgroundColor: '#00C851',
  },
  expenseButton: {
    backgroundColor: '#FF4D4D',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'flex-start',
    marginBottom: 16,
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
  },
  modalTitleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  modalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  form: {
    gap: 24,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  amountInput: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  descriptionInput: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1a1a1a',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  modalFooter: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addButton: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
});
