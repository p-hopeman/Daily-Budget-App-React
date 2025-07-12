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
        
        // Web Notifications initialisieren
        if (notificationService.isWebNotificationSupported()) {
          const granted = await notificationService.requestPermission();
          if (granted) {
            console.log('✅ Web Notifications erfolgreich aktiviert!');
            // Sende Willkommens-Notification
            setTimeout(() => {
              const iosSettings = notificationService.checkIOSSettings();
              let message = 'Web-Benachrichtigungen sind jetzt aktiv! Du erhältst Budget-Updates auch im Browser.';
              
              if (iosSettings && !iosSettings.isStandalone) {
                message = 'Benachrichtigungen aktiv! 🎉\n\n💡 Tipp: Füge diese App zum Home-Bildschirm hinzu für die beste PWA-Erfahrung auf iOS.';
              }
              
              notificationService.sendNotification(
                '🎉 Daily Budget App',
                message,
                { requireInteraction: true }
              );
            }, 1000);
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
                onPress={async () => {
                  if (isWeb) {
                    // Test Web Notification und zeige iOS-spezifische Infos
                    await notificationService.sendTestNotification();
                    
                    const iosSettings = notificationService.checkIOSSettings();
                    const pwaStatus = pwaService ? pwaService.getStatus() : null;
                    
                    if (iosSettings) {
                      Alert.alert(
                        '🔔 iOS PWA Status',
                        `Benachrichtigungen: ${iosSettings.permissionStatus}\nPWA-Modus: ${pwaStatus?.isStandalone ? 'Ja' : 'Nein'}\nService Worker: ${pwaStatus?.hasServiceWorker ? 'Ja' : 'Nein'}\n\n${iosSettings.recommendation}`,
                        [
                          {
                            text: 'Setup-Anleitung',
                            onPress: () => {
                              Alert.alert(
                                '📱 PWA Setup für iOS',
                                '1. Prüfe iOS Version (16.4+ nötig)\n2. Tippe "Teilen" → "Zum Home-Bildschirm"\n3. Öffne App vom Home-Bildschirm\n4. Erlaube Benachrichtigungen\n5. Prüfe Einstellungen → Benachrichtigungen\n\n💡 Nur im PWA-Modus funktionieren persistente Benachrichtigungen!'
                              );
                            }
                          },
                          pwaStatus?.canInstall ? {
                            text: 'PWA Installieren',
                            onPress: () => {
                              pwaService?.showInstallPrompt();
                            }
                          } : null,
                          { text: 'OK' }
                        ].filter(Boolean)
                      );
                    } else {
                      Alert.alert('✅ Test', 'Web-Benachrichtigung gesendet!');
                    }
                  } else {
                    Alert.alert('Info', 'Einstellungen kommen bald!');
                  }
                }}
              >
                <Ionicons name={isWeb ? "notifications-outline" : "settings-outline"} size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <Text style={styles.statusText}>VERFÜGBAR</Text>
            <Text style={styles.mainAmount}>{formatCurrency(dailyBudget)}</Text>
            <Text style={styles.subtitle}>Tagesbudget</Text>
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
