// سرویس‌ورکر: دریافت اعلان‌های سرور (حتی وقتی اپ بسته است) و باز کردن اپ با کلیک
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'استودیو معماری دَست', body: '', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch (e) { /* بدون داده */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    renotify: !!data.tag,
    dir: 'rtl',
    lang: 'fa',
    icon: '/assets/logo_blue.svg',
    badge: '/assets/logo_blue.svg',
    data: { url: data.url || '/' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
