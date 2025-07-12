// COMPLETELY DISABLED FOR DEBUGGING - ALL FUNCTIONS RETURN DUMMY VALUES
// This prevents complex PWA logic from interfering with web app

export default class PWAService {
  constructor() {
    console.log('PWAService: DUMMY MODE - alle Funktionen deaktiviert');
    this.isSupported = false;
    this.registration = null;
    this.isStandalone = false;
    this.deferredPrompt = null;
  }

  canInstall() {
    return false;
  }

  async showInstallPrompt() {
    console.log('DUMMY: showInstallPrompt');
    return false;
  }

  async registerServiceWorker() {
    console.log('DUMMY: registerServiceWorker');
    return false;
  }

  createManifest() {
    console.log('DUMMY: createManifest');
    return {};
  }

  addPWAMetaTags() {
    console.log('DUMMY: addPWAMetaTags');
  }

  async initialize() {
    console.log('DUMMY: PWA initialize');
    return false;
  }

  getStatus() {
    return {
      isSupported: false,
      isStandalone: false,
      canInstall: false,
      hasServiceWorker: false
    };
  }

  async sendServiceWorkerNotification() {
    console.log('DUMMY: sendServiceWorkerNotification');
    return false;
  }
} 