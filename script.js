/**
 * RÁDIO SUPERMERCADO DO LOURO - SISTEMA AO VIVO 24H
 * ================================================
 * Sistema de transmissão contínua com gerenciamento automático
 */

// Configuração da Cloudinary (ATUALIZADA)
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'ml_default' // Preset padrão, pode ser alterado se necessário
};

// Estado global da rádio
let radioState = {
    // Controle de transmissão
    isLive: true,
    isPlaying: false,
    autoRestart: true,
    volume: 70,
    isMuted: false,
    
    // Música atual
    currentTrack: null,
    currentTrackStartTime: null,
    
    // Contadores e controle
    playCount: 0,
    totalPlayedTracks: 0,
    tracksSinceTimeAnnouncement: 0,
    tracksSinceCommercial: 0,
    lastTimeCheck: 0,
    listeners: 1,
    
    // Playlists
    activeAlbum: null,
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: {
            natal: [],
            pascoa: [],
            saojoao: [],
            carnaval: []
        }
    },
    
    // Histórico e capas
    playHistory: {},
    albumCovers: {
        general: 'https://res.cloudinary.com/dygbrcrr6/image/upload/v1735075200/radio-louro/covers/default-cover.png'
    }
};

// Dados dos álbuns
const ALBUM_DATA = {
    general: { 
        title: '📻 Playlist Geral', 
        description: 'Todas as músicas da rádio' 
    },
    natal: { 
        title: '🎄 Natal', 
        description: 'Músicas natalinas e celebração' 
    },
    pascoa: { 
        title: '🐰 Páscoa', 
        description: 'Celebrando a ressurreição' 
    },
    saojoao: { 
        title: '🎪 São João', 
        description: 'Forró e festa junina' 
    },
    carnaval: { 
        title: '🎭 Carnaval', 
        description: 'Marchinha e folia' 
    }
};

// Cache de elementos DOM
let elements = {};
let isInitialized = false;

// Verificações de segurança
function safeLocalStorage() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.warn('⚠️ localStorage não disponível, usando memória RAM');
        return false;
    }
}

function initializeElements() {
    const elementIds = [
        // Player principal
        'audioPlayer', 'playPauseBtn', 'skipBtn', 'muteBtn', 'volumeSlider', 'volumeValue',
        'albumCover', 'trackCover', 'albumTitle', 'currentTrack', 'trackTime',
        'playStatus', 'trackCount', 'listenersCount', 'liveIndicator',
        
        // Navegação
        'playerMode', 'adminMode', 'adminBtn', 'backToPlayerBtn',
        
        // Admin
        'passwordModal', 'adminPassword', 'activeAlbumSelect', 'transmissionStatus',
        'totalTracks', 'playedTracks', 'currentAlbumTracks',
        'reportList', 'loadingOverlay', 'coversGrid',
        
        // Modais
        'coverModal', 'coverAlbumName', 'coverUpload',
        
        // Upload
        'musicUpload', 'timeUpload', 'adUpload', 'albumUpload', 'albumSelect',
        
        // Files
        'musicFiles', 'timeFiles', 'adFiles', 'albumFiles'
    ];
    
    elements = {};
    let missing = [];
    
    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            elements[id] = element;
        } else {
            missing.push(id);
        }
    });
    
    // Verificar elementos críticos
    const critical = ['audioPlayer', 'playPauseBtn', 'currentTrack'];
    const missingCritical = critical.filter(id => !elements[id]);
    
    if (missingCritical.length > 0) {
        console.error('❌ Elementos críticos ausentes:', missingCritical);
        return false;
    }
    
    if (missing.length > 0) {
        console.warn('⚠️ Elementos opcionais ausentes:', missing);
    }
    
    console.log('✅ Elementos DOM inicializados:', Object.keys(elements).length);
    return true;
}

/**
 * CLASSE PRINCIPAL - GERENCIADOR DE RÁDIO AO VIVO
 */
class LiveRadioManager {
    constructor() {
        this.isManagerActive = false;
        this.playbackTimer = null;
        this.timeCheckTimer = null;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        
        this.setupAudioEvents();
        this.startLiveTransmission();
    }
    
    setupAudioEvents() {
        if (!elements.audioPlayer) {
            console.error('❌ AudioPlayer não encontrado');
            return;
        }
        
        const audio = elements.audioPlayer;
        
        // Eventos principais
        audio.addEventListener('ended', () => this.handleTrackEnd());
        audio.addEventListener('timeupdate', () => this.updateTimeDisplay());
        audio.addEventListener('error', (e) => this.handleAudioError(e));
        audio.addEventListener('canplay', () => this.handleCanPlay());
        audio.addEventListener('play', () => this.handlePlay());
        audio.addEventListener('pause', () => this.handlePause());
        audio.addEventListener('loadstart', () => this.handleLoadStart());
        
        console.log('✅ Eventos de áudio configurados');
    }
    
    startLiveTransmission() {
        if (this.isManagerActive) {
            console.log('⚠️ Transmissão já ativa');
            return;
        }
        
        console.log('🔴 INICIANDO TRANSMISSÃO AO VIVO 24H');
        this.isManagerActive = true;
        radioState.isLive = true;
        
        // Atualizar interface
        this.updateTransmissionStatus();
        
        // Iniciar timers
        this.startHeartbeat();
        this.startTimeCheck();
        
        // Tocar primeira música
        setTimeout(() => {
            this.playNextTrack();
        }, 1000);
        
        // Auto-restart em caso de falha
        this.setupAutoRestart();
        
        console.log('✅ Sistema de transmissão ao vivo ativado');
    }
    
    startHeartbeat() {
        // Heartbeat a cada 30 segundos para manter transmissão ativa
        this.heartbeatTimer = setInterval(() => {
            if (radioState.isLive) {
                this.checkTransmissionHealth();
            }
        }, 30000);
    }
    
    checkTransmissionHealth() {
        const audio = elements.audioPlayer;
        
        // Verificar se há música tocando
        if (audio && !audio.paused && !audio.ended) {
            // Tudo OK
            return;
        }
        
        // Se chegou aqui, algo está errado - tentar recuperar
        if (radioState.isLive && radioState.autoRestart) {
            console.log('🔄 Recuperando transmissão...');
            setTimeout(() => {
                this.playNextTrack();
            }, 2000);
        }
    }
    
    startTimeCheck() {
        // Verificar hora certa a cada minuto
        this.timeCheckTimer = setInterval(() => {
            this.checkTimeAnnouncement();
        }, 60000);
    }
    
    checkTimeAnnouncement() {
        const now = new Date();
        const minutes = now.getMinutes();
        
        // Tocar hora certa no minuto 0 (hora exata)
        if (minutes === 0 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            // Evitar repetir hora certa muito frequentemente (mínimo 50 minutos)
            if (timeSinceLastTime > 50 * 60 * 1000) {
                console.log('🕐 Hora certa ativada');
                radioState.lastTimeCheck = Date.now();
                radioState.tracksSinceTimeAnnouncement = 999; // Forçar próxima
                
                setTimeout(() => {
                    this.playNextTrack();
                }, 5000); // Aguardar 5s para não interromper abruptamente
            }
        }
    }
    
    setupAutoRestart() {
        // Verificar se precisa reiniciar a cada 5 minutos
        setInterval(() => {
            if (radioState.isLive && radioState.autoRestart) {
                const audio = elements.audioPlayer;
                
                // Se não está tocando há mais de 2 minutos, reiniciar
                if (audio && (audio.paused || audio.ended)) {
                    const timeSinceLastPlay = Date.now() - (radioState.currentTrackStartTime || 0);
                    
                    if (timeSinceLastPlay > 2 * 60 * 1000) {
                        console.log('🔄 Auto-restart ativado - retomando transmissão');
                        this.playNextTrack();
                    }
                }
            }
        }, 5 * 60 * 1000); // 5 minutos
    }
    
    playNextTrack() {
        try {
            const nextTrack = this.selectNextTrack();
            
            if (!nextTrack) {
                this.handleNoTracksAvailable();
                return;
            }
            
            this.loadAndPlayTrack(nextTrack);
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir próxima música:', error);
            this.scheduleRetry();
        }
    }
    
    selectNextTrack() {
        // 1. Verificar se deve tocar hora certa
        if (radioState.tracksSinceTimeAnnouncement >= 999 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTimeAnnouncement = 0;
            radioState.tracksSinceCommercial++;
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        // 2. Verificar se deve tocar comercial (a cada 4-7 músicas)
        const commercialInterval = 4 + Math.floor(Math.random() * 4); // Entre 4-7 músicas
        if (radioState.tracksSinceCommercial >= commercialInterval && radioState.playlists.ads.length > 0) {
            radioState.tracksSinceCommercial = 0;
            radioState.tracksSinceTimeAnnouncement++;
            return this.getRandomTrack(radioState.playlists.ads);
        }
        
        // 3. Tocar música normal
        let playlist = radioState.playlists.music;
        
        // Se há álbum ativo, usar suas músicas
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        radioState.tracksSinceTimeAnnouncement++;
        radioState.tracksSinceCommercial++;
        
        return playlist.length > 0 ? this.getRandomTrack(playlist) : null;
    }
    
    getRandomTrack(playlist) {
        if (!playlist || playlist.length === 0) return null;
        
        // Evitar repetir a música anterior se há mais opções
        if (playlist.length > 1 && radioState.currentTrack) {
            const filteredPlaylist = playlist.filter(track => 
                track.name !== radioState.currentTrack.name
            );
            if (filteredPlaylist.length > 0) {
                playlist = filteredPlaylist;
            }
        }
        
        const randomIndex = Math.floor(Math.random() * playlist.length);
        return playlist[randomIndex];
    }
    
    loadAndPlayTrack(track) {
        const audio = elements.audioPlayer;
        
        // Atualizar estado
        radioState.currentTrack = track;
        radioState.currentTrackStartTime = Date.now();
        
        // Carregar áudio
        audio.src = track.url;
        audio.load();
        
        // Atualizar interface
        this.updateTrackDisplay(track);
        this.updatePlayHistory(track);
        
        // Tentar reproduzir
        if (radioState.isLive) {
            audio.play().catch(error => {
                console.log('⚠️ Autoplay bloqueado ou erro na reprodução:', error.message);
                this.handleAutoplayBlocked();
            });
        }
        
        console.log(`🎵 Tocando: ${track.name}`);
    }
    
    updateTrackDisplay(track) {
        // Atualizar nome da música
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name;
        }
        
        // Atualizar capa se disponível
        this.updateTrackCover(track);
        
        // Atualizar contadores
        this.updateCounters();
    }
    
    updateTrackCover(track) {
        if (!elements.trackCover || !elements.albumCover) return;
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.albumCover.style.display = 'none';
        } else {
            elements.trackCover.style.display = 'none';
            elements.albumCover.style.display = 'block';
            
            // Usar capa do álbum ativo ou capa geral
            const albumKey = radioState.activeAlbum || 'general';
            const coverUrl = radioState.albumCovers[albumKey] || radioState.albumCovers.general;
            elements.albumCover.src = coverUrl;
        }
    }
    
    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.totalPlayedTracks++;
        
        // Salvar dados
        if (fileManager) {
            fileManager.saveData();
        }
    }
    
    updateCounters() {
        if (elements.trackCount) {
            elements.trackCount.textContent = `Músicas: ${radioState.totalPlayedTracks}`;
        }
        
        if (elements.playedTracks) {
            elements.playedTracks.textContent = radioState.totalPlayedTracks;
        }
        
        // Simular contagem de ouvintes (entre 1-15)
        radioState.listeners = Math.max(1, Math.floor(Math.random() * 15) + 1);
        if (elements.listenersCount) {
            elements.listenersCount.textContent = `🎧 ${radioState.listeners} ouvinte${radioState.listeners !== 1 ? 's' : ''}`;
        }
    }
    
    handleNoTracksAvailable() {
        console.log('⚠️ Nenhuma música disponível');
        
        if (elements.currentTrack) {
            elements.currentTrack.textContent = 'Aguardando músicas...';
        }
        
        // Tentar novamente em 30 segundos
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNextTrack();
            }
        }, 30000);
    }
    
    handleAutoplayBlocked() {
        // Mostrar indicação visual de que precisa clicar para ativar
        if (elements.playPauseBtn) {
            elements.playPauseBtn.style.animation = 'pulse 2s infinite';
            elements.playPauseBtn.style.border = '3px solid #ff4444';
        }
        
        if (elements.currentTrack) {
            elements.currentTrack.textContent = 'Clique em Play para ouvir a rádio';
        }
    }
    
    scheduleRetry() {
        // Tentar novamente em 10 segundos
        setTimeout(() => {
            if (radioState.isLive) {
                console.log('🔄 Tentando novamente...');
                this.playNextTrack();
            }
        }, 10000);
    }
    
    // Event Handlers
    handleTrackEnd() {
        console.log('📻 Música terminou, próxima...');
        if (radioState.isLive) {
            // Pequeno delay para evitar cortes abruptos
            setTimeout(() => {
                this.playNextTrack();
            }, 1000);
        }
    }
    
    handleCanPlay() {
        // Remover indicações visuais de problema
        if (elements.playPauseBtn) {
            elements.playPauseBtn.style.animation = '';
            elements.playPauseBtn.style.border = '';
        }
    }
    
    handlePlay() {
        radioState.isPlaying = true;
        if (elements.playPauseBtn) {
            elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
        }
        this.updateTransmissionStatus();
    }
    
    handlePause() {
        radioState.isPlaying = false;
        if (elements.playPauseBtn) {
            elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
        }
        this.updateTransmissionStatus();
    }
    
    handleLoadStart() {
        if (elements.currentTrack && !radioState.currentTrack) {
            elements.currentTrack.textContent = 'Carregando próxima música...';
        }
    }
    
    handleAudioError(error) {
        console.error('❌ Erro no áudio:', error);
        
        if (elements.currentTrack) {
            elements.currentTrack.textContent = 'Erro na reprodução, tentando novamente...';
        }
        
        // Tentar próxima música em 3 segundos
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNextTrack();
            }
        }, 3000);
    }
    
    updateTimeDisplay() {
        if (!elements.audioPlayer || !elements.trackTime) return;
        
        try {
            const current = Math.floor(elements.audioPlayer.currentTime || 0);
            const duration = Math.floor(elements.audioPlayer.duration || 0);
            
            const currentFormatted = this.formatTime(current);
            const durationFormatted = duration > 0 ? this.formatTime(duration) : '--:--';
            
            elements.trackTime.textContent = `${currentFormatted} / ${durationFormatted}`;
        } catch (error) {
            // Silencioso - erro comum durante transições
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateTransmissionStatus() {
        // Status no player
        if (elements.playStatus) {
            elements.playStatus.textContent = radioState.isLive ? 
                (radioState.isPlaying ? 'AO VIVO' : 'CONECTADO') : 'OFFLINE';
        }
        
        if (elements.liveIndicator) {
            elements.liveIndicator.textContent = radioState.isLive ? 
                '🔴 TRANSMITINDO' : '⚫ OFFLINE';
            elements.liveIndicator.style.color = radioState.isLive ? '#ff4444' : '#666';
        }
        
        // Status no admin
        if (elements.transmissionStatus) {
            elements.transmissionStatus.textContent = radioState.isLive ? 
                '🔴 AO VIVO - Transmitindo 24h' : '⚫ OFFLINE - Transmissão pausada';
        }
    }
    
    toggleTransmission() {
        radioState.isLive = !radioState.isLive;
        
        if (radioState.isLive) {
            console.log('🔴 Retomando transmissão AO VIVO');
            this.startLiveTransmission();
        } else {
            console.log('⚫ Pausando transmissão');
            this.stopTransmission();
        }
        
        this.updateTransmissionStatus();
    }
    
    stopTransmission() {
        this.isManagerActive = false;
        
        // Parar áudio
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
        }
        
        // Limpar timers
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.timeCheckTimer) {
            clearInterval(this.timeCheckTimer);
            this.timeCheckTimer = null;
        }
        
        radioState.isPlaying = false;
    }
    
    // Controles manuais
    manualPlay() {
        const audio = elements.audioPlayer;
        
        if (!radioState.currentTrack) {
            this.playNextTrack();
            return;
        }
        
        if (audio) {
            radioState.isLive = true;
            audio.play().catch(error => {
                console.log('Erro no play manual:', error);
            });
        }
    }
    
    manualPause() {
        const audio = elements.audioPlayer;
        
        if (audio) {
            audio.pause();
            // Não definir isLive = false para manter transmissão ativa
        }
    }
    
    manualSkip() {
        if (radioState.isLive) {
            console.log('⏭️ Pulando música manualmente');
            this.playNextTrack();
        }
    }
}

/**
 * GERENCIADOR DE ARQUIVOS E UPLOAD
 */
class FileManager {
    constructor() {
        this.isUploading = false;
    }
    
    async uploadFiles(category, albumType = '') {
        if (this.isUploading) {
            alert('Upload em andamento, aguarde...');
            return;
        }
        
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        this.isUploading = true;
        showLoading(true);
        
        try {
            const files = Array.from(fileInput.files);
            const uploadedFiles = [];
            let successCount = 0;
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                try {
                    showLoading(true, `Enviando ${i + 1} de ${files.length}: ${file.name}`);
                    
                    const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                    uploadedFiles.push(uploadedFile);
                    successCount++;
                    
                } catch (error) {
                    console.error(`Erro no upload de ${file.name}:`, error);
                }
            }
            
            // Adicionar arquivos às playlists
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            this.saveData();
            this.updateStats();
            fileInput.value = '';
            this.refreshFilesList();
            
            // Se não há música tocando, iniciar
            if (radioState.isLive && !radioState.currentTrack && uploadedFiles.length > 0) {
                setTimeout(() => {
                    if (radioManager) {
                        radioManager.playNextTrack();
                    }
                }, 2000);
            }
            
            alert(`✅ ${successCount} de ${files.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('❌ Erro geral no upload:', error);
            alert('Erro no upload. Verifique sua conexão e tente novamente.');
        } finally {
            this.isUploading = false;
            showLoading(false);
        }
    }
    
    getFileInput(category) {
        const inputs = {
            music: elements.musicUpload,
            time: elements.timeUpload,
            ads: elements.adUpload,
            album: elements.albumUpload
        };
        return inputs[category];
    }
    
    async uploadToCloudinary(file, category, albumType = '') {
        // Validar arquivo
        if (!this.isValidAudioFile(file)) {
            throw new Error(`Arquivo ${file.name} não é um formato de áudio válido`);
        }
        
        // Preparar dados
        const folder = category === 'album' ? `albums/${albumType}` : category;
        const formData = new FormData();
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        // Fazer upload
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, 
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Erro HTTP ${response.status}: ${errorData}`);
        }
        
        const data = await response.json();
        
        return {
            name: this.cleanFileName(file.name),
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString(),
            duration: data.duration || 0,
            format: data.format || 'unknown'
        };
    }
    
    isValidAudioFile(file) {
        const validTypes = [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 
            'audio/m4a', 'audio/aac', 'audio/flac'
        ];
        return validTypes.includes(file.type) || 
               /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
    }
    
    cleanFileName(filename) {
        return filename
            .replace(/\.[^/.]+$/, '') // Remove extensão
            .replace(/[_-]/g, ' ')    // Substitui _ e - por espaços
            .replace(/\s+/g, ' ')     // Remove espaços duplos
            .trim();
    }
    
    saveData() {
        if (safeLocalStorage()) {
            try {
                localStorage.setItem('radioState', JSON.stringify({
                    playlists: radioState.playlists,
                    playHistory: radioState.playHistory,
                    albumCovers: radioState.albumCovers,
                    activeAlbum: radioState.activeAlbum,
                    volume: radioState.volume,
                    totalPlayedTracks: radioState.totalPlayedTracks
                }));
                console.log('💾 Dados salvos');
            } catch (error) {
                console.error('❌ Erro ao salvar dados:', error);
            }
        }
    }
    
    loadData() {
        if (!safeLocalStorage()) return;
        
        try {
            const stored = localStorage.getItem('radioState');
            if (stored) {
                const data = JSON.parse(stored);
                
                // Restaurar dados
                if (data.playlists) radioState.playlists = { ...radioState.playlists, ...data.playlists };
                if (data.playHistory) radioState.playHistory = data.playHistory;
                if (data.albumCovers) radioState.albumCovers = { ...radioState.albumCovers, ...data.albumCovers };
                if (data.activeAlbum) radioState.activeAlbum = data.activeAlbum;
                if (data.volume) radioState.volume = data.volume;
                if (data.totalPlayedTracks) radioState.totalPlayedTracks = data.totalPlayedTracks;
                
                console.log('📂 Dados carregados');
                this.updateStats();
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
        }
    }
    
    updateStats() {
        const totalMusic = radioState.playlists.music.length;
        const totalAlbumMusic = Object.values(radioState.playlists.albums)
            .reduce((sum, album) => sum + album.length, 0);
        const totalTracks = totalMusic + totalAlbumMusic;
        
        if (elements.totalTracks) {
            elements.totalTracks.textContent = totalTracks;
        }
        
        if (elements.currentAlbumTracks) {
            const albumTracks = radioState.activeAlbum ? 
                radioState.playlists.albums[radioState.activeAlbum].length : totalMusic;
            elements.currentAlbumTracks.textContent = albumTracks;
        }
    }
    
    refreshFilesList() {
        // Atualizar listas de arquivos
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
    }
    
    refreshCategoryFiles(category) {
        const container = elements[`${category}Files`];
        if (!container) return;
        
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p style="color: #999;">Nenhum arquivo encontrado.</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <small style="color: #666;">${this.formatDuration(file.duration)}</small>
                </div>
                <div class="file-actions">
                    <button onclick="deleteFile('${category}', ${index})" 
                            class="btn-danger btn-small" title="Excluir">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    refreshAlbumFiles() {
        const container = elements.albumFiles;
        if (!container) return;
        
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = ALBUM_DATA[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `
                <div style="margin-bottom: 20px;">
                    <h5 style="color: #4caf50; margin-bottom: 10px; font-size: 1rem;">
                        ${album.title}
                    </h5>
            `;
            
            if (files.length === 0) {
                html += '<p style="color: #999; font-size: 0.9rem;">Nenhum arquivo encontrado.</p>';
            } else {
                html += files.map((file, index) => `
                    <div class="file-item" style="margin-bottom: 8px;">
                        <div class="file-info">
                            <span class="file-name" style="font-size: 0.9rem;">${file.name}</span>
                            <small style="color: #666;">${this.formatDuration(file.duration)}</small>
                        </div>
                        <button onclick="deleteAlbumFile('${albumKey}', ${index})" 
                                class="btn-danger btn-small" title="Excluir">
                            🗑️
                        </button>
                    </div>
                `).join('');
            }
            
            html += '</div>';
        });
        
        container.innerHTML = html;
    }
    
    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '--:--';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // Funções de exclusão
    deleteFile(category, index) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
        
        try {
            radioState.playlists[category].splice(index, 1);
            this.saveData();
            this.refreshFilesList();
            this.updateStats();
            
            alert('✅ Arquivo excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir arquivo:', error);
            alert('❌ Erro ao excluir arquivo.');
        }
    }
    
    deleteAlbumFile(albumKey, index) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
        
        try {
            radioState.playlists.albums[albumKey].splice(index, 1);
            this.saveData();
            this.refreshFilesList();
            this.updateStats();
            
            alert('✅ Arquivo excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir arquivo:', error);
            alert('❌ Erro ao excluir arquivo.');
        }
    }
}

/**
 * GERENCIADOR DE ÁLBUNS E CAPAS
 */
class AlbumManager {
    async uploadCover(albumKey, file) {
        if (!file) {
            throw new Error('Nenhuma imagem selecionada');
        }
        
        showLoading(true, 'Enviando capa...');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            formData.append('folder', 'radio-louro/covers');
            
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, 
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!response.ok) {
                throw new Error(`Erro HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Salvar URL da capa
            radioState.albumCovers[albumKey] = data.secure_url;
            
            if (fileManager) {
                fileManager.saveData();
            }
            
            this.updateCoversDisplay();
            updateAlbumDisplay();
            
            return data.secure_url;
            
        } finally {
            showLoading(false);
        }
    }
    
    removeCover(albumKey) {
        if (!radioState.albumCovers[albumKey]) {
            throw new Error('Não há capa para remover');
        }
        
        delete radioState.albumCovers[albumKey];
        
        if (fileManager) {
            fileManager.saveData();
        }
        
        this.updateCoversDisplay();
        updateAlbumDisplay();
    }
    
    setActiveAlbum(albumKey) {
        const previousAlbum = radioState.activeAlbum;
        radioState.activeAlbum = albumKey || null;
        
        if (fileManager) {
            fileManager.saveData();
            fileManager.updateStats();
        }
        
        updateAlbumDisplay();
        
        const albumName = albumKey ? ALBUM_DATA[albumKey].title : 'Playlist Geral';
        console.log(`📻 Álbum ativo alterado para: ${albumName}`);
        
        return {
            previous: previousAlbum,
            current: albumKey,
            name: albumName
        };
    }
    
    updateCoversDisplay() {
        if (!elements.coversGrid) return;
        
        let html = '';
        
        Object.keys(ALBUM_DATA).forEach(albumKey => {
            const album = ALBUM_DATA[albumKey];
            let coverUrl;
            
            if (albumKey === 'general') {
                coverUrl = radioState.albumCovers.general;
            } else {
                coverUrl = radioState.albumCovers[albumKey] || 
                    `https://via.placeholder.com/200x200/1a4f2e/ffffff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div class="cover-item">
                    <img src="${coverUrl}" alt="${album.title}" loading="lazy">
                    <h4>${album.title}</h4>
                    <button onclick="openCoverModal('${albumKey}')" class="btn-secondary btn-small">
                        🖼️ Alterar
                    </button>
                </div>
            `;
        });
        
        elements.coversGrid.innerHTML = html;
    }
}

/**
 * INSTÂNCIAS GLOBAIS
 */
let radioManager, fileManager, albumManager;

/**
 * INICIALIZAÇÃO PRINCIPAL
 */
function initializeRadio() {
    if (isInitialized) {
        console.warn('Radio já inicializada');
        return;
    }
    
    console.log('🚀 Iniciando Rádio Supermercado do Louro...');
    
    // Verificar elementos DOM
    if (!initializeElements()) {
        console.error('Falha na inicialização dos elementos');
        setTimeout(() => initializeRadio(), 2000);
        return;
    }
    
    isInitialized = true;
    
    // Inicializar gerenciadores
    fileManager = new FileManager();
    albumManager = new AlbumManager();
    
    // Carregar dados salvos
    fileManager.loadData();
    
    // Configurar controles
    setupPlayerControls();
    setupAdminControls();
    
    // Atualizar interface
    updateAlbumDisplay();
    fileManager.updateStats();
    
    // Inicializar transmissão
    radioManager = new LiveRadioManager();
    
    console.log('✅ Rádio inicializada - transmitindo AO VIVO 24h!');
}

function setupPlayerControls() {
    // Volume
    if (elements.volumeSlider) {
        elements.audioPlayer.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        elements.volumeValue.textContent = radioState.volume + '%';
        
        elements.volumeSlider.addEventListener('input', updateVolume);
    }
    
    // Botões de controle
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
    }
    
    if (elements.skipBtn) {
        elements.skipBtn.addEventListener('click', () => {
            if (radioManager) {
                radioManager.manualSkip();
            }
        });
    }
    
    if (elements.muteBtn) {
        elements.muteBtn.addEventListener('click', toggleMute);
    }
}

function setupAdminControls() {
    // Navegação
    if (elements.adminBtn) {
        elements.adminBtn.addEventListener('click', openPasswordModal);
    }
    
    if (elements.backToPlayerBtn) {
        elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
    }
    
    // Senha
    if (elements.adminPassword) {
        elements.adminPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Cliques em modais (fechar ao clicar fora)
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
}

/**
 * CONTROLES DO PLAYER
 */
function togglePlayPause() {
    if (!radioManager) return;
    
    const audio = elements.audioPlayer;
    
    if (audio.paused) {
        radioManager.manualPlay();
    } else {
        radioManager.manualPause();
    }
}

function updateVolume() {
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    
    // Atualizar ícone do mute
    if (elements.muteBtn) {
        const icon = volume == 0 ? '🔇' : (volume < 50 ? '🔉' : '🔊');
        elements.muteBtn.innerHTML = `<span class="volume-icon">${icon}</span>`;
    }
    
    if (fileManager) {
        fileManager.saveData();
    }
}

function toggleMute() {
    const audio = elements.audioPlayer;
    
    if (radioState.isMuted) {
        // Desmutar
        audio.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        radioState.isMuted = false;
    } else {
        // Mutar
        audio.volume = 0;
        elements.volumeSlider.value = 0;
        radioState.isMuted = true;
    }
    
    updateVolume();
}

/**
 * INTERFACE ADMINISTRATIVA
 */
function openPasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.style.display = 'flex';
        if (elements.adminPassword) {
            elements.adminPassword.focus();
        }
    }
}

function checkPassword() {
    const password = elements.adminPassword.value;
    
    if (password === 'admin123') {
        closeModal('passwordModal');
        showAdminMode();
    } else {
        alert('❌ Senha incorreta!');
        elements.adminPassword.value = '';
        elements.adminPassword.focus();
    }
}

function showAdminMode() {
    elements.playerMode.style.display = 'none';
    elements.adminMode.style.display = 'block';
    
    // Atualizar dados
    if (fileManager) {
        fileManager.refreshFilesList();
        fileManager.updateStats();
    }
    
    if (albumManager) {
        albumManager.updateCoversDisplay();
    }
    
    refreshReports();
}

function showPlayerMode() {
    elements.playerMode.style.display = 'flex';
    elements.adminMode.style.display = 'none';
}

function switchTab(tabName) {
    // Remover active
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adicionar active
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Ações específicas
    if (tabName === 'files' && fileManager) {
        fileManager.refreshFilesList();
    }
    if (tabName === 'reports') {
        refreshReports();
    }
    if (tabName === 'albums' && albumManager) {
        albumManager.updateCoversDisplay();
    }
}

/**
 * FUNÇÕES DE UPLOAD
 */
function uploadFiles(category) {
    const albumType = category === 'album' ? elements.albumSelect?.value : '';
    
    if (fileManager) {
        fileManager.uploadFiles(category, albumType);
    }
}

function setActiveAlbum() {
    const selectedAlbum = elements.activeAlbumSelect.value;
    
    if (albumManager) {
        const result = albumManager.setActiveAlbum(selectedAlbum);
        
        const message = selectedAlbum ? 
            `✅ Álbum "${result.name}" ativado! A rádio tocará apenas este álbum.` : 
            '✅ Voltou para playlist geral. A rádio tocará todas as músicas.';
        
        alert(message);
    }
}

/**
 * FUNÇÕES DE ARQUIVOS
 */
function deleteFile(category, index) {
    if (fileManager) {
        fileManager.deleteFile(category, index);
    }
}

function deleteAlbumFile(albumKey, index) {
    if (fileManager) {
        fileManager.deleteAlbumFile(albumKey, index);
    }
}

/**
 * FUNÇÕES DE CAPAS
 */
function openCoverModal(albumKey) {
    elements.coverAlbumName.textContent = ALBUM_DATA[albumKey].title;
    elements.coverModal.dataset.albumKey = albumKey;
    elements.coverModal.style.display = 'flex';
}

async function uploadCover() {
    const albumKey = elements.coverModal.dataset.albumKey;
    const file = elements.coverUpload.files[0];
    
    if (!file) {
        alert('❌ Selecione uma imagem!');
        return;
    }
    
    if (!file.type.startsWith('image/')) {
        alert('❌ Arquivo deve ser uma imagem!');
        return;
    }
    
    try {
        await albumManager.uploadCover(albumKey, file);
        closeModal('coverModal');
        alert('✅ Capa alterada com sucesso!');
    } catch (error) {
        console.error('Erro no upload da capa:', error);
        alert('❌ Erro ao alterar a capa. Tente novamente.');
    }
}

function removeCover() {
    const albumKey = elements.coverModal.dataset.albumKey;
    
    if (!radioState.albumCovers[albumKey]) {
        alert('❌ Não há capa para remover!');
        return;
    }
    
    if (!confirm('Tem certeza que deseja remover esta capa?')) return;
    
    try {
        albumManager.removeCover(albumKey);
        closeModal('coverModal');
        alert('✅ Capa removida com sucesso!');
    } catch (error) {
        console.error('Erro ao remover capa:', error);
        alert('❌ Erro ao remover capa.');
    }
}

/**
 * RELATÓRIOS
 */
function refreshReports() {
    if (!elements.reportList) return;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        elements.reportList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <p>📊 Nenhuma música foi reproduzida ainda.</p>
                <p style="font-size: 0.9rem; margin-top: 10px;">
                    Os relatórios aparecerão assim que a transmissão começar.
                </p>
            </div>
        `;
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 50); // Limitar a 50 mais tocadas
    
    elements.reportList.innerHTML = sortedHistory.map(([track, count]) => `
        <div class="report-item">
            <span class="track-name">${track}</span>
            <span class="play-count">${count}x</span>
        </div>
    `).join('');
}

function resetPlayCount() {
    if (!confirm('⚠️ Tem certeza que deseja resetar toda a contagem de reprodução?')) return;
    
    radioState.playHistory = {};
    radioState.totalPlayedTracks = 0;
    
    if (fileManager) {
        fileManager.saveData();
        fileManager.updateStats();
    }
    
    refreshReports();
    alert('✅ Contagem resetada com sucesso!');
}

/**
 * CONTROLE DE TRANSMISSÃO (ADMIN)
 */
function toggleTransmission() {
    if (radioManager) {
        radioManager.toggleTransmission();
        
        const message = radioState.isLive ? 
            '🔴 Transmissão AO VIVO iniciada!' : 
            '⚫ Transmissão pausada';
        
        alert(message);
    }
}

/**
 * FUNÇÕES AUXILIARES
 */
function updateAlbumDisplay() {
    if (!elements.albumCover || !elements.albumTitle) return;
    
    try {
        if (radioState.activeAlbum && ALBUM_DATA[radioState.activeAlbum]) {
            const album = ALBUM_DATA[radioState.activeAlbum];
            const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
                `https://via.placeholder.com/300x300/1a4f2e/ffffff?text=${encodeURIComponent(album.title)}`;
            
            elements.albumCover.src = coverUrl;
            elements.albumTitle.textContent = album.title;
        } else {
            const coverUrl = radioState.albumCovers.general;
            elements.albumCover.src = coverUrl;
            elements.albumTitle.textContent = 'Playlist Geral';
        }
        
        if (elements.activeAlbumSelect) {
            elements.activeAlbumSelect.value = radioState.activeAlbum || '';
        }
    } catch (error) {
        console.error('Erro ao atualizar display do álbum:', error);
    }
}

function showLoading(show, message = 'Carregando...') {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
        
        const text = elements.loadingOverlay.querySelector('p');
        if (text) {
            text.textContent = message;
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Limpar campos
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal' && elements.coverUpload) {
        elements.coverUpload.value = '';
    }
}

/**
 * INICIALIZAÇÃO SEGURA E TRATAMENTO DE ERROS
 */
function safeInitialization() {
    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeRadio);
        } else {
            // DOM já carregado
            setTimeout(initializeRadio, 100);
        }
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        
        // Tentar novamente em 3 segundos
        setTimeout(() => {
            console.log('🔄 Tentando inicializar novamente...');
            safeInitialization();
        }, 3000);
    }
}

// Tratamento global de erros
window.addEventListener('error', (e) => {
    console.error('❌ Erro global:', e.error);
    
    // Se é erro crítico na transmissão, tentar recuperar
    if (radioState.isLive && radioManager) {
        console.log('🔄 Tentando recuperar transmissão...');
        setTimeout(() => {
            radioManager.checkTransmissionHealth();
        }, 5000);
    }
});

// Manter transmissão ativa quando página volta ao foco
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive) {
        console.log('👁️ Página visível - verificando transmissão...');
        
        setTimeout(() => {
            if (radioState.isLive && elements.audioPlayer?.paused) {
                elements.audioPlayer.play().catch(() => {
                    console.log('Autoplay ainda bloqueado');
                });
            }
        }, 1000);
    }
});

// Salvar dados antes de sair
window.addEventListener('beforeunload', () => {
    if (fileManager) {
        fileManager.saveData();
    }
    console.log('💾 Salvando estado da rádio...');
});

// Prevenir que página seja fechada acidentalmente durante upload
window.addEventListener('beforeunload', (e) => {
    if (fileManager && fileManager.isUploading) {
        e.preventDefault();
        e.returnValue = 'Upload em andamento. Tem certeza que deseja sair?';
    }
});

/**
 * INICIALIZAÇÃO
 */
console.log('🎵 Sistema de Rádio AO VIVO 24H carregando...');
safeInitialization();
console.log('✅ Script inicializado!');
