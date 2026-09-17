const webpush = require('web-push');
const admin = require('firebase-admin');

// Captura o título e a mensagem enviados pelo painel local
const titulo = process.env.INPUT_TITLE || "O PicanhaFlix Atualizou!";
const mensagemTexto = process.env.INPUT_BODY || "Novo conteúdo adicionado! Venha conferir.";

// Configurações das chaves VAPID
webpush.setVapidDetails(
  'mailto:seu-email@gmail.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Objeto da notificação que será enviado aos navegadores
const payload = JSON.stringify({
  title: titulo,
  body: mensagemTexto,
  icon: 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'
});

// Inicialização do Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function enviarNotificacoes() {
  try {
    const snapshot = await db.collection('push_subscriptions').get();
    if (snapshot.empty) {
      console.log('Nenhum inscrito encontrado no banco.');
      return;
    }

    const envios = [];
    snapshot.forEach(doc => {
      const subscription = doc.data();
      envios.push(
        webpush.sendNotification(subscription, payload)
          .catch(err => {
            console.error('Erro ao enviar para inscrição:', err.endpoint, err.message);
            // Se a inscrição expirou (410/404), remove do Firestore
            if (err.statusCode === 410 || err.statusCode === 404) {
              doc.ref.delete();
            }
          })
      );
    });

    await Promise.all(envios);
    console.log('Todas as notificações foram processadas com sucesso!');
  } catch (error) {
    console.error('Erro geral ao buscar inscritos:', error);
    process.exit(1);
  }
}

enviarNotificacoes();