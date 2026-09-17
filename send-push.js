const webpush = require('web-push');
const admin = require('firebase-admin');

// Conecta ao Firebase usando as credenciais seguras
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Configura as chaves de segurança
webpush.setVapidDetails(
  'mailto:seu-email@exemplo.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function enviarNotificacoes() {
  // Busca todos os usuários que ativaram a notificação
  const snapshot = await db.collection('push_subscriptions').get();
  
  const mensagem = JSON.stringify({
    title: 'PicanhaFlix Atualizado! 🍿',
    body: 'Tem novidade no site! Confira as novas atualizações agora.',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'
  });

  // Manda a notificação para cada um
  const envios = snapshot.docs.map(doc => {
    const inscricao = doc.data();
    return webpush.sendNotification(inscricao, mensagem).catch(err => {
      // Se a pessoa desativou no navegador, limpa o banco de dados
      if (err.statusCode === 410 || err.statusCode === 404) {
        return doc.ref.delete();
      }
    });
  });

  await Promise.all(envios);
  console.log('Todas as notificações foram enviadas com sucesso!');
}

enviarNotificacoes().catch(console.error);