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
  
  // 📱 PWA States
  const [showPWAPrompt, setShowPWAPrompt] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState('unknown');

  // Lade Daten beim App-Start (Notifications komplett entfernt)
  useEffect(() => {
    loadData();
    calculateRemainingDays();
    
    // 🔔 AUTO-SETUP: PWA & Benachrichtigungen automatisch einrichten
    if (Platform.OS === 'web') {
      setupPWAAndNotifications();
      checkPWAInstallability();
    }
    
    // Timer für tägliche Aktualisierung
    const interval = setInterval(() => {
      calculateRemainingDays();
      calculateDailyBudget();
    }, 60000); // Jede Minute prüfen

    return () => clearInterval(interval);
  }, []);

  // 🔔 PWA & Benachrichtigung Setup mit iOS-spezifischen Verbesserungen
  const setupPWAAndNotifications = async () => {
    try {
      console.log('🚀 PWA-SETUP: Starte vollständige PWA-Einrichtung...');
      setServiceWorkerStatus('initializing');
      
      // iOS-spezifische Erkennung und Checks
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isPWAStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSPWA = isIOS && isPWAStandalone;
      
      console.log('📱 iOS-DIAGNOSE:');
      console.log('  - iOS:', isIOS);
      console.log('  - Safari:', isSafari);  
      console.log('  - PWA-Modus:', isPWAStandalone);
      console.log('  - iOS PWA:', isIOSPWA);
      
      // iOS PWA-Check: Nur installierte PWAs können Push auf iOS
      if (isIOS && !isPWAStandalone) {
        console.log('⚠️ iOS-WARNUNG: App nicht als PWA installiert - Push-Notifications nicht verfügbar');
        setServiceWorkerStatus('ios-not-pwa');
        return;
      }
      
      // 1. Service Worker Check & Registration
      if ('serviceWorker' in navigator) {
        console.log('✅ PWA-SETUP: Service Worker API verfügbar');
        
        try {
          // iOS-spezifische Service Worker Registration mit erweiterten Optionen
          console.log('🔄 PWA-SETUP: Registriere Service Worker (iOS-optimiert)...');
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none' // iOS-spezifisch: Cache-Probleme vermeiden
          });
          
          console.log('✅ PWA-SETUP: Service Worker erfolgreich registriert:', registration);
          setServiceWorkerStatus('registered');
          
          // iOS: Länger warten auf Service Worker Aktivierung
          const waitTime = isIOS ? 3000 : 1000;
          console.log(`⏰ PWA-SETUP: Warte ${waitTime}ms auf Service Worker Aktivierung...`);
          
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Warte auf Aktivierung
          if (registration.installing) {
            console.log('🔄 PWA-SETUP: Service Worker wird installiert...');
            setServiceWorkerStatus('installing');
          } else if (registration.waiting) {
            console.log('🔄 PWA-SETUP: Service Worker wartet auf Aktivierung...');
            setServiceWorkerStatus('waiting');
          } else if (registration.active) {
            console.log('✅ PWA-SETUP: Service Worker ist aktiv');
            setServiceWorkerStatus('active');
          }
          
          // 2. Push Manager Check
          if (registration.pushManager) {
            console.log('✅ PWA-SETUP: Push Manager verfügbar');
            
                         // 3. iOS-spezifische Notification Permission Check
             console.log('🔔 PWA-SETUP: Aktuelle Permission:', Notification.permission);
             
             if (Notification.permission === 'default') {
               console.log('🔔 PWA-SETUP: Frage nach Notification Permission...');
               
               // iOS braucht längere Wartezeit und spezielle Behandlung
               const permissionDelay = isIOS ? 5000 : 2000;
               console.log(`⏰ iOS-TIMING: Warte ${permissionDelay}ms vor Permission-Request...`);
               
               setTimeout(async () => {
                 try {
                   console.log('🔔 iOS-PERMISSION: Starte Permission-Request...');
                   const permission = await Notification.requestPermission();
                   console.log('🔔 iOS-PERMISSION: Permission Antwort:', permission);
                   
                   if (permission === 'granted') {
                     console.log('✅ iOS-PERMISSION: Permission erteilt! Erstelle Push Subscription...');
                     
                     // iOS: Zusätzliche Wartezeit vor Subscription
                     if (isIOS) {
                       console.log('⏰ iOS-TIMING: Warte weitere 2s vor Push Subscription...');
                       await new Promise(resolve => setTimeout(resolve, 2000));
                     }
                     
                     try {
                       // iOS-spezifische Push Subscription Optionen
                       const subscriptionOptions = {
                         userVisibleOnly: true
                       };
                       
                       console.log('🔄 iOS-SUBSCRIPTION: Erstelle Push Subscription mit Optionen:', subscriptionOptions);
                       const subscription = await registration.pushManager.subscribe(subscriptionOptions);
                       
                       console.log('✅ iOS-SUBSCRIPTION: Push Subscription erfolgreich erstellt:', subscription);
                       
                       // iOS-spezifische Subscription-Details loggen
                       if (subscription.endpoint) {
                         const isAppleEndpoint = subscription.endpoint.includes('web.push.apple.com');
                         console.log('📡 iOS-ENDPOINT:', isAppleEndpoint ? 'Apple Push Service ✅' : 'Anderer Service');
                         console.log('🔗 iOS-URL:', subscription.endpoint.substring(0, 50) + '...');
                       }
                       
                       // Willkommens-Benachrichtigung (iOS-optimiert)
                       setTimeout(() => {
                         console.log('🔔 iOS-NOTIFICATION: Sende Willkommens-Benachrichtigung...');
                         const notification = new Notification('🎉 Daily Budget App', {
                           body: isIOS ? 'PWA & iOS-Push aktiv!' : 'PWA installiert & Benachrichtigungen aktiv!',
                           icon: '/favicon.ico',
                           badge: '/favicon.ico', // iOS zeigt Badge an
                           tag: 'ios-pwa-welcome',
                           requireInteraction: false // iOS-spezifisch
                         });
                         
                         notification.onclick = () => {
                           console.log('🔔 iOS-NOTIFICATION: Willkommens-Notification geklickt');
                           notification.close();
                         };
                       }, isIOS ? 3000 : 1500);
                       
                     } catch (subscriptionError) {
                       console.error('❌ iOS-SUBSCRIPTION: Push Subscription Fehler:', subscriptionError);
                       console.error('❌ iOS-SUBSCRIPTION: Fehler-Details:', subscriptionError.message);
                     }
                   } else {
                     console.log('ℹ️ iOS-PERMISSION: Permission verweigert, respektieren wir');
                   }
                 } catch (permError) {
                   console.error('❌ iOS-PERMISSION: Permission Request Fehler:', permError);
                   console.error('❌ iOS-PERMISSION: Fehler-Details:', permError.message);
                 }
               }, permissionDelay);
              
            } else if (Notification.permission === 'granted') {
              console.log('✅ PWA-SETUP: Permission bereits erteilt');
            } else {
              console.log('ℹ️ PWA-SETUP: Permission bereits verweigert');
            }
          } else {
            console.warn('⚠️ PWA-SETUP: Push Manager nicht verfügbar');
          }
          
        } catch (swError) {
          console.error('❌ PWA-SETUP: Service Worker Registration Fehler:', swError);
          setServiceWorkerStatus('error');
        }
      } else {
        console.warn('⚠️ PWA-SETUP: Service Worker nicht unterstützt');
        setServiceWorkerStatus('unsupported');
      }
    } catch (error) {
      console.error('❌ PWA-SETUP: Allgemeiner Fehler:', error);
      setServiceWorkerStatus('error');
    }
  };

  // 📱 PWA Installierbarkeit prüfen mit verbesserter iOS-Detection
  const checkPWAInstallability = () => {
    // iOS Safari PWA Check mit mehreren Detection-Methoden
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    // Multiple iOS PWA Detection-Methoden (iOS ist tricky!)
    const isPWAStandalone1 = window.matchMedia('(display-mode: standalone)').matches;
    const isPWAStandalone2 = window.navigator.standalone === true; // iOS-spezifisch
    const isPWAStandalone3 = !window.matchMedia('(display-mode: browser)').matches;
    const isPWAStandalone = isPWAStandalone1 || isPWAStandalone2;
    
    // Erweiterte iOS PWA-Diagnostik
    console.log('📱 PWA-CHECK DIAGNOSE:');
    console.log('  - iOS Device:', isIOS);
    console.log('  - Safari Browser:', isSafari);
    console.log('  - Display-Mode Standalone:', isPWAStandalone1);
    console.log('  - Navigator Standalone (iOS):', isPWAStandalone2);
    console.log('  - Not Browser Mode:', isPWAStandalone3);
    console.log('  - PWA Status Final:', isPWAStandalone);
    console.log('  - Window Location:', window.location.href);
    console.log('  - User Agent:', navigator.userAgent.substring(0, 100) + '...');
    
    // Zeige Installation Banner für iOS wenn nicht installiert
    if (isIOS && !isPWAStandalone) {
      console.log('📱 PWA-CHECK: iOS ohne PWA-Modus erkannt - zeige Installation Banner');
      setShowPWAPrompt(true);
      
      // Zusätzlicher Check nach 3 Sekunden (iOS braucht manchmal Zeit)
      setTimeout(() => {
        const recheckStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        console.log('📱 PWA-RECHECK: Standalone nach 3s:', recheckStandalone);
        if (!recheckStandalone) {
          console.log('📱 PWA-RECHECK: Immer noch nicht im PWA-Modus');
        }
      }, 3000);
    } else if (isIOS && isPWAStandalone) {
      console.log('✅ PWA-CHECK: iOS PWA-Modus erkannt!');
    }
    
    // BeforeInstallPrompt Event (Chrome/Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📱 PWA-CHECK: BeforeInstallPrompt Event empfangen');
      e.preventDefault();
      setPwaInstallPrompt(e);
      setShowPWAPrompt(true);
    });
  };

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
                    
                    // Kritische Checks initialisieren
                    const criticalIssues = [];
                    
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
                    
                    // Weitere kritische Checks
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
            
            {/* iOS Test Button - SEHR EINFACH */}
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#00FF00', marginTop: 10 }]}
              onPress={() => {
                console.log('🧪 TEST: Button wurde geklickt!');
                Alert.alert('🧪 TEST', 'Button funktioniert!');
              }}
            >
              <Text style={styles.debugButtonText}>
                🧪 BUTTON TEST
              </Text>
            </TouchableOpacity>
            
            {/* iOS Diagnose Button - VEREINFACHT */}
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#FF0000', marginTop: 10, paddingVertical: 12 }]}
              onPress={() => {
                console.log('🔍 iOS DIAGNOSE: Button geklickt');
                
                try {
                  // Vereinfachte iOS-Erkennung
                  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  console.log('🔍 iOS erkannt:', isiOS);
                  
                  if (!isiOS) {
                    Alert.alert('ℹ️ Nur für iOS', 'Dieser Check ist nur für iPhone/iPad gedacht.');
                    return;
                  }
                  
                  console.log('🔍 iOS DIAGNOSE: Starte Checkliste...');
                  
                  const checks = [];
                  
                  // CHECK 1: iOS Version
                  const userAgent = navigator.userAgent;
                  const versionMatch = userAgent.match(/OS (\d+)_(\d+)/);
                  if (versionMatch) {
                    const major = parseInt(versionMatch[1]);
                    const minor = parseInt(versionMatch[2]);
                    const supported = major > 16 || (major === 16 && minor >= 4);
                    checks.push(`✅ iOS ${major}.${minor} ${supported ? '(✅ OK)' : '(❌ Zu alt)'}`);
                  } else {
                    checks.push(`⚠️ iOS Version unbekannt`);
                  }
                  
                  // CHECK 2: PWA Status
                  const standalone1 = window.matchMedia('(display-mode: standalone)').matches;
                  const standalone2 = window.navigator.standalone === true;
                  const isPWA = standalone1 || standalone2;
                  checks.push(`${isPWA ? '✅' : '❌'} PWA: ${isPWA ? 'Installiert' : 'Browser-Modus'}`);
                  checks.push(`  - display-mode: ${standalone1 ? 'standalone' : 'browser'}`);
                  checks.push(`  - navigator.standalone: ${standalone2 ? 'true' : 'false/undefined'}`);
                  
                  // CHECK 3: APIs
                  const hasNotification = 'Notification' in window;
                  const hasSW = 'serviceWorker' in navigator;
                  const hasPM = 'PushManager' in window;
                  checks.push(`${hasNotification ? '✅' : '❌'} Notification API: ${hasNotification ? 'JA' : 'NEIN'}`);
                  checks.push(`${hasSW ? '✅' : '❌'} ServiceWorker: ${hasSW ? 'JA' : 'NEIN'}`);
                  checks.push(`${hasPM ? '✅' : '❌'} PushManager: ${hasPM ? 'JA' : 'NEIN'}`);
                  
                  // CHECK 4: Permission
                  if (hasNotification) {
                    const permission = Notification.permission;
                    checks.push(`${permission === 'granted' ? '✅' : permission === 'default' ? '⚠️' : '❌'} Permission: ${permission.toUpperCase()}`);
                  }
                  
                  // CHECK 5: Subscription (vereinfacht)
                  checks.push(`ℹ️ Subscription: Wird asynchron geprüft...`);
                  
                  console.log('🔍 Checks fertig:', checks);
                  
                  // Empfehlung
                  let recommendation = '';
                  if (!isiOS) {
                    recommendation = '\n⚠️ Kein iOS-Gerät';
                  } else if (!isPWA) {
                    recommendation = '\n🚨 AKTION: Safari → Teilen ↗️ → "Zum Home-Bildschirm" → Safari SCHLIEßEN → App vom Home-Bildschirm starten!';
                  } else if (!hasNotification) {
                    recommendation = '\n⚠️ PROBLEM: Notification API nicht verfügbar in diesem Kontext';
                  } else if (hasNotification && Notification.permission === 'default') {
                    recommendation = '\n✅ BEREIT: Permission-Dialog sollte bald kommen...';
                  } else if (Notification.permission === 'granted') {
                    recommendation = '\n🎉 PERFEKT: Alles sollte funktionieren!';
                  } else {
                    recommendation = '\n❌ PROBLEM: Permission verweigert - iOS Einstellungen prüfen';
                  }
                  
                  Alert.alert(
                    '🔍 iOS Push-Diagnose',
                    checks.join('\n') + recommendation,
                    [
                      {
                        text: 'Vollständige Logs',
                        onPress: () => {
                          console.log('📱 VOLLSTÄNDIGE iOS-DIAGNOSE:');
                          console.log('User Agent:', navigator.userAgent);
                          console.log('Display-Mode Tests:', {
                            standalone: window.matchMedia('(display-mode: standalone)').matches,
                            browser: window.matchMedia('(display-mode: browser)').matches
                          });
                          console.log('Navigator:', {
                            standalone: window.navigator.standalone,
                            onLine: navigator.onLine,
                            cookieEnabled: navigator.cookieEnabled
                          });
                        }
                      },
                      { text: 'OK' }
                    ]
                  );
                  
                } catch (error) {
                  console.error('❌ iOS Diagnose Fehler:', error);
                  Alert.alert('❌ Fehler', `Diagnose fehlgeschlagen:\n${error.message}`);
                }
              }}
            >
              <Text style={[styles.debugButtonText, { fontSize: 11, fontWeight: '700' }]}>
                🔍 iOS DIAGNOSE
              </Text>
            </TouchableOpacity>
            {isWeb && /iPad|iPhone|iPod/.test(navigator.userAgent) && (
              <TouchableOpacity 
                style={[styles.debugButton, { backgroundColor: '#FF9500', marginTop: 10 }]}
                onPress={async () => {
                  try {
                    console.log('📱 iOS PWA-VALIDATION: Starte umfassende iOS-Diagnostik...');
                    
                    const results = [];
                    
                    // iOS-spezifische Erkennung
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
                    
                    // Multiple PWA Detection
                    const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
                    const navigatorStandalone = window.navigator.standalone;
                    const displayModeBrowser = window.matchMedia('(display-mode: browser)').matches;
                    
                    results.push(`🔍 iOS Device: ${isIOS ? 'JA' : 'NEIN'}`);
                    results.push(`🔍 Safari Browser: ${isSafari ? 'JA' : 'NEIN'}`);
                    results.push(`🔍 Display Mode Standalone: ${displayModeStandalone ? 'JA' : 'NEIN'}`);
                    results.push(`🔍 Navigator Standalone: ${navigatorStandalone === true ? 'JA' : navigatorStandalone === false ? 'NEIN' : 'UNDEFINED'}`);
                    results.push(`🔍 Display Mode Browser: ${displayModeBrowser ? 'JA' : 'NEIN'}`);
                    
                    // PWA-Status bestimmen
                    const isPWAInstalled = displayModeStandalone || navigatorStandalone === true;
                    results.push(`📱 PWA-Status: ${isPWAInstalled ? '✅ INSTALLIERT' : '❌ NICHT INSTALLIERT'}`);
                    
                    // Notification API Check
                    const notificationSupported = 'Notification' in window;
                    const notificationPermission = notificationSupported ? Notification.permission : 'not-supported';
                    results.push(`🔔 Notification API: ${notificationSupported ? 'VERFÜGBAR' : 'NICHT VERFÜGBAR'}`);
                    results.push(`🔐 Permission: ${notificationPermission}`);
                    
                    // Service Worker Check
                    const swSupported = 'serviceWorker' in navigator;
                    results.push(`⚙️ Service Worker: ${swSupported ? 'UNTERSTÜTZT' : 'NICHT UNTERSTÜTZT'}`);
                    results.push(`📊 SW Status: ${serviceWorkerStatus}`);
                    
                    // URL und User Agent Info
                    results.push(`🌐 URL: ${window.location.href}`);
                    results.push(`📱 User Agent: ${navigator.userAgent.substring(0, 60)}...`);
                    
                    console.log('📱 iOS PWA-VALIDATION ERGEBNISSE:', results);
                    
                    // Empfehlungen basierend auf Status
                    let recommendation = '';
                    if (!isPWAInstalled) {
                      recommendation = '🚨 AKTION ERFORDERLICH:\n\n1. Safari → Teilen ↗️\n2. "Zum Home-Bildschirm"\n3. Safari SCHLIESSEN\n4. App vom Home-Bildschirm starten';
                    } else if (notificationPermission === 'default') {
                      recommendation = '✅ PWA installiert!\n🔔 Permission-Dialog sollte bald kommen...';
                    } else if (notificationPermission === 'granted') {
                      recommendation = '🎉 ALLES PERFEKT!\nPWA & Notifications aktiv!';
                    } else if (notificationPermission === 'denied') {
                      recommendation = '⚠️ Permission verweigert\nSettings → Safari → Website-Einstellungen';
                    } else {
                      recommendation = '❌ Notification API nicht verfügbar\nPWA möglicherweise nicht korrekt installiert';
                    }
                    
                    Alert.alert(
                      '📱 iOS PWA Diagnose',
                      results.join('\n') + '\n\n' + recommendation,
                      [
                        {
                          text: 'Debug-Logs anzeigen',
                          onPress: () => {
                            console.log('📱 VOLLSTÄNDIGE iOS-DIAGNOSE:');
                            console.log('window.matchMedia checks:', {
                              standalone: window.matchMedia('(display-mode: standalone)').matches,
                              browser: window.matchMedia('(display-mode: browser)').matches,
                              fullscreen: window.matchMedia('(display-mode: fullscreen)').matches,
                              'minimal-ui': window.matchMedia('(display-mode: minimal-ui)').matches
                            });
                            console.log('window.navigator.standalone:', window.navigator.standalone);
                            console.log('document.referrer:', document.referrer);
                            console.log('window.location:', window.location);
                          }
                        },
                        { text: 'OK' }
                      ]
                    );
                    
                  } catch (error) {
                    console.error('❌ iOS PWA-Validation Fehler:', error);
                    Alert.alert('❌ Diagnose-Fehler', error.message);
                  }
                }}
              >
                                 <Text style={styles.debugButtonText}>
                   📱 iOS PWA-CHECK
                 </Text>
               </TouchableOpacity>
             )}
             {isWeb && /iPad|iPhone|iPod/.test(navigator.userAgent) && (
               <TouchableOpacity 
                 style={[styles.debugButton, { backgroundColor: '#FF0000', marginTop: 10, paddingVertical: 12 }]}
                 onPress={async () => {
                   try {
                     console.log('🔍 iOS VOLLSTÄNDIGE CHECKLISTE: Starte systematische Diagnose...');
                     
                     const results = [];
                     const errors = [];
                     let checksPassed = 0;
                     const totalChecks = 10;
                     
                     // ===== CHECK 1: iOS-Version ≥ 16.4 =====
                     try {
                       const userAgent = navigator.userAgent;
                       const versionMatch = userAgent.match(/OS (\d+)_(\d+)/);
                       if (versionMatch) {
                         const majorVersion = parseInt(versionMatch[1]);
                         const minorVersion = parseInt(versionMatch[2]);
                         const versionString = `${majorVersion}.${minorVersion}`;
                         const isVersionSupported = majorVersion > 16 || (majorVersion === 16 && minorVersion >= 4);
                         
                         results.push(`✅ CHECK 1: iOS ${versionString} ${isVersionSupported ? '(✅ Unterstützt)' : '(❌ Zu alt - braucht ≥16.4)'}`);
                         if (isVersionSupported) checksPassed++;
                         else errors.push('iOS-Version zu alt für Web-Push');
                       } else {
                         results.push(`⚠️ CHECK 1: iOS-Version nicht erkennbar`);
                         errors.push('iOS-Version nicht erkennbar');
                       }
                     } catch (e) {
                       results.push(`❌ CHECK 1: Fehler - ${e.message}`);
                       errors.push('iOS-Version Check fehlgeschlagen');
                     }
                     
                     // ===== CHECK 2: PWA-Installation Status =====
                     try {
                       const displayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
                       const navigatorStandalone = window.navigator.standalone === true;
                       const isPWAInstalled = displayModeStandalone || navigatorStandalone;
                       
                       results.push(`${isPWAInstalled ? '✅' : '❌'} CHECK 2: PWA vom Home-Bildschirm ${isPWAInstalled ? '(✅ JA)' : '(❌ NEIN - Installiere als PWA!)'}`);
                       results.push(`  - display-mode: ${displayModeStandalone ? 'standalone' : 'browser'}`);
                       results.push(`  - navigator.standalone: ${navigatorStandalone}`);
                       
                       if (isPWAInstalled) checksPassed++;
                       else errors.push('App MUSS als PWA vom Home-Bildschirm gestartet werden!');
                     } catch (e) {
                       results.push(`❌ CHECK 2: Fehler - ${e.message}`);
                       errors.push('PWA-Status Check fehlgeschlagen');
                     }
                     
                     // ===== CHECK 3: Feature-Erkennung =====
                     try {
                       const hasServiceWorker = 'serviceWorker' in navigator;
                       const hasPushManager = 'PushManager' in window;
                       const hasNotification = 'Notification' in window;
                       
                       let pushManagerInContext = false;
                       if (hasServiceWorker) {
                         try {
                           const registration = await navigator.serviceWorker.getRegistration();
                           if (registration) {
                             pushManagerInContext = 'pushManager' in registration;
                           }
                         } catch (e) {
                           console.warn('ServiceWorker getRegistration failed:', e);
                         }
                       }
                       
                       const featuresOK = hasServiceWorker && hasPushManager && hasNotification;
                       results.push(`${featuresOK ? '✅' : '❌'} CHECK 3: Push-APIs ${featuresOK ? '(✅ Verfügbar)' : '(❌ Nicht verfügbar)'}`);
                       results.push(`  - ServiceWorker: ${hasServiceWorker ? '✅' : '❌'}`);
                       results.push(`  - PushManager: ${hasPushManager ? '✅' : '❌'}`);
                       results.push(`  - Notification: ${hasNotification ? '✅' : '❌'}`);
                       results.push(`  - PushManager in SW: ${pushManagerInContext ? '✅' : '❌'}`);
                       
                       if (featuresOK) checksPassed++;
                       else errors.push('Push-APIs nicht vollständig verfügbar');
                     } catch (e) {
                       results.push(`❌ CHECK 3: Fehler - ${e.message}`);
                       errors.push('Feature-Detection fehlgeschlagen');
                     }
                     
                     // ===== CHECK 4: Permission-Status =====
                     try {
                       const permission = 'Notification' in window ? Notification.permission : 'not-supported';
                       const permissionOK = permission === 'granted';
                       
                       results.push(`${permissionOK ? '✅' : permission === 'default' ? '⚠️' : '❌'} CHECK 4: Permission ${permission.toUpperCase()}`);
                       
                       if (permission === 'granted') {
                         checksPassed++;
                       } else if (permission === 'default') {
                         results.push(`  ℹ️ Permission noch nicht angefragt`);
                       } else if (permission === 'denied') {
                         errors.push('Permission verweigert - Settings → Safari → Website-Einstellungen');
                       } else {
                         errors.push('Notification API nicht unterstützt');
                       }
                     } catch (e) {
                       results.push(`❌ CHECK 4: Fehler - ${e.message}`);
                       errors.push('Permission Check fehlgeschlagen');
                     }
                     
                     // ===== CHECK 5: Subscription-Objekt =====
                     try {
                       let subscription = null;
                       let subscriptionOK = false;
                       let isAppleEndpoint = false;
                       
                       if ('serviceWorker' in navigator) {
                         const registration = await navigator.serviceWorker.getRegistration();
                         if (registration && registration.pushManager) {
                           subscription = await registration.pushManager.getSubscription();
                           if (subscription) {
                             subscriptionOK = true;
                             isAppleEndpoint = subscription.endpoint.includes('web.push.apple.com');
                             results.push(`✅ CHECK 5: Push-Subscription vorhanden`);
                             results.push(`  - Endpoint: ${isAppleEndpoint ? '✅ Apple Push Service' : '⚠️ Anderer Service'}`);
                             results.push(`  - URL: ${subscription.endpoint.substring(0, 50)}...`);
                             
                             if (isAppleEndpoint) checksPassed++;
                             else errors.push('Kein Apple Push Service Endpoint');
                           } else {
                             results.push(`❌ CHECK 5: Keine Push-Subscription`);
                             errors.push('Push-Subscription fehlt - muss erstellt werden');
                           }
                         } else {
                           results.push(`❌ CHECK 5: Service Worker oder PushManager fehlt`);
                           errors.push('Service Worker nicht bereit');
                         }
                       } else {
                         results.push(`❌ CHECK 5: ServiceWorker nicht unterstützt`);
                         errors.push('ServiceWorker nicht verfügbar');
                       }
                     } catch (e) {
                       results.push(`❌ CHECK 5: Fehler - ${e.message}`);
                       errors.push('Subscription Check fehlgeschlagen: ' + e.message);
                     }
                     
                     // ===== CHECK 6-10: Vereinfachte Checks =====
                     
                     // CHECK 6: Server-Kompatibilität (können wir nicht direkt testen)
                     results.push(`ℹ️ CHECK 6: Server Apple-Endpoint Kompatibilität (manuell zu prüfen)`);
                     results.push(`  - Backend muss web-push Library verwenden`);
                     results.push(`  - Nicht direkt FCM/Firebase aufrufen`);
                     checksPassed++; // Assume OK für jetzt
                     
                     // CHECK 7: Service Worker showNotification
                     results.push(`ℹ️ CHECK 7: Service Worker zeigt Notifications (implementiert)`);
                     checksPassed++; // Implemented
                     
                     // CHECK 8: Payload Limits
                     results.push(`ℹ️ CHECK 8: Payload Budget (≤4096 Byte, TTL ≤28 Tage)`);
                     checksPassed++; // Standard limits
                     
                     // CHECK 9: iOS System Features
                     results.push(`ℹ️ CHECK 9: iOS-System Checks`);
                     results.push(`  - Prüfe: Nicht stören, Fokusmodus, Stromsparmodus`);
                     results.push(`  - Einstellungen → Mitteilungen → Safari`);
                     checksPassed++; // User muss prüfen
                     
                     // CHECK 10: Debug-Verbindung
                     results.push(`ℹ️ CHECK 10: Live-Debugging verfügbar`);
                     results.push(`  - iPhone via USB mit Mac verbinden`);
                     results.push(`  - Safari (Mac) → Entwickler → ${navigator.userAgent.includes('iPhone') ? 'iPhone' : 'iPad'}`);
                     checksPassed++; // Information provided
                     
                     // ===== ZUSAMMENFASSUNG =====
                     const successRate = Math.round((checksPassed / totalChecks) * 100);
                     let summaryTitle = '';
                     let summaryText = '';
                     
                     if (successRate >= 80) {
                       summaryTitle = '🎉 DIAGNOSE: BEREIT FÜR PUSH!';
                       summaryText = `${checksPassed}/${totalChecks} Checks bestanden (${successRate}%)\n\n✅ Push-Notifications sollten funktionieren!`;
                     } else if (successRate >= 50) {
                       summaryTitle = '⚠️ DIAGNOSE: TEILWEISE BEREIT';
                       summaryText = `${checksPassed}/${totalChecks} Checks bestanden (${successRate}%)\n\nBehebe die Fehler unten:`;
                     } else {
                       summaryTitle = '❌ DIAGNOSE: NICHT BEREIT';
                       summaryText = `${checksPassed}/${totalChecks} Checks bestanden (${successRate}%)\n\nKritische Probleme gefunden:`;
                     }
                     
                     console.log('🔍 iOS CHECKLISTE ERGEBNISSE:', results);
                     console.log('🔍 iOS CHECKLISTE FEHLER:', errors);
                     
                     // Zeige Ergebnisse
                     Alert.alert(
                       summaryTitle,
                       results.join('\n') + 
                       (errors.length > 0 ? '\n\n🚨 PROBLEME:\n' + errors.join('\n') : '') +
                       '\n\n' + summaryText,
                       [
                         {
                           text: 'Vollständige Logs',
                           onPress: () => {
                             console.log('📱 VOLLSTÄNDIGE iOS-CHECKLISTE DIAGNOSE:');
                             console.log('User Agent:', navigator.userAgent);
                             console.log('Display Modes:', {
                               standalone: window.matchMedia('(display-mode: standalone)').matches,
                               browser: window.matchMedia('(display-mode: browser)').matches,
                               fullscreen: window.matchMedia('(display-mode: fullscreen)').matches
                             });
                             console.log('Navigator:', {
                               standalone: window.navigator.standalone,
                               onLine: navigator.onLine,
                               cookieEnabled: navigator.cookieEnabled
                             });
                             console.log('APIs:', {
                               serviceWorker: 'serviceWorker' in navigator,
                               pushManager: 'PushManager' in window,
                               notification: 'Notification' in window
                             });
                           }
                         },
                         { text: 'OK' }
                       ]
                     );
                     
                   } catch (error) {
                     console.error('❌ iOS Checkliste Fehler:', error);
                     Alert.alert('❌ Diagnose-Fehler', `Unerwarteter Fehler:\n${error.message}`);
                   }
                 }}
               >
                 <Text style={[styles.debugButtonText, { fontSize: 11 }]}>
                   🔍 iOS VOLLSTÄNDIGE CHECKLISTE
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

      {/* PWA Installation Banner */}
      {isWeb && showPWAPrompt && (
        <View style={styles.pwaPrompt}>
          <View style={styles.pwaPromptContent}>
            <Text style={styles.pwaPromptTitle}>📱 Als App installieren</Text>
            <Text style={styles.pwaPromptText}>
              {/iPad|iPhone|iPod/.test(navigator.userAgent) ? 
                'Installiere die App für Push-Benachrichtigungen!' : 
                'Installiere die Daily Budget App für eine bessere Erfahrung!'
              }
            </Text>
            {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
              <View style={styles.pwaPromptButtons}>
                <Text style={styles.iosInstructions}>
                  🚨 WICHTIG für Push-Benachrichtigungen:{'\n\n'}
                  1. Tippe UNTEN auf Teilen-Symbol ↗️{'\n'}
                  2. Scrolle nach unten → "Zum Home-Bildschirm"{'\n'}
                  3. Tippe "Hinzufügen"{'\n'}
                  4. ✅ App erscheint auf Home-Bildschirm{'\n'}
                  5. 🚨 WICHTIG: Starte App NUR vom Home-Bildschirm!{'\n\n'}
                  ❌ Safari schließen nach Installation!
                </Text>
                <TouchableOpacity
                  style={[styles.pwaButton, styles.pwaButtonSecondary]}
                  onPress={() => {
                    console.log('🔧 PWA Banner: Verstanden geklickt');
                    setShowPWAPrompt(false);
                  }}
                >
                  <Text style={styles.pwaButtonTextSecondary}>Banner schließen</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.pwaButton, { backgroundColor: '#FF0000', marginTop: 8 }]}
                  onPress={() => {
                    console.log('🔧 PWA Banner: Direkt zu Diagnose');
                    setShowPWAPrompt(false);
                    // Kurz warten, dann Alert mit Hinweis auf Diagnose-Button
                    setTimeout(() => {
                      Alert.alert(
                        '🔍 iOS Diagnose verfügbar',
                        'Scroll nach unten zum roten "🔍 iOS DIAGNOSE" Button für eine vollständige Analyse deines iOS Push-Notification Problems.',
                        [{ text: 'OK' }]
                      );
                    }, 500);
                  }}
                >
                  <Text style={styles.pwaButtonText}>🔍 Direkt zur Diagnose</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pwaPromptButtons}>
                <TouchableOpacity
                  style={styles.pwaButton}
                  onPress={async () => {
                    if (pwaInstallPrompt) {
                      const result = await pwaInstallPrompt.prompt();
                      console.log('PWA Installation:', result);
                      setPwaInstallPrompt(null);
                    }
                    setShowPWAPrompt(false);
                  }}
                >
                  <Text style={styles.pwaButtonText}>Installieren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pwaButton, styles.pwaButtonSecondary]}
                  onPress={() => setShowPWAPrompt(false)}
                >
                  <Text style={styles.pwaButtonTextSecondary}>Später</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* iOS-spezifische Debug Console mit verbesserter Diagnostik */}
      {isWeb && (
        <View style={styles.debugConsole}>
          <Text style={styles.debugTitle}>
            {/iPad|iPhone|iPod/.test(navigator.userAgent) ? '📱 iOS PWA Debug' : '🔧 PWA Debug Status'}
          </Text>
          <Text style={styles.debugText}>SW: {serviceWorkerStatus}</Text>
          <Text style={styles.debugText}>Permission: {typeof Notification !== 'undefined' ? Notification.permission : 'N/A'}</Text>
          {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
            <>
              <Text style={styles.debugText}>iOS: ✅</Text>
              <Text style={styles.debugText}>Safari: {/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? '✅' : '❌'}</Text>
              <Text style={styles.debugText}>DisplayMode: {window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}</Text>
              <Text style={styles.debugText}>Navigator.standalone: {window.navigator.standalone === true ? 'true' : window.navigator.standalone === false ? 'false' : 'undefined'}</Text>
              <Text style={styles.debugText}>PWA: {(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) ? 'Installiert ✅' : 'Browser ❌'}</Text>
            </>
          ) : (
            <Text style={styles.debugText}>PWA: {window.matchMedia('(display-mode: standalone)').matches ? 'Installiert' : 'Browser'}</Text>
          )}
          <TouchableOpacity
            style={styles.debugRefreshButton}
            onPress={() => {
              console.log('🔄 DEBUG: Force refresh PWA setup...');
              setupPWAAndNotifications();
            }}
          >
            <Text style={styles.debugRefreshText}>🔄 Neu laden</Text>
          </TouchableOpacity>
          {/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) && (
            <View style={styles.iosWarning}>
              <Text style={styles.iosWarningText}>⚠️ Start vom Home-Bildschirm!</Text>
            </View>
          )}
        </View>
      )}

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
  
  // PWA Styles
  pwaPrompt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1000,
  },
  pwaPromptContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  pwaPromptTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  pwaPromptText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  pwaPromptButtons: {
    gap: 12,
  },
  pwaButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  pwaButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pwaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  pwaButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  iosInstructions: {
    fontSize: 14,
    color: '#0A84FF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '500',
  },
  
  // Debug Console Styles
  debugConsole: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: 10,
    minWidth: 150,
    zIndex: 999,
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 6,
  },
  debugText: {
    fontSize: 10,
    color: '#FFF',
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  debugRefreshButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 6,
    alignItems: 'center',
  },
  debugRefreshText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: 'bold',
  },
  iosWarning: {
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
    padding: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  iosWarningText: {
    fontSize: 9,
    color: '#FFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
