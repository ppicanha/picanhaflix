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
let recommendedMovie = null;
let currentHistory = {};
let controlsTimeout = null;
let notificationTimeout = null;
let recommendationInterval = null;
let isManageProfilesMode = false;
let editingProfileIndex = null;

// Ícones SVG
const svgSoundOn = `<svg class="icon-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const svgSoundMute = `<svg class="icon-svg" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

// Changelog
const CHANGELOG_DATA = [
  {
    version: "v2.2.0",
    date: "19 de Setembro, 2026",
    changes: [
      "Aba dedicada de Coleção adicionada ao invés de janela pop-up."
    ]
  },
  {
    version: "v2.1.0",
    date: "19 de Setembro, 2026",
    changes: [
      "Adicionada a seção de Coleções no catálogo inicial (Makoto Shinkai, Demon Slayer e Rascal Does Not Dream).",
      "Ícone de logs movido de forma fixa e centralizada para o final da página Inicial."
    ]
  },
  {
    version: "v2.0.0",
    date: "18 de Setembro, 2026",
    changes: [
      "Ícones de notificações e logs movidos para a tela de seleção de perfil.",
      "Layout do catálogo ajustado para carrossel/deslize lateral em todas as seções."
    ]
  }
];

const LATEST_VERSION = CHANGELOG_DATA[0].version;

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
  navigator.serviceWorker.register('/picanhaflix/sw.js', { scope: '/picanhaflix/' })
    .then(registration => {
      registration.update();
    })
    .catch(err => console.error('Erro SW:', err));
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
    alert("Notificações desativadas.");
  } else {
    if (!("Notification" in window)) {
      alert("Seu navegador não suporta notificações.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem("notificationsEnabled", "true");
      closeNotificationBanner();
      sendSystemNotification("PicanhaFlix", "Notificações ativadas com sucesso!");
    } else {
      localStorage.setItem("notificationsEnabled", "false");
      alert("Permissão negada.");
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

      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "BOJurSsMJ8gwr3vXtaknMu2zrC_D-CxiEMKuBMGYn2Ey6LXVIGjKpjuXjd8y5_Cq7irmZCtwDzPj_0eUFATNZRQ"
      });

      if (currentUser) {
        await setDoc(doc(db, "push_subscriptions", currentUser.uid), subscription.toJSON());
      }

      sendSystemNotification("PicanhaFlix", "Notificações ativadas!");
      return;
    }
  }
  alert("Não foi possível ativar as notificações.");
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

  localStorage.setItem("lastSeenChangelog", LATEST_VERSION);
  checkChangelogBadge();

  modal.style.display = "flex";
  modal.style.zIndex = "9999";
};

window.closeChangelogModal = function () {
  const modal = document.getElementById("changelogModal");
  if (modal) modal.style.display = "none";

  if (activeProfileIndex === null) {
    const profileSelector = document.getElementById('profile-selector');
    const mainApp = document.getElementById('main-app');
    
    if (profileSelector) profileSelector.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
  }
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

  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    const menuIcon = menuBtn.querySelector('i');
    menuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      if (navLinks.classList.contains('active')) {
        menuIcon.classList.remove('fa-bars');
        menuIcon.classList.add('fa-xmark');
      } else {
        menuIcon.classList.remove('fa-xmark');
        menuIcon.classList.add('fa-bars');
      }
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuIcon.classList.remove('fa-xmark');
        menuIcon.classList.add('fa-bars');
      });
    });
  }
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
      myList: [],
      likes: []
    }];
    await setDoc(userRef, { profiles: userProfiles });
  }

  renderProfileSelector();
}

function renderProfileSelector() {
  document.getElementById('profile-selector').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  
  checkChangelogBadge();
  updateNotificationIcon();

  const grid = document.getElementById('profilesGrid');
  grid.innerHTML = '';

  const btnManage = document.getElementById('btnManageProfiles');
  if (btnManage) {
    btnManage.innerText = isManageProfilesMode ? "Concluído" : "Gerenciar Perfis";
  }

  userProfiles.forEach((profile, idx) => {
    const card = document.createElement('div');
    card.className = `profile-card ${isManageProfilesMode ? 'edit-mode' : ''}`;
    
    card.onclick = () => {
      if (isManageProfilesMode) {
        openEditProfileModal(idx);
      } else {
        selectProfile(idx);
      }
    };

    card.innerHTML = `
      <div class="profile-avatar-container">
        <img src="${profile.avatar}" class="profile-avatar">
        ${isManageProfilesMode ? '<div class="profile-edit-icon">&#9998;</div>' : ''}
      </div>
      <span class="profile-name">${profile.name}</span>
    `;
    grid.appendChild(card);
  });

  if (!isManageProfilesMode && userProfiles.length < 6) {
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

window.toggleManageProfiles = function() {
  isManageProfilesMode = !isManageProfilesMode;
  renderProfileSelector();
};

function selectProfile(idx) {
  activeProfileIndex = idx;
  const profile = userProfiles[idx];
  
  document.getElementById('profile-selector').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  
  document.getElementById('headerAvatar').src = profile.avatar;
  document.getElementById('headerName').innerText = profile.name;

  showCatalogSection('home');
  renderMainCatalog();
  renderCollectionsCatalog();
  renderComingSoonCatalog();
  loadContinueWatching();
  initRecommendationSystem();
}

window.openCreateProfileModal = () => document.getElementById('profileModal').style.display = 'flex';
window.closeCreateProfileModal = () => document.getElementById('profileModal').style.display = 'none';

window.openEditProfileModal = (idx) => {
  editingProfileIndex = idx;
  const profile = userProfiles[idx];
  document.getElementById('editProfileName').value = profile.name;
  document.getElementById('editProfileModal').style.display = 'flex';
};

window.closeEditProfileModal = () => {
  document.getElementById('editProfileModal').style.display = 'none';
  editingProfileIndex = null;
};

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
    myList: [],
    likes: []
  };

  userProfiles.push(newProfile);

  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { profiles: userProfiles });

  closeCreateProfileModal();
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileImage').value = '';
  renderProfileSelector();
};

window.saveEditedProfile = async function() {
  if (editingProfileIndex === null) return;

  const nameInput = document.getElementById('editProfileName').value.trim();
  const fileInput = document.getElementById('editProfileImage').files[0];

  if (!nameInput) return alert('Por favor, digite um nome para o perfil.');

  let avatarUrl = userProfiles[editingProfileIndex].avatar;

  if (fileInput) {
    try {
      const fileRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}_${fileInput.name}`);
      await uploadBytes(fileRef, fileInput);
      avatarUrl = await getDownloadURL(fileRef);
    } catch (e) {
      console.error("Erro ao atualizar foto do perfil:", e);
    }
  }

  userProfiles[editingProfileIndex].name = nameInput;
  userProfiles[editingProfileIndex].avatar = avatarUrl;

  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { profiles: userProfiles });

  closeEditProfileModal();
  renderProfileSelector();
};

window.deleteProfile = async function() {
  if (editingProfileIndex === null) return;

  if (userProfiles.length <= 1) {
    return alert("Sua conta precisa ter pelo menos um perfil.");
  }

  if (confirm("Tem certeza que deseja excluir este perfil?")) {
    userProfiles.splice(editingProfileIndex, 1);
    
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { profiles: userProfiles });

    closeEditProfileModal();
    renderProfileSelector();
  }
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

function getActiveLikes() {
  if (activeProfileIndex === null || !userProfiles[activeProfileIndex]) return [];
  return userProfiles[activeProfileIndex].likes || [];
}

async function syncMyListToCloud(myList) {
  if (!currentUser || activeProfileIndex === null) return;
  userProfiles[activeProfileIndex].myList = myList;
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { profiles: userProfiles });
}

async function syncLikesToCloud(likes) {
  if (!currentUser || activeProfileIndex === null) return;
  userProfiles[activeProfileIndex].likes = likes;
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
  const inList = myList.includes(currentSelectedMovie.id);

  const btnMobile = document.getElementById('btnMyListIcon');
  const btnPc = document.getElementById('btnMyListIconPc');

  const iconClass = inList ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>';

  if (btnMobile) {
    btnMobile.innerHTML = iconClass;
    if (inList) btnMobile.classList.add('active'); else btnMobile.classList.remove('active');
  }

  if (btnPc) {
    btnPc.innerHTML = iconClass;
    if (inList) btnPc.classList.add('active'); else btnPc.classList.remove('active');
  }
}

window.toggleLikeMovie = async function() {
  if (!currentSelectedMovie) return;
  let likes = getActiveLikes();
  const index = likes.indexOf(currentSelectedMovie.id);

  if (index > -1) {
    likes.splice(index, 1);
  } else {
    likes.push(currentSelectedMovie.id);
  }

  await syncLikesToCloud(likes);
  updateLikeButtonState();
};

function updateLikeButtonState() {
  if (!currentSelectedMovie) return;
  const likes = getActiveLikes();
  const isLiked = likes.includes(currentSelectedMovie.id);

  const btnMobile = document.getElementById('btnLikeIcon');
  const btnPc = document.getElementById('btnLikeIconPc');

  const iconClass = isLiked ? '<i class="fa-solid fa-thumbs-up"></i>' : '<i class="fa-regular fa-thumbs-up"></i>';

  if (btnMobile) {
    btnMobile.innerHTML = iconClass;
    if (isLiked) btnMobile.classList.add('active'); else btnMobile.classList.remove('active');
  }

  if (btnPc) {
    btnPc.innerHTML = iconClass;
    if (isLiked) btnPc.classList.add('active'); else btnPc.classList.remove('active');
  }
}

window.showCatalogSection = function(section) {
  const homeSection = document.getElementById('homeSection');
  const singleCollectionSection = document.getElementById('singleCollectionSection');
  const myListSection = document.getElementById('myListSection');
  const comingSoonSection = document.getElementById('comingSoonSection');
  const suggestionsSection = document.getElementById('suggestionsSection');
  const mobileMoviePage = document.getElementById('mobileMoviePage');

  const tabHome = document.getElementById('tabHome');
  const tabMyList = document.getElementById('tabMyList');
  const tabComingSoon = document.getElementById('tabComingSoon');
  const tabSuggestions = document.getElementById('tabSuggestions');

  homeSection.style.display = 'none';
  if (singleCollectionSection) singleCollectionSection.style.display = 'none';
  myListSection.style.display = 'none';
  comingSoonSection.style.display = 'none';
  if (suggestionsSection) suggestionsSection.style.display = 'none';
  if (mobileMoviePage) mobileMoviePage.style.display = 'none';

  tabHome.classList.remove('active');
  tabMyList.classList.remove('active');
  tabComingSoon.classList.remove('active');
  if (tabSuggestions) tabSuggestions.classList.remove('active');

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
  } else if (section === 'suggestions') {
    if (suggestionsSection) suggestionsSection.style.display = 'block';
    if (tabSuggestions) tabSuggestions.classList.add('active');
    closeNotificationBanner();
  } else {
    homeSection.style.display = 'block';
    tabHome.classList.add('active');
    loadContinueWatching();
    triggerNotificationPrompt();
  }
};

window.toggleSubtitleOption = function() {
  const audioVal = document.getElementById('suggestionAudio').value;
  const ptSubtitleGroup = document.getElementById('ptSubtitleGroup');
  const ptSubtitleSelect = document.getElementById('suggestionPtSubtitle');

  if (audioVal === 'Legendado') {
    ptSubtitleGroup.style.display = 'block';
    ptSubtitleSelect.required = true;
  } else {
    ptSubtitleGroup.style.display = 'none';
    ptSubtitleSelect.required = false;
    ptSubtitleSelect.value = '';
  }
};

window.sendSuggestion = async function(event) {
  event.preventDefault();

  const movieName = document.getElementById('suggestionName').value.trim();
  const movieAudio = document.getElementById('suggestionAudio').value;
  const moviePtSubtitle = document.getElementById('suggestionPtSubtitle').value;
  const movieDetails = document.getElementById('suggestionDetails').value.trim();
  const fileInput = document.getElementById('suggestionImage').files[0];
  const btnSubmit = document.getElementById('btnSubmitSuggestion');

  if (!movieName) {
    alert("Por favor, digite o nome do filme.");
    return;
  }

  if (!movieAudio) {
    alert("Por favor, selecione se o filme é Legendado ou Dublado.");
    return;
  }

  if (movieAudio === 'Legendado' && !moviePtSubtitle) {
    alert("Por favor, informe se o filme tem legendas em Português(Brasileiro).");
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.innerText = "Enviando...";

  try {
    const formData = new FormData();
    formData.append("Filme Sugerido", movieName);
    formData.append("Tipo de Áudio", movieAudio);
    if (movieAudio === 'Legendado') {
      formData.append("Legendas PT-BR", moviePtSubtitle);
    }
    formData.append("Observações", movieDetails || "Nenhuma observação informada");
    formData.append("Usuário", currentUser ? currentUser.email : "Anônimo");
    formData.append("_subject", `Nova Sugestão de Filme: ${movieName}`);
    formData.append("_template", "table");
    formData.append("_captcha", "false");

    if (fileInput) {
      formData.append("Anexo/Poster", fileInput);
    }

    const response = await fetch("https://formsubmit.co/ajax/microfonedepedro1@gmail.com", {
      method: "POST",
      body: formData
    });

    if (response.ok) {
      alert("Sua sugestão foi enviada com sucesso! Muito obrigado.");
      document.getElementById('suggestionForm').reset();
      window.toggleSubtitleOption();
    } else {
      alert("Houve um erro ao enviar sua sugestão. Tente novamente em instantes.");
    }
  } catch (err) {
    console.error("Erro ao enviar sugestão:", err);
    alert("Erro de conexão ao enviar a sugestão.");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerText = "Enviar Sugestão";
  }
};

window.switchProfile = () => {
  activeProfileIndex = null;
  isManageProfilesMode = false;
  renderProfileSelector();
};

const moviesData = [
  {
    id: 'demon_slayer_mugen_train',
    title: 'Demon Slayer: Trem Infinito',
    poster: 'https://wallpaperaccess.com/full/5627712.jpg',
    banner: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjkgKXqXDOh7Bbj66lo687kXiCqLXSUJH66rM83c-h_X9a0Pnj9d-QvljbXbcNa_6bJiFhmDTS_K4RegdSAp9x_OhVlj4_ORjTYALWkYQhbB51QKeRgJr64HJ7eGWcUdhXulNJoCY7MsdLGqVk9OmGMQ1OH22xaG80P1gXcmLCY4floRRXrFlGt0awddR_x/s3840/demon-slayer-mugen-train-capa.jpg',
    match: '99% Relevância',
    year: '2020',
    age: '16+',
    duration: '1h 57m',
    badge: 'Full HD',
    synopsis: 'Tanjiro Kamado e seus amigos da Corporação de Caçadores de Demônios acompanham o Pilar das Chamas, Kyojuro Rengoku, para investigar uma série de desaparecimentos misteriosos a bordo do Trem Infinito.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/demon-slayer-castelo-infinito-part-1-1080p-edit/Demon_Slayer_Mugen_Train_1080p_Edit.mkv', size: '~ 2.1 GB', default: true }
    ]
  },
  {
    id: 'demon_slayer_infinity_castle_1',
    title: 'Demon Slayer: Castelo Infinito Part.1',
    poster: 'https://teoriageek.com.br/wp-content/uploads/2025/09/Poster-1.jpg',
    banner: 'https://img.odcdn.com.br/wp-content/uploads/2025/09/demon-slayer-castelo-infinito-1920x1080.jpg',
    match: '99% Relevância',
    year: '2025',
    age: '16+',
    duration: '2h 35m',
    badge: 'Full HD',
    synopsis: 'A batalha final contra Muzan Kibutsuji começa no traiçoeiro Castelo Infinito. Os Caçadores de Demônios enfrentam os membros mais poderosos das Luas Superiores em uma luta decisiva pela sobrevivência da humanidade.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/demon-slayer-castelo-infinito-part-1-1080p-edit/Demon_Slayer_Castelo_Infinito_Part1_1080p_Edit.mkv', size: '~ 2.8 GB', default: true }
    ]
  },
  {
    id: 'rascal_dreaming_girl',
    title: 'Rascal Does Not Dream of a Dreaming Girl',
    poster: 'https://cdn.sinemalar.com/images/movie/281745/poster/rascal-does-not-dream-of-a-dreaming-girl-1681869118.jpg',
    banner: 'https://is2-ssl.mzstatic.com/image/thumb/Ovpc47k2QZAjktK2GQQRYA/1200x675.jpg',
    match: '99% Relevância',
    year: '2019',
    age: '12+',
    duration: '1h 30m',
    badge: 'Full HD',
    synopsis: 'Em Fujisawa, Sakuta Azusagawa está em seu segundo ano do ensino médio. Seus dias felizes com Mai Sakurajima são interrompidos pelo aparecimento de sua primeira paixão, Shoko Makinohara.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/rascal-does-not-dream-of-a-dreaming-girl-1080-p-edit/Rascal_Does_Not_Dream_Of_A_Dreaming_Girl_1080P_Edit.mp4', size: '~ 1.8 GB', default: true },
      { quality: '720p HD', url: 'https://archive.org/download/rascal-does-not-dream-of-a-dreaming-girl-1080-p-edit/Rascal_Does_Not_Dream_Of_A_Dreaming_Girl_720P_Edit.mp4', size: '~ 900 MB' }
    ]
  },
  {
    id: 'rascal_sister_venturing_out',
    title: 'Rascal Does Not Dream of a Sister Venturing Out',
    poster: 'https://images.justwatch.com/poster/307622904/s718/rascal-does-not-dream-of-a-sister-venturing-out.jpg',
    banner: 'https://is1-ssl.mzstatic.com/image/thumb/01fmauw1HUb9DU-VUl-kJg/1200x675.jpg',
    match: '98% Relevância',
    year: '2023',
    age: '12+',
    duration: '1h 13m',
    badge: 'Full HD',
    synopsis: 'Após um inverno de estresse em relação ao seu futuro, Kaede decide expressar seu desejo de frequentar o mesmo ensino médio de seu irmão Sakuta.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/rascal-does-not-dream-of-a-dreaming-girl-1080-p-edit/Rascal_Does_Not_Dream_Of_A_Sister_Venturing_Out_1080P_Edit.mp4', size: '~ 1.5 GB', default: true }
    ]
  },
  {
    id: 'rascal_knapsack_kid',
    title: 'Rascal Does Not Dream of a Knapsack Kid',
    poster: 'https://animotaku.fr/wp-content/uploads/2023/06/film-rascal-does-not-dream-of-a-knapsack-girl-visuel-1.jpeg',
    banner: 'https://is1-ssl.mzstatic.com/image/thumb/_hQ5fSYwAEOE14pN2tC0mw/1200x675.jpg',
    match: '98% Relevância',
    year: '2023',
    age: '12+',
    duration: '1h 15m',
    badge: 'Full HD',
    synopsis: 'Finalmente chegou o dia da formatura do ensino médio de Mai. Enquanto Sakuta espera por sua namorada, uma garota do primário que se parece exatamente com ela aparece diante dele.',
    sources: [
      { quality: '1080p Full HD', url: 'https://archive.org/download/rascal-does-not-dream-of-a-dreaming-girl-1080-p-edit/Rascal_Does_Not_Dream_Of_A_Knapsack_Kid_1080P_Edit.mp4', size: '~ 1.5 GB', default: true }
    ]
  },
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
      { quality: '1080p Full HD', url: 'https://archive.org/download/5-centimetros-por-segundo-720p/5_Centimetros_por_Segundo_720p.mp4', size: '~ 1.2 GB', default: true },
      { quality: '720p HD', url: 'https://archive.org/download/5-centimetros-por-segundo-720p/5_Centimetros_por_Segundo_1080p.mp4', size: '~ 600 MB' }
    ]
  }
];

const comingSoonData = [
  {
    id: 'suzume',
    title: 'Suzume (Suzume no Tojimari)',
    poster: 'https://res.cloudinary.com/jnto/image/upload/w_2006,h_2838,c_fill,f_auto,fl_lossy,q_60/v1/media/filer_public/d0/bb/d0bb19b5-3bb8-4e16-9e93-4baedaf3136d/suzume_fint6z',
    banner: 'https://images5.alphacoders.com/119/1198137.jpg',
    match: '98% Relevância',
    year: '2022',
    age: '12+',
    duration: '2h 02m',
    badge: 'Em Breve',
    isComingSoon: true,
    synopsis: 'Suzume, uma garota de 17 anos que mora em uma cidade pacata em Kyushu, conhece um jovem viajante em busca de uma porta. Ao segui-lo até as ruínas nas montanhas, ela encontra uma porta antiga e, ao abri-la, desencadeia portais de destruição por todo o Japão. Agora, Suzume precisa embarcar em uma jornada para fechar essas portas e evitar desastres iminentes.',
    sources: []
  }
];

// Dados das Coleções
const collectionsData = [
  {
    id: 'col_makoto_shinkai',
    title: 'Coleção Makoto Shinkai',
    poster: 'https://chonthuonghieu.com/wp-content/uploads/2022/01/your-name-7.jpg',
    movieIds: [
      'your_name',
      'tenki_no_ko',
      'kotonoha_no_niwa',
      'byousoku_5_centimeter',
      'kumo_no_mukou'
    ]
  },
  {
    id: 'col_demon_slayer',
    title: 'Coleção Demon Slayer',
    poster: 'https://teoriageek.com.br/wp-content/uploads/2025/09/Poster-1.jpg',
    movieIds: [
      'demon_slayer_infinity_castle_1',
      'demon_slayer_mugen_train'
    ]
  },
  {
    id: 'col_rascal',
    title: 'Trilogia Rascal Does Not Dream',
    poster: 'https://cdn.sinemalar.com/images/movie/281745/poster/rascal-does-not-dream-of-a-dreaming-girl-1681869118.jpg',
    movieIds: [
      'rascal_dreaming_girl',
      'rascal_sister_venturing_out',
      'rascal_knapsack_kid'
    ]
  }
];

function initRecommendationSystem() {
  updateRecommendationBanner();
  if (recommendationInterval) clearInterval(recommendationInterval);
  recommendationInterval = setInterval(updateRecommendationBanner, 30 * 60 * 1000);
}

function updateRecommendationBanner() {
  const isMobile = window.innerWidth <= 768;
  const randomIndex = Math.floor(Math.random() * moviesData.length);
  recommendedMovie = moviesData[randomIndex];

  const banner = document.getElementById('recommendationBanner');
  const title = document.getElementById('recTitle');
  const synopsis = document.getElementById('recSynopsis');

  if (!banner || !recommendedMovie) return;

  const bgImage = isMobile ? recommendedMovie.poster : recommendedMovie.banner;
  banner.style.backgroundImage = `url('${bgImage}')`;
  title.innerText = recommendedMovie.title;
  synopsis.innerText = recommendedMovie.synopsis;
}

window.watchRecommendedMovie = function() {
  if (!recommendedMovie) return;
  currentSelectedMovie = recommendedMovie;
  handleWatchClick();
};

window.openMovieFromRecommendation = function() {
  if (!recommendedMovie) return;
  openModal(recommendedMovie.id);
};

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

function renderCollectionsCatalog() {
  const catalog = document.getElementById('collectionsCatalog');
  if (!catalog) return;
  catalog.innerHTML = '';

  collectionsData.forEach(col => {
    const card = document.createElement('div');
    card.className = 'movie-card collection-card';
    card.onclick = () => openCollectionSection(col.id);
    card.innerHTML = `
      <img src="${col.poster}" alt="${col.title}">
      <div class="movie-card-title">${col.title}</div>
    `;
    catalog.appendChild(card);
  });
}

window.openCollectionSection = function(collectionId) {
  const collection = collectionsData.find(c => c.id === collectionId);
  if (!collection) return;

  const homeSection = document.getElementById('homeSection');
  const singleCollectionSection = document.getElementById('singleCollectionSection');
  const titleEl = document.getElementById('singleCollectionTitle');
  const gridEl = document.getElementById('singleCollectionCatalog');

  if (!singleCollectionSection || !titleEl || !gridEl) return;

  homeSection.style.display = 'none';
  singleCollectionSection.style.display = 'block';

  titleEl.innerText = collection.title;
  gridEl.innerHTML = '';

  collection.movieIds.forEach(id => {
    const movie = moviesData.find(m => m.id === id);
    if (!movie) return;

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(movie.id);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <div class="movie-card-title">${movie.title}</div>
    `;
    gridEl.appendChild(card);
  });

  window.scrollTo(0, 0);
};

function renderMyListCatalog() {
  const myListCatalog = document.getElementById('myListCatalog');
  myListCatalog.innerHTML = '';

  const myList = getActiveMyList();
  const allMovies = [...moviesData, ...comingSoonData];
  const listMovies = allMovies.filter(m => myList.includes(m.id));

  if (listMovies.length === 0) {
    myListCatalog.innerHTML = `<div style="color: #aaa; font-size: 14px; padding: 10px 0;">Sua lista está vazia. Adicione filmes clicando no ícone de lista.</div>`;
    return;
  }

  listMovies.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(movie.id);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <div class="movie-card-title">${movie.title} ${movie.isComingSoon ? '<span style="color: var(--primary-color); font-size: 11px;">(Em Breve)</span>' : ''}</div>
    `;
    myListCatalog.appendChild(card);
  });
}

function renderComingSoonCatalog() {
  const comingSoonCatalog = document.getElementById('comingSoonCatalog');
  if (!comingSoonCatalog) return;
  comingSoonCatalog.innerHTML = '';

  if (comingSoonData.length === 0) {
    comingSoonCatalog.innerHTML = `<div style="color: #aaa; font-size: 14px; padding: 10px 0;">Não há lançamentos pendentes no momento. Todos os títulos já estão disponíveis no catálogo!</div>`;
    return;
  }

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

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    openMobileMoviePage();
  } else {
    openPcMovieModal();
  }
};

function openPcMovieModal() {
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

  setupMovieButtons('btnWatchText', 'btnRestart', 'downloadMenu', 'btnDownload');
  closeSearchDropdown();
  updateMyListButtonState();
  updateLikeButtonState();
  document.getElementById('movieModal').style.display = 'flex';
}

function openMobileMoviePage() {
  document.getElementById('homeSection').style.display = 'none';
  const singleCollectionSection = document.getElementById('singleCollectionSection');
  if (singleCollectionSection) singleCollectionSection.style.display = 'none';
  document.getElementById('myListSection').style.display = 'none';
  document.getElementById('comingSoonSection').style.display = 'none';
  const suggestionsSection = document.getElementById('suggestionsSection');
  if (suggestionsSection) suggestionsSection.style.display = 'none';

  document.getElementById('mobilePoster').src = currentSelectedMovie.poster;
  document.getElementById('mobileTitle').innerText = currentSelectedMovie.title;
  document.getElementById('mobileSynopsis').innerText = currentSelectedMovie.synopsis;

  document.getElementById('mobileMeta').innerHTML = `
    <span class="match">${currentSelectedMovie.match}</span>
    <span>${currentSelectedMovie.year}</span>
    <span class="badge">${currentSelectedMovie.age}</span>
    <span>${currentSelectedMovie.duration}</span>
  `;

  setupMovieButtons('mobileBtnWatchText', 'mobileBtnRestart', 'mobileDownloadMenu', 'mobileBtnDownload');
  closeSearchDropdown();
  updateMyListButtonState();
  updateLikeButtonState();
  document.getElementById('mobileMoviePage').style.display = 'block';
  window.scrollTo(0, 0);
}

function setupMovieButtons(watchTextId, restartId, downloadMenuId, downloadContainerId) {
  const btnWatchText = document.getElementById(watchTextId);
  const btnWatch = btnWatchText ? btnWatchText.closest('button') : null;
  const btnDownload = document.getElementById(downloadContainerId);
  const btnRestart = document.getElementById(restartId);
  const downloadMenu = document.getElementById(downloadMenuId);

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
          item.download = `${currentSelectedMovie.title}_${src.quality}.mkv`;
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
}

window.closeMobileMoviePage = function() {
  document.getElementById('mobileMoviePage').style.display = 'none';
  showCatalogSection('home');
};

window.closeModal = function() {
  document.getElementById('movieModal').style.display = 'none';
};

window.toggleDownloadMenu = function() {
  const isMobile = window.innerWidth <= 768;
  const menu = isMobile ? document.getElementById('mobileDownloadMenu') : document.getElementById('downloadMenu');

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

async function startStreaming(movie, savedTime = 0, savedQualityUrl = null) {
  currentSelectedMovie = movie;
  closeModal();
  if (window.innerWidth <= 768) {
    document.getElementById('mobileMoviePage').style.display = 'none';
  }
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

  try {
    if (playerView.requestFullscreen) {
      await playerView.requestFullscreen();
    } else if (playerView.webkitRequestFullscreen) {
      await playerView.webkitRequestFullscreen();
    }

    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock("landscape").catch(() => {});
    }
  } catch (err) {
    console.log("Modo tela cheia não suportado ou negado pelo navegador:", err);
  }

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

  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock();
  }

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
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
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    if (playerView.requestFullscreen) {
      playerView.requestFullscreen().catch(err => alert(err.message));
    } else if (playerView.webkitRequestFullscreen) {
      playerView.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
};

window.changeQuality = function() {
  const currentTime = player.currentTime;
  const isPaused = player.paused;
  source.src = select.value;
  player.load();
  player.currentTime = currentTime;
  if (!isPaused) player.play();
};

player.addEventListener('timeupdate', () => {
  if (!player.duration) return;
  const progress = (player.currentTime / player.duration) * 100;
  playerSeek.value = progress;
  timeDisplay.innerText = `${formatTime(player.currentTime)} / ${formatTime(player.duration)}`;
  
  if (Math.floor(player.currentTime) % 5 === 0) {
    saveProgress();
  }
});

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function saveProgress() {
  if (!currentSelectedMovie || !player.duration) return;
  currentHistory = window.getActiveHistory();
  
  if (player.currentTime / player.duration > 0.95) {
    delete currentHistory[currentSelectedMovie.id];
  } else {
    currentHistory[currentSelectedMovie.id] = {
      time: player.currentTime,
      duration: player.duration,
      quality: select.value,
      lastUpdated: Date.now()
    };
  }
  window.syncHistoryToCloud();
}

function loadContinueWatching() {
  const container = document.getElementById('continueCatalog');
  const section = document.getElementById('continueSection');
  container.innerHTML = '';

  currentHistory = window.getActiveHistory();
  const keys = Object.keys(currentHistory);

  if (keys.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  keys.forEach(movieId => {
    const movie = moviesData.find(m => m.id === movieId);
    if (!movie) return;

    const hist = currentHistory[movieId];
    const progress = (hist.time / hist.duration) * 100;
    const remainingMins = Math.ceil((hist.duration - hist.time) / 60);

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(movie.id);
    card.innerHTML = `
      <img src="${movie.poster}" alt="${movie.title}">
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
      <div class="movie-card-title">${movie.title}</div>
      <div class="remaining-time">Faltam ${remainingMins} min</div>
    `;
    container.appendChild(card);
  });
}

window.searchMovies = function() {
  const input = document.getElementById('searchInput').value.toLowerCase().trim();
  const dropdown = document.getElementById('searchResultsDropdown');

  if (input === '') {
    dropdown.style.display = 'none';
    return;
  }

  const allMovies = [...moviesData, ...comingSoonData];
  const results = allMovies.filter(m => m.title.toLowerCase().includes(input));

  if (results.length === 0) {
    dropdown.innerHTML = '<div style="padding: 10px; color: #aaa; font-size: 12px;">Nenhum filme encontrado</div>';
  } else {
    dropdown.innerHTML = results.map(m => `
      <div class="search-result-item" onclick="openModal('${m.id}')">
        <img src="${m.poster}" alt="${m.title}">
        <span>${m.title}</span>
      </div>
    `).join('');
  }

  dropdown.style.display = 'block';
};

function closeSearchDropdown() {
  const dropdown = document.getElementById('searchResultsDropdown');
  if (dropdown) dropdown.style.display = 'none';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
}