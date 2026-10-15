/* Notification-only worker. It does not intercept or cache website requests. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    /* use safe defaults */
  }
  event.waitUntil(
    self.registration.showNotification('New chess challenge', {
      body:
        typeof data.body === 'string'
          ? data.body.slice(0, 180)
          : 'A visitor is waiting in your chess dashboard.',
      tag: 'personal-computer-chess',
      icon: new URL('favicon.svg', self.registration.scope).href,
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('./?chess=owner', self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      for (const client of windows)
        if (client.url.startsWith(self.registration.scope)) {
          await client.navigate(target);
          return client.focus();
        }
      return clients.openWindow(target);
    }),
  );
});
