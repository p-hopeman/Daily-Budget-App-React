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
                    console.log('🔔 DIREKTER TEST STARTET...');
                    
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
                    
                    // SOFORTIGER TEST - Erstelle Benachrichtigung direkt
                    if ('Notification' in window) {
                      if (Notification.permission === 'granted') {
                        console.log('🔔 Berechtigung bereits erteilt - erstelle sofort Benachrichtigung...');
                        
                        try {
                          const notification = new Notification('🚀 DIREKTER TEST', {
                            body: 'Das ist eine direkte Benachrichtigung ohne Dialog!',
                            icon: '/favicon.ico',
                            tag: 'direct-test',
                            requireInteraction: true
                          });
                          
                          console.log('🔔 Benachrichtigung erstellt:', notification);
                          
                          notification.onshow = () => {
                            console.log('🔔 ✅ Benachrichtigung wird angezeigt!');
                          };
                          
                          notification.onerror = (error) => {
                            console.error('🔔 ❌ Benachrichtigung Fehler:', error);
                          };
                          
                          notification.onclick = () => {
                            console.log('🔔 👆 Benachrichtigung geklickt');
                            notification.close();
                          };
                          
                          // Zeige auch einen Alert
                          Alert.alert('🚀 Test gestartet!', 'Direkte Benachrichtigung erstellt. Schaue oben rechts!');
                          
                          // Schließe erst nach 30 Sekunden (länger sichtbar)
                          setTimeout(() => {
                            notification.close();
                            console.log('🔔 Benachrichtigung automatisch geschlossen');
                          }, 30000);
                          
                        } catch (directError) {
                          console.error('🔔 ❌ Direkter Test fehlgeschlagen:', directError);
                          Alert.alert('❌ Direkter Test fehlgeschlagen', directError.message);
                        }
                      } else {
                        // Frage Berechtigung an
                        console.log('🔔 Berechtigung anfordern...');
                        Alert.alert(
                          '🔔 Berechtigung erforderlich', 
                          `Aktuelle Berechtigung: ${Notification.permission}\n\nBenachrichtigungen müssen erst erlaubt werden.`,
                          [
                            {
                              text: 'Berechtigung erteilen',
                              onPress: async () => {
                                try {
                                  const permission = await Notification.requestPermission();
                                  console.log('🔔 Neue Berechtigung:', permission);
                                  
                                  if (permission === 'granted') {
                                    const notification = new Notification('✅ Berechtigung erteilt!', {
                                      body: 'Benachrichtigungen funktionieren jetzt!',
                                      icon: '/favicon.ico'
                                    });
                                    
                                    notification.onshow = () => {
                                      console.log('🔔 Berechtigung-Benachrichtigung angezeigt');
                                    };
                                    
                                    Alert.alert('✅ Erfolgreich!', 'Berechtigung erteilt und Test-Benachrichtigung gesendet!');
                                  } else {
                                    Alert.alert('❌ Verweigert', `Berechtigung wurde verweigert: ${permission}`);
                                  }
                                } catch (error) {
                                  console.error('🔔 Berechtigung-Fehler:', error);
                                  Alert.alert('❌ Fehler', error.message);
                                }
                              }
                            },
                            { text: 'Abbrechen', style: 'cancel' }
                          ]
                        );
                      }
                    } else {
                      console.log('🔔 ❌ Benachrichtigungen nicht unterstützt');
                      Alert.alert('❌ Nicht unterstützt', 'Browser unterstützt keine Benachrichtigungen.');
                    }
                  } catch (error) {
                    console.error('🔔 ❌ Button Fehler:', error);
                    Alert.alert('❌ Fehler', error.message);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>
                  🚀 DIREKTER TEST
                </Text>
              </TouchableOpacity>
            )}
            {isWeb && (
              <TouchableOpacity 
                style={[styles.debugButton, { backgroundColor: '#4CAF50', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    console.log('✅ SCHRITT 1: GRUNDLAGEN & VERSIONEN PRÜFEN');
                    Alert.alert('✅ Schritt 1 Check', 'Prüfe Betriebssystem, Browser und APIs...');
                    
                    const results = [];
                    
                    // 1. Betriebssystem & Browser erkennen
                    const userAgent = navigator.userAgent;
                    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
                    const isChrome = /chrome/i.test(userAgent);
                    const isMac = /mac/i.test(navigator.platform);
                    const isiOS = /iPad|iPhone|iPod/.test(userAgent);
                    
                    results.push(`🖥️ Plattform: ${navigator.platform}`);
                    results.push(`🌐 Browser: ${isSafari ? 'Safari' : isChrome ? 'Chrome' : 'Anderer'}`);
                    results.push(`📱 iOS: ${isiOS ? 'JA' : 'NEIN'}`);
                    results.push(`🍎 Mac: ${isMac ? 'JA' : 'NEIN'}`);
                    
                    // 2. HTTPS prüfen
                    const isHTTPS = location.protocol === 'https:';
                    results.push(`🔒 HTTPS: ${isHTTPS ? '✅ JA' : '❌ NEIN'}`);
                    
                    // 3. Service Worker API verfügbar?
                    const hasServiceWorker = 'serviceWorker' in navigator;
                    results.push(`⚙️ ServiceWorker: ${hasServiceWorker ? '✅ JA' : '❌ NEIN'}`);
                    
                    // 4. Push Manager API verfügbar?
                    const hasPushManager = 'PushManager' in window;
                    results.push(`📧 PushManager: ${hasPushManager ? '✅ JA' : '❌ NEIN'}`);
                    
                    // 5. Notification API verfügbar?
                    const hasNotifications = 'Notification' in window;
                    results.push(`🔔 Notifications: ${hasNotifications ? '✅ JA' : '❌ NEIN'}`);
                    
                    // 6. Current Permission Status
                    if (hasNotifications) {
                      results.push(`🔐 Permission: ${Notification.permission}`);
                    }
                    
                    // 7. PWA installiert? (nur auf iOS/Safari relevant)
                    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                    results.push(`📱 PWA installiert: ${isPWA ? '✅ JA' : '❌ NEIN'}`);
                    
                                         // 8. Manifest vorhanden?
                     const manifestLink = document.querySelector('link[rel="manifest"]');
                     results.push(`📋 Manifest: ${manifestLink ? '✅ JA' : '❌ NEIN'}`);
                     
                     // 9. WICHTIGER API-TEST (aus der Liste):
                     try {
                       const apiTest = 'serviceWorker' in navigator && 'PushManager' in window;
                       results.push(`🧪 API-Test (SW+Push): ${apiTest ? '✅ TRUE' : '❌ FALSE'}`);
                       console.log('🧪 API-TEST RESULTAT:', apiTest);
                       
                       if (!apiTest) {
                         criticalIssues.push('⚠️ Push-APIs nicht verfügbar');
                       }
                     } catch (testError) {
                       results.push(`🧪 API-Test: ❌ FEHLER`);
                       console.error('API-Test Fehler:', testError);
                     }
                     
                     console.log('✅ SCHRITT 1 ERGEBNISSE:', results);
                    
                    // Kritische Checks
                    const criticalIssues = [];
                    if (!isHTTPS) criticalIssues.push('⚠️ HTTPS fehlt');
                    if (!hasServiceWorker) criticalIssues.push('⚠️ ServiceWorker nicht unterstützt');
                    if (!hasPushManager) criticalIssues.push('⚠️ PushManager nicht unterstützt');
                    if (isiOS && !isPWA) criticalIssues.push('⚠️ iOS: App muss installiert sein!');
                    
                    // Ergebnis anzeigen
                    const resultText = results.join('\n');
                    const criticalText = criticalIssues.length > 0 ? '\n\n❌ KRITISCHE PROBLEME:\n' + criticalIssues.join('\n') : '\n\n✅ Grundvoraussetzungen erfüllt!';
                    
                    Alert.alert(
                      '📋 Schritt 1: Grundlagen Check',
                      resultText + criticalText,
                      [
                        {
                          text: 'Weiter zu Schritt 2',
                          onPress: () => {
                            Alert.alert(
                              '📝 Nächster Schritt',
                              `${criticalIssues.length > 0 ? 
                                'STOPP! Erst kritische Probleme lösen:\n\n' + criticalIssues.join('\n') + '\n\nDann Service Worker implementieren.' :
                                'Grundlagen OK! ✅\n\nNächster Schritt: Service Worker für Safari/iOS implementieren.'
                              }`
                            );
                          }
                        },
                        { text: 'OK' }
                      ]
                    );
                    
                  } catch (error) {
                    console.error('❌ Schritt 1 Fehler:', error);
                    Alert.alert('❌ Fehler bei Schritt 1', error.message);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>
                  ✅ SCHRITT 1: GRUNDLAGEN
                </Text>
              </TouchableOpacity>
            )}
            {isWeb && (
              <TouchableOpacity 
                style={[styles.debugButton, { backgroundColor: '#2196F3', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    console.log('🔧 SCHRITT 2: SAFARI (MACOS) STABILISIEREN');
                    Alert.alert('🔧 Schritt 2 Check', 'Service Worker registrieren & Push-Subscription testen...');
                    
                    const results = [];
                    
                    // 1. Service Worker registrieren
                    if ('serviceWorker' in navigator) {
                      try {
                        const registration = await navigator.serviceWorker.register('/sw.js');
                        results.push('✅ Service Worker registriert');
                        console.log('🔧 SW Registration:', registration);
                        
                        // 2. Push Manager verfügbar in Registration?
                        if (registration.pushManager) {
                          results.push('✅ Push Manager verfügbar');
                          
                          // 3. Permission für Notifications
                          let permission = Notification.permission;
                          if (permission === 'default') {
                            permission = await Notification.requestPermission();
                          }
                          results.push(`🔐 Permission: ${permission}`);
                          
                          if (permission === 'granted') {
                            // 4. Push Subscription versuchen (erstmal ohne VAPID)
                            try {
                              const subscription = await registration.pushManager.subscribe({
                                userVisibleOnly: true
                              });
                              
                              results.push('✅ Push Subscription erstellt');
                              console.log('🔧 Subscription:', subscription);
                              
                              // 5. Subscription Details anzeigen
                              const endpoint = subscription.endpoint;
                              const isSafari = endpoint.includes('web.push.apple.com');
                              const isChrome = endpoint.includes('fcm.googleapis.com');
                              
                              results.push(`📡 Endpoint: ${isSafari ? 'Apple (Safari)' : isChrome ? 'Google (Chrome)' : 'Unbekannt'}`);
                              results.push(`🔗 URL: ${endpoint.substring(0, 50)}...`);
                              
                              // 6. Keys verfügbar?
                              const keys = subscription.getKey ? {
                                p256dh: subscription.getKey('p256dh'),
                                auth: subscription.getKey('auth')
                              } : null;
                              
                              results.push(`🔑 Keys: ${keys ? '✅ Verfügbar' : '❌ Nicht verfügbar'}`);
                              
                              // 7. Test-Push über Service Worker
                              try {
                                if (registration.active) {
                                  // Simuliere Push-Event
                                  console.log('🧪 Simuliere Push-Event über Service Worker...');
                                  results.push('🧪 Test-Push wird gesendet...');
                                }
                              } catch (pushError) {
                                results.push(`❌ Test-Push Fehler: ${pushError.message}`);
                              }
                              
                            } catch (subscriptionError) {
                              results.push(`❌ Subscription Fehler: ${subscriptionError.message}`);
                              console.error('Subscription Error:', subscriptionError);
                            }
                          } else {
                            results.push('❌ Permission verweigert - kann nicht subscriben');
                          }
                        } else {
                          results.push('❌ Push Manager nicht verfügbar');
                        }
                      } catch (swError) {
                        results.push(`❌ Service Worker Fehler: ${swError.message}`);
                        console.error('SW Error:', swError);
                      }
                    } else {
                      results.push('❌ Service Worker nicht unterstützt');
                    }
                    
                    const resultText = results.join('\n');
                    console.log('🔧 SCHRITT 2 ERGEBNISSE:', results);
                    
                    Alert.alert(
                      '🔧 Schritt 2: Safari macOS',
                      resultText,
                      [
                        {
                          text: 'Weiter zu Schritt 3',
                          onPress: () => {
                            Alert.alert(
                              '📱 Nächster Schritt',
                              'Schritt 3: iOS PWA testen\n\n1. App auf iPhone öffnen\n2. "Zum Home-Bildschirm" hinzufügen\n3. Von Home-Bildschirm starten\n4. Schritt 3 Button klicken'
                            );
                          }
                        },
                        { text: 'OK' }
                      ]
                    );
                    
                  } catch (error) {
                    console.error('❌ Schritt 2 Fehler:', error);
                    Alert.alert('❌ Fehler bei Schritt 2', error.message);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>
                  🔧 SCHRITT 2: SAFARI
                </Text>
              </TouchableOpacity>
            )}
            {isWeb && (
              <TouchableOpacity 
                style={[styles.debugButton, { backgroundColor: '#FF6B6B', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    console.log('🔧 SYSTEM-CHECK STARTET...');
                    
                    // Prüfe verschiedene Notification-Eigenschaften
                    if ('Notification' in window && Notification.permission === 'granted') {
                      console.log('🔧 Teste verschiedene Notification-Eigenschaften...');
                      
                      // Test 1: Minimale Benachrichtigung
                      const minimalNotification = new Notification('🔧 MINIMAL TEST');
                      console.log('🔧 Minimal-Benachrichtigung erstellt');
                      
                      // Test 2: Erweiterte Benachrichtigung ohne requireInteraction
                      setTimeout(() => {
                        const simpleNotification = new Notification('🔧 EINFACHER TEST', {
                          body: 'Ohne requireInteraction',
                          icon: '/favicon.ico'
                        });
                        console.log('🔧 Einfache Benachrichtigung erstellt');
                      }, 2000);
                      
                      // Test 3: Mit Sound
                      setTimeout(() => {
                        const soundNotification = new Notification('🔧 SOUND TEST', {
                          body: 'Mit Sound (silent: false)',
                          icon: '/favicon.ico',
                          silent: false
                        });
                        console.log('🔧 Sound-Benachrichtigung erstellt');
                      }, 4000);
                      
                      // Test 4: Mit anderen Eigenschaften
                      setTimeout(() => {
                        const detailedNotification = new Notification('🔧 DETAILLIERT TEST', {
                          body: 'Mit verschiedenen Eigenschaften',
                          icon: '/favicon.ico',
                          badge: '/favicon.ico',
                          tag: 'system-test',
                          dir: 'ltr',
                          lang: 'de',
                          vibrate: [200, 100, 200],
                          requireInteraction: false
                        });
                        
                        detailedNotification.onshow = () => {
                          console.log('🔧 ✅ Detaillierte Benachrichtigung angezeigt');
                        };
                        
                        detailedNotification.onerror = (error) => {
                          console.error('🔧 ❌ Detaillierte Benachrichtigung Fehler:', error);
                        };
                        
                        console.log('🔧 Detaillierte Benachrichtigung erstellt');
                      }, 6000);
                      
                      // Info-Dialog
                      Alert.alert(
                        '🔧 System-Check',
                        'Vier verschiedene Benachrichtigungen werden in 2-Sekunden-Abständen gesendet.\n\nPrüfe:\n1. Oben rechts am Bildschirm\n2. Chrome-Benachrichtigungen in Systemeinstellungen\n3. "Nicht stören" Modus\n\nWenn du NICHTS siehst, ist es ein System-Problem.',
                        [
                          {
                            text: 'Chrome-Einstellungen öffnen',
                            onPress: () => {
                              Alert.alert(
                                '⚙️ Chrome-Einstellungen',
                                'Gehe zu:\n\n1. Chrome → Einstellungen\n2. Datenschutz und Sicherheit\n3. Website-Einstellungen\n4. Benachrichtigungen\n5. Prüfe ob deine Website erlaubt ist\n\nOder direkt: chrome://settings/content/notifications'
                              );
                            }
                          },
                          {
                            text: 'Mac-Einstellungen öffnen',
                            onPress: () => {
                              Alert.alert(
                                '🍎 Mac-Einstellungen',
                                'Gehe zu:\n\n1. Systemeinstellungen\n2. Benachrichtigungen\n3. Google Chrome\n4. Benachrichtigungen aktivieren\n5. Stil: Banner oder Hinweise\n\nPrüfe auch "Nicht stören" Modus!'
                              );
                            }
                          },
                          { text: 'OK' }
                        ]
                      );
                      
                    } else {
                      Alert.alert('❌ Keine Berechtigung', 'Benachrichtigungen nicht erlaubt oder unterstützt.');
                    }
                  } catch (error) {
                    console.error('🔧 System-Check Fehler:', error);
                    Alert.alert('❌ Fehler', error.message);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>
                  🔧 SYSTEM-CHECK
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
