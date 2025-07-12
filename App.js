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
// Re-enabled imports - all services are now in dummy mode for debugging
import NotificationService from './NotificationService';
import WebNotificationService from './WebNotificationService';
import PWAService from './PWAService';

const { width, height } = Dimensions.get('window');

// Plattform-spezifische NotificationService-Instanz (alle Services in Dummy-Mode)
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

  // Lade Daten beim App-Start (Notifications komplett entfernt)
  useEffect(() => {
    loadData();
    calculateRemainingDays();
    
    // Timer für tägliche Aktualisierung
    const interval = setInterval(() => {
      calculateRemainingDays();
      calculateDailyBudget();
    }, 60000); // Jede Minute prüfen

    return () => clearInterval(interval);
  }, []);

  // All notification functions removed for debugging

  // Berechne Tagesbudget wenn sich Budget oder Tage ändern
  useEffect(() => {
    calculateDailyBudget();
  }, [remainingBudget, remainingDays]);

  // Daily reminders temporarily disabled for debugging

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
    
    // Temporarily disabled for debugging
    // try {
    //   // Sende Budget-Update-Notification
    //   await notificationService.sendBudgetUpdateNotification(
    //     newDailyBudget,
    //     newBudget,
    //     remainingDays,
    //     amount,
    //     !isDeposit // isExpense
    //   );
    //   
    //   // Prüfe auf niedrig-Budget-Warnung
    //   if (newDailyBudget <= 5) {
    //     if (isWeb) {
    //       await notificationService.sendLowBudgetWarning(newDailyBudget);
    //     } else {
    //       await notificationService.scheduleLowBudgetWarning(newDailyBudget);
    //     }
    //   }
    //   
    //   // Sende Motivations-Notification bei gutem Budget
    //   if (newDailyBudget > 20) {
    //     await notificationService.sendMotivationNotification(newDailyBudget);
    //   }
    // } catch (error) {
    //   console.error('Fehler beim Senden der Notification:', error);
    // }
    
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
                  try {
                    console.log('🔔 Button geklickt!');
                    
                    // Prüfe Browser und Notification Support
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                    
                    console.log('🔍 Browser Info:', {
                      isIOS,
                      isSafari,
                      userAgent: navigator.userAgent,
                      notificationSupported: 'Notification' in window,
                      currentPermission: 'Notification' in window ? Notification.permission : 'nicht verfügbar'
                    });
                    
                    if ('Notification' in window) {
                      Alert.alert(
                        '🔔 Notification Test', 
                        `Browser: ${isSafari ? 'Safari' : 'Anderer'}\nPlatform: ${isIOS ? 'iOS' : 'Desktop'}\nStatus: ${Notification.permission}\n\n${isIOS ? 'Hinweis: iOS benötigt möglicherweise PWA-Modus für Benachrichtigungen.' : ''}`,
                        [
                          {
                            text: 'Berechtigung anfordern',
                            onPress: async () => {
                              try {
                                console.log('🔔 Berechtigung wird angefragt...');
                                const permission = await Notification.requestPermission();
                                console.log('🔔 Berechtigung erhalten:', permission);
                                
                                if (permission === 'granted') {
                                  // Warte kurz und teste dann Notification
                                  setTimeout(() => {
                                    try {
                                      console.log('🔔 Erstelle Benachrichtigung...');
                                      const notification = new Notification('✅ Erfolgreich!', {
                                        body: 'Benachrichtigungen sind jetzt aktiv!',
                                        icon: '/favicon.ico',
                                        badge: '/favicon.ico',
                                        tag: 'test-notification',
                                        requireInteraction: true,
                                        silent: false
                                      });
                                      
                                      notification.onshow = () => {
                                        console.log('🔔 Benachrichtigung wird angezeigt');
                                        Alert.alert('✅ Erfolgreich!', 'Benachrichtigung wird angezeigt!');
                                      };
                                      
                                      notification.onerror = (error) => {
                                        console.error('🔔 Benachrichtigung Fehler:', error);
                                        Alert.alert('❌ Fehler', 'Benachrichtigung konnte nicht angezeigt werden.');
                                      };
                                      
                                      notification.onclick = () => {
                                        console.log('🔔 Benachrichtigung geklickt');
                                        notification.close();
                                      };
                                      
                                    } catch (notificationError) {
                                      console.error('🔔 Notification Erstellungsfehler:', notificationError);
                                      Alert.alert('❌ Fehler', `Notification konnte nicht erstellt werden: ${notificationError.message}`);
                                    }
                                  }, 500);
                                  
                                } else {
                                  Alert.alert('❌ Verweigert', `Berechtigung wurde verweigert: ${permission}`);
                                }
                              } catch (permissionError) {
                                console.error('🔔 Berechtigung Fehler:', permissionError);
                                Alert.alert('❌ Fehler', `Berechtigung konnte nicht angefragt werden: ${permissionError.message}`);
                              }
                            }
                          },
                          { text: 'OK' }
                        ]
                      );
                    } else {
                      Alert.alert('❌ Nicht unterstützt', 'Browser unterstützt keine Benachrichtigungen.');
                    }
                  } catch (error) {
                    console.error('Button Fehler:', error);
                    Alert.alert('❌ Fehler', error.message);
                  }
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
              <TouchableOpacity 
                style={styles.debugButton}
                onPress={async () => {
                  try {
                    // Erweiterte Browser-Erkennung
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                    const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
                    
                    console.log('🔍 Erweiterte Browser Info:', {
                      isIOS,
                      isSafari,
                      isStandalone,
                      userAgent: navigator.userAgent,
                      notificationSupported: 'Notification' in window,
                      permission: 'Notification' in window ? Notification.permission : 'nicht verfügbar',
                      serviceWorkerSupported: 'serviceWorker' in navigator
                    });
                    
                    Alert.alert(
                      '🔔 Detaillierter Test', 
                      `Browser: ${isSafari ? 'Safari' : 'Anderer'}\nPlatform: ${isIOS ? 'iOS' : 'Desktop'}\nPWA-Modus: ${isStandalone ? 'Ja' : 'Nein'}\nStatus: ${Notification.permission}\n\n${isIOS && !isStandalone ? 'Hinweis: iOS Safari benötigt PWA-Modus für Benachrichtigungen. Auf iPhone: "Zum Home-Bildschirm hinzufügen"' : ''}`,
                      [
                        {
                          text: 'Sofort testen',
                          onPress: async () => {
                            try {
                              console.log('🔔 Starte sofortigen Test...');
                              
                              if ('Notification' in window) {
                                // Prüfe aktuelle Berechtigung
                                let permission = Notification.permission;
                                console.log('🔔 Aktuelle Berechtigung:', permission);
                                
                                if (permission === 'default') {
                                  console.log('🔔 Frage Berechtigung an...');
                                  permission = await Notification.requestPermission();
                                  console.log('🔔 Neue Berechtigung:', permission);
                                }
                                
                                if (permission === 'granted') {
                                  console.log('🔔 Erstelle Test-Benachrichtigung...');
                                  
                                  // Erstelle eine Test-Benachrichtigung mit allen Event-Handlers
                                  const notification = new Notification('🎉 Test erfolgreich!', {
                                    body: `Browser-Benachrichtigungen funktionieren!\n\nBrowser: ${isSafari ? 'Safari' : 'Anderer'}\nPlatform: ${isIOS ? 'iOS' : 'Desktop'}\nPWA: ${isStandalone ? 'Ja' : 'Nein'}`,
                                    icon: '/favicon.ico',
                                    badge: '/favicon.ico',
                                    tag: 'detailed-test',
                                    requireInteraction: true,
                                    silent: false,
                                    timestamp: Date.now()
                                  });
                                  
                                  // Event-Handler für Debugging
                                  notification.onshow = () => {
                                    console.log('🔔 Benachrichtigung wird angezeigt');
                                    setTimeout(() => {
                                      Alert.alert('✅ Erfolgreich!', 'Benachrichtigung wird angezeigt!');
                                    }, 1000);
                                  };
                                  
                                  notification.onerror = (error) => {
                                    console.error('🔔 Benachrichtigung Fehler:', error);
                                    Alert.alert('❌ Fehler', 'Benachrichtigung konnte nicht angezeigt werden.');
                                  };
                                  
                                  notification.onclick = () => {
                                    console.log('🔔 Benachrichtigung geklickt');
                                    Alert.alert('👆 Geklickt!', 'Benachrichtigung wurde geklickt!');
                                    notification.close();
                                  };
                                  
                                  notification.onclose = () => {
                                    console.log('🔔 Benachrichtigung geschlossen');
                                  };
                                  
                                  // Schließe automatisch nach 10 Sekunden
                                  setTimeout(() => {
                                    notification.close();
                                  }, 10000);
                                  
                                } else if (permission === 'denied') {
                                  Alert.alert(
                                    '❌ Verweigert', 
                                    'Benachrichtigungen wurden dauerhaft verweigert. Bitte Browser-Einstellungen prüfen.',
                                    [
                                      { text: 'OK' },
                                      { 
                                        text: 'Hilfe',
                                        onPress: () => {
                                          Alert.alert(
                                            '💡 Hilfe',
                                            isIOS ? 
                                              'iPhone Safari:\n1. App zum Home-Bildschirm hinzufügen\n2. Als PWA öffnen\n3. Benachrichtigungen aktivieren' :
                                              'Desktop:\n1. Adressleiste: Schloss-Symbol klicken\n2. Benachrichtigungen auf "Zulassen" setzen\n3. Seite neu laden'
                                          );
                                        }
                                      }
                                    ]
                                  );
                                } else {
                                  Alert.alert('❓ Unbekannt', `Unbekannter Berechtigungsstatus: ${permission}`);
                                }
                              } else {
                                Alert.alert('❌ Nicht unterstützt', 'Browser unterstützt keine Benachrichtigungen.');
                              }
                            } catch (error) {
                              console.error('🔔 Test Fehler:', error);
                              Alert.alert('❌ Fehler', `Test fehlgeschlagen: ${error.message}`);
                            }
                          }
                        },
                        { text: 'Abbrechen', style: 'cancel' }
                      ]
                    );
                  } catch (error) {
                    console.error('🔔 Button Fehler:', error);
                    Alert.alert('❌ Fehler', error.message);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>
                  🔔 BENACHRICHTIGUNGEN TESTEN
                </Text>
              </TouchableOpacity>
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
  debugButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
    alignSelf: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 12,
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
