// radio.js — versão completa usando Firebase modular (v9+), Cloudinary fallback, e handlers principais
// Substitua CLOUDINARY_CONFIG.cloud_name se necessário.
// Certifique-se de usar um bundler que suporte ES Modules (Vite, Webpack, Rollup) ou usar <script type="module">.

// Firebase modular imports
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc
} from "firebase/firestore";

// -------------------- Configurações --------------------
const CLOUDINARY_CONFIG = {
  cloud_name: 'dygbrcrr6', // altere se necessário
};

const firebaseConfig = {
  apiKey: "AIzaSyDkuwNr9RqlGGFey7DD9G_tTirCRP3eKqk",
  authDomain: "radio-louro.firebaseapp.com",
  projectId: "radio-louro",
  storageBucket: "radio-louro.firebasestorage.app",
  messagingSenderId: "922823434228",
  appId: "1:922823434228:web:1ca9c473742728a2dee3a1"
};

// -------------------- Inicializar Firebase (modular) --------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// -------------------- Estado inicial do app --------------------
window.radioState = {
  isLive: false,
  isPlaying: false,
  volume: 0.8,
  lastUpdate: null,
  time: null,
  program: null,
  music: null,
  content: {
    formData: [],
    jingle: [],
    program: []
  }
};

// -------------------- Patch de robustez e utilitários --------------------
(function(){
  const runWhenReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  window.$safe = (sel) => {
    try {
      const el = document.querySelector(sel);
      if (!el) console.warn('[$safe] elemento não encontrado:', sel);
      return el;
    } catch (e) {
      console.error('[$safe] seletor inválido:', sel, e);
      return null;
    }
  };

  runWhenReady(() => {
    const required = ['audioPlayer','playPauseBtn','volumeSlider','broadcastStatus','programasSelect','musicList','radioStateTextContent'];
    required.forEach(id => {
      if (!document.getElementById(id) && !document.querySelector('#' + id)) {
        console.error(`[init] Elemento crítico ausente: id="${id}" — verifique HTML ou nomes no JS`);
      }
    });
  });

  window.testRadioSyncUrl = function(cloudName=CLOUDINARY_CONFIG.cloud_name, folder='radio-louro_sync', publicId='radio-state') {
    const url = `https://res.cloudinary.com/${cloudName}/raw/upload/${folder}/${publicId}.json`;
    console.info('[testRadioSyncUrl] GET', url);
    return fetch(url).then(r => {
      console.info('[testRadioSyncUrl] status', r.status);
      return r.text().then(t => { console.log('[testRadioSyncUrl] body preview:', t.slice(0,500)); return t; });
    }).catch(e => console.error('[testRadioSyncUrl] erro', e));
  };

  window.debugPublishPayload = function(payload = {test:'ok'}) {
    console.log('[debugPublishPayload] payload:', payload);
  };
})();

// -------------------- Firebase helpers (modular) --------------------
window.adminLogin = async function(email, senha) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, senha);
    console.info('[Admin] logado:', credential.user.email);
    return credential.user;
  } catch (err) {
    console.error('[Admin] erro login:', err);
    throw err;
  }
};

window.saveRadioState = async function(radioStateObj) {
  try {
    const ref = doc(db, 'estado', 'atual');
    await setDoc(ref, Object.assign({}, radioStateObj, { lastUpdate: new Date().toISOString() }));
    console.info('[Firestore] estado salvo');
    return true;
  } catch (e) {
    console.error('[Firestore] erro ao salvar estado:', e);
    throw e;
  }
};

window.loadRadioState = async function() {
  try {
    const ref = doc(db, 'estado', 'atual');
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) {
      console.info('[Firestore] estado carregado');
      return snapshot.data();
    } else {
      console.info('[Firestore] nenhum estado salvo');
      return null;
    }
  } catch (e) {
    console.error('[Firestore] erro ao carregar estado:', e);
    return null;
  }
};

window.watchRadioState = function(callback) {
  try {
    const ref = doc(db, 'estado', 'atual');
    return onSnapshot(ref, docSnap => {
      if (docSnap.exists()) callback(docSnap.data());
      else callback(null);
    }, err => console.error('[Firestore] onSnapshot erro:', err));
  } catch (e) {
    console.error('[Firestore] watchRadioState erro:', e);
    return null;
  }
};

// -------------------- Funções de UI e manipulação de conteúdo --------------------
window.deleteContent = function(type, id) {
  try {
    if (!window.radioState || !radioState.content || !radioState.content[type]) return;
    radioState.content[type] = radioState.content[type].filter(x => x.id !== id);
    if (typeof window.renderReports === 'function') window.renderReports();
    if (typeof window.updateUIRadioContent === 'function') window.updateUIRadioContent();
    saveRadioState(radioState).catch(()=>{});
    console.info(`[deleteContent] removed ${type} ${id}`);
  } catch (e) {
    console.error('[deleteContent] erro:', e);
  }
};

window.updateUIRadioContent = function() {
  try {
    const radioStateLocal = window.radioState;
    const radioStateTextContent = document.getElementById('radioStateTextContent') || document.querySelector('#radioStateTextContent');
    if (radioStateTextContent) {
      radioStateTextContent.textContent = radioStateLocal.isLive ? 'AO VIVO' : (radioStateLocal.lastUpdate ? 'Última atualização: ' + radioStateLocal.lastUpdate : 'Sem estado');
    }
    if (typeof window.renderReports === 'function') window.renderReports();
  } catch (e) {
    console.error('[updateUIRadioContent] erro:', e);
  }
};

window.renderReports = function() {
  try {
    const container = document.getElementById('reportsContainer') || document.querySelector('#reportsContainer');
    if (!container) return;
    const items = [];
    Object.keys(radioState.content || {}).forEach(type => {
      (radioState.content[type] || []).slice().reverse().forEach(item => {
        items.push(`<div class="report-item">${type} — ${item.id} — ${JSON.stringify(item.data || item)}</div>`);
      });
    });
    container.innerHTML = items.join('');
  } catch (e) {
    console.error('[renderReports] erro:', e);
  }
};

window.showModal = function(type) {
  try {
    const modal = document.getElementById(type + 'Modal') || document.querySelector('#' + type + 'Modal');
    if (modal) modal.style.display = 'block';
  } catch (e) {
    console.error('[showModal] erro:', e);
  }
};

window.hideModal = function() {
  try {
    const ids = ['passwordModal','formDataModal','broadcastModal','askRemoveOld'];
    ids.forEach(id => {
      const el = document.getElementById(id) || document.querySelector('#' + id);
      if (el) el.style.display = 'none';
    });
  } catch (e) {
    console.error('[hideModal] erro:', e);
  }
};

window.savePassword = function() {
  try {
    const password = (document.getElementById('passwordInput') || {}).value;
    if (!password) return alert('Senha vazia');
    const ref = doc(db, 'secrets', 'admin');
    setDoc(ref, { password, updated: new Date().toISOString() })
      .then(() => alert('Senha salva'))
      .catch(e => { console.error(e); alert('Erro ao salvar senha'); });
  } catch (e) {
    console.error('[savePassword] erro:', e);
  }
};

window.saveFormData = function() {
  try {
    const newFormData = {
      name: (document.getElementById('formDataNameInput') || {}).value || '',
      age: (document.getElementById('formDataAgeInput') || {}).value || '',
      gender: (document.getElementById('formDataGenderSelect') || {}).value || '',
      email: (document.getElementById('formDataEmailInput') || {}).value || '',
      phone: (document.getElementById('formDataPhoneInput') || {}).value || ''
    };
    const type = 'formData';
    const id = Date.now();
    const content = { type, id, data: newFormData };
    radioState.content[type] = radioState.content[type] || [];
    radioState.content[type].push(content);
    // persistir no Firestore (coleção pedidos)
    addDoc(collection(db, 'pedidos'), { ...content, createdAt: new Date().toISOString() })
      .then(() => console.info('[saveFormData] salvo no Firestore'))
      .catch(e => console.error('[saveFormData] erro ao salvar:', e));
    if (typeof window.renderReports === 'function') window.renderReports();
    console.info('[saveFormData] ok', content);
  } catch (e) {
    console.error('[saveFormData] erro:', e);
  }
};

// -------------------- Logs e player UI --------------------
window.renderLogs = function(msg, level='info') {
  try {
    const logs = document.getElementById('logs') || document.querySelector('#logs');
    const now = new Date().toLocaleString();
    if (logs) {
      const node = document.createElement('div');
      node.className = 'log ' + level;
      node.textContent = `[${now}] ${msg}`;
      logs.prepend(node);
    } else {
      console[level](`[${now}] ${msg}`);
    }
  } catch (e) {
    console.error('[renderLogs] erro:', e);
  }
};

window.updatePlayerDataUI = function(data) {
  try {
    const trackTitle = document.getElementById('currentTrackTitle') || document.querySelector('#currentTrackTitle');
    const trackCover = document.getElementById('currentTrackCover') || document.querySelector('#currentTrackCover');
    if (trackTitle && data && data.title) trackTitle.textContent = data.title;
    if (trackCover && data && data.cover) trackCover.src = data.cover;
  } catch (e) {
    console.error('[updatePlayerDataUI] erro:', e);
  }
};

// -------------------- Player controls (simplificado) --------------------
(function(){
  const audio = document.getElementById('audioPlayer') || document.querySelector('#audioPlayer') || new Audio();
  window.audio = audio;
  const volumeSlider = document.getElementById('volumeSlider') || document.querySelector('#volumeSlider');
  if (volumeSlider) {
    volumeSlider.value = window.radioState.volume;
    volumeSlider.oninput = (e) => {
      const v = Number(e.target.value);
      window.setVolume(v);
    };
  }

  window.stopBroadcast = function() {
    if (!radioState.isLive) return;
    radioState.isLive = false;
    radioState.isPlaying = false;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    window.updateUI('btn-primary');
    renderLogs('Broadcast stopped', 'info');
    saveRadioState(radioState).catch(()=>{});
  };

  window.playPause = function() {
    if (!radioState.isLive) return;
    if (radioState.isPlaying) {
      radioState.isPlaying = false;
      audio.pause();
      window.updateUI('btn-primary');
      renderLogs('Paused', 'info');
    } else {
      radioState.isPlaying = true;
      audio.play().catch(e => console.error('audio.play error', e));
      window.updateUI('btn-secondary');
      renderLogs('Playing', 'info');
    }
    saveRadioState(radioState).catch(()=>{});
  };

  window.updateUI = function(btnClass) {
    try {
      const starBtn = document.querySelector('#startBroadcastBtn') || document.getElementById('startBroadcastBtn');
      const backBtn = document.querySelector('#backToPlayerBtn') || document.getElementById('backToPlayerBtn');
      if (starBtn) starBtn.className = `btn ${btnClass}`;
      if (backBtn) backBtn.className = `btn ${btnClass}`;
      if (starBtn) starBtn.style.display = radioState.isPlaying ? 'block' : 'none';
      if (backBtn) backBtn.style.display = radioState.isPlaying ? 'block' : 'none';
    } catch (e) {
      console.error('[updateUI] erro:', e);
    }
  };

  window.setVolume = function(v) {
    radioState.volume = v;
    if (audio) audio.volume = v;
    const volLabel = document.getElementById('volumeLabel') || document.querySelector('#volumeLabel');
    if (volLabel) volLabel.textContent = Math.round(v*100) + '%';
    saveRadioState(radioState).catch(()=>{});
  };

  window.updateTrackTime = function() {
    try {
      const t = audio.currentTime || 0;
      const d = audio.duration || 0;
      const currentTrackTime = document.getElementById('currentTrackTime') || document.querySelector('#currentTrackTime');
      const totalTrackTime = document.getElementById('totalTrackTime') || document.querySelector('#totalTrackTime');
      if (currentTrackTime) currentTrackTime.textContent = formatTime(t);
      if (totalTrackTime) totalTrackTime.textContent = formatTime(d);
    } catch (e) {
      console.error('[updateTrackTime] erro:', e);
    }
  };

  function formatTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    const s = Math.floor(sec % 60).toString().padStart(2,'0');
    const m = Math.floor(sec / 60);
    return `${m}:${s}`;
  }

  audio.onended = () => {
    renderLogs('Track ended', 'info');
    if (typeof window.queueItem === 'function') window.queueItem();
  };
  audio.onpause = () => {};
  audio.onplay = () => {};
  audio.ontimeupdate = window.updateTrackTime;

})();

// -------------------- Scheduling / playlist helpers (simplified) --------------------
window.scheduleNextTrack = function() {
  try {
    const list = radioState.music || [];
    if (!list.length) return;
    const track = list[Math.floor(Math.random()*list.length)];
    if (track && track.url) {
      if (window.audio) {
        window.audio.src = track.url;
        if (radioState.isPlaying) window.audio.play().catch(e=>console.error(e));
        window.updatePlayerDataUI({ title: track.title || '—', cover: track.cover || '' });
      }
    }
  } catch (e) {
    console.error('[scheduleNextTrack] erro:', e);
  }
};

window.playTrack = function(track) {
  try {
    if (!track) return;
    if (window.audio) {
      window.audio.src = track.url;
      window.audio.play().catch(e=>console.error(e));
      radioState.isPlaying = true;
      window.updateUI('btn-secondary');
      window.updatePlayerDataUI({ title: track.title, cover: track.cover });
      saveRadioState(radioState).catch(()=>{});
    }
  } catch (e) {
    console.error('[playTrack] erro:', e);
  }
};

window.titleByType = function(track) {
  if (!track) return '';
  if (track.type === 'program') return track.programName || track.title || 'Programa';
  if (track.type === 'music') return track.title || 'Música';
  return track.title || '';
};

// -------------------- Init routine que integra Firestore fallback e Cloudinary --------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // carrega estado do Firestore e aplica
    const state = await loadRadioState();
    if (!state) {
      // fallback: tenta Cloudinary
      try {
        const txt = await window.testRadioSyncUrl();
        const j = JSON.parse(txt);
        if (j) {
          Object.assign(window.radioState, j);
          window.updateUIRadioContent();
        }
      } catch (e) {
        console.warn('[init] Cloudinary fallback inválido', e);
      }
    } else {
      Object.assign(window.radioState, state);
      window.updateUIRadioContent();
    }

    // wiring de botões básicos (se existirem)
    (document.querySelector('#startBroadcastBtn') || {}).onclick = () => {
      radioState.isLive = true;
      radioState.isPlaying = true;
      window.updateUI('btn-secondary');
      saveRadioState(radioState).catch(()=>{});
    };
    (document.querySelector('#stopBroadcastBtn') || {}).onclick = () => window.stopBroadcast();
    (document.querySelector('#playPauseBtn') || {}).onclick = () => window.playPause();

    // salvar formulário de dados
    (document.querySelector('#formSaveBtn') || {}).onclick = () => window.saveFormData();
    (document.querySelector('#passwordSaveBtn') || {}).onclick = () => window.savePassword();

    // inicializa volume UI
    if (window.audio) window.audio.volume = radioState.volume || 0.8;

    renderLogs('radio.js inicializado', 'info');
  } catch (e) {
    console.error('[init DOMContentLoaded] erro:', e);
  }
});
