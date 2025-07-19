// Service Worker für Push-Benachrichtigungen
// Unterstützt Safari macOS und iOS PWA

const CACHE_NAME = 'daily-budget-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico'
];

// Service Worker Installation
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('🔧 Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('🔧 Service Worker: Installation complete');
        self.skipWaiting(); // Aktiviere sofort
      })
  );
});

// Service Worker Aktivierung
self.addEventListener('activate', event => {
  console.log('🔧 Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🔧 Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('🔧 Service Worker: Activation complete');
      return self.clients.claim(); // Übernehme alle Clients
    })
  );
});

// Fetch Event (Basic Caching)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// 🔔 PUSH EVENT HANDLER (Wichtig für Safari/iOS)
self.addEventListener('push', event => {
  console.log('📧 Push-Event empfangen:', event);
  
  let notificationData = {
    title: 'Daily Budget App',
    body: 'Du hast eine neue Benachrichtigung!',
    icon: '/favicon.ico',
    badge: '/favicon.ico'
  };
  
  // Parse Push-Data falls vorhanden
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || 'budget-notification',
        requireInteraction: data.requireInteraction || false,
        actions: data.actions || []
      };
      console.log('📧 Push-Data parsed:', notificationData);
    } catch (error) {
      console.error('📧 Fehler beim Parsen der Push-Data:', error);
      // Verwende Default-Daten
    }
  }
  
  // Zeige Benachrichtigung (WICHTIG: Safari braucht sichtbare Benachrichtigungen!)
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      data: notificationData.data || {}
    }).then(() => {
      console.log('📧 ✅ Benachrichtigung angezeigt:', notificationData.title);
    }).catch(error => {
      console.error('📧 ❌ Fehler beim Anzeigen der Benachrichtigung:', error);
    })
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', event => {
  console.log('🔔 Benachrichtigung geklickt:', event.notification.tag);
  
  event.notification.close();
  
  // App öffnen/fokussieren
  event.waitUntil(
    clients.matchAll().then(clientList => {
      // Suche nach bereits geöffneter App
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Öffne neue App-Instanz
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Push Subscription Change (für Safari wichtig)
self.addEventListener('pushsubscriptionchange', event => {
  console.log('📧 Push Subscription Changed:', event);
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null // Wird später durch VAPID-Key ersetzt
    }).then(subscription => {
      console.log('📧 ✅ Neue Push Subscription:', subscription);
      // Hier könnte man die neue Subscription an den Server senden
    }).catch(error => {
      console.error('📧 ❌ Fehler bei neuer Push Subscription:', error);
    })
  );
});

console.log('🔧 Service Worker geladen und bereit für Push-Notifications'); 