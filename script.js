// radio.js — Versão modular (Firebase v9+) pronta para deploy
// - Usa preset unsigned Cloudinary 'radio_preset'
// - Usa firebaseConfig que você forneceu
// Requisitos: carregar este arquivo com <script type="module" src="radio.js"></script>
// IDs HTML esperados (se não usar, altere os seletores): 
// mediaFileInput, mediaTitleInput, mediaUploadBtn, audioPlayer, playPauseBtn, volumeSlider,
// startBroadcastBtn, stopBroadcastBtn, formSaveBtn, passwordSaveBtn, logs, reportsContainer, radioStateTextContent

// -------------------- Imports Firebase modular --------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// -------------------- Configs --------------------
const CLOUDINARY_CONFIG = { cloud_name: 'dygbrcrr6' };
const CLOUDINARY_UNSIGNED_PRESET = 'radio_preset';

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

// -------------------- Estado inicial --------------------
window.radioState = {
  isLive: false,
  isPlaying: false,
  volume: 0.8,
  lastUpdate: null,
  time: null,
  program: null,
  music: [],
  content: { formData: [], jingle: [], program: [] }
};

// -------------------- Utilitários --------------------
window.$safe = (sel) => {
  try { const el = document.querySelector(sel); if (!el) console.warn('[$safe] elemento não encontrado:', sel); return el; }
  catch (e) { console.error('[$safe] seletor inválido:', sel, e); return null; }
};

window.testRadioSyncUrl = function(cloudName=CLOUDINARY_CONFIG.cloud_name, folder='radio-louro_sync', publicId='radio-state') {
  const url = `https://res.cloudinary.com/${cloudName}/raw/upload/${folder}/${publicId}.json`;
  console.info('[testRadioSyncUrl] GET', url);
  return fetch(url).then(r => { console.info('[testRadioSyncUrl] status', r.status); return r.text().then(t => { console.log('[testRadioSyncUrl] body preview:', t.slice(0,500)); return { status: r.status, body: t }; }); }).catch(e => { console.error('[testRadioSyncUrl] erro', e); throw e; });
};

// -------------------- Firebase helpers --------------------
window.adminLogin = async function(email, senha) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, senha);
    console.info('[Admin] logado:', credential.user.email);
    return credential.user;
  } catch (err) { console.error('[Admin] erro login:', err); throw err; }
};

window.saveRadioState = async function(radioStateObj) {
  try {
    const ref = doc(db, 'estado', 'atual');
    await setDoc(ref, Object.assign({}, radioStateObj, { lastUpdate: new Date().toISOString() }));
    console.info('[Firestore] estado salvo');
    return true;
  } catch (e) { console.error('[Firestore] erro ao salvar estado:', e); throw e; }
};

window.loadRadioState = async function() {
  try {
    const ref = doc(db, 'estado', 'atual');
    const snapshot = await getDoc(ref);
    if (snapshot.exists()) { console.info('[Firestore] estado carregado'); return snapshot.data(); }
    console.info('[Firestore] nenhum estado salvo'); return null;
  } catch (e) { console.error('[Firestore] erro ao carregar estado:', e); return null; }
};

window.watchRadioState = function(callback) {
  try {
    const ref = doc(db, 'estado', 'atual');
    return onSnapshot(ref, docSnap => { if (docSnap.exists()) callback(docSnap.data()); else callback(null); }, err => console.error('[Firestore] onSnapshot erro:', err));
  } catch (e) { console.error('[Firestore] watchRadioState erro:', e); return null; }
};

// -------------------- Upload Cloudinary + registro Firestore --------------------
export async function uploadMediaAndRegister(file, meta = {}) {
  if (!file) throw new Error('Arquivo não fornecido');
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/raw/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', CLOUDINARY_UNSIGNED_PRESET);
  form.append('folder', 'radio_media');

  if (meta.title) form.append('context', `title=${meta.title}`);
  if (meta.artist) form.append('context', (form.get('context') ? form.get('context') + '|' : '') + `artist=${meta.artist}`);

  const resp = await fetch(url, { method: 'POST', body: form });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Cloudinary upload failed ${resp.status}: ${txt}`);
  }
  const json = await resp.json();

  const docPayload = {
    public_id: json.public_id,
    url: json.secure_url || json.url,
    resource_type: json.resource_type,
    format: json.format,
    bytes: json.bytes,
    created_at: json.created_at || new Date().toISOString(),
    meta: meta || {}
  };

  const docRef = await addDoc(collection(db, 'midia'), docPayload);

  try {
    window.radioState = window.radioState || {};
    window.radioState.music = window.radioState.music || [];
    window.radioState.music.push({
      id: docRef.id,
      title: meta.title || file.name,
      url: docPayload.url,
      cloudinary: { public_id: json.public_id },
      addedAt: new Date().toISOString()
    });
    await saveRadioState(window.radioState);
  } catch (e) { console.warn('[uploadMediaAndRegister] falha ao atualizar radioState', e); }

  return { cloudinary: json, firestoreId: docRef.id };
}

// -------------------- UI handlers e player --------------------
window.saveFormData = async function() {
  try {
    const newFormData = {
      name: (document.getElementById('formDataNameInput') || {}).value || '',
      age: (document.getElementById('formDataAgeInput') || {}).value || '',
      gender: (document.getElementById('formDataGenderSelect') || {}).value || '',
      email: (document.getElementById('formDataEmailInput') || {}).value || '',
      phone: (document.getElementById('formDataPhoneInput') || {}).value || ''
    };
    const id = Date.now();
    const content = { type: 'formData', id, data: newFormData };
    window.radioState.content = window.radioState.content || {};
    window.radioState.content.formData = window.radioState.content.formData || [];
    window.radioState.content.formData.push(content);
    await addDoc(collection(db, 'pedidos'), { ...content, createdAt: new Date().toISOString() });
    if (typeof window.renderReports === 'function') window.renderReports();
    console.info('[saveFormData] ok', content);
  } catch (e) { console.error('[saveFormData] erro:', e); }
};

window.renderLogs = function(msg, level='info') {
  try {
    const logs = document.getElementById('logs') || document.querySelector('#logs');
    const now = new Date().toLocaleString();
    if (logs) { const node = document.createElement('div'); node.className = 'log ' + level; node.textContent = `[${now}] ${msg}`; logs.prepend(node); }
    else console[level](`[${now}] ${msg}`);
  } catch (e) { console.error('[renderLogs] erro:', e); }
};

// Player simplified
(function(){
  const audio = document.getElementById('audioPlayer') || document.querySelector('#audioPlayer') || new Audio();
  window.audio = audio;
  window.setVolume = function(v) { window.radioState.volume = v; if (audio) audio.volume = v; saveRadioState(window.radioState).catch(()=>{}); };
  window.playTrack = function(track) { if (!track) return; if (audio) { audio.src = track.url; audio.play().catch(()=>{}); window.radioState.isPlaying = true; saveRadioState(window.radioState).catch(()=>{}); } };
  audio.ontimeupdate = function(){ try { const currentTrackTime = document.getElementById('currentTrackTime'); if (currentTrackTime) currentTrackTime.textContent = Math.floor(audio.currentTime); } catch(e){} };
})();

// -------------------- Init --------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const state = await loadRadioState();
    if (!state) {
      try {
        const res = await window.testRadioSyncUrl();
        if (res && res.status === 200) {
          const j = JSON.parse(res.body);
          if (j) { Object.assign(window.radioState, j); }
        }
      } catch (e) { console.warn('[init] Cloudinary fallback inválido', e); }
    } else {
      Object.assign(window.radioState, state);
    }

    document.getElementById('mediaUploadBtn')?.addEventListener('click', async () => {
      const file = (document.getElementById('mediaFileInput') || {}).files?.[0];
      const title = (document.getElementById('mediaTitleInput') || {}).value;
      if (!file) return alert('Selecione um arquivo');
      try {
        const res = await uploadMediaAndRegister(file, { title });
        alert('Upload OK: ' + (res.cloudinary.secure_url || res.cloudinary.url));
      } catch (e) { console.error('Upload falhou', e); alert('Erro no upload: ' + e.message); }
    });

    document.getElementById('startBroadcastBtn')?.addEventListener('click', () => {
      window.radioState.isLive = true;
      window.radioState.isPlaying = true;
      saveRadioState(window.radioState).catch(()=>{});
    });
    document.getElementById('stopBroadcastBtn')?.addEventListener('click', () => {
      window.radioState.isLive = false;
      window.radioState.isPlaying = false;
      if (window.audio) { window.audio.pause(); window.audio.currentTime = 0; }
      saveRadioState(window.radioState).catch(()=>{});
    });
    document.getElementById('playPauseBtn')?.addEventListener('click', () => {
      if (!window.radioState.isLive) return;
      if (window.radioState.isPlaying) { window.radioState.isPlaying = false; window.audio.pause(); }
      else { window.radioState.isPlaying = true; window.audio.play().catch(()=>{}); }
      saveRadioState(window.radioState).catch(()=>{});
    });

    renderLogs('radio.js modular pronto', 'info');
  } catch (e) { console.error('[init DOMContentLoaded] erro:', e); }
});
