// radio.js

// 1. Configuração Cloudinary
const CLOUDINARY_CONFIG = {
  cloudName: 'dygbrcrr6',
  apiKey: '853591251513134',
  apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
  uploadPreset: 'radio_preset'
};

// 2. Configuração de Sincronização (Raw JSON via Cloudinary)
const SYNC_CONFIG = {
  enabled: true,
  interval: 10000,              // checa a cada 10s
  folder: 'radio-louro_sync',   // pasta ajustada para underscore
  publicId: 'radio-state',      // nome do arquivo JSON
  resourceType: 'raw'
};

// 3. Estado global da rádio
let radioState = {
  isLive: false,
  isPlaying: false,
  currentTrack: null,
  volume: 70,
  playHistory: [],
  stats: {
    totalPlayed: 0,
    popularTracks: {},
    requests: []
  },
  content: {
    music: [],
    jingle: [],
    time: [],
    program: { morning: [], afternoon: [], evening: [], late: [] }
  },
  schedule: {
    morning:   { type: 'mixed', jingleFreq: 15 },
    afternoon: { type: 'mixed', jingleFreq: 10 },
    evening:   { type: 'mixed', jingleFreq: 20 },
    late:      { type: 'music', jingleFreq: 30 }
  },
  automation: {
    hourlyTime: true,
    autoJingles: true,
    avoidRepeat: true,
    repeatInterval: 50,
    crossfade: false,
    crossfadeDuration: 3
  },
  lastSync: null
};

// 4. Cache de elementos DOM e instâncias
let elements = {},
    radioSystem,
    uploader;

// 5. Gerente de Sincronização
class RadioSyncManager {
  constructor() { this.init(); }
  init() {
    if (!SYNC_CONFIG.enabled) return;
    this.intervalID = setInterval(() => this.syncFromCloud(), SYNC_CONFIG.interval);
    window.addEventListener('focus', () => this.syncFromCloud());
  }
  async syncFromCloud() {
    try {
      const url = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/raw/upload/${SYNC_CONFIG.folder}/${SYNC_CONFIG.publicId}.json`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.lastSync && data.lastSync !== radioState.lastSync) {
        Object.assign(radioState, data);
        radioState.lastSync = data.lastSync;
        localStorage.setItem('radioState', JSON.stringify(radioState));
        radioSystem.updateAllUI();
      }
    } catch (e) {}
  }
  async publishUpdate() {
    const payload = { ...radioState, lastSync: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const form = new FormData();
    form.append('file', blob, 'radio-state.json');
    form.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    form.append('folder', SYNC_CONFIG.folder);
    form.append('resource_type', SYNC_CONFIG.resourceType);
    form.append('public_id', SYNC_CONFIG.publicId);
    form.append('overwrite', 'true');
    await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/raw/upload`,
      { method: 'POST', body: form }
    );
    radioState.lastSync = payload.lastSync;
  }
}

// 6. Classe principal de Rádio
class RadioLive24 {
  constructor() {
    this.audio = null;
    this.syncManager = new RadioSyncManager();
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  init() {
    this.cacheElements();
    this.loadState();
    this.bindUI();
    this.syncManager.syncFromCloud();
    this.startBroadcast();
  }

  cacheElements() {
    const ids = [
      'audioPlayer','playPauseBtn','volumeSlider','volumeValue',
      'albumCover','trackCover','albumTitle','currentTrack','trackTime','trackGenre',
      'currentProgram','nextProgram','broadcastStatus','playCount',
      'musicCount','jingleCount','timeCount','programCount',
      'musicList','jingleList','timeList','programList',
      'scheduleList','recentTracks','requestsList',
      'adminBtn','passwordModal','adminMode','adminPassword','loadingOverlay',
      'hourlyTime','autoJingles','avoidRepeat','repeatInterval','crossfade','crossfadeDuration','crossfadeValue',
      'programSelect'
    ];
    ids.forEach(id => elements[id] = document.getElementById(id));
  }

  bindUI() {
    elements.playPauseBtn.onclick = () => this.togglePlay();
    elements.volumeSlider.oninput = e => this.setVolume(e.target.value);
    this.audio = elements.audioPlayer;
    this.audio.onended      = () => this.nextTrack();
    this.audio.ontimeupdate = () => this.updateTime();

    document.querySelectorAll('.info-tab').forEach(tab => {
      tab.onclick = () => this.switchInfoTab(tab.dataset.tab);
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => this.switchAdminTab(btn.dataset.tab);
    });

    document.getElementById('sendRequest').onclick = () => this.sendRequest();

    document.querySelectorAll('.content-type-select').forEach(sel => {
      sel.onchange = () => this.saveScheduleConfig();
    });
    document.querySelectorAll('.jingle-frequency').forEach(inp => {
      inp.onchange = () => this.saveScheduleConfig();
    });

    ['hourlyTime','autoJingles','avoidRepeat','crossfade'].forEach(id => {
      const cb = elements[id];
      if (cb) cb.onchange = () => {
        radioState.automation[id] = cb.checked;
        this.persist();
      };
    });
    elements.repeatInterval.onchange = e => {
      radioState.automation.repeatInterval = +e.target.value;
      this.persist();
    };
    elements.crossfadeDuration.oninput = e => {
      radioState.automation.crossfadeDuration = +e.target.value;
      elements.crossfadeValue.textContent = e.target.value + 's';
      this.persist();
    };

    elements.adminBtn.onclick                = () => this.showModal('passwordModal');
    document.getElementById('emergencyStop').onclick    = () => this.stopBroadcast();
    document.getElementById('toggleBroadcast').onclick = () => this.toggleBroadcast();
    document.getElementById('backToPlayerBtn').onclick = () => this.showPlayerMode();

    document.querySelector('#passwordModal .btn-primary')
      .onclick = () => this.checkAdminPassword();
    document.querySelector('#passwordModal .btn-secondary')
      .onclick = () => this.closeModal('passwordModal');
  }

  loadState() {
    const saved = localStorage.getItem('radioState');
    if (saved) Object.assign(radioState, JSON.parse(saved));
    this.updateAllUI();
  }

  persist() {
    localStorage.setItem('radioState', JSON.stringify(radioState));
    this.syncManager.publishUpdate();
    this.updateAllUI();
  }

  startBroadcast() {
    if (radioState.isLive) return;
    radioState.isLive = true;
    elements.broadcastStatus.textContent = 'AO VIVO';
    this.scheduleNextTrack();
  }

  stopBroadcast() {
    radioState.isLive = false;
    this.audio.pause();
    elements.broadcastStatus.textContent = 'OFFLINE';
  }

  toggleBroadcast() {
    radioState.isLive ? this.stopBroadcast() : this.startBroadcast();
  }

  togglePlay() {
    if (!radioState.isPlaying) {
      this.audio.play().catch(() => {});
      radioState.isPlaying = true;
    } else {
      this.audio.pause();
      radioState.isPlaying = false;
    }
    this.updatePlayPauseIcon();
  }

  updatePlayPauseIcon() {
    const playI = elements.playPauseBtn.querySelector('.play-icon');
    const pauI  = elements.playPauseBtn.querySelector('.pause-icon');
    playI.style.display = radioState.isPlaying ? 'none' : 'block';
    pauI.style.display  = radioState.isPlaying ? 'block' : 'none';
  }

  setVolume(v) {
    radioState.volume = +v;
    this.audio.volume = v/100;
    elements.volumeValue.textContent = v + '%';
    this.persist();
  }

  updateTime() {
    const c = this.audio.currentTime || 0;
    const d = this.audio.duration    || 0;
    elements.trackTime.textContent = this.formatTime(c) + ' / ' + this.formatTime(d);
  }

  formatTime(sec) {
    const m = Math.floor(sec/60),
          s = Math.floor(sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  scheduleNextTrack() {
    if (!radioState.isLive) return;
    const period = this.currentPeriod();
    const config = radioState.schedule[period];
    let next = null;
    if      (config.type === 'music')  next = this.randomFrom(radioState.content.music);
    else if (config.type === 'program') next = this.randomFrom(radioState.content.program[period]);
    else                                 next = this.randomFrom(radioState.content.music);

    if (!next) {
      setTimeout(() => this.scheduleNextTrack(), 30000);
      return;
    }
    this.playTrack(next);
  }

  playTrack(track) {
    radioState.currentTrack = track;
    this.audio.src           = track.url;
    this.audio.volume        = radioState.volume/100;
    this.audio.play().catch(() => {});
    radioState.playHistory.push(track);
    radioState.stats.totalPlayed++;
    this.persist();
    this.updateTrackInfo(track);
    elements.playCount.textContent = `Faixas: ${radioState.stats.totalPlayed}`;
  }

  nextTrack() {
    if (radioState.isLive) this.scheduleNextTrack();
  }

  randomFrom(arr) {
    if (!arr.length) return null;
    return arr[Math.floor(Math.random()*arr.length)];
  }

  updateTrackInfo(t) {
    elements.currentTrack.textContent = this.formatFilename(t.name);
    elements.albumTitle.textContent   = this.titleByType(t);
    elements.trackGenre.textContent   = this.detectGenre(t.name);
    if (t.url) {
      elements.trackCover.src           = t.url;
      elements.trackCover.style.display = 'block';
      elements.albumCover.style.display = 'none';
    } else {
      elements.trackCover.style.display = 'none';
      elements.albumCover.style.display = 'block';
    }
  }

  formatFilename(name) {
    return name.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
  }

  detectGenre(name) {
    const n = name.toLowerCase();
    if (n.includes('rock'))       return 'Rock';
    if (n.includes('pop'))        return 'Pop';
    if (n.includes('jazz'))       return 'Jazz';
    if (n.includes('classical'))  return 'Clássica';
    if (n.includes('electronic')) return 'Eletrônica';
    if (n.includes('country'))    return 'Country';
    if (n.includes('blues'))      return 'Blues';
    return 'Variada';
  }

  titleByType(track) {
    if (radioState.content.jingle.some(t => t.publicId === track.publicId))
      return 'Vinheta';
    if (radioState.content.time.some(t => t.publicId === track.publicId))
      return 'Hora Certa';
    for (let p of ['morning','afternoon','evening','late']) {
      if (radioState.content.program[p].some(t => t.publicId === track.publicId))
        return this.titlePeriod(p);
    }
    return 'Música';
  }

  titlePeriod(key) {
    if (key === 'morning')   return 'Manhã Musical';
    if (key === 'afternoon') return 'Tarde Animada';
    if (key === 'evening')   return 'Noite Especial';
    return 'Madrugada Suave';
  }

  currentPeriod() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12)      return 'morning';
    if (h >= 12 && h < 18)     return 'afternoon';
    if (h >= 18 && h < 24)     return 'evening';
    return 'late';
  }

  switchInfoTab(tab) {
    document.querySelectorAll('.info-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.info-section').forEach(s => s.classList.remove('active'));
    document.querySelector(`button[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-section`).classList.add('active');
    if (tab === 'schedule') this.renderSchedule();
    if (tab === 'recent')   this.renderRecent();
    if (tab === 'requests') this.renderRequests();
  }

  switchAdminTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`button[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-tab`).classList.add('active');
    if (tab === 'content') this.renderLibrary();
    if (tab === 'reports') this.renderReports();
  }

  renderSchedule() {
    const list = elements.scheduleList;
    const periods = [
      { key: 'morning',   time: '06:00–12:00' },
      { key: 'afternoon', time: '12:00–18:00' },
      { key: 'evening',   time: '18:00–00:00' },
      { key: 'late',      time: '00:00–06:00' }
    ];
    list.innerHTML = periods.map(p => {
      const cur = this.currentPeriod() === p.key ? 'current' : '';
      return `
        <div class="schedule-item ${cur}">
          <span class="schedule-time">${p.time}</span>
          <span class="schedule-program">${this.titlePeriod(p.key)}</span>
        </div>
      `;
    }).join('');
  }

  saveScheduleConfig() {
    document.querySelectorAll('.time-slot').forEach(div => {
      const p = div.dataset.period;
      radioState.schedule[p].type = div.querySelector('.content-type-select').value;
      radioState.schedule[p].jingleFreq = +div.querySelector('.jingle-frequency').value;
    });
    this.persist();
  }

  resetSchedule() {
    Object.keys(radioState.schedule).forEach(k => {
      radioState.schedule[k] = { type: 'mixed', jingleFreq: 15 };
    });
    this.persist();
    this.renderSchedule();
  }

  renderRecent() {
    const c = elements.recentTracks;
    const arr = radioState.playHistory.slice(-5).reverse();
    if (!arr.length) {
      c.innerHTML = '<p>Nenhuma música tocada ainda.</p>';
      return;
    }
    c.innerHTML = arr.map(t => `
      <div class="recent-track">
        <span class="track-name">${this.formatFilename(t.name)}</span>
        <span class="track-time">${new Date(t.uploadedAt).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit'
        })}</span>
      </div>`).join('');
  }

  renderRequests() {
    const c = elements.requestsList;
    const arr = radioState.stats.requests.slice(-10).reverse();
    if (!arr.length) {
      c.innerHTML = '<p>Nenhum pedido ainda hoje.</p>';
      return;
    }
    c.innerHTML = arr.map(r => `
      <div class="request-item">
        <span class="request-song">${r.song}</span>
        <span class="request-time">${new Date(r.timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit'
        })}</span>
      </div>`).join('');
  }

  sendRequest() {
    const inp = document.getElementById('requestSong');
    const txt = inp.value.trim();
    if (!txt) return;
    radioState.stats.requests.push({ song: txt, timestamp: new Date().toISOString() });
    inp.value = '';
    this.persist();
    this.renderRequests();
  }

  renderLibrary() {
    elements.musicCount.textContent  = radioState.content.music.length; 
    elements.jingleCount.textContent = radioState.content.jingle.length;
    elements.timeCount.textContent   = radioState.content.time.length;
    const totalProg = Object.values(radioState.content.program).reduce((s,a)=>s+a.length,0);
    elements.programCount.textContent = totalProg;

    this.renderList('musicList', radioState.content.music,   'music');
    this.renderList('jingleList', radioState.content.jingle, 'jingle');
    this.renderList('timeList',   radioState.content.time,   'time');

    let html = '';
    ['morning','afternoon','evening','late'].forEach(p => {
      const arr = radioState.content.program[p];
      if (!arr.length) return;
      html += `<h5>${this.titlePeriod(p)} (${arr.length})</h5>`;
      html += arr.map((t,i) => `
        <div class="file-item">
          <span class="file-name">${this.formatFilename(t.name)}</span>
          <button class="btn-small" onclick="radioSystem.deleteProgram('${p}',${i})">❌</button>
        </div>`).join('');
    });
    elements.programList.innerHTML = html || '<p>Nenhum programa encontrado.</p>';
  }

  renderList(listId, arr, type) {
    const c = elements[listId];
    if (!arr.length) {
      c.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
      return;
    }
    c.innerHTML = arr.map((t,i) => `
      <div class="file-item">
        <span class="file-name">${this.formatFilename(t.name)}</span>
        <button class="btn-small" onclick="radioSystem.deleteContent('${type}',${i})">❌</button>
      </div>`).join('');
  }

  renderReports() {
    this.renderTopTracks();
    this.renderRequestsReport();
    this.renderLogs();
  }

  renderTopTracks() {
    const el = document.getElementById('topTracks');
    const arr = Object.entries(radioState.stats.popularTracks)
      .sort((a,b) => b[1]-a[1])
      .slice(0,10);
    if (!arr.length) {
      el.innerHTML = '<p>Nenhuma estatística ainda.</p>';
      return;
    }
    el.innerHTML = arr.map(([name,count]) => `
      <div class="report-item">
        <span>${this.formatFilename(name)}</span>
        <span class="play-count">${count}x</span>
      </div>`).join('');
  }

  renderRequestsReport() {
    const el = document.getElementById('requestsReport');
    const arr = radioState.stats.requests.slice(-5).reverse();
    if (!arr.length) {
      el.innerHTML = '<p>Nenhum pedido recebido.</p>';
      return;
    }
    el.innerHTML = arr.map(r => `
      <div class="report-item">
        <span>${r.song}</span>
        <span class="track-time">${new Date(r.timestamp).toLocaleString('pt-BR')}</span>
      </div>`).join('');
  }

  renderLogs() {
    const el = document.getElementById('systemLogs');
    const logs = [
      { time: new Date(), message: 'Sistema iniciado',      type:'info' },
      { time: new Date(Date.now()-30000), message: 'Transmissão ativa', type:'success' },
      { time: new Date(Date.now()-60000), message: 'Conteúdo carregado', type:'info' }
    ];
    el.innerHTML = logs.map(log => `
      <div class="log-item ${log.type}">
        <span class="log-time">${log.time.toLocaleTimeString('pt-BR')}</span>
        <span class="log-message">${log.message}</span>
      </div>`).join('');
  }

  deleteContent(type, idx) {
    if (!confirm('Excluir este item?')) return;
    radioState.content[type].splice(idx,1);
    this.persist();
  }

  deleteProgram(period, idx) {
    if (!confirm('Excluir este programa?')) return;
    radioState.content.program[period].splice(idx,1);
    this.persist();
  }

  updateAllUI() {
    this.updatePlayPauseIcon();
    elements.playCount.textContent     = `Faixas: ${radioState.stats.totalPlayed}`;
    elements.broadcastStatus.textContent = radioState.isLive ? 'AO VIVO' : 'OFFLINE';
    elements.volumeSlider.value       = radioState.volume;
    elements.volumeValue.textContent  = radioState.volume + '%';
    this.renderSchedule();
    this.renderRecent();
    this.renderRequests();
    this.renderLibrary();
    this.renderReports();
  }

  showModal(id)  { document.getElementById(id).style.display = 'flex'; }
  closeModal(id) { document.getElementById(id).style.display = 'none';  }
  showPlayerMode() {
    elements.adminMode.style.display  = 'none';
    document.getElementById('playerMode').style.display = 'flex';
    this.syncManager.isAdmin = false;
  }

  checkAdminPassword() {
    const pwd = elements.adminPassword.value;
    if (pwd === 'admin123') {
      this.closeModal('passwordModal');
      document.getElementById('playerMode').style.display = 'none';
      elements.adminMode.style.display  = 'block';
      this.syncManager.isAdmin = true;
      this.updateAllUI();
    } else {
      alert('Senha incorreta!');
      elements.adminPassword.value = '';
    }
  }
}

// 7. Gerenciador de Upload para Cloudinary
class ContentUploader {
  constructor(system) {
    this.system = system;
  }

  async uploadContent(type) {
    const map = {
      music: 'musicUpload',
      jingle: 'jingleUpload',
      time: 'timeUpload',
      program: 'programUpload'
    };
    const input = document.getElementById(map[type]);
    if (!input.files.length) return alert('Selecione ao menos 1 arquivo.');

    for (let file of input.files) {
      await this.uploadOne(file, type);
    }
    input.value = '';
    this.system.persist();
    alert('Upload e sincronização concluídos!');
  }

  async uploadOne(file, type) {
    const fd = new FormData();
    let folder = type;
    if (type === 'program') {
      const p = elements.programSelect.value;
      folder = `program/${p}`;
    }
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    fd.append('folder', `radio-louro/${folder}`);
    fd.append('resource_type', 'auto');

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`,
      { method: 'POST', body: fd }
    );
    const data = await res.json();
    const obj = {
      name: file.name,
      url: data.secure_url,
      publicId: data.public_id,
      uploadedAt: new Date().toISOString()
    };
    if (type === 'program') {
      const p = elements.programSelect.value;
      radioState.content.program[p].push(obj);
    } else {
      radioState.content[type].push(obj);
    }
  }
}

// 8. Funções globais para botões HTML
function uploadContent(type)    { uploader.uploadContent(type); }
function exportReport() {
  const blob = new Blob([JSON.stringify(radioState.stats, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
}
function clearReports() {
  if (!confirm('Limpar todos os relatórios?')) return;
  radioState.stats = { totalPlayed:0, popularTracks:{}, requests:[] };
  radioState.playHistory = [];
  radioSystem.persist();
}

// 9. Inicialização
window.addEventListener('DOMContentLoaded', () => {
  radioSystem = new RadioLive24();
  uploader    = new ContentUploader(radioSystem);
});
