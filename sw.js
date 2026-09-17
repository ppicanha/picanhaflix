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
        url: data.url || 'https://ppicanha.github.io/picanhaflix/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PicanhaFlix', options)
    );
  }
});

// Abre o site correto ao clicar na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Define o endereço correto do repositório
  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : 'https://ppicanha.github.io/picanhaflix/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Se o PicanhaFlix já estiver aberto em uma aba, foca nela
      for (let client of clientList) {
        if (client.url.includes('picanhaflix') && 'focus' in client) {
          return client.focus();
        }
      }
      // Se não estiver aberto, abre a URL completa do projeto
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});