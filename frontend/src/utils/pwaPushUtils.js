export const registerPwaAndServiceWorker = async () => {
    if (typeof window === 'undefined') return;

    // Ensure manifest link exists in <head>
    if (!document.querySelector("link[rel='manifest']")) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
    }

    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
        } catch (e) {
            console.warn('Service Worker registration note:', e);
        }
    }
};

export const requestLockScreenNotifications = async () => {
    if (typeof Notification === 'undefined') return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
};

export const triggerLocalLockScreenAlert = async (title, body, url = '/?widget=drop') => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title, {
                    body,
                    vibrate: [200, 100, 200],
                    data: { url }
                });
                return;
            }
        }
        new Notification(title, { body });
    } catch { }
};