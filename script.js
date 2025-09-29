/**
 * radio_js.js — Versão corrigida e completa
 * Rádio Supermercado do Louro — Sincronização via Cloudinary + fallback localStorage
 *
 * IMPORTANTE: para produção NÃO coloque apiSecret no cliente.
 */

/* =========================
   Cloudinary / Sync Config
   ========================= */
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U', // NÃO use isso em produção no cliente
    uploadPreset: 'radio_preset'
};

const SYNC_CONFIG = {
    enabled: true,
    interval: 10000, // 10s
    storageKey: 'radioSyncData',
    lastUpdateKey: 'radioLastUpdate'
};

/* =========================
   Estado global
   ========================= */
let radioState = {
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    volume: 70,
    playHistory: [],
    recentTracks: [],
    listeners: 0,
    uptime: 0,
    lastSync: null,
    content: {
        music: [],
        jingles: [],
        time: [],
        programs: { morning: [], afternoon: [], evening: [], late: [] }
    },
    schedule: {
        morning: { type: 'mixed', jingleFreq: 15 },
        afternoon: { type: 'mixed', jingleFreq: 10 },
        evening: { type: 'mixed', jingleFreq: 20 },
        late: { type: 'music', jingleFreq: 30 }
    },
    automation: {
        hourlyTime: true,
        autoJingles: true,
        avoidRepeat: true,
        repeatInterval: 50,
        crossfade: false,
        crossfadeDuration: 3
    },
    stats: { totalPlayed: 0, dailyStats: {}, popularTracks: {}, requests: [] }
};

/* Cache DOM */
let elements = {};

/* ================
   RadioSyncManager
   ================ */
class RadioSyncManager {
    constructor() {
        this.syncInterval = null;
        this.isAdmin = false;
        this.init();
    }

    init() {
        if (!SYNC_CONFIG.enabled) return;
        this.startSyncLoop();
        window.addEventListener('focus', () => this.forceSync());
        window.addEventListener('storage', (e) => this.handleStorageChange(e));
    }

    startSyncLoop() {
        if (this.syncInterval) clearInterval(this.syncInterval);
        this.syncInterval = setInterval(() => this.checkForUpdates(), SYNC_CONFIG.interval);
    }

    async checkForUpdates() {
        try {
            const centralData = await this.fetchCentralData();
            if (centralData && this.hasUpdates(centralData)) {
                console.log('🔄 Atualizações detectadas, sincronizando...');
                await this.syncData(centralData);
                this.notifyUpdate();
            } else {
                // fallback local
                this.syncWithLocalStorage();
            }
        } catch (err) {
            console.warn('Erro na sincronização (checkForUpdates):', err);
            this.syncWithLocalStorage();
        }
    }

    async fetchCentralData() {
        try {
            const url = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/raw/upload/radio-louro/sync/radio-state.json`;
            const resp = await fetch(url, { cache: 'no-cache' });
            if (!resp.ok) return null;
            return await resp.json();
        } catch (err) {
            console.warn('fetchCentralData falhou:', err);
            return null;
        }
    }

    hasUpdates(centralData) {
        if (!centralData || !centralData.lastSync) return false;
        const centralUpdate = new Date(centralData.lastSync);
        const localUpdate = radioState.lastSync ? new Date(radioState.lastSync) : new Date(0);
        return centralUpdate > localUpdate;
    }

    async syncData(centralData) {
        // Mesclar com segurança
        radioState.content = { ...radioState.content, ...(centralData.content || {}) };
        radioState.schedule = { ...radioState.schedule, ...(centralData.schedule || {}) };
        radioState.automation = { ...radioState.automation, ...(centralData.automation || {}) };
        radioState.lastSync = centralData.lastSync || new Date().toISOString();

        this.saveLocalData();
        if (typeof radioSystem !== 'undefined' && radioSystem) {
            radioSystem.updateContentLibrary();
            radioSystem.updateReports();
        }
    }

    syncWithLocalStorage() {
        try {
            const storedSync = localStorage.getItem(SYNC_CONFIG.lastUpdateKey);
            const storedData = localStorage.getItem(SYNC_CONFIG.storageKey);
            if (storedSync && storedData) {
                const syncTime = new Date(storedSync);
                const localSyncTime = radioState.lastSync ? new Date(radioState.lastSync) : new Date(0);
                if (syncTime > localSyncTime) {
                    const data = JSON.parse(storedData);
                    this.syncData(data);
                }
            }
        } catch (err) {
            console.warn('syncWithLocalStorage erro:', err);
        }
    }

    handleStorageChange(event) {
        if (!event) return;
        if (event.key === SYNC_CONFIG.storageKey && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                this.syncData(data);
            } catch (err) {
                console.warn('Erro ao processar storage event:', err);
            }
        }
    }

    async publishUpdate() {
        if (!this.isAdmin) {
            console.warn('Tentativa de publish sem ser admin');
            // ainda atualiza local
        }

        const updateData = {
            content: radioState.content,
            schedule: radioState.schedule,
            automation: radioState.automation,
            lastSync: new Date().toISOString()
        };

        try {
            await this.publishToCentral(updateData);
        } catch (err) {
            console.warn('publishToCentral falhou:', err);
        }

        localStorage.setItem(SYNC_CONFIG.storageKey, JSON.stringify(updateData));
        localStorage.setItem(SYNC_CONFIG.lastUpdateKey, updateData.lastSync);
        radioState.lastSync = updateData.lastSync;
    }

    async publishToCentral(data) {
        // Upload de um JSON "raw" para Cloudinary (pasta sync, public_id radio-state)
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const fd = new FormData();
        fd.append('file', blob, 'radio-state.json');
        fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        fd.append('folder', 'radio-louro/sync');
        fd.append('resource_type', 'raw');
        fd.append('public_id', 'radio-state');
        fd.append('overwrite', 'true');

        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/raw/upload`;
        const resp = await fetch(url, { method: 'POST', body: fd });
        if (!resp.ok) {
            throw new Error('Erro HTTP ao publicar na Cloudinary: ' + resp.status);
        }
        return await resp.json();
    }

    notifyUpdate() {
        this.showSyncNotification();
        window.dispatchEvent(new CustomEvent('radioContentUpdated', { detail: { timestamp: radioState.lastSync } }));
    }

    showSyncNotification() {
        const el = document.createElement('div');
        el.className = 'sync-notification';
        el.style.position = 'fixed';
        el.style.top = '20px';
        el.style.right = '20px';
        el.style.zIndex = 10000;
        el.style.padding = '12px 18px';
        el.style.background = 'linear-gradient(135deg,#4FACFE,#00F2FE)';
        el.style.color = 'white';
        el.style.borderRadius = '8px';
        el.innerText = 'Conteúdo sincronizado!';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    setAdminMode(isAdmin) {
        this.isAdmin = isAdmin;
        console.log('isAdmin =', isAdmin);
    }

    forceSync() {
        this.checkForUpdates();
    }

    destroy() {
        if (this.syncInterval) clearInterval(this.syncInterval);
    }
}

/* ======================
   ContentUploader
   ====================== */
class ContentUploader {
    constructor(radioSystem) {
        this.radio = radioSystem;
    }

    async uploadContent(type) {
        const mapping = { music: 'musicUpload', jingles: 'jingleUpload', time: 'timeUpload', programs: 'programUpload' };
        const inputId = mapping[type];
        const input = inputId ? document.getElementById(inputId) : null;
        if (!input || input.files.length === 0) {
            alert('Selecione pelo menos um arquivo para upload.');
            return;
        }

        const files = Array.from(input.files);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const uploaded = await this.uploadToCloudinary(file, type);
                this.addToLibrary(uploaded, type);
            }
            input.value = '';
            if (this.radio) {
                this.radio.saveData();
                this.radio.updateContentLibrary();
            }
            if (this.radio && this.radio.syncManager && this.radio.syncManager.isAdmin) {
                await this.radio.syncManager.publishUpdate();
                this.showSyncSuccess();
            }
            alert('Upload concluído e sincronizado (quando admin).');
        } catch (err) {
            console.error('uploadContent erro:', err);
            alert('Erro no upload: ' + (err.message || err));
        }
    }

    async uploadToCloudinary(file, type) {
        const fd = new FormData();
        let folder = type === 'programs' ? 'programs' : type;
        fd.append('file', file);
        fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        fd.append('folder', `radio-louro/${folder}`);
        fd.append('resource_type', 'auto');

        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`;
        const resp = await fetch(url, { method: 'POST', body: fd });
        if (!resp.ok) throw new Error('Erro HTTP Upload: ' + resp.status);
        const data = await resp.json();
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0,
            format: data.format,
            uploadedAt: new Date().toISOString()
        };
    }

    addToLibrary(file, type) {
        if (type === 'programs') {
            const periodSelect = document.getElementById('programSelect');
            const period = (periodSelect && periodSelect.value) || 'morning';
            radioState.content.programs[period].push(file);
        } else {
            radioState.content[type].push(file);
        }
        radioState.lastSync = new Date().toISOString();
    }

    showSyncSuccess() {
        const el = document.createElement('div');
        el.className = 'sync-success';
        el.style.position = 'fixed';
        el.style.top = '20px'; el.style.right = '20px';
        el.style.padding = '10px 14px';
        el.style.background = '#22c55e'; el.style.color = 'white';
        el.style.borderRadius = '8px';
        el.innerText = 'Conteúdo enviado e sincronizado!';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
}

/* ======================
   RadioLive24 — Principal
   ====================== */
class RadioLive24 {
    constructor() {
        this.currentPeriod = 'morning';
        this.playbackQueue = [];
        this.programTimer = null;
        this.uptimeTimer = null;
        this.syncManager = null;
        this.init().catch(e => console.error('Erro init:', e));
    }

    async init() {
        this.initElements();
        this.loadStoredData();
        this.setupEventListeners();

        // Sync
        this.syncManager = new RadioSyncManager();

        // Aguardar uma tentativa de sync inicial (máx 5s)
        await this.waitForInitialSync(5000);

        // Start
        this.startBroadcast();
        this.startUptime();

        console.log('Rádio inicializada.');
    }

    initElements() {
        const ids = [
            'audioPlayer','playPauseBtn','volumeSlider','volumeValue','albumCover','trackCover',
            'albumTitle','currentTrack','trackTime','trackGenre','currentProgram','nextProgram',
            'broadcastStatus','playCount','scheduleList','recentTracks','requestsList','adminBtn',
            'playerMode','adminMode'
        ];
        elements = {};
        ids.forEach(id => elements[id] = document.getElementById(id));
        if (!elements.audioPlayer) {
            // cria elemento audio em tempo de execução se não existir
            const audio = document.createElement('audio');
            audio.id = 'audioPlayer';
            audio.preload = 'auto';
            document.body.appendChild(audio);
            elements.audioPlayer = audio;
        }
    }

    async waitForInitialSync(timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (radioState.lastSync) return;
            await new Promise(r => setTimeout(r, 300));
        }
    }

    setupEventListeners() {
        if (elements.playPauseBtn) elements.playPauseBtn.addEventListener('click', () => this.togglePlayback());
        if (elements.volumeSlider) elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        if (elements.audioPlayer) {
            elements.audioPlayer.addEventListener('ended', () => this.playNext());
            elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
            elements.audioPlayer.addEventListener('error', (e) => this.handleAudioError(e));
            elements.audioPlayer.addEventListener('canplay', () => this.onTrackReady());
        }
        if (elements.adminBtn) elements.adminBtn.addEventListener('click', () => this.openAdminModal());

        window.addEventListener('radioContentUpdated', () => {
            this.updateContentLibrary();
            this.updateReports();
            this.checkPlaylistStatus();
        });
    }

    loadStoredData() {
        try {
            const stored = localStorage.getItem('radioLive24State');
            if (stored) {
                const parsed = JSON.parse(stored);
                radioState = { ...radioState, ...parsed };
            }
        } catch (err) {
            console.warn('loadStoredData erro:', err);
        }
    }

    saveData() {
        try {
            const safe = { ...radioState, playHistory: radioState.playHistory.slice(-100) };
            localStorage.setItem('radioLive24State', JSON.stringify(safe));
            // se admin, publicar atualização automática
            if (this.syncManager && this.syncManager.isAdmin) {
                this.syncManager.publishUpdate().catch(err => console.warn('publishUpdate erro:', err));
            }
        } catch (err) {
            console.warn('saveData erro:', err);
        }
    }

    startBroadcast() {
        if (radioState.isLive) return;
        radioState.isLive = true;
        this.updateBroadcastStatus('🔴 AO VIVO');
        this.updateCurrentPeriod();
        this.scheduleNextTrack();

        if (this.programTimer) clearInterval(this.programTimer);
        this.programTimer = setInterval(() => {
            this.updateCurrentPeriod();
            this.checkTimeAnnouncement();
            this.checkJingleTime();
            this.updateListenerCount();
        }, 30000);
    }

    stopBroadcast() {
        radioState.isLive = false;
        if (this.programTimer) clearInterval(this.programTimer);
        if (elements.audioPlayer) elements.audioPlayer.pause();
        radioState.isPlaying = false;
        this.updateBroadcastStatus('⚫ OFFLINE');
        this.updatePlayPauseButton();
    }

    updateCurrentPeriod() {
        const h = new Date().getHours();
        const newPeriod = (h >= 6 && h < 12) ? 'morning' : (h >= 12 && h < 18) ? 'afternoon' : (h >= 18 && h < 24) ? 'evening' : 'late';
        if (newPeriod !== this.currentPeriod) {
            this.currentPeriod = newPeriod;
            this.updateProgramInfo();
        }
    }

    updateProgramInfo() {
        const programs = { morning: '🌅 Manhã Musical', afternoon: '☀️ Tarde Animada', evening: '🌆 Noite Especial', late: '🌙 Madrugada Suave' };
        const nextMap = { morning: 'afternoon', afternoon: 'evening', evening: 'late', late: 'morning' };
        if (elements.currentProgram) elements.currentProgram.textContent = programs[this.currentPeriod] || 'Música';
        if (elements.nextProgram) elements.nextProgram.textContent = programs[nextMap[this.currentPeriod]] || '';
    }

    checkTimeAnnouncement() {
        if (!radioState.automation.hourlyTime) return;
        const now = new Date();
        if (now.getMinutes() === 0) this.queueTimeAnnouncement();
    }

    checkJingleTime() {
        if (!radioState.automation.autoJingles) return;
        const schedule = radioState.schedule[this.currentPeriod];
        const interval = (schedule && schedule.jingleFreq ? schedule.jingleFreq : 15) * 60 * 1000;
        if (!this._lastJingle || (Date.now() - this._lastJingle) > interval) {
            this._lastJingle = Date.now();
            this.queueJingle();
        }
    }

    scheduleNextTrack() {
        if (!radioState.isLive) return;
        // Se tiver fila
        if (this.playbackQueue.length > 0) {
            const next = this.playbackQueue.shift();
            this.playTrack(next);
            return;
        }

        const schedule = radioState.schedule[this.currentPeriod];
        let nextTrack = null;
        if (!schedule) nextTrack = this.getRandomMusic();
        else {
            if (schedule.type === 'music') nextTrack = this.getRandomMusic();
            else if (schedule.type === 'program') nextTrack = this.getRandomProgram(this.currentPeriod);
            else nextTrack = this.getRandomMusic();
        }

        if (nextTrack) this.playTrack(nextTrack);
        else setTimeout(() => this.scheduleNextTrack(), 15000);
    }

    playNext() {
        this.scheduleNextTrack();
    }

    async playTrack(track) {
        if (!track) return;
        radioState.currentTrack = track;
        this.loadAndPlayTrack(track);
        this.updateTrackInfo(track);
        this.addToHistory(track);
        this.updateRecentTracks();
    }

    loadAndPlayTrack(track) {
        if (!elements.audioPlayer) return;
        elements.audioPlayer.src = track.url;
        elements.audioPlayer.volume = (radioState.volume || 70) / 100;
        radioState.isPlaying = true;
        elements.audioPlayer.play().catch(err => {
            console.warn('play erro:', err);
            this.showAutoplayPrompt();
        });
        this.updatePlayPauseButton();
    }

    addToHistory(track) {
        radioState.playHistory = radioState.playHistory || [];
        radioState.playHistory.push({ ...track, playedAt: new Date().toISOString() });
        radioState.stats.totalPlayed = (radioState.stats.totalPlayed || 0) + 1;
        this.saveData();
    }

    getRandomMusic() {
        const arr = radioState.content.music || [];
        if (arr.length === 0) return null;
        if (radioState.automation.avoidRepeat && radioState.playHistory && radioState.playHistory.length > 0) {
            const recentLimit = Math.min(radioState.automation.repeatInterval || 50, arr.length - 1);
            const recentPublic = new Set(radioState.playHistory.slice(-recentLimit).map(x => x.publicId));
            const filtered = arr.filter(a => !recentPublic.has(a.publicId));
            return (filtered.length > 0) ? filtered[Math.floor(Math.random() * filtered.length)] : arr[Math.floor(Math.random() * arr.length)];
        }
        return arr[Math.floor(Math.random() * arr.length)];
    }

    getRandomProgram(period) {
        const list = (radioState.content.programs && radioState.content.programs[period]) || [];
        if (!list || list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    getRandomJingle() {
        const list = radioState.content.jingles || [];
        if (!list || list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    getRandomTimeAnnouncement() {
        const list = radioState.content.time || [];
        if (!list || list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }

    queueTimeAnnouncement() {
        const t = this.getRandomTimeAnnouncement();
        if (t) this.playbackQueue.unshift(t);
    }

    queueJingle() {
        const j = this.getRandomJingle();
        if (j) this.playbackQueue.push(j);
    }

    updateTrackInfo(track) {
        if (elements.currentTrack) elements.currentTrack.textContent = this.formatTrackName(track.name || track.publicId || 'Faixa');
        if (elements.albumTitle) elements.albumTitle.textContent = this.getTrackCategory(track);
        if (elements.trackGenre) elements.trackGenre.textContent = track.format || '';
        this.updateTrackCover(track);
        this.updatePlayCount();
    }

    updateTrackCover(track) {
        if (elements.trackCover && track && track.url) {
            elements.trackCover.style.display = 'block';
            elements.trackCover.src = track.url;
        }
    }

    formatTrackName(filename) {
        if (!filename) return 'Desconhecido';
        return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
    }

    getTrackCategory(track) {
        if (!track) return '';
        if (radioState.content.jingles && radioState.content.jingles.includes(track)) return '📢 Vinheta';
        if (radioState.content.time && radioState.content.time.includes(track)) return '🕐 Hora Certa';
        for (const p in (radioState.content.programs || {})) {
            if ((radioState.content.programs[p] || []).includes(track)) return '🎙 Programa';
        }
        return '🎵 Música';
    }

    updateTime() {
        if (!elements.trackTime || !elements.audioPlayer) return;
        const cur = elements.audioPlayer.currentTime || 0;
        const dur = elements.audioPlayer.duration || 0;
        elements.trackTime.textContent = `${this.formatSeconds(cur)} / ${this.formatSeconds(dur)}`;
    }

    formatSeconds(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2,'0')}`;
    }

    onTrackReady() {
        radioState.isPlaying = true;
        this.updatePlayPauseButton();
        this.updatePlayCount();
    }

    handleAudioError(e) {
        console.error('Erro no áudio:', e);
        // tentar próxima
        setTimeout(() => { if (radioState.isLive) this.playNext(); }, 3000);
    }

    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.style.position = 'fixed';
        prompt.style.left = '50%'; prompt.style.top = '50%';
        prompt.style.transform = 'translate(-50%,-50%)';
        prompt.style.padding = '16px 20px'; prompt.style.zIndex = 9999;
        prompt.style.background = 'rgba(0,0,0,0.8)'; prompt.style.color = 'white';
        prompt.style.borderRadius = '8px';
        prompt.innerText = 'Clique para ativar o áudio';
        prompt.addEventListener('click', () => {
            if (elements.audioPlayer) elements.audioPlayer.play().catch(()=>{});
            prompt.remove();
        });
        document.body.appendChild(prompt);
        setTimeout(()=>prompt.remove(), 10000);
    }

    togglePlayback() {
        if (!elements.audioPlayer) return;
        if (elements.audioPlayer.paused) {
            elements.audioPlayer.play().catch(()=>this.showAutoplayPrompt());
            radioState.isPlaying = true;
        } else {
            elements.audioPlayer.pause();
            radioState.isPlaying = false;
        }
        this.updatePlayPauseButton();
    }

    updatePlayPauseButton() {
        if (!elements.playPauseBtn) return;
        elements.playPauseBtn.textContent = (radioState.isPlaying ? '⏸' : '▶');
    }

    setVolume(value) {
        const v = parseInt(value);
        radioState.volume = v;
        if (elements.audioPlayer) elements.audioPlayer.volume = v / 100;
        if (elements.volumeValue) elements.volumeValue.textContent = v + '%';
        this.saveData();
    }

    updatePlayCount() {
        if (elements.playCount) elements.playCount.textContent = `Faixas: ${radioState.stats.totalPlayed || 0}`;
    }

    updateListenerCount() {
        radioState.listeners = Math.floor(Math.random()*50) + 5;
    }

    startUptime() {
        const radioStart = new Date('2025-09-27T00:00:00');
        if (this.uptimeTimer) clearInterval(this.uptimeTimer);
        this.uptimeTimer = setInterval(()=>{
            const now = new Date();
            const seconds = Math.max(0, Math.floor((now - radioStart)/1000));
            const hh = Math.floor(seconds / 3600).toString().padStart(2,'0');
            const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
            const ss = (seconds % 60).toString().padStart(2,'0');
            const up = `${hh}:${mm}:${ss}`;
            const el = document.getElementById('uptime');
            if (el) el.textContent = up;
        }, 1000);
    }

    updateBroadcastStatus(status) {
        if (elements.broadcastStatus) elements.broadcastStatus.textContent = status;
    }

    updateContentLibrary() {
        // Atualizar lista de tocadas recentes
        const container = document.getElementById('recentTracks');
        if (container) {
            container.innerHTML = '';
            const tracks = (radioState.playHistory || []).slice(-10).reverse();
            if (tracks.length === 0) container.innerHTML = '<p>Nenhuma faixa tocada ainda.</p>';
            else {
                tracks.forEach(t => {
                    const div = document.createElement('div');
                    div.className = 'recent-track';
                    div.innerHTML = `<div class="track-name">${this.formatTrackName(t.name || t.publicId)}</div>
                                     <div class="track-time">${(new Date(t.playedAt)).toLocaleTimeString()}</div>`;
                    container.appendChild(div);
                });
            }
        }

        // Programação
        const scheduleEl = document.getElementById('scheduleList');
        if (scheduleEl) {
            scheduleEl.innerHTML = '';
            for (const period of ['morning','afternoon','evening','late']) {
                const item = document.createElement('div');
                item.className = 'schedule-item' + (this.currentPeriod === period ? ' current' : '');
                item.innerHTML = `<span class="schedule-time">${period}</span><span class="schedule-program">${(radioState.schedule[period]||{}).type||'music'}</span>`;
                scheduleEl.appendChild(item);
            }
        }

        // Pedidos
        const reqEl = document.getElementById('requestsList');
        if (reqEl) {
            reqEl.innerHTML = '';
            const reqs = radioState.stats.requests || [];
            if (reqs.length === 0) reqEl.innerHTML = '<p>Nenhum pedido ainda.</p>';
            else reqs.slice().reverse().forEach(r => {
                const div = document.createElement('div');
                div.className = 'request-item';
                div.innerHTML = `<div class="request-song">${r.text}</div><div class="request-time">${new Date(r.at).toLocaleString()}</div>`;
                reqEl.appendChild(div);
            });
        }
    }

    updateReports() {
        const elTotal = document.getElementById('totalPlayed');
        if (elTotal) elTotal.textContent = (radioState.stats.totalPlayed || 0);
        const serverEl = document.getElementById('serverStatus');
        if (serverEl) serverEl.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
    }

    checkPlaylistStatus() {
        // If current track not in content, try scheduleNextTrack
        if (!radioState.currentTrack) this.scheduleNextTrack();
    }

    showAutoplayPromptIfNeeded() {
        if (elements.audioPlayer && elements.audioPlayer.paused && radioState.isPlaying) this.showAutoplayPrompt();
    }

    openAdminModal() {
        const pwd = prompt('Senha de admin (protótipo):');
        if (pwd === 'admin' || pwd === '1234') {
            // liberou admin
            if (this.syncManager) this.syncManager.setAdminMode(true);
            alert('Modo admin ativado (temporário).');
            // Exibir painel admin se existir
            if (elements.playerMode) elements.playerMode.style.display = 'none';
            if (elements.adminMode) elements.adminMode.style.display = 'block';
        } else {
            alert('Senha incorreta.');
        }
    }

    closeAdminModal() {
        if (elements.playerMode) elements.playerMode.style.display = 'flex';
        if (elements.adminMode) elements.adminMode.style.display = 'none';
        if (this.syncManager) this.syncManager.setAdminMode(false);
    }

    // UI helpers
    showError(msg) {
        console.error(msg);
        alert(msg);
    }
}

/* ============================
   Inicialização global
   ============================ */
let radioSystem = null;
let uploader = null;

function initRadioSystem() {
    try {
        radioSystem = new RadioLive24();
        uploader = new ContentUploader(radioSystem);
        setTimeout(() => {
            radioSystem.updateContentLibrary();
            radioSystem.updateReports();
        }, 800);
    } catch (err) {
        console.error('initRadioSystem erro:', err);
        setTimeout(initRadioSystem, 2000);
    }
}

/* Eventos de rede e lifecycle */
window.addEventListener('load', () => {
    initRadioSystem();
});
window.addEventListener('online', () => { if (radioSystem && radioSystem.syncManager) radioSystem.syncManager.forceSync(); });
window.addEventListener('beforeunload', () => { if (radioSystem) radioSystem.saveData(); });

/* Expor funções chamadas por botões inline (se houver) */
window.uploadContent = async function(type){ if (uploader) await uploader.uploadContent(type); };
window.checkAdminPassword = function(){ if (radioSystem) radioSystem.openAdminModal(); };
window.closeModal = function(id){ /* implementar se necessário */ };

console.log('radio_js (corrigido) carregado.');
