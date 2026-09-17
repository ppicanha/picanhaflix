import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDb1s_yCly18-4kOGrkVHzkSfhyU7TB1a8",
  authDomain: "picanhaflix-feecb.firebaseapp.com",
  projectId: "picanhaflix-feecb",
  storageBucket: "picanhaflix-feecb.firebasestorage.app",
  messagingSenderId: "485603050369",
  appId: "1:485603050369:web:487af16b7d893c701c5e80",
  measurementId: "G-NVVZ37WG45"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let activeProfileIndex = null;
let userProfiles = [];
let isIntroFinished = false;
let pendingAuthUser = null;
let currentSelectedMovie = null;
let currentHistory = {};
let controlsTimeout = null;
let notificationTimeout = null;

// Ícones SVG
const svgSoundOn = `<svg class="icon-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const svgSoundMute = `<svg class="icon-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

// Changelog
const CHANGELOG_DATA = [
  {
    version: "v1.2.1",
    date: "16 de Setembro, 2026",
    changes: [
      "Correção de layout: Remoção do ícone de notificação duplicado na exibição mobile."
    ]
  },
  {
    version: "v1.2.0",
    date: "16 de Setembro, 2026",
    changes: [
      "Adicionado suporte nativo a Notificações Push do sistema.",
      "Adicionado painel de histórico de notas de atualização.",
      "Melhorias no player de vídeo e suporte a resoluções.",
      "Ajustes de toque no player e novos títulos 'Em Breve'."
    ]
  },
  {
    version: "v1.1.0",
    date: "01 de Setembro, 2026",
    changes: [
      "Implementado suporte a salvamento de progresso ('Continuar Assistindo').",
      "Adicionada a funcionalidade 'Minha Lista'."
    ]
  }
];

const LATEST_VERSION = CHANGELOG_DATA[0].version;

// Sistema de Notificações
function updateNotificationIcon() {
  const btn = document.getElementById("btnNotificationToggle");
  if (!btn) return;
  const enabled = localStorage.getItem("notificationsEnabled") === "true" && Notification.permission === "granted";
  
  if (enabled) {
    btn.classList.remove("disabled");
    btn.title = "Notificações Ativadas";
  } else {
    btn.classList.add("disabled");
    btn.title = "Notificações Desativadas";
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/picanhaflix/sw.js');
}

window.sendSystemNotification = function(title, body, icon = "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png") {
  if (localStorage.getItem("notificationsEnabled") === "true" && Notification.permission === "granted") {
    new Notification(title, { body, icon });
  }
};

window.toggleNotificationSetting = async function() {
  const current = localStorage.getItem("notificationsEnabled") === "true";

  if (current) {
    localStorage.setItem("notificationsEnabled", "false");
    alert("Notificações desativadas nas configurações do aplicativo.");
  } else {
    if (!("Notification" in window)) {
      alert("Seu navegador não suporta notificações de sistema.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("notificationsEnabled", "true");
      closeNotificationBanner();
      sendSystemNotification("PicanhaFlix", "Notificações ativadas com sucesso!");
    } else {
      localStorage.setItem("notificationsEnabled", "false");
      alert("Permissão de notificação negada pelo navegador.");
    }
  }
  updateNotificationIcon();
};

function triggerNotificationPrompt() {
  const isEnabled = localStorage.getItem("notificationsEnabled") === "true" && Notification.permission === "granted";
  if (isEnabled) return;

  const banner = document.getElementById("notificationBanner");
  if (!banner) return;

  banner.style.display = "block";
  clearTimeout(notificationTimeout);

  notificationTimeout = setTimeout(() => {
    closeNotificationBanner();
  }, 10000);
}

window.enableNotifications = async function() {
  if ("Notification" in window && "serviceWorker" in navigator) {
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      localStorage.setItem("notificationsEnabled", "true");
      closeNotificationBanner();
      updateNotificationIcon();

      // 1. Pega o registro do Service Worker
      const registration = await navigator.serviceWorker.ready;
      
      // 2. Cria o "endereço de entrega" usando a sua CHAVE PÚBLICA (VAPID)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "BOJurSsMJ8gwr3vXtaknMu2zrC_D-CxiEMKuBMGYn2Ey6LXVIGjKpjuXjd8y5_Cq7irmZCtwDzPj_0eUFATNZRQ" // Cole a chave pública do Passo 1
      });

      // 3. Salva esse endereço no Firestore
      if (currentUser) {
        await setDoc(doc(db, "push_subscriptions", currentUser.uid), subscription.toJSON());
      }

      sendSystemNotification("PicanhaFlix", "Notificações ativadas com sucesso!");
      return;
    }
  }
  alert("Não foi possível ativar as notificações do navegador.");
  closeNotificationBanner();
};

window.closeNotificationBanner = function() {
  const banner = document.getElementById("notificationBanner");
  if (banner) banner.style.display = "none";
  clearTimeout(notificationTimeout);
};

function checkChangelogBadge() {
  const lastSeenVersion = localStorage.getItem("lastSeenChangelog");
  const badgeElement = document.getElementById("changelogBadge");

  if (badgeElement) {
    badgeElement.style.display = (lastSeenVersion !== LATEST_VERSION) ? "flex" : "none";
  }
}

window.openChangelogModal = function () {
  const modal = document.getElementById("changelogModal");
  const listContainer = document.getElementById("changelogList");

  if (!modal || !listContainer) return;

  listContainer.innerHTML = CHANGELOG_DATA.map(item => `
    <div class="changelog-item">
      <div class="changelog-version">${item.version}</div>
      <div class="changelog-date">${item.date}</div>
      <ul class="changelog-changes">
        ${item.changes.map(change => `<li>${change}</li>`).join("")}
      </ul>
    </div>
  `).join("");

  modal.style.display = "flex";
  localStorage.setItem("lastSeenChangelog", LATEST_VERSION);
  checkChangelogBadge();
};

window.closeChangelogModal = function () {
  const modal = document.getElementById("changelogModal");
  if (modal) modal.style.display = "none";
};

function playTudumSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(110, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 1.2);
    gain1.gain.setValueAtTime(0.8, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 1.2);

    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(180, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.8);
      gain2.gain.setValueAtTime(0.6, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.8);
    }, 150);
  } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
  const introLogo = document.getElementById('introLogo');
  if (introLogo) introLogo.classList.add('animate');
  playTudumSound();

  setTimeout(() => {
    const introScreen = document.getElementById('intro-screen');
    if (introScreen) introScreen.style.display = 'none';
    isIntroFinished = true;
    checkAuthState();
  }, 2500);
});

onAuthStateChanged(auth, (user) => {
  pendingAuthUser = user;
  if (isIntroFinished) {
    checkAuthState();
  }
});

async function checkAuthState() {
  const loadingScreen = document.getElementById('loading-screen');
  const authScreen = document.getElementById('auth-screen');

  if (loadingScreen) loadingScreen.style.display = 'flex';
  if (authScreen) authScreen.style.display = 'none';

  if (pendingAuthUser) {
    currentUser = pendingAuthUser;
    await loadUserProfiles();
    if (loadingScreen) loadingScreen.style.display = 'none';
  } else {
    currentUser = null;
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (authScreen) authScreen.style.display = 'flex';
    document.getElementById('profile-selector').style.display = 'none';
    document.getElementById('main-app').style.display = 'none';
  }
}

window.loginGoogle = function() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  signInWithPopup(auth, provider).catch(err => {
    console.error(err);
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
  });
};

window.logout = function() {
  signOut(auth);
};

async function loadUserProfiles() {
  const userRef = doc(db, "users", currentUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    userProfiles = userSnap.data().profiles || [];
  } else {
    userProfiles = [{
      id: 'p1',
      name: currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'Perfil 1',
      avatar: currentUser.photoURL || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png',
      history: {},
      myList: []
    }];
    await setDoc(userRef, { profiles: userProfiles });
  }

  renderProfileSelector();
}

function renderProfileSelector() {
  document.getElementById('profile-selector').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  
  checkChangelogBadge();

  const grid = document.getElementById('profilesGrid');
  grid.innerHTML = '';

  userProfiles.forEach((profile, idx) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.onclick = () => selectProfile(idx);
    card.innerHTML = `
      <img src="${profile.avatar}" class="profile-avatar">
      <span class="profile-name">${profile.name}</span>
    `;
    grid.appendChild(card);
  });

  if (userProfiles.length < 6) {
    const addBtn = document.createElement('div');
    addBtn.className = 'profile-card';
    addBtn.onclick = openCreateProfileModal;
    addBtn.innerHTML = `
      <div class="add-profile-btn">+</div>
      <span class="profile-name">Adicionar Perfil</span>
    `;
    grid.appendChild(addBtn);
  }
}

function selectProfile(idx) {
  activeProfileIndex = idx;
  const profile = userProfiles[idx];
  
  document.getElementById('profile-selector').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  
  document.getElementById('headerAvatar').src = profile.avatar;
  document.getElementById('headerName').innerText = profile.name;

  updateNotificationIcon();
  showCatalogSection('home');
  renderMainCatalog();
  renderComingSoonCatalog();
  loadContinueWatching();
}

window.saveNewProfile = async function() {
  const nameInput = document.getElementById('newProfileName').value.trim();
  const fileInput = document.getElementById('newProfileImage').files[0];

  if (!nameInput) return alert('Por favor, digite um nome para o perfil.');

  let avatarUrl = 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png';

  if (fileInput) {
    try {
      const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}_${fileInput.name}`);
      await uploadBytes(fileRef, fileInput);
      avatarUrl = await getDownloadURL(fileRef);
    } catch (e) {
      console.error("Erro no upload da foto, usando avatar padrão:", e);
    }
  }

  const newProfile = {
    id: 'p_' + Date.now(),
    name: nameInput,
    avatar: avatarUrl,
    history: {},
    myList: []
  };

  userProfiles.push(newProfile);

  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { profiles: userProfiles });

  closeCreateProfileModal();
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileImage').value = '';
  renderProfileSelector();
};

window.syncHistoryToCloud = async function() {
  if (!currentUser || activeProfileIndex === null) return;
  userProfiles[activeProfileIndex].history = currentHistory;
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { profiles: userProfiles });
};

window.getActiveHistory = function() {
  if (activeProfileIndex === null || !userProfiles[activeProfileIndex]) return {};
  return userProfiles[activeProfileIndex].history || {};
};

function getActiveMyList() {
  if (activeProfileIndex === null || !userProfiles[activeProfileIndex]) return [];
  return userProfiles[activeProfileIndex].myList || [];
}

async function syncMyListToCloud(myList) {
  if (!currentUser || activeProfileIndex === null) return;
  userProfiles[activeProfileIndex].myList = myList;
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { profiles: userProfiles });
}

window.toggleMyList = async function() {
  if (!currentSelectedMovie) return;
  let myList = getActiveMyList();
  const index = myList.indexOf(currentSelectedMovie.id);

  if (index > -1) {
    myList.splice(index, 1);
  } else {
    myList.push(currentSelectedMovie.id);
  }

  await syncMyListToCloud(myList);
  updateMyListButtonState();
  renderMyListCatalog();
};

function updateMyListButtonState() {
  if (!currentSelectedMovie) return;
  const myList = getActiveMyList();
  const btnMyListText = document.getElementById('btnMyListText');
  if (myList.includes(currentSelectedMovie.id)) {
    btnMyListText.innerHTML = '&#10003; Na minha lista';
  } else {
    btnMyListText.innerHTML = '+ Minha Lista';
  }
}

window.showCatalogSection = function(section) {
  const homeSection = document.getElementById('homeSection');
  const myListSection = document.getElementById('myListSection');
  const comingSoonSection = document.getElementById('comingSoonSection');

  const tabHome = document.getElementById('tabHome');
  const tabMyList = document.getElementById('tabMyList');
  const tabComingSoon = document.getElementById('tabComingSoon');

  homeSection.style.display = 'none';
  myListSection.style.display = 'none';
  comingSoonSection.style.display = 'none';

  tabHome.classList.remove('active');
  tabMyList.classList.remove('active');
  tabComingSoon.classList.remove('active');

  if (section === 'myList') {
    myListSection.style.display = 'block';
    tabMyList.classList.add('active');
    renderMyListCatalog();
    closeNotificationBanner();
  } else if (section === 'comingSoon') {
    comingSoonSection.style.display = 'block';
    tabComingSoon.classList.add('active');
    renderComingSoonCatalog();
    closeNotificationBanner();
  } else {
    homeSection.style.display = 'block';
    tabHome.classList.add('active');
    loadContinueWatching();
    triggerNotificationPrompt();
  }
};

window.openCreateProfileModal = () => document.getElementById('profileModal').style.display = 'flex';
window.closeCreateProfileModal = () => document.getElementById('profileModal').style.display = 'none';
window.switchProfile = () => renderProfileSelector();

const moviesData = [
  {
    id: 'your_name',
    title: 'Your Name (Kimi no Na wa)',
    poster: 'https://chonthuonghieu.com/wp-content/uploads/2022/01/your-name-7.jpg',
    banner: 'https://4kwallpapers.com/images/wallpapers/your-name-5k-2560x1440-14943.jpg',
    match: '98% Relevância',
    year: '2016',
    age: '12+',
    duration: '1h 46m',
    badge: '4K Ultra HD',
    synopsis: 'Mitsuha é a filha do prefeito de uma pequena cidade nas montanhas. Ela é uma estudante do ensino médio que mora com sua irmã e sua avó. Taki é um estudante do ensino médio em Tóquio. Os dois não se conhecem, mas começam a trocar de corpo misteriosamente durante o sono.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/your-name-4k-uhd/Your_Name_1080p_FHD.mp4', size: '~ 1.8 GB', default: true },
      { quality: '4K Ultra HD', url: 'https://download1351.mediafire.com/0eigpbsn2ceg3Z9fteTQllXsbjCGTx9htosu2rz6JwHkWkuhZBfEgoIcj-uoIbVmxuNCQsIUMuIdWb3PnQ7vjfxN_UGkgG5tihpYnDpeJPx05U2I2iTm--y_CtEGq7taAYVzKyE6Rm9hMdOKja_JBFpNH25FFdBmmTIaggVYaIfk66-i/d60396kaf6dsq0v/Your_Name_4k_UHD.mp4', size: '~ 4.2 GB' },
      { quality: '720p HD', url: 'https://archive.org/download/your-name-4k-uhd/Your_Name_720p_HD.mp4', size: '~ 850 MB' }
    ]
  },
  {
    id: 'kotonoha_no_niwa',
    title: 'O Jardim das Palavras (Kotonoha no Niwa)',
    poster: 'https://wallpaperaccess.com/full/6044555.jpg',
    banner: 'https://wallpaperaccess.com/full/6044481.jpg',
    match: '95% Relevância',
    year: '2013',
    age: '12+',
    duration: '46m',
    badge: 'Full HD',
    synopsis: 'Takao, um jovem estudante que treina para ser sapateiro, mata aula em dias chuvosos para desenhar sapatos em um jardim no estilo japonês. Ele conhece uma mulher misteriosa, Yukino, mais velha do que ele. Sem combinar, os dois continuam a se encontrar de novo e de novo, mas apenas em dias de chuva.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/kotonoha-no-niwa-1080p-fhd/Kotonoha_no_Niwa_1080p_FHD.mp4', size: '~ 950 MB', default: true },
      { quality: '720p HD', url: 'https://archive.org/download/kotonoha-no-niwa-1080p-fhd/Kotonoha_No_Niwa_720p_HD.mp4', size: '~ 450 MB' }
    ]
  },
  {
    id: 'tenki_no_ko',
    title: 'O Tempo com Você (Tenki no Ko)',
    poster: 'https://tse2.mm.bing.net/th/id/OIP.1Zhgzvvd9gF6_7qz5oknOQHaKc?r=0&w=1500&h=2116&rs=1&pid=ImgDetMain&o=7&rm=3',
    banner: 'https://tse1.mm.bing.net/th/id/OIP.uuT56rfV2x_-z-a2M6e3LwHaEK?r=0&w=1500&h=844&rs=1&pid=ImgDetMain&o=7&rm=3',
    match: '97% Relevância',
    year: '2019',
    age: '12+',
    duration: '1h 52m',
    badge: '4K Ultra HD',
    synopsis: 'No verão de seu primeiro ano do ensino médio, Hodaka foge de sua casa em uma ilha remota para Tóquio, onde se vê rapidamente levado aos seus limites financeiros e pessoais. Em meio a dias de chuva ininterrupta na cidade, ele conhece Hina, uma garota com a habilidade misteriosa e impressionante de parar a chuva e clarear o céu.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/tenki-no-ko-1080p-fhd/Tenki_no_Ko_1080p_FHD.mp4', size: '~ 1.9 GB', default: true },
      { quality: '720p HD', url: 'https://archive.org/download/tenki-no-ko-1080p-fhd/Tenki_no_Ko_720p_HD.mp4', size: '~ 900 MB' },
      { quality: '4K Ultra HD', url: 'https://archive.org/download/tenki-no-ko-4k-uhd/Tenki_no_Ko_4k_UHD.mp4', size: '~ 4.0 GB' }
    ]
  },
  {
    id: 'kumo_no_mukou',
    title: 'O Lugar Prometido em Nossa Juventude (Kumo no Mukou, Yakusoku no Basho)',
    poster: 'https://tse3.mm.bing.net/th/id/OIP.A8aEQqqMzI4XyZCfNk6zOwHaLH?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    banner: 'https://www.joblo.com/wp-content/uploads/2026/03/the_place_promised_in_our_early_days_anime-1024x563.jpg',
    match: '92% Relevância',
    year: '2004',
    age: '12+',
    duration: '1h 30m',
    badge: 'Full HD',
    synopsis: 'Em uma história alternativa pós-guerra, o Japão foi dividido. Hiroki, Takuya e Sayako fazem uma promessa de infância: construir um avião e voar até a misteriosa torre alta construída na ilha ocupada pela União. No entanto, Sayako desaparece misteriosamente antes que o plano se concretize.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/o-lugar-prometido-em-nossa-juventude-1080p-fhd/O_Lugar_Prometido_Em_Nossa_Juventude_1080p_FHD.mp4', size: '~ 1.5 GB', default: true }
    ]
  },
  {
    id: 'byousoku_5_centimeter',
    title: '5 Centímetros por Segundo (Byousoku 5 Centimeter)',
    poster: 'https://tse4.mm.bing.net/th/id/OIP.xlcfnUBucrOz4xi0ttpAFgHaKe?r=0&rs=1&pid=ImgDetMain&o=7&rm=3',
    banner: 'https://wallpapers.com/images/hd/makoto-shinkai-5cm-per-second-romantic-anime-a7fyki1lmdzm8c8m.jpg',
    match: '94% Relevância',
    year: '2007',
    age: '10+',
    duration: '1h 03m',
    badge: 'Full HD',
    synopsis: 'Dividido em três partes, o filme conta a história de Takaki Tono e sua amiga de infância Akari Shinohara. À medida que o tempo passa e a distância física entre eles aumenta por causa das mudanças de suas famílias, a conexão afetiva entre os dois é testada sob o efeito inexorável do tempo.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/5-centimetros-por-segundo-1080-p-fhd/5%20Cent%C3%ADmetros%20Por%20Segundo%201080P%20Fhd.mp4', size: '~ 1.2 GB', default: true },
      { quality: '720p HD', url: 'https://archive.org/download/5-centimetros-por-segundo-1080-p-fhd/5%20Cent%C3%ADmetros%20Por%20Segundo%20720P%20Hd.mp4', size: '~ 600 MB' }
    ]
  }
];

const comingSoonData = [
  {
    id: 'rascal_dreaming_girl',
    title: 'Rascal Does Not Dream of a Dreaming Girl',
    poster: 'https://cdn.sinemalar.com/images/movie/281745/poster/rascal-does-not-dream-of-a-dreaming-girl-1681869118.jpg',
    banner: 'https://is2-ssl.mzstatic.com/image/thumb/Ovpc47k2QZAjktK2GQQRYA/1200x675.jpg',
    match: '99% Relevância',
    year: 'Em Breve',
    age: '12+',
    duration: '1h 30m',
    badge: 'Full HD',
    isComingSoon: true,
    synopsis: 'Em Fujisawa, Sakuta Azusagawa está em seu segundo ano do ensino médio. Seus dias felizes com Mai Sakurajima são interrompidos pelo aparecimento de sua primeira paixão, Shoko Makinohara.',
    sources: []
  },
  {
    id: 'rascal_sister_venturing_out',
    title: 'Rascal Does Not Dream of a Sister Venturing Out',
    poster: 'https://images.justwatch.com/poster/307622904/s718/rascal-does-not-dream-of-a-sister-venturing-out.jpg',
    banner: 'https://is1-ssl.mzstatic.com/image/thumb/01fmauw1HUb9DU-VUl-kJg/1200x675.jpg',
    match: '98% Relevância',
    year: 'Em Breve',
    age: '12+',
    duration: '1h 13m',
    badge: 'Full HD',
    isComingSoon: true,
    synopsis: 'Após um inverno de estresse em relação ao seu futuro, Kaede decide expressar seu desejo de frequentar o mesmo ensino médio de seu irmão Sakuta.',
    sources: []
  },
  {
    id: 'rascal_knapsack_kid',
    title: 'Rascal Does Not Dream of a Knapsack Kid',
    poster: 'https://animotaku.fr/wp-content/uploads/2023/06/film-rascal-does-not-dream-of-a-knapsack-girl-visuel-1.jpeg',
    banner: 'https://is1-ssl.mzstatic.com/image/thumb/_hQ5fSYwAEOE14pN2tC0mw/1200x675.jpg',
    match: '98% Relevância',
    year: 'Em Breve',
    age: '12+',
    duration: '1h 15m',
    badge: 'Full HD',
    isComingSoon: true,
    synopsis: 'Finalmente chegou o dia da formatura do ensino médio de Mai. Enquanto Sakuta espera por sua namorada, uma garota do primário que se parece exatamente com ela aparece diante dele.',
    sources: []
  }
];

function renderMainCatalog() {
  const mainCatalog = document.getElementById('mainCatalog');
  mainCatalog.innerHTML = '';

  moviesData.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(movie.id);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <div class="movie-card-title">${movie.title}</div>
    `;
    mainCatalog.appendChild(card);
  });
}

function renderMyListCatalog() {
  const myListCatalog = document.getElementById('myListCatalog');
  myListCatalog.innerHTML = '';

  const myList = getActiveMyList();
  const allMovies = [...moviesData, ...comingSoonData];
  const listMovies = allMovies.filter(m => myList.includes(m.id));

  if (listMovies.length === 0) {
    myListCatalog.innerHTML = `<div style="color: #aaa; font-size: 14px; grid-column: 1 / -1;">Sua lista está vazia. Adicione filmes clicando no botão "+ Minha Lista".</div>`;
    return;
  }

  listMovies.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(movie.id);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <div class="movie-card-title">${movie.title} ${movie.isComingSoon ? '<span style="color: #E50914; font-size: 11px;">(Em Breve)</span>' : ''}</div>
    `;
    myListCatalog.appendChild(card);
  });
}

function renderComingSoonCatalog() {
  const comingSoonCatalog = document.getElementById('comingSoonCatalog');
  if (!comingSoonCatalog) return;
  comingSoonCatalog.innerHTML = '';

  comingSoonData.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(movie.id);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <div class="movie-card-title">${movie.title}</div>
    `;
    comingSoonCatalog.appendChild(card);
  });
}

window.openModal = function(movieId) {
  currentSelectedMovie = moviesData.find(m => m.id === movieId) || comingSoonData.find(m => m.id === movieId);
  if (!currentSelectedMovie) return;

  document.getElementById('modalBanner').style.backgroundImage = `url('${currentSelectedMovie.banner}')`;
  document.getElementById('modalTitle').innerText = currentSelectedMovie.title;
  document.getElementById('modalSynopsis').innerText = currentSelectedMovie.synopsis;

  document.getElementById('modalMeta').innerHTML = `
    <span class="match">${currentSelectedMovie.match}</span>
    <span>${currentSelectedMovie.year}</span>
    <span class="badge">${currentSelectedMovie.age}</span>
    <span>${currentSelectedMovie.duration}</span>
    <span class="badge">${currentSelectedMovie.badge}</span>
  `;

  const btnWatchText = document.getElementById('btnWatchText');
  const btnWatch = btnWatchText ? btnWatchText.closest('button') : null;
  const btnDownload = document.getElementById('btnDownload') || document.querySelector('.download-container');
  const btnRestart = document.getElementById('btnRestart');
  const downloadMenu = document.getElementById('downloadMenu');

  if (currentSelectedMovie.isComingSoon) {
    if (btnWatch) btnWatch.style.display = 'none';
    if (btnDownload) btnDownload.style.display = 'none';
    if (btnRestart) btnRestart.style.display = 'none';
    if (downloadMenu) downloadMenu.style.display = 'none';
  } else {
    if (btnWatch) btnWatch.style.display = 'inline-flex';
    if (btnDownload) btnDownload.style.display = 'inline-flex';
    
    if (downloadMenu) {
      downloadMenu.innerHTML = '';
      currentSelectedMovie.sources.forEach(src => {
        if (src.url && src.url !== '#') {
          const item = document.createElement('a');
          item.className = 'download-item';
          item.href = src.url;
          item.download = `${currentSelectedMovie.title}_${src.quality}.mp4`;
          item.innerHTML = `
            <span><b>${src.quality}</b></span>
            <span style="font-size:12px; color:#aaa;">${src.size}</span>
          `;
          downloadMenu.appendChild(item);
        }
      });
      downloadMenu.style.display = 'none';
    }

    currentHistory = window.getActiveHistory();
    const savedHistory = currentHistory[currentSelectedMovie.id];

    if (savedHistory) {
      if (btnWatchText) btnWatchText.innerHTML = '&#9654; Continuar Assistindo';
      if (btnRestart) btnRestart.style.display = 'inline-flex';
    } else {
      if (btnWatchText) btnWatchText.innerHTML = '&#9654; Assistir';
      if (btnRestart) btnRestart.style.display = 'none';
    }
  }

  closeSearchDropdown();
  updateMyListButtonState();
  document.getElementById('movieModal').style.display = 'flex';
};

window.closeModal = function() {
  document.getElementById('movieModal').style.display = 'none';
};

window.toggleDownloadMenu = function() {
  const menu = document.getElementById('downloadMenu');
  if (currentSelectedMovie && currentSelectedMovie.isComingSoon) {
    if (menu) menu.style.display = 'none';
    return;
  }
  if (menu) {
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  }
};

const playerView = document.getElementById('playerView');
const playerControls = document.getElementById('playerControls');
const player = document.getElementById('videoPlayer');
const source = document.getElementById('videoSource');
const select = document.getElementById('qualitySelect');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnCenterPlayPause = document.getElementById('btnCenterPlayPause');
const btnMute = document.getElementById('btnMute');
const volumeBar = document.getElementById('volumeBar');
const playerSeek = document.getElementById('playerSeek');
const timeDisplay = document.getElementById('timeDisplay');

function showControlsTemporarily() {
  playerControls.classList.remove('hidden');
  clearTimeout(controlsTimeout);
  controlsTimeout = setTimeout(() => {
    if (!player.paused) {
      playerControls.classList.add('hidden');
    }
  }, 3000);
}

playerView.addEventListener('mousemove', showControlsTemporarily);

let lastTapTime = 0;
let tapTimeout = null;

playerControls.addEventListener('click', (e) => {
  if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
    return;
  }

  const currentTime = new Date().getTime();
  const tapLength = currentTime - lastTapTime;
  const rect = playerView.getBoundingClientRect();
  const clickX = e.clientX - rect.left;

  clearTimeout(tapTimeout);

  if (tapLength < 300 && tapLength > 0) {
    if (clickX < rect.width / 2) {
      player.currentTime = Math.max(0, player.currentTime - 10);
      showTapIndicator('left');
    } else {
      player.currentTime = Math.min(player.duration, player.currentTime + 10);
      showTapIndicator('right');
    }
  } else {
    tapTimeout = setTimeout(() => {
      if (playerControls.classList.contains('hidden')) {
        showControlsTemporarily();
      } else {
        playerControls.classList.add('hidden');
      }
    }, 300);
  }
  lastTapTime = currentTime;
});

function showTapIndicator(side) {
  const overlay = side === 'left' ? document.getElementById('tapOverlayLeft') : document.getElementById('tapOverlayRight');
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 600);
}

window.addEventListener('keydown', (e) => {
  if (playerView.style.display === 'block') {
    if (e.code === 'Space' || e.code === 'KeyK') {
      e.preventDefault();
      togglePlayPause();
      showControlsTemporarily();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      toggleMute();
      showControlsTemporarily();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      player.currentTime = Math.min(player.duration, player.currentTime + 10);
      showControlsTemporarily();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      player.currentTime = Math.max(0, player.currentTime - 10);
      showControlsTemporarily();
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      changeVolume(Math.min(1, player.volume + 0.1));
      volumeBar.value = player.volume;
      showControlsTemporarily();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      changeVolume(Math.max(0, player.volume - 0.1));
      volumeBar.value = player.volume;
      showControlsTemporarily();
    }
  }
});

window.handleWatchClick = function() {
  if (!currentSelectedMovie || currentSelectedMovie.isComingSoon) return;
  const validSources = currentSelectedMovie.sources.filter(s => s.url && s.url !== '#');
  if (validSources.length === 0) {
    alert('Este filme ainda não possui um vídeo disponível para reprodução.');
    return;
  }
  currentHistory = window.getActiveHistory();
  const saved = currentHistory[currentSelectedMovie.id];
  if (saved) {
    startStreaming(currentSelectedMovie, saved.time, saved.quality);
  } else {
    const defaultSource = validSources.find(s => s.default) || validSources[0];
    startStreaming(currentSelectedMovie, 0, defaultSource.url);
  }
};

window.restartMovie = function() {
  if (!currentSelectedMovie || currentSelectedMovie.isComingSoon) return;
  const validSources = currentSelectedMovie.sources.filter(s => s.url && s.url !== '#');
  if (validSources.length === 0) return;
  const defaultSource = validSources.find(s => s.default) || validSources[0];
  startStreaming(currentSelectedMovie, 0, defaultSource.url);
};

function startStreaming(movie, savedTime = 0, savedQualityUrl = null) {
  currentSelectedMovie = movie;
  closeModal();
  closeSearchDropdown();

  document.getElementById('playerMovieTitle').innerText = movie.title;
  
  select.innerHTML = '';
  const validSources = movie.sources.filter(s => s.url && s.url !== '#');
  validSources.forEach(src => {
    const option = document.createElement('option');
    option.value = src.url;
    option.innerText = src.quality;
    if (src.url === savedQualityUrl || (src.default && !savedQualityUrl)) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  const activeUrl = select.value || validSources[0].url;
  source.src = activeUrl;
  player.load();

  document.getElementById('playerView').style.display = 'block';

  player.currentTime = savedTime;
  player.play().then(() => {
    updatePlayPauseState(false);
  }).catch(() => {
    updatePlayPauseState(true);
  });

  showControlsTemporarily();
}

window.closePlayer = function() {
  player.pause();
  saveProgress();
  document.getElementById('playerView').style.display = 'none';
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  loadContinueWatching();
};

function updatePlayPauseState(isPaused) {
  if (isPaused) {
    btnPlayPause.innerHTML = '&#9654;';
    btnCenterPlayPause.innerHTML = '&#9654;';
  } else {
    btnPlayPause.innerHTML = '&#10074;&#10074;';
    btnCenterPlayPause.innerHTML = '&#10074;&#10074;';
  }
}

window.togglePlayPause = function() {
  if (player.paused) {
    player.play();
    updatePlayPauseState(false);
  } else {
    player.pause();
    updatePlayPauseState(true);
  }
};

window.toggleMute = function() {
  player.muted = !player.muted;
  btnMute.innerHTML = player.muted ? svgSoundMute : svgSoundOn;
};

window.changeVolume = function(val) {
  player.volume = val;
  player.muted = (val === 0 || val === "0");
  btnMute.innerHTML = player.muted ? svgSoundMute : svgSoundOn;
};

window.seekVideo = function(val) {
  if (!player.duration) return;
  player.currentTime = (val / 100) * player.duration;
};

window.toggleFullscreen = function() {
  if (!document.fullscreenElement) {
    playerView.requestFullscreen().catch(err => alert(err.message));
  } else {
    document.exitFullscreen();
  }
};

function formatTime(sec) {
  if (isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

player.addEventListener('ended', () => {
  removeMovieFromHistory(currentSelectedMovie.id);
  closePlayer();
});

player.addEventListener('timeupdate', () => {
  if (player.duration) {
    const percentage = (player.currentTime / player.duration) * 100;
    playerSeek.value = percentage;
    timeDisplay.innerText = `${formatTime(player.currentTime)} / ${formatTime(player.duration)}`;
  }
  if (player.currentTime > 0) {
    saveProgress();
  }
});

function saveProgress() {
  if (!player.duration || !currentSelectedMovie) return;

  if (player.duration - player.currentTime <= 10) {
    removeMovieFromHistory(currentSelectedMovie.id);
    return;
  }

  currentHistory[currentSelectedMovie.id] = {
    id: currentSelectedMovie.id,
    title: currentSelectedMovie.title,
    poster: currentSelectedMovie.poster,
    time: player.currentTime,
    duration: player.duration,
    quality: select.value
  };

  window.syncHistoryToCloud();
}

function removeMovieFromHistory(movieId) {
  if (currentHistory[movieId]) {
    delete currentHistory[movieId];
    window.syncHistoryToCloud();
  }
}

function loadContinueWatching() {
  currentHistory = window.getActiveHistory();
  const continueSection = document.getElementById('continueSection');
  const continueCatalog = document.getElementById('continueCatalog');

  continueCatalog.innerHTML = '';
  const keys = Object.keys(currentHistory);

  if (keys.length === 0) {
    continueSection.style.display = 'none';
    return;
  }

  keys.forEach(key => {
    const data = currentHistory[key];
    const movieObj = moviesData.find(m => m.id === data.id);
    if (!movieObj) return;

    const percentage = (data.time / data.duration) * 100;
    const remainingSeconds = Math.max(0, data.duration - data.time);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => startStreaming(movieObj, data.time, data.quality);
    card.innerHTML = `
      <img src="${data.poster}" alt="${data.title}">
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
      <div class="movie-card-title">${data.title}</div>
      <div class="remaining-time">Faltam ${remainingMinutes} min</div>
    `;
    continueCatalog.appendChild(card);
  });

  continueSection.style.display = 'block';
}

window.changeQuality = function() {
  const currentTime = player.currentTime;
  const isPaused = player.paused;

  source.src = select.value;
  player.load();
  player.currentTime = currentTime;

  if (!isPaused) player.play();
  saveProgress();
};

window.searchMovies = function() {
  const input = document.getElementById('searchInput').value.trim().toLowerCase();
  const dropdown = document.getElementById('searchResultsDropdown');

  if (input === '') {
    closeSearchDropdown();
    return;
  }

  const allMovies = [...moviesData, ...comingSoonData];
  const results = allMovies.filter(movie => movie.title.toLowerCase().includes(input));
  dropdown.innerHTML = '';

  if (results.length > 0) {
    results.forEach(movie => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.onclick = () => openModal(movie.id);
      item.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title}">
        <span class="search-result-title">${movie.title}</span>
      `;
      dropdown.appendChild(item);
    });
  } else {
    dropdown.innerHTML = `<div style="text-align:center; padding:15px; color:#aaa; font-size:13px;">Nenhum filme encontrado</div>`;
  }

  dropdown.style.display = 'block';
};

function closeSearchDropdown() {
  const dropdown = document.getElementById('searchResultsDropdown');
  if (dropdown) dropdown.style.display = 'none';
}

window.onclick = function(event) {
  const modal = document.getElementById('movieModal');
  if (event.target === modal) closeModal();
  if (!event.target.closest('.search-container')) {
    closeSearchDropdown();
  }
};