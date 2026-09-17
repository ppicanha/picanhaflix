// Escuta a notificação enviada em segundo plano
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: data.icon || '/favicon.ico'
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Abre o site ao clicar na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});