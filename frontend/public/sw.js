self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = { title: '🌸 The Us Space', body: 'Your partner sent you a new update!', url: '/?widget=drop' };
    try {
        if (event.data) payload = { ...payload, ...event.data.json() };
    } catch { }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            image: payload.image || undefined,
            vibrate: [200, 100, 200],
            data: { url: payload.url || '/?widget=drop' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        })
    );
});