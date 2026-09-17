// Força o Service Worker a se instalar e se ativar imediatamente
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// Escuta a notificação enviada em segundo plano
self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nova atualização disponível!',
      icon: data.icon || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
      badge: data.icon || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
      vibrate: [100, 50, 100],
      data: {
        url: 'https://ppicanha.github.io/picanhaflix/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PicanhaFlix', options)
    );
  }
});

// Redirecionamento direto para a subpasta do projeto
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl = 'https://ppicanha.github.io/picanhaflix/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes('picanhaflix') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});