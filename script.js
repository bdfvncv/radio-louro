// Funções globais para compatibilidade com HTML
window.uploadFiles = (category) => fileManager.uploadFiles(category);
window.checkPassword = () => adminManager.checkPassword();
window.closeModal = (modalId) => adminManager.hideModal(modalId);
window.radioManager = radioManager; // Para acesso no autoplay prompt

// Funções para gerenciamento de playlist
window.shufflePlaylist = () => {
    Object.keys(radioState.playlists).forEach(key => {
        if (Array.isArray(radioState.playlists[key])) {
            radioState.playlists[key] = shuffleArray(radioState.playlists[key]);
        } else if (typeof radioState.playlists[key] === 'object') {
            Object.keys(radioState.playlists[key]).forEach(albumKey => {
                radioState.playlists[key][albumKey] = shuffleArray(radioState.playlists[key][albumKey]);
            });
        }
    });
    radioState.save();
    adminManager.updatePlaylistView();
    notifications.success('Playlists embaralhadas!');
};

window.clearPlaylist = () => {
    if (confirm('Tem certeza que deseja limpar TODAS as playlists? Esta ação não pode ser desfeita!')) {
        radioState.playlists = {
            music: [],
            time: [],
            ads: [],
            albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
        };
        radioState.save();
        adminManager.updatePlaylistView();
        notifications.success('Todas as playlists foram limpas');
    }
};

window.exportPlaylist = () => {
    const dataStr = JSON.stringify(radioState.playlists, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `radio-playlist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    notifications.success('Playlist exportada!');
};

// Funções para álbuns
window.setActiveAlbum = () => {
    const select = dom.get('activeAlbumSelect');
    if (!select) return;
    
    const selectedAlbum = select.value;
    radioState.activeAlbum = selectedAlbum || null;
    radioState.save();
    
    // Atualizar UI do player
    updateAlbumDisplay();
    
    const message = selectedAlbum ? 
        `Álbum "${getAlbumData()[selectedAlbum]?.title}" ativado!` : 
        'Voltou para playlist geral';
    
    notifications.success(message);
    
    // Se não há música tocando, iniciar com novo álbum
    if (radioState.isLive && !radioState.currentTrack) {
        setTimeout(() => radioManager.playNext(), 1000);
    }
};

window.openCoverModal = (albumKey) => {
    // Criar modal para upload de capa
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content glass">
            <h3>🖼️ Alterar Capa - ${getAlbumData()[albumKey]?.title}</h3>
            <input type="file" id="tempCoverUpload" accept="image/*" class="modal-input">
            <div class="modal-buttons">
                <button onclick="uploadAlbumCover('${albumKey}')" class="btn-primary">Alterar</button>
                <button onclick="removeCover('${albumKey}')" class="btn-danger">Remover</button>
                <button onclick="this.closest('.modal').remove()" class="btn-secondary">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.classList.add('show');
};

window.uploadAlbumCover = async (albumKey) => {
    const fileInput = document.getElementById('tempCoverUpload');
    const file = fileInput?.files[0];
    
    if (!file) {
        notifications.warning('Selecione uma imagem!');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.cloudinary.uploadPreset);
        formData.append('folder', 'radio-louro/covers');
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro no upload');
        
        const data = await response.json();
        radioState.albumCovers[albumKey] = data.secure_url;
        radioState.save();
        
        adminManager.updateCoversGrid();
        updateAlbumDisplay();
        
        document.querySelector('.modal')?.remove();
        notifications.success('Capa alterada com sucesso!');
        
    } catch (error) {
        notifications.error('Erro ao fazer upload da capa');
    }
};

window.removeCover = (albumKey) => {
    if (!confirm('Tem certeza que deseja remover esta capa?')) return;
    
    delete radioState.albumCovers[albumKey];
    radioState.save();
    
    adminManager.updateCoversGrid();
    updateAlbumDisplay();
    
    document.querySelector('.modal')?.remove();
    notifications.success('Capa removida!');
};

// Funções para relatórios
window.refreshReports = () => {
    adminManager.updateReports();
    notifications.info('Relatórios atualizados');
};

window.exportReports = () => {
    const stats = radioState.getStats();
    const reportData = {
        generatedAt: new Date().toISOString(),
        statistics: stats,
        playHistory: radioState.playHistory,
        topTracks: Object.entries(radioState.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20)
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `radio-relatorio-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    notifications.success('Relatório exportado!');
};

window.resetPlayCount = () => {
    if (!confirm('Tem certeza que deseja resetar todos os contadores de reprodução?')) return;
    
    radioState.playHistory = {};
    radioState.playCount = 0;
    radioState.save();
    
    adminManager.updateReports();
    radioManager.updateStats();
    notifications.success('Contadores resetados!');
};

// Funções para configurações
window.saveSettings = () => {
    try {
        // Salvar configurações de áudio
        const defaultVolume = document.getElementById('defaultVolume')?.value;
        const autoPlay = document.getElementById('autoPlay')?.checked;
        const fadeTransitions = document.getElementById('fadeTransitions')?.checked;
        
        // Salvar configurações de programação
        const hourlyTime = document.getElementById('hourlyTime')?.checked;
        const adInterval = document.getElementById('adInterval')?.value;
        const randomOrder = document.getElementById('randomOrder')/**
 * RÁDIO SUPERMERCADO DO LOURO - SISTEMA 24/7
 * Transmissão contínua com programação automática
 * ============================================
 */

// Configurações globais
const CONFIG = {
    cloudinary: {
        cloudName: 'dygbrcrr6',
        uploadPreset: 'radio_preset'
    },
    radio: {
        autoRestart: true,
        fadeTime: 3000,
        hourlyTimeCheck: true,
        adInterval: { min: 5, max: 8 }, // Intervalo de músicas entre anúncios
        maxRetries: 3,
        retryDelay: 5000,
        bufferSize: 3 // Número de faixas para pré-carregar
    },
    ui: {
        updateInterval: 1000,
        fadeInTime: 500,
        animationDuration: 300
    }
};

// Estado global da aplicação
class RadioState {
    constructor() {
        this.isLive = false;
        this.isPlaying = false;
        this.currentTrack = null;
        this.volume = 70;
        this.playCount = 0;
        this.startTime = Date.now();
        this.lastTimeCheck = 0;
        this.tracksSinceAd = 0;
        this.activeAlbum = null;
        this.retryCount = 0;
        
        // Playlists
        this.playlists = {
            music: [],
            time: [],
            ads: [],
            albums: {
                natal: [],
                pascoa: [],
                saojoao: [],
                carnaval: []
            }
        };
        
        // Histórico e estatísticas
        this.playHistory = {};
        this.albumCovers = {};
        this.listeners = 0;
        this.errors = [];
    }
    
    // Salvar estado no localStorage (se disponível)
    save() {
        try {
            const stateToSave = {
                playlists: this.playlists,
                playHistory: this.playHistory,
                albumCovers: this.albumCovers,
                playCount: this.playCount,
                activeAlbum: this.activeAlbum,
                volume: this.volume
            };
            localStorage.setItem('radioState', JSON.stringify(stateToSave));
            console.log('✅ Estado salvo com sucesso');
        } catch (error) {
            console.warn('⚠️ Não foi possível salvar o estado:', error.message);
        }
    }
    
    // Carregar estado do localStorage
    load() {
        try {
            const saved = localStorage.getItem('radioState');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.playlists = { ...this.playlists, ...parsed.playlists };
                this.playHistory = parsed.playHistory || {};
                this.albumCovers = parsed.albumCovers || {};
                this.playCount = parsed.playCount || 0;
                this.activeAlbum = parsed.activeAlbum || null;
                this.volume = parsed.volume || 70;
                console.log('✅ Estado carregado com sucesso');
            }
        } catch (error) {
            console.warn('⚠️ Erro ao carregar estado:', error.message);
        }
    }
    
    // Obter estatísticas
    getStats() {
        const totalMusic = this.playlists.music.length;
        const totalAlbumMusic = Object.values(this.playlists.albums).reduce((sum, album) => sum + album.length, 0);
        const totalTime = this.playlists.time.length;
        const totalAds = this.playlists.ads.length;
        
        return {
            totalTracks: totalMusic + totalAlbumMusic,
            totalMusic,
            totalAlbumMusic,
            totalTime,
            totalAds,
            totalPlayed: this.playCount,
            uptime: Date.now() - this.startTime,
            listeners: this.listeners,
            errors: this.errors.length
        };
    }
}

// Instância global do estado
const radioState = new RadioState();

// Gerenciador de elementos DOM
class DOMManager {
    constructor() {
        this.elements = {};
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return true;
        
        const elementIds = [
            'audioPlayer', 'playPauseBtn', 'skipBtn', 'volumeBtn', 'volumeSlider',
            'volumeValue', 'albumCover', 'trackCover', 'albumTitle', 'currentTrack',
            'trackTime', 'radioStatus', 'trackCount', 'listenersCount', 'progressFill',
            'playerMode', 'adminMode', 'adminBtn', 'backToPlayerBtn', 'passwordModal',
            'adminPassword', 'loadingOverlay', 'visualizer'
        ];
        
        let missing = [];
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements[id] = element;
            } else {
                missing.push(id);
            }
        });
        
        if (missing.length > 0) {
            console.warn('⚠️ Elementos não encontrados:', missing);
        }
        
        // Verificar elementos críticos
        const critical = ['audioPlayer', 'playPauseBtn', 'currentTrack'];
        const missingCritical = critical.filter(id => !this.elements[id]);
        
        if (missingCritical.length > 0) {
            console.error('❌ Elementos críticos ausentes:', missingCritical);
            return false;
        }
        
        this.initialized = true;
        console.log('✅ DOM inicializado:', Object.keys(this.elements).length, 'elementos');
        return true;
    }
    
    get(id) {
        return this.elements[id];
    }
    
    updateText(id, text) {
        const element = this.elements[id];
        if (element) {
            element.textContent = text;
        }
    }
    
    updateHTML(id, html) {
        const element = this.elements[id];
        if (element) {
            element.innerHTML = html;
        }
    }
}

// Instância global do DOM
const dom = new DOMManager();

// Gerenciador de rádio 24/7
class Radio24Manager {
    constructor() {
        this.isInitialized = false;
        this.intervals = {};
        this.audioBuffer = [];
        this.currentRetries = 0;
        this.nextTrackPreloaded = false;
    }
    
    async init() {
        if (this.isInitialized) return;
        
        console.log('🎵 Iniciando sistema de rádio 24/7...');
        
        if (!dom.init()) {
            throw new Error('Falha na inicialização do DOM');
        }
        
        // Configurar eventos de áudio
        this.setupAudioEvents();
        
        // Configurar controles
        this.setupControls();
        
        // Iniciar transmissão automática
        await this.startTransmission();
        
        // Iniciar checkers automáticos
        this.startAutomaticChecks();
        
        this.isInitialized = true;
        console.log('✅ Rádio 24/7 inicializada com sucesso!');
    }
    
    setupAudioEvents() {
        const audio = dom.get('audioPlayer');
        if (!audio) return;
        
        audio.addEventListener('ended', () => this.playNext());
        audio.addEventListener('error', (e) => this.handleAudioError(e));
        audio.addEventListener('canplay', () => this.handleCanPlay());
        audio.addEventListener('timeupdate', () => this.updateProgress());
        audio.addEventListener('loadstart', () => console.log('🔄 Carregando faixa...'));
        audio.addEventListener('loadeddata', () => console.log('✅ Faixa carregada'));
        
        // Configurar volume inicial
        audio.volume = radioState.volume / 100;
    }
    
    setupControls() {
        // Play/Pause
        const playBtn = dom.get('playPauseBtn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlayback());
        }
        
        // Skip
        const skipBtn = dom.get('skipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.playNext());
        }
        
        // Volume
        const volumeSlider = dom.get('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        }
        
        const volumeBtn = dom.get('volumeBtn');
        if (volumeBtn) {
            volumeBtn.addEventListener('click', () => this.toggleMute());
        }
    }
    
    async startTransmission() {
        console.log('🔴 Iniciando transmissão ao vivo...');
        
        radioState.isLive = true;
        radioState.startTime = Date.now();
        
        // Atualizar UI
        this.updateRadioStatus('AO VIVO', 'live');
        this.updatePlayButton(true);
        
        // Iniciar primeira música
        await this.playNext();
        
        // Simular ouvintes (para demonstração)
        this.simulateListeners();
    }
    
    async playNext() {
        try {
            const nextTrack = this.getNextTrack();
            
            if (!nextTrack) {
                console.warn('⚠️ Nenhuma faixa disponível, aguardando...');
                dom.updateText('currentTrack', 'Aguardando novas músicas...');
                setTimeout(() => this.playNext(), 30000);
                return;
            }
            
            await this.loadAndPlayTrack(nextTrack);
            this.updatePlayHistory(nextTrack);
            this.preloadNextTrack();
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir próxima faixa:', error);
            this.handlePlaybackError();
        }
    }
    
    getNextTrack() {
        // Verificar se é hora de tocar hora certa
        if (this.shouldPlayTimeAnnouncement()) {
            const timeTrack = this.getRandomFromPlaylist('time');
            if (timeTrack) {
                console.log('🕐 Tocando hora certa');
                radioState.lastTimeCheck = Date.now();
                radioState.tracksSinceAd++;
                return timeTrack;
            }
        }
        
        // Verificar se é hora de tocar anúncio
        if (this.shouldPlayAd()) {
            const adTrack = this.getRandomFromPlaylist('ads');
            if (adTrack) {
                console.log('📢 Tocando anúncio');
                radioState.tracksSinceAd = 0;
                return adTrack;
            }
        }
        
        // Tocar música normal
        const musicTrack = this.getMusicTrack();
        if (musicTrack) {
            radioState.tracksSinceAd++;
        }
        
        return musicTrack;
    }
    
    shouldPlayTimeAnnouncement() {
        if (radioState.playlists.time.length === 0) return false;
        
        const now = new Date();
        const minutes = now.getMinutes();
        const timeSinceLastCheck = Date.now() - radioState.lastTimeCheck;
        
        return minutes === 0 && timeSinceLastCheck > 55 * 60 * 1000; // 55 minutos
    }
    
    shouldPlayAd() {
        if (radioState.playlists.ads.length === 0) return false;
        
        const { min, max } = CONFIG.radio.adInterval;
        const interval = min + Math.floor(Math.random() * (max - min + 1));
        
        return radioState.tracksSinceAd >= interval;
    }
    
    getMusicTrack() {
        // Álbum ativo tem prioridade
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            return this.getRandomFromPlaylist('albums', radioState.activeAlbum);
        }
        
        // Playlist geral
        return this.getRandomFromPlaylist('music');
    }
    
    getRandomFromPlaylist(type, albumKey = null) {
        let playlist;
        
        if (type === 'albums' && albumKey) {
            playlist = radioState.playlists.albums[albumKey];
        } else {
            playlist = radioState.playlists[type];
        }
        
        if (!playlist || playlist.length === 0) return null;
        
        // Evitar repetir a música atual
        let filteredPlaylist = playlist;
        if (radioState.currentTrack && playlist.length > 1) {
            filteredPlaylist = playlist.filter(track => track.name !== radioState.currentTrack.name);
        }
        
        if (filteredPlaylist.length === 0) {
            filteredPlaylist = playlist;
        }
        
        const randomIndex = Math.floor(Math.random() * filteredPlaylist.length);
        return filteredPlaylist[randomIndex];
    }
    
    async loadAndPlayTrack(track) {
        const audio = dom.get('audioPlayer');
        if (!audio) throw new Error('Player de áudio não encontrado');
        
        console.log(`🎵 Carregando: ${track.name}`);
        
        // Atualizar estado
        radioState.currentTrack = track;
        
        // Atualizar UI
        dom.updateText('currentTrack', track.name);
        this.updateAlbumCover(track);
        
        // Carregar e reproduzir
        audio.src = track.url;
        
        if (radioState.isLive) {
            try {
                await audio.play();
                radioState.isPlaying = true;
                this.updatePlayButton(true);
                console.log(`▶️ Reproduzindo: ${track.name}`);
            } catch (error) {
                if (error.name === 'NotAllowedError') {
                    console.log('🔇 Autoplay bloqueado, aguardando interação do usuário');
                    this.showAutoplayPrompt();
                } else {
                    throw error;
                }
            }
        }
    }
    
    updateAlbumCover(track) {
        const mainCover = dom.get('albumCover');
        const trackCover = dom.get('trackCover');
        
        if (!mainCover || !trackCover) return;
        
        if (track.coverUrl) {
            trackCover.src = track.coverUrl;
            trackCover.style.display = 'block';
            mainCover.style.opacity = '0.5';
        } else {
            trackCover.style.display = 'none';
            mainCover.style.opacity = '1';
        }
    }
    
    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.playCount++;
        radioState.save();
        this.updateStats();
    }
    
    updateProgress() {
        const audio = dom.get('audioPlayer');
        const progressFill = dom.get('progressFill');
        const trackTime = dom.get('trackTime');
        
        if (!audio || !progressFill || !trackTime) return;
        
        const current = audio.currentTime;
        const duration = audio.duration;
        
        if (isNaN(duration)) return;
        
        const progress = (current / duration) * 100;
        progressFill.style.width = `${progress}%`;
        
        trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    togglePlayback() {
        const audio = dom.get('audioPlayer');
        if (!audio) return;
        
        if (radioState.isPlaying) {
            audio.pause();
            radioState.isPlaying = false;
            radioState.isLive = false;
            this.updatePlayButton(false);
            this.updateRadioStatus('PAUSADO', 'paused');
            console.log('⏸️ Transmissão pausada');
        } else {
            audio.play().then(() => {
                radioState.isPlaying = true;
                radioState.isLive = true;
                this.updatePlayButton(true);
                this.updateRadioStatus('AO VIVO', 'live');
                console.log('▶️ Transmissão retomada');
            }).catch(console.error);
        }
    }
    
    setVolume(value) {
        const audio = dom.get('audioPlayer');
        if (!audio) return;
        
        radioState.volume = parseInt(value);
        audio.volume = radioState.volume / 100;
        dom.updateText('volumeValue', `${radioState.volume}%`);
        radioState.save();
    }
    
    toggleMute() {
        const audio = dom.get('audioPlayer');
        const volumeSlider = dom.get('volumeSlider');
        
        if (!audio || !volumeSlider) return;
        
        if (audio.volume > 0) {
            this.previousVolume = radioState.volume;
            this.setVolume(0);
            volumeSlider.value = 0;
        } else {
            const restoreVolume = this.previousVolume || 70;
            this.setVolume(restoreVolume);
            volumeSlider.value = restoreVolume;
        }
    }
    
    updatePlayButton(isPlaying) {
        const btn = dom.get('playPauseBtn');
        if (!btn) return;
        
        const playIcon = btn.querySelector('.play-icon');
        const pauseIcon = btn.querySelector('.pause-icon');
        
        if (isPlaying) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'inline';
            btn.classList.add('playing');
        } else {
            if (playIcon) playIcon.style.display = 'inline';
            if (pauseIcon) pauseIcon.style.display = 'none';
            btn.classList.remove('playing');
        }
    }
    
    updateRadioStatus(text, className = '') {
        const status = dom.get('radioStatus');
        if (!status) return;
        
        status.textContent = text;
        status.className = 'status-value';
        if (className) {
            status.classList.add(className);
        }
    }
    
    updateStats() {
        const stats = radioState.getStats();
        
        dom.updateText('trackCount', stats.totalPlayed.toString());
        dom.updateText('listenersCount', stats.listeners.toString());
        
        // Atualizar dashboard se estiver visível
        this.updateDashboard(stats);
    }
    
    updateDashboard(stats) {
        dom.updateText('totalTracks', stats.totalTracks.toString());
        dom.updateText('totalPlayed', stats.totalPlayed.toString());
        dom.updateText('uptime', this.formatUptime(stats.uptime));
        dom.updateText('dashboardTrack', radioState.currentTrack?.name || 'Nenhuma');
    }
    
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    simulateListeners() {
        // Simular número de ouvintes para demonstração
        const baseListeners = 15;
        const variation = 10;
        
        setInterval(() => {
            radioState.listeners = baseListeners + Math.floor(Math.random() * variation);
            this.updateStats();
        }, 30000); // Atualizar a cada 30 segundos
        
        // Definir número inicial
        radioState.listeners = baseListeners + Math.floor(Math.random() * variation);
    }
    
    startAutomaticChecks() {
        // Verificar status da transmissão a cada minuto
        this.intervals.statusCheck = setInterval(() => {
            this.checkTransmissionHealth();
        }, 60000);
        
        // Atualizar UI a cada segundo
        this.intervals.uiUpdate = setInterval(() => {
            this.updateStats();
            this.updateVisualizerBars();
        }, CONFIG.ui.updateInterval);
        
        // Salvar estado a cada 5 minutos
        this.intervals.save = setInterval(() => {
            radioState.save();
        }, 300000);
    }
    
    checkTransmissionHealth() {
        const audio = dom.get('audioPlayer');
        if (!audio) return;
        
        // Verificar se deve estar tocando mas não está
        if (radioState.isLive && audio.paused && radioState.currentTrack) {
            console.warn('⚠️ Transmissão interrompida, tentando recuperar...');
            this.handlePlaybackError();
        }
        
        // Verificar se o áudio travou
        if (radioState.isLive && !audio.paused) {
            const currentTime = audio.currentTime;
            setTimeout(() => {
                if (audio.currentTime === currentTime && !audio.paused) {
                    console.warn('⚠️ Áudio travado, reiniciando faixa...');
                    this.handlePlaybackError();
                }
            }, 5000);
        }
    }
    
    updateVisualizerBars() {
        const visualizer = dom.get('visualizer');
        if (!visualizer || !radioState.isPlaying) return;
        
        const bars = visualizer.querySelectorAll('.bar');
        bars.forEach(bar => {
            const height = Math.random() * 30 + 10;
            bar.style.height = `${height}px`;
        });
    }
    
    handleAudioError(error) {
        console.error('❌ Erro de áudio:', error);
        radioState.errors.push({
            type: 'audio',
            message: error.message || 'Erro desconhecido',
            timestamp: Date.now(),
            track: radioState.currentTrack?.name
        });
        
        this.handlePlaybackError();
    }
    
    handleCanPlay() {
        this.currentRetries = 0; // Resetar contador de tentativas
        console.log('✅ Áudio pronto para reprodução');
    }
    
    handlePlaybackError() {
        this.currentRetries++;
        
        if (this.currentRetries > CONFIG.radio.maxRetries) {
            console.error('❌ Máximo de tentativas excedido, pausando transmissão');
            this.updateRadioStatus('ERRO', 'error');
            return;
        }
        
        console.log(`🔄 Tentativa ${this.currentRetries} de recuperação...`);
        
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, CONFIG.radio.retryDelay);
    }
    
    preloadNextTrack() {
        // Pré-carregar próxima faixa para transição suave
        setTimeout(() => {
            const nextTrack = this.getNextTrack();
            if (nextTrack) {
                const preloadAudio = new Audio(nextTrack.url);
                preloadAudio.preload = 'metadata';
                console.log('🔄 Pré-carregando próxima faixa:', nextTrack.name);
            }
        }, 5000);
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.innerHTML = `
            <div class="prompt-content glass">
                <h3>🎵 Ativar Rádio</h3>
                <p>Clique para iniciar a transmissão ao vivo</p>
                <button class="btn-primary" onclick="this.parentElement.parentElement.remove(); radioManager.resumePlayback()">
                    ▶️ Iniciar Rádio
                </button>
            </div>
        `;
        
        prompt.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(13, 40, 24, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20000;
        `;
        
        document.body.appendChild(prompt);
    }
    
    async resumePlayback() {
        const audio = dom.get('audioPlayer');
        if (!audio) return;
        
        try {
            await audio.play();
            radioState.isPlaying = true;
            radioState.isLive = true;
            this.updatePlayButton(true);
            this.updateRadioStatus('AO VIVO', 'live');
            console.log('▶️ Reprodução retomada pelo usuário');
        } catch (error) {
            console.error('❌ Erro ao retomar reprodução:', error);
        }
    }
    
    stop() {
        // Limpar todos os intervalos
        Object.values(this.intervals).forEach(interval => {
            clearInterval(interval);
        });
        
        // Parar áudio
        const audio = dom.get('audioPlayer');
        if (audio) {
            audio.pause();
            audio.src = '';
        }
        
        // Resetar estado
        radioState.isLive = false;
        radioState.isPlaying = false;
        
        console.log('🔴 Transmissão encerrada');
    }
}

// Instância global do gerenciador de rádio
const radioManager = new Radio24Manager();

// Gerenciador de upload e arquivos
class FileManager {
    constructor() {
        this.uploadQueue = [];
        this.isUploading = false;
    }
    
    async uploadFiles(category) {
        const albumType = category === 'album' ? dom.get('albumSelect')?.value : '';
        const fileInput = this.getFileInput(category);
        
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        this.showUploadModal();
        
        try {
            const files = Array.from(fileInput.files);
            const uploadedFiles = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateUploadProgress((i / files.length) * 100, `Enviando ${file.name}...`);
                
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
            }
            
            // Adicionar arquivos à playlist apropriada
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            radioState.save();
            fileInput.value = '';
            
            this.updateUploadProgress(100, 'Upload concluído!');
            
            setTimeout(() => {
                this.hideUploadModal();
                alert(`${files.length} arquivo(s) enviado(s) com sucesso!`);
                radioManager.updateStats();
            }, 1000);
            
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            this.hideUploadModal();
            alert('Erro no upload. Verifique sua conexão e tente novamente.');
        }
    }
    
    getFileInput(category) {
        const inputs = {
            music: 'musicUpload',
            time: 'timeUpload',
            ads: 'adUpload',
            album: 'albumUpload'
        };
        return dom.get(inputs[category]);
    }
    
    async uploadToCloudinary(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.cloudinary.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString(),
            type: category,
            albumType: albumType || null
        };
    }
    
    showUploadModal() {
        const modal = dom.get('uploadModal');
        if (modal) {
            modal.classList.add('show');
            this.updateUploadProgress(0, 'Preparando upload...');
        }
    }
    
    hideUploadModal() {
        const modal = dom.get('uploadModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    updateUploadProgress(percentage, status) {
        const progress = dom.get('uploadProgress');
        const statusText = dom.get('uploadStatus');
        
        if (progress) {
            progress.style.width = `${percentage}%`;
        }
        if (statusText) {
            statusText.textContent = status;
        }
    }
}

// Instância global do gerenciador de arquivos
const fileManager = new FileManager();

// Gerenciador de interface administrativa
class AdminManager {
    constructor() {
        this.currentTab = 'dashboard';
        this.isLoggedIn = false;
    }
    
    init() {
        this.setupEventListeners();
        this.setupTabs();
    }
    
    setupEventListeners() {
        // Botão admin
        const adminBtn = dom.get('adminBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => this.showPasswordModal());
        }
        
        // Voltar ao player
        const backBtn = dom.get('backToPlayerBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showPlayerMode());
        }
        
        // Enter na senha
        const passwordInput = dom.get('adminPassword');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkPassword();
                }
            });
        }
    }
    
    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    showPasswordModal() {
        const modal = dom.get('passwordModal');
        if (modal) {
            modal.classList.add('show');
            const input = dom.get('adminPassword');
            if (input) {
                input.focus();
            }
        }
    }
    
    checkPassword() {
        const passwordInput = dom.get('adminPassword');
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        
        // Senha padrão (em produção, use hash e verificação segura)
        if (password === 'admin123') {
            this.isLoggedIn = true;
            this.hideModal('passwordModal');
            this.showAdminMode();
            passwordInput.value = '';
        } else {
            alert('Senha incorreta!');
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
    
    showAdminMode() {
        const playerMode = dom.get('playerMode');
        const adminMode = dom.get('adminMode');
        
        if (playerMode) playerMode.style.display = 'none';
        if (adminMode) adminMode.style.display = 'block';
        
        this.switchTab('dashboard');
        this.updateDashboardData();
    }
    
    showPlayerMode() {
        const playerMode = dom.get('playerMode');
        const adminMode = dom.get('adminMode');
        
        if (playerMode) playerMode.style.display = 'flex';
        if (adminMode) adminMode.style.display = 'none';
    }
    
    switchTab(tabName) {
        // Remover classe active de todos os botões e conteúdos
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Adicionar classe active nos elementos selecionados
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        this.currentTab = tabName;
        
        // Executar ações específicas da aba
        this.handleTabSwitch(tabName);
    }
    
    handleTabSwitch(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.updateDashboardData();
                break;
            case 'reports':
                this.updateReports();
                break;
            case 'playlist':
                this.updatePlaylistView();
                break;
            default:
                break;
        }
    }
    
    updateDashboardData() {
        const stats = radioState.getStats();
        radioManager.updateDashboard(stats);
        
        // Atualizar controles do dashboard
        const toggleBtn = document.getElementById('toggleRadio');
        if (toggleBtn) {
            toggleBtn.innerHTML = radioState.isLive ? '🔴 Parar Transmissão' : '🟢 Iniciar Transmissão';
            toggleBtn.onclick = () => this.toggleTransmission();
        }
        
        const restartBtn = document.getElementById('restartRadio');
        if (restartBtn) {
            restartBtn.onclick = () => this.restartRadio();
        }
    }
    
    toggleTransmission() {
        if (radioState.isLive) {
            radioManager.togglePlayback();
            alert('Transmissão pausada');
        } else {
            radioManager.togglePlayback();
            alert('Transmissão iniciada');
        }
        this.updateDashboardData();
    }
    
    restartRadio() {
        if (confirm('Tem certeza que deseja reiniciar a rádio?')) {
            radioManager.playNext();
            alert('Rádio reiniciada');
        }
    }
    
    updateReports() {
        // Implementar visualização de relatórios
        console.log('Atualizando relatórios...');
    }
    
    updatePlaylistView() {
        // Implementar visualização de playlist
        console.log('Atualizando visualização de playlist...');
    }
    
    hideModal(modalId) {
        const modal = dom.get(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
}

// Instância global do gerenciador admin
const adminManager = new AdminManager();

// Funções globais para compatibilidade com HTML
window.uploadFiles = (category) => fileManager.uploadFiles(category);
window.checkPassword = () => adminManager.checkPassword();
window.closeModal = (modalId) => adminManager.hideModal(modalId);
window.radioManager = radioManager; // Para acesso no autoplay prompt

// Utilitários
class Utils {
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    static formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// Sistema de notificações
class NotificationManager {
    constructor() {
        this.notifications = [];
        this.container = null;
        this.init();
    }
    
    init() {
        // Criar container de notificações
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} glass`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; padding: 15px;">
                <span style="font-size: 1.2em;">${icons[type] || icons.info}</span>
                <span style="flex: 1; color: white;">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2em;">×</button>
            </div>
        `;
        
        notification.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            backdrop-filter: blur(20px);
            animation: slideIn 0.3s ease-out;
            cursor: pointer;
        `;
        
        // Adicionar animação CSS
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .notification:hover {
                    background: rgba(255, 255, 255, 0.15) !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        this.container.appendChild(notification);
        
        // Auto-remover após duração especificada
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.style.animation = 'slideIn 0.3s ease-out reverse';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }
        
        // Remover ao clicar
        notification.addEventListener('click', () => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        });
        
        this.notifications.push(notification);
        
        // Limitar número de notificações
        if (this.notifications.length > 5) {
            const oldest = this.notifications.shift();
            if (oldest.parentElement) {
                oldest.remove();
            }
        }
    }
    
    success(message, duration) {
        this.show(message, 'success', duration);
    }
    
    error(message, duration) {
        this.show(message, 'error', duration);
    }
    
    warning(message, duration) {
        this.show(message, 'warning', duration);
    }
    
    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// Instância global de notificações
const notifications = new NotificationManager();

// Inicialização da aplicação
class App {
    constructor() {
        this.initialized = false;
        this.startTime = Date.now();
    }
    
    async init() {
        if (this.initialized) return;
        
        console.log('🚀 Iniciando Rádio Supermercado do Louro...');
        
        try {
            // Mostrar loading
            this.showLoading();
            
            // Aguardar DOM estar pronto
            await this.waitForDOM();
            
            // Carregar estado salvo
            radioState.load();
            
            // Inicializar gerenciadores
            await radioManager.init();
            adminManager.init();
            
            // Configurar eventos globais
            this.setupGlobalEvents();
            
            // Ocultar loading
            this.hideLoading();
            
            this.initialized = true;
            
            notifications.success('Rádio iniciada com sucesso! Transmitindo 24/7', 3000);
            console.log('✅ Aplicação inicializada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.hideLoading();
            notifications.error('Erro ao inicializar a rádio. Recarregue a página.', 0);
        }
    }
    
    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    setupGlobalEvents() {
        // Prevenir que a página pare a transmissão
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && radioState.isLive) {
                console.log('👁️ Página visível novamente, verificando transmissão...');
                setTimeout(() => {
                    const audio = dom.get('audioPlayer');
                    if (audio && audio.paused && radioState.currentTrack) {
                        audio.play().catch(console.error);
                    }
                }, 1000);
            }
        });
        
        // Salvar estado antes de sair
        window.addEventListener('beforeunload', () => {
            radioState.save();
            console.log('💾 Estado salvo antes de sair');
        });
        
        // Tratamento de erros globais
        window.addEventListener('error', (event) => {
            console.error('❌ Erro global:', event.error);
            notifications.error('Ocorreu um erro inesperado', 5000);
        });
        
        // Recuperação automática de conectividade
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            notifications.success('Conexão restaurada', 3000);
            
            if (radioState.isLive && !radioState.isPlaying) {
                setTimeout(() => radioManager.playNext(), 2000);
            }
        });
        
        window.addEventListener('offline', () => {
            console.log('🌐 Conexão perdida');
            notifications.warning('Conexão perdida - tentando reconectar...', 5000);
        });
    }
    
    showLoading() {
        const loading = dom.get('loadingOverlay');
        if (loading) {
            loading.classList.remove('hide');
        }
    }
    
    hideLoading() {
        const loading = dom.get('loadingOverlay');
        if (loading) {
            loading.classList.add('hide');
            setTimeout(() => {
                loading.style.display = 'none';
            }, 500);
        }
    }
}

// Instância global da aplicação
const app = new App();

// Inicialização automática
(function() {
    'use strict';
    
    // Aguardar um pouco para garantir que todos os recursos carreguem
    setTimeout(() => {
        app.init().catch(error => {
            console.error('❌ Falha crítica na inicialização:', error);
            
            // Tentar reinicializar após delay
            setTimeout(() => {
                window.location.reload();
            }, 5000);
        });
    }, 100);
    
    console.log('📻 Sistema de rádio 24/7 carregado');
})();

// Exportar para debug no console
if (typeof window !== 'undefined') {
    window.RadioDebug = {
        radioState,
        radioManager,
        adminManager,
        fileManager,
        notifications,
        dom,
        app
    };
}
