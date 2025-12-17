self.addEventListener('install', event => {
	self.skipWaiting();
});

self.addEventListener('activate', event => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
	// no-op fetch handler; presence of SW is enough for installability
}); 

// Handle incoming Web Push payloads and show notifications
self.addEventListener('push', (event) => {
	try {
		const data = event.data ? event.data.json() : {};
		const title = data.title || 'Daily Budget';
		const body = data.body || 'Neues Update';
		const icon = data.icon || '/assets/DailyBudget_icon_48x48.png';
		const tag = data.tag || 'daily-budget';
		const requireInteraction = !!data.requireInteraction;

		event.waitUntil(
			self.registration.showNotification(title, {
				body,
				icon,
				tag,
				requireInteraction,
				data: data.data || {}
			})
		);
	} catch (e) {
		// Fallback ohne Payload
		event.waitUntil(
			self.registration.showNotification('Daily Budget', {
				body: 'Benachrichtigung erhalten',
				icon: '/assets/DailyBudget_icon_48x48.png',
				tag: 'daily-budget'
			})
		);
	}
});

// Focus the client when the notification is clicked
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if ('focus' in client) return client.focus();
			}
			if (clients.openWindow) {
				return clients.openWindow('/');
			}
		})
	);
});