self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? {
    title: 'TaskForge Reminder',
    body: 'You have tasks waiting.',
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data,
      icon: '/favicon.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
