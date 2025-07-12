class PWAService {
  constructor() {
    this.isSupported = 'serviceWorker' in navigator;
    this.registration = null;
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    this.deferredPrompt = null;
    
    // Installierungs-Event abfangen
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('PWA: Install prompt event');
      e.preventDefault();
      this.deferredPrompt = e;
    });
  }

  // Prüfe ob PWA-Installation unterstützt wird
  canInstall() {
    return this.deferredPrompt !== null;
  }

  // Zeige PWA-Installationsprompt
  async showInstallPrompt() {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`PWA Install: ${outcome}`);
      this.deferredPrompt = null;
      return outcome === 'accepted';
    } catch (error) {
      console.error('PWA Install Error:', error);
      return false;
    }
  }

  // Registriere Service Worker
  async registerServiceWorker() {
    if (!this.isSupported) {
      console.log('Service Worker wird nicht unterstützt');
      return false;
    }

    try {
      // Erstelle Service Worker inline für bessere Kompatibilität
      const swCode = `
        const CACHE_NAME = 'daily-budget-app-v1';
        const urlsToCache = [
          '/',
          '/manifest.json'
        ];

        self.addEventListener('install', (event) => {
          console.log('Service Worker: Install Event');
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => {
                console.log('Service Worker: Caching Files');
                return cache.addAll(urlsToCache);
              })
              .then(() => {
                console.log('Service Worker: Installation Complete');
                return self.skipWaiting();
              })
          );
        });

        self.addEventListener('activate', (event) => {
          console.log('Service Worker: Activate Event');
          event.waitUntil(
            caches.keys().then((cacheNames) => {
              return Promise.all(
                cacheNames.map((cacheName) => {
                  if (cacheName !== CACHE_NAME) {
                    console.log('Service Worker: Removing Old Cache:', cacheName);
                    return caches.delete(cacheName);
                  }
                })
              );
            }).then(() => {
              console.log('Service Worker: Activation Complete');
              return self.clients.claim();
            })
          );
        });

        self.addEventListener('fetch', (event) => {
          event.respondWith(
            caches.match(event.request)
              .then((response) => {
                if (response) {
                  return response;
                }
                return fetch(event.request);
              })
          );
        });

        // Push Notification Handler
        self.addEventListener('push', (event) => {
          console.log('Service Worker: Push Event Received');
          
          if (!event.data) {
            console.log('Push event but no data');
            return;
          }

          let notificationData;
          try {
            notificationData = event.data.json();
          } catch (e) {
            notificationData = {
              title: 'Daily Budget App',
              body: event.data.text(),
              icon: '/favicon.ico',
              badge: '/favicon.ico'
            };
          }

          const options = {
            body: notificationData.body,
            icon: notificationData.icon || '/favicon.ico',
            badge: notificationData.badge || '/favicon.ico',
            vibrate: [100, 50, 100],
            data: notificationData.data || {},
            actions: [
              {
                action: 'open',
                title: 'App öffnen'
              }
            ],
            requireInteraction: true,
            tag: 'daily-budget-notification'
          };

          event.waitUntil(
            self.registration.showNotification(notificationData.title, options)
          );
        });

        // Notification Click Handler
        self.addEventListener('notificationclick', (event) => {
          console.log('Service Worker: Notification Click Event');
          
          event.notification.close();
          
          if (event.action === 'open' || !event.action) {
            event.waitUntil(
              clients.matchAll({ type: 'window' }).then((windowClients) => {
                for (let client of windowClients) {
                  if (client.url === self.registration.scope && 'focus' in client) {
                    return client.focus();
                  }
                }
                if (clients.openWindow) {
                  return clients.openWindow('/');
                }
              })
            );
          }
        });

        console.log('Service Worker: Loaded Successfully');
      `;

      // Erstelle Service Worker als Blob
      const blob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);

      this.registration = await navigator.serviceWorker.register(swUrl);
      console.log('Service Worker registriert:', this.registration);

      // Update-Handler
      this.registration.addEventListener('updatefound', () => {
        console.log('Service Worker Update gefunden');
        const newWorker = this.registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            console.log('Service Worker Update bereit');
            // Hier könnte man eine Update-Notification zeigen
          }
        });
      });

      return true;
    } catch (error) {
      console.error('Service Worker Registration fehler:', error);
      return false;
    }
  }

  // Erstelle Web App Manifest dynamisch
  createManifest() {
    const manifest = {
      name: 'Daily Budget App',
      short_name: 'Budget App',
      description: 'Verwalte dein tägliches Budget einfach und effektiv',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#00C851',
      background_color: '#FFFFFF',
      categories: ['finance', 'productivity', 'lifestyle'],
      lang: 'de-DE',
      scope: '/',
      icons: [
        {
          src: '/favicon.ico',
          sizes: '64x64',
          type: 'image/x-icon'
        }
      ]
    };

    // Erstelle Manifest-Blob
    const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/json'
    });
    const manifestUrl = URL.createObjectURL(manifestBlob);

    // Füge Manifest-Link zum Head hinzu
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);

    console.log('PWA Manifest erstellt');
    return manifest;
  }

  // Füge PWA Meta-Tags hinzu
  addPWAMetaTags() {
    const metaTags = [
      { name: 'theme-color', content: '#00C851' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Budget App' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'application-name', content: 'Daily Budget App' },
      { name: 'msapplication-TileColor', content: '#00C851' },
      { name: 'msapplication-tap-highlight', content: 'no' }
    ];

    metaTags.forEach(tag => {
      const meta = document.createElement('meta');
      meta.name = tag.name;
      meta.content = tag.content;
      document.head.appendChild(meta);
    });

    // Apple Touch Icon
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.href = '/favicon.ico';
    document.head.appendChild(appleIcon);

    console.log('PWA Meta-Tags hinzugefügt');
  }

  // PWA vollständig initialisieren
  async initialize() {
    console.log('PWA Service: Initialization started');
    
    // Meta-Tags hinzufügen
    this.addPWAMetaTags();
    
    // Manifest erstellen
    this.createManifest();
    
    // Service Worker registrieren
    const swRegistered = await this.registerServiceWorker();
    
    if (swRegistered) {
      console.log('✅ PWA erfolgreich initialisiert!');
    } else {
      console.log('❌ PWA Initialisierung fehlgeschlagen');
    }
    
    return swRegistered;
  }

  // Prüfe PWA-Status
  getStatus() {
    return {
      isSupported: this.isSupported,
      isStandalone: this.isStandalone,
      canInstall: this.canInstall(),
      hasServiceWorker: this.registration !== null
    };
  }

  // Sende Notification über Service Worker
  async sendServiceWorkerNotification(title, body, options = {}) {
    if (!this.registration) {
      console.log('Kein Service Worker registriert');
      return false;
    }

    try {
      await this.registration.showNotification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        requireInteraction: true,
        tag: 'daily-budget-app',
        ...options
      });
      return true;
    } catch (error) {
      console.error('Service Worker Notification Fehler:', error);
      return false;
    }
  }
}

export default PWAService; 