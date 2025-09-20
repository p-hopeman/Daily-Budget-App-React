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

const { width, height } = Dimensions.get('window');

// NotificationService-Instanz
const notificationService = new NotificationService();

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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  // iOS PWA Meta-Tags und Apple Touch Icon sicherstellen (minimal, ohne weitere Logik)
  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        const ensureMeta = (name, content) => {
          let el = document.querySelector(`meta[name="${name}"]`);
          if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', name);
            document.head.appendChild(el);
          }
          el.setAttribute('content', content);
        };

        ensureMeta('apple-mobile-web-app-capable', 'yes');
        ensureMeta('apple-mobile-web-app-status-bar-style', 'default');
        ensureMeta('apple-mobile-web-app-title', 'Daily Budget App');

        if (!document.querySelector("link[rel='apple-touch-icon']")) {
          const link = document.createElement('link');
          link.rel = 'apple-touch-icon';
          // PNG-Icon aus assets verwenden (iOS unterstützt kein SVG)
          link.href = '/assets/favicon.png';
          document.head.appendChild(link);
        }
      } catch (e) {
        console.log('iOS PWA meta injection error', e);
      }
    }
  }, []);

  // Web: Statisches Theme-Color auf Weiß setzen
  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        let meta = document.querySelector("meta[name='theme-color']");
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'theme-color');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', '#FFFFFF');
      } catch (e) {
        console.log('theme-color meta error', e);
      }
    }
  }, []);

    // Web: Manifest-Link sicherstellen und Service Worker registrieren (minimal)
    useEffect(() => {
      if (Platform.OS === 'web') {
        try {
          if (!document.querySelector("link[rel='manifest']")) {
            const link = document.createElement('link');
            link.rel = 'manifest';
            link.href = '/manifest.json';
            document.head.appendChild(link);
          }
          if ('serviceWorker' in navigator) {
            const onLoad = () => {
              navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.log('SW reg error', err);
              });
            };
            if (document.readyState === 'complete') {
              onLoad();
            } else {
              window.addEventListener('load', onLoad, { once: true });
            }
          }
        } catch (e) {
          console.log('PWA init error', e);
        }
      }
    }, []);

  // Lade Daten beim App-Start und initialisiere Notifications
  useEffect(() => {
    loadData();
    calculateRemainingDays();
    initializeNotifications();
    
    // 🎯 ONBOARDING: Prüfe ersten Besuch
    checkFirstVisit();
    
    // Timer für tägliche Aktualisierung
    const interval = setInterval(() => {
      calculateRemainingDays();
      calculateDailyBudget();
    }, 60000); // Jede Minute prüfen

    return () => clearInterval(interval);
  }, []);

  // 🕘 AUTOMATISCHE TÄGLICHE BENACHRICHTIGUNGEN: 9:00 und 20:00 Uhr
  useEffect(() => {
    if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
      console.log('🕘 Setze automatische tägliche Benachrichtigungen (9:00 & 20:00)...');
      
      // Prüfe jede Minute, ob es Zeit für eine Benachrichtigung ist
      const notificationInterval = setInterval(() => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        
        // Debug-Log alle 10 Minuten
        if (minute % 10 === 0) {
          console.log(`🕘 Automatische Benachrichtigungen: ${hour}:${minute.toString().padStart(2, '0')} (warte auf 9:00 oder 20:00)`);
        }
        
        // 9:00 Uhr morgens oder 20:00 Uhr abends (bei Minute 0, damit nur einmal pro Stunde)
        if (minute === 0 && (hour === 9 || hour === 20)) {
          console.log(`🕘 Zeit für tägliche Benachrichtigung: ${hour}:00`);
          
          // Prüfe, ob heute schon eine Benachrichtigung für diese Uhrzeit gesendet wurde
          const today = now.toDateString();
          const notificationKey = `daily-notification-${today}-${hour}`;
          const alreadySent = localStorage.getItem(notificationKey);
          
          if (!alreadySent) {
            console.log(`🕘 Sende tägliche Budget-Benachrichtigung für ${hour}:00`);
            
            const timeText = hour === 9 ? 'Guten Morgen!' : 'Guten Abend!';
            const emoji = hour === 9 ? '🌅' : '🌆';
            
            const notification = new Notification(`💸 ${timeText}`, {
              body: `Dein aktuelles Tagesbudget: ${formatCurrency(dailyBudget)}\nVerbleibendes Budget: ${formatCurrency(remainingBudget)}\nNoch ${remainingDays} Tage im Monat`,
              icon: '/favicon.svg',
              requireInteraction: false,
              tag: `daily-budget-${hour}`
            });
            
            notification.onclick = () => {
              console.log('🕘 Tägliche Benachrichtigung geklickt');
              notification.close();
              // Optional: App in den Vordergrund bringen
              if (window.focus) window.focus();
            };
            
            // Markiere als gesendet für heute
            localStorage.setItem(notificationKey, 'sent');
            console.log(`✅ Tägliche Benachrichtigung für ${hour}:00 gesendet und markiert`);
          } else {
            console.log(`⏭️ Tägliche Benachrichtigung für ${hour}:00 heute bereits gesendet`);
          }
        }
      }, 60000); // Prüfe jede Minute
      
      console.log('✅ Automatische tägliche Benachrichtigungen aktiviert (9:00 & 20:00)');
      
      return () => {
        clearInterval(notificationInterval);
        console.log('🛑 Automatische tägliche Benachrichtigungen deaktiviert');
      };
    }
  }, [dailyBudget, remainingBudget, remainingDays]); // Re-run wenn sich Budget-Werte ändern

  // 🎯 ONBOARDING: Prüfe ersten Besuch
  const checkFirstVisit = () => {
    if (Platform.OS === 'web') {
      try {
        const hasVisited = localStorage.getItem('daily-budget-app-visited');
        console.log('🎯 ONBOARDING: Erster Besuch Check:', hasVisited);
        
        if (!hasVisited) {
          console.log('🎯 ONBOARDING: Erster Besuch erkannt - zeige Onboarding');
          // Kurz warten damit App geladen ist
          setTimeout(() => {
            setShowOnboarding(true);
          }, 2000);
        }
      } catch (error) {
        console.error('🎯 ONBOARDING: localStorage Fehler:', error);
      }
    }
  };

  // 🎯 ONBOARDING: Als besucht markieren
  const markAsVisited = () => {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem('daily-budget-app-visited', 'true');
        console.log('🎯 ONBOARDING: Als besucht markiert');
      } catch (error) {
        console.error('🎯 ONBOARDING: localStorage Fehler:', error);
      }
    }
  };

  // 🎯 ONBOARDING: Schließen
  const closeOnboarding = () => {
    setShowOnboarding(false);
    markAsVisited();
  };

  // 🎯 ONBOARDING: Schritt 2 Notifications aktivieren (EINFACHE VERSION)
  const activateNotificationsOnboarding = () => {
    console.log('🎯 ONBOARDING: Aktiviere Notifications...');
    
    return new Promise((resolve) => {
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            console.log('🎯 ONBOARDING Permission:', permission);
            if (permission === 'granted') {
                          const notification = new Notification('💸 Perfekt!', {
              body: 'Daily Budget App ist bereit! Du erhältst jetzt Budget-Updates.',
              icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSI0OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiPvCfkrg8L3RleHQ+PC9zdmc+'
            });
              console.log('✅ Onboarding Notifications erfolgreich aktiviert!');
              resolve(true);
            } else {
              Alert.alert('❌ Berechtigung erforderlich', 'Benachrichtigungen sind für die beste Erfahrung erforderlich.');
              resolve(false);
            }
          }).catch(error => {
            console.error('🎯 ONBOARDING Permission Fehler:', error);
            Alert.alert('❌ Fehler', 'Berechtigung konnte nicht angefragt werden.');
            resolve(false);
          });
        } else if (Notification.permission === 'granted') {
          const notification = new Notification('💸 Bereits aktiv!', {
            body: 'Benachrichtigungen sind bereits aktiviert!',
            icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSI0OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiPvCfkrg8L3RleHQ+PC9zdmc+'
          });
          console.log('✅ Onboarding Notifications bereits aktiv!');
          resolve(true);
        } else {
          Alert.alert('❌ Blockiert', 'Benachrichtigungen sind blockiert. Aktiviere sie in den Browser-Einstellungen.');
          resolve(false);
        }
      } else {
        Alert.alert('❌ Nicht unterstützt', 'Benachrichtigungen werden nicht unterstützt.');
        resolve(false);
      }
    });
  };

  // Initialisiere Notification-System
  const initializeNotifications = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web Notifications initialisieren
        if ('Notification' in window) {
          const permissionStatus = Notification.permission;
          console.log('Web Notifications Status:', permissionStatus);
          
          if (permissionStatus === 'granted') {
            console.log('✅ Web Notifications bereits aktiviert!');
            // Sende Willkommens-Notification
            setTimeout(() => {
              const notification = new Notification('🎉 Daily Budget App', {
                body: 'Web-Benachrichtigungen sind aktiv! Du erhältst Budget-Updates auch im Browser.',
                icon: '/favicon.svg',
                requireInteraction: true
              });
            }, 2000);
          } else if (permissionStatus === 'default') {
            // 🔔 AUTO-SETUP: Automatische Permission-Request
            console.log('🔔 AUTO-SETUP: Frage automatisch nach Notification-Permission...');
            setTimeout(async () => {
              try {
                const permission = await Notification.requestPermission();
                console.log('🔔 AUTO-SETUP: Permission erhalten:', permission);
                
                if (permission === 'granted') {
                  console.log('✅ AUTO-SETUP: Notifications automatisch aktiviert!');
                  // Sende Willkommens-Notification
                  const notification = new Notification('💸 Willkommen!', {
                    body: 'Benachrichtigungen sind jetzt aktiv! Du erhältst Budget-Updates.',
                    icon: '/favicon.svg',
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
        if (Platform.OS === 'web') {
          // Web-Version: Lokale Erinnerungen werden durch useEffect gehandhabt
          console.log(`Web: Tägliche Erinnerungen aktiv (9:00 & 20:00)`);
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

  // 🔔 VERBINDUNG ZUM SERVICE WORKER für Hintergrund-Benachrichtigungen
  useEffect(() => {
    if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      console.log('🔔 Registriere Service Worker für Hintergrund-Benachrichtigungen...');
      
      navigator.serviceWorker.ready.then(registration => {
        console.log('🔔 Service Worker bereit:', registration);
        
        // Sende Nachricht an Service Worker für tägliche Erinnerungen
        if (registration.active) {
          registration.active.postMessage({
            type: 'SCHEDULE_DAILY_REMINDER',
            dailyBudget: dailyBudget,
            remainingBudget: remainingBudget,
            remainingDays: remainingDays
          });
          console.log('✅ Tägliche Erinnerungen an Service Worker übertragen');
        }
      }).catch(error => {
        console.log('❌ Service Worker Fehler:', error);
      });
    }
  }, [dailyBudget, remainingBudget, remainingDays]);

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
      // Web: Sende direkte Benachrichtigung
      if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('💸 Budget aktualisiert!', {
          body: `${!isDeposit ? '➖ Ausgabe' : '➕ Einzahlung'}: ${formatCurrency(amount)}\nNeues Tagesbudget: ${formatCurrency(newDailyBudget)}`,
          icon: '/favicon.svg',
          tag: 'budget-update'
        });
        
        // Niedrig-Budget-Warnung
        if (newDailyBudget <= 5) {
          const warningNotification = new Notification('⚠️ Niedriges Budget!', {
            body: `Dein Tagesbudget ist nur noch ${formatCurrency(newDailyBudget)}. Vorsicht bei weiteren Ausgaben!`,
            icon: '/favicon.svg',
            tag: 'low-budget-warning'
          });
        }
        
        // Motivations-Notification
        if (newDailyBudget > 20) {
          const motivationNotification = new Notification('🎉 Super Budget!', {
            body: `Dein Tagesbudget ist ${formatCurrency(newDailyBudget)}. Weiter so!`,
            icon: '/favicon.svg',
            tag: 'motivation'
          });
        }
      } else if (Platform.OS !== 'web') {
        // Native: Verwende NotificationService
        await notificationService.sendBudgetUpdateNotification(
          newDailyBudget,
          newBudget,
          remainingDays,
          amount,
          !isDeposit
        );
        
        if (newDailyBudget <= 5) {
          await notificationService.scheduleLowBudgetWarning(newDailyBudget);
        }
        
        if (newDailyBudget > 20) {
          await notificationService.sendMotivationNotification(newDailyBudget);
        }
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
                          if (Platform.OS === 'web') {
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
                                  const notification = new Notification('💸 Test erfolgreich!', {
                                    body: 'Benachrichtigungen funktionieren jetzt!',
                                    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSI0OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiPvCfkrg8L3RleHQ+PC9zdmc+'
                                  });
                                  Alert.alert('✅ Erfolgreich', 'Benachrichtigungen sind aktiv!');
                                } else {
                                  Alert.alert('❌ Abgelehnt', 'Benachrichtigungen wurden abgelehnt.');
                                }
                              } else if (Notification.permission === 'granted') {
                                console.log('Sende Test-Notification...');
                                const notification = new Notification('💸 Test erfolgreich!', {
                                  body: 'Benachrichtigungen funktionieren bereits!',
                                  icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSI0OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9ImNlbnRyYWwiPvCfkrg8L3RleHQ+PC9zdmc+'
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
                  name={Platform.OS === 'web' ? "notifications-outline" : "settings-outline"} 
                  size={24} 
                  color="#666"
                />
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

      {/* 🎯 ONBOARDING Modal */}
      {showOnboarding && (
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingModal}>
            {/* Header */}
            <View style={styles.onboardingHeader}>
              <Text style={styles.onboardingTitle}>
                🎉 Willkommen bei Daily Budget!
              </Text>
              <Text style={styles.onboardingSubtitle}>
                Installiere die App für die beste Erfahrung
              </Text>
            </View>

            {/* Content basierend auf Schritt */}
            <View style={styles.onboardingContent}>
              {onboardingStep === 1 && (
                <View style={styles.onboardingStep}>
                  <Text style={styles.onboardingStepTitle}>
                    📱 Schritt 1: App installieren
                  </Text>
                  <Text style={styles.onboardingStepText}>
                    {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                      'iPhone/iPad:\n\n1. Tippe auf das Teilen-Symbol (📤) in Safari\n2. Wähle "Zum Home-Bildschirm hinzufügen"\n3. Tippe "Hinzufügen"\n4. Öffne die App vom Home-Bildschirm'
                    ) : (
                      'Desktop:\n\n1. Klicke auf das Installieren-Symbol in der Adressleiste\n2. Bestätige die Installation\n3. Die App ist jetzt verfügbar'
                    )}
                  </Text>
                  <TouchableOpacity 
                    style={styles.onboardingButton}
                    onPress={() => setOnboardingStep(2)}
                  >
                    <Text style={styles.onboardingButtonText}>
                      ✅ App installiert, weiter
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {onboardingStep === 2 && (
                <View style={styles.onboardingStep}>
                  <Text style={styles.onboardingStepTitle}>
                    🔔 Schritt 2: Benachrichtigungen aktivieren
                  </Text>
                  <Text style={styles.onboardingStepText}>
                    Erhalte automatische Updates über dein Budget, Ausgaben und Erinnerungen.
                    {'\n\n'}• Budget-Updates bei Transaktionen
                    {'\n'}• Warnungen bei niedrigem Budget  
                    {'\n'}• Tägliche Erinnerungen
                  </Text>
                  <TouchableOpacity 
                    style={styles.onboardingButtonPrimary}
                    onPress={() => {
                      activateNotificationsOnboarding().then(success => {
                        if (success) {
                          setOnboardingStep(3);
                        }
                      });
                    }}
                  >
                    <Text style={styles.onboardingButtonTextPrimary}>
                      🔔 Hier klicken - Benachrichtigungen aktivieren
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.onboardingButtonSecondary}
                    onPress={() => closeOnboarding()}
                  >
                    <Text style={styles.onboardingButtonTextSecondary}>
                      Später aktivieren
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {onboardingStep === 3 && (
                <View style={styles.onboardingStep}>
                  <Text style={styles.onboardingStepTitle}>
                    🎉 Alles bereit!
                  </Text>
                  <Text style={styles.onboardingStepText}>
                    Daily Budget App ist jetzt vollständig eingerichtet!
                    {'\n\n'}✅ App installiert
                    {'\n'}✅ Benachrichtigungen aktiv
                    {'\n'}✅ Bereit für Budget-Tracking
                    {'\n\n'}Viel Spaß beim Verwalten deines Budgets! 💰
                  </Text>
                  <TouchableOpacity 
                    style={styles.onboardingButtonPrimary}
                    onPress={() => closeOnboarding()}
                  >
                    <Text style={styles.onboardingButtonTextPrimary}>
                      🚀 Los geht's!
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Skip Button - nur in Schritt 1 */}
            {onboardingStep === 1 && (
              <TouchableOpacity 
                style={styles.onboardingSkip}
                onPress={() => closeOnboarding()}
              >
                <Text style={styles.onboardingSkipText}>
                  Überspringen
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
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
  // 🎯 ONBOARDING Styles
  onboardingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  onboardingModal: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  onboardingHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  onboardingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  onboardingContent: {
    marginBottom: 20,
  },
  onboardingStep: {
    alignItems: 'center',
  },
  onboardingStepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  onboardingStepText: {
    fontSize: 15,
    color: '#444',
    textAlign: 'left',
    lineHeight: 22,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  onboardingButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  onboardingButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  onboardingButtonPrimary: {
    backgroundColor: '#0A84FF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#0A84FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  onboardingButtonTextPrimary: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  onboardingButtonSecondary: {
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  onboardingButtonTextSecondary: {
    color: '#666',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  onboardingSkip: {
    alignSelf: 'center',
    padding: 12,
  },
  onboardingSkipText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },

});
