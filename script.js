/**
 * RÁDIO SUPERMERCADO DO LOURO - SISTEMA AO VIVO 24H
 * ================================================
 * Sistema de transmissão contínua com gerenciamento automático
 */

console.log('🎵 Script iniciando...');

// Debug function
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${message}`, data || '');
}

function showDebugMessage(message) {
    const debugDiv = document.createElement('div');
    debugDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.9); color: white; padding: 20px; border-radius: 10px;
        z-index: 9999; max-width: 80%; text-align: center; font-family: monospace;
    `;
    debugDiv.innerHTML = `
        <h3>🔧 Debug Info</h3>
        <p>${message}</p>
        <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 15px;">OK</button>
    `;
    document.body.appendChild(debugDiv);
}

// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

debugLog('✅ Config Cloudinary carregada', CLOUDINARY_CONFIG);

// Estado global da rádio
let radioState = {
    isLive: true,
    isPlaying: false,
    autoRestart: true,
    volume: 70,
    isMuted: false,
    currentTrack: null,
    currentTrackStartTime: null,
    playCount: 0,
    totalPlayedTracks: 0,
    tracksSinceTimeAnnouncement: 0,
    tracksSinceCommercial: 0,
    lastTimeCheck: 0,
    listeners: 1,
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
    playHistory: {},
    albumCovers: {
        general: 'https://res.cloudinary.com/dygbrcrr6/image/upload/v1735075200/radio-louro/covers/default-cover.png'
    }
};

debugLog('✅ Estado inicial definido');

// Cache de elementos DOM
let elements = {};
let isInitialized = false;

// Dados dos álbuns
const ALBUM_DATA = {
    general: { title: 'Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: 'Natal', description: 'Músicas natalinas' },
    pascoa: { title: 'Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: 'São João', description: 'Forró e festa junina' },
    carnaval: { title: 'Carnaval', description: 'Marchinha e alegria' }
};

// Verificações de segurança
function safeLocalStorage() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        debugLog('✅ localStorage disponível');
        return true;
    } catch (e) {
        debugLog('⚠️ localStorage não disponível');
        return false;
    }
}

function initializeElements() {
    debugLog('🔍 Inicializando elementos DOM...');
    
    const elementIds = [
        'audioPlayer', 'playPauseBtn', 'skipBtn', 'muteBtn', 'volumeSlider', 'volumeValue',
        'albumCover', 'trackCover', 'albumTitle', 'currentTrack', 'trackTime',
        'playStatus', 'trackCount', 'listenersCount', 'liveIndicator',
        'playerMode', 'adminMode', 'adminBtn', 'backToPlayerBtn',
        'passwordModal', 'adminPassword', 'activeAlbumSelect', 'transmissionStatus',
        'totalTracks', 'playedTracks', 'currentAlbumTracks',
        'reportList', 'loadingOverlay', 'coversGrid',
        'coverModal', 'coverAlbumName', 'coverUpload',
        'musicUpload', 'timeUpload', 'adUpload', 'albumUpload', 'albumSelect',
        'musicFiles', 'timeFiles', 'adFiles', 'albumFiles'
    ];
    
    elements = {};
    let missing = [];
    let found = 0;
    
    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            elements[id] = element;
            found++;
        } else {
            missing.push(id);
        }
    });
    
    debugLog(`📊 Elementos encontrados: ${found}/${elementIds.length}`);
    
    if (missing.length > 0) {
        debugLog('⚠️ Elementos não encontrados:', missing);
    }
    
    // Verificar elementos críticos
    const critical = ['audioPlayer', 'playPauseBtn', 'currentTrack', 'loadingOverlay'];
    const missingCritical = critical.filter(id => !elements[id]);
    
    if (missingCritical.length > 0) {
        debugLog('❌ Elementos críticos ausentes:', missingCritical);
        showDebugMessage(`Elementos críticos não encontrados: ${missingCritical.join(', ')}`);
        return false;
    }
    
    debugLog('✅ Elementos DOM inicializados com sucesso');
    return true;
}

/**
 * CLASSE PRINCIPAL - GERENCIADOR DE RÁDIO AO VIVO
 */
class LiveRadioManager {
    constructor() {
        debugLog('🎵 Iniciando LiveRadioManager...');
        
        this.isManagerActive = false;
        this.playbackTimer = null;
        this.timeCheckTimer = null;
        this.heartbeatTimer = null;
        
        try {
            this.setupAudioEvents();
            this.startLiveTransmission();
            debugLog('✅ LiveRadioManager inicializado');
        try {
            this.setupAudioEvents();
            this.startLiveTransmission();
            debugLog('✅ LiveRadioManager inicializado');
        } catch (error) {
            debugLog('❌ Erro no LiveRadioManager:', error);
            showDebugMessage(`Erro no gerenciador: ${error.message}`);
        }
    }
    
    setupAudioEvents() {
        if (!elements.audioPlayer) {
            throw new Error('AudioPlayer não encontrado');
        }
        
        const audio = elements.audioPlayer;
        
        audio.addEventListener('ended', () => {
            debugLog('🎵 Música terminou');
            this.handleTrackEnd();
        });
        
        audio.addEventListener('timeupdate', () => this.updateTimeDisplay());
        
        audio.addEventListener('error', (e) => {
            debugLog('❌ Erro no áudio:', e);
            this.handleAudioError(e);
        });
        
        audio.addEventListener('canplay', () => {
            debugLog('✅ Áudio pode tocar');
            this.handleCanPlay();
        });
        
        audio.addEventListener('play', () => {
            debugLog('▶️ Áudio iniciou');
            this.handlePlay();
        });
        
        audio.addEventListener('pause', () => {
            debugLog('⏸️ Áudio pausou');
            this.handlePause();
        });
        
        debugLog('✅ Eventos de áudio configurados');
    }
    
    startLiveTransmission() {
        if (this.isManagerActive) {
            debugLog('⚠️ Transmissão já ativa');
            return;
        }
        
        debugLog('🔴 INICIANDO TRANSMISSÃO AO VIVO 24H');
        this.isManagerActive = true;
        radioState.isLive = true;
        
        this.updateTransmissionStatus();
        this.hideLoading();
        
        // Verificar se há músicas
        const totalTracks = radioState.playlists.music.length + 
            Object.values(radioState.playlists.albums).reduce((sum, album) => sum + album.length, 0);
        
        if (totalTracks === 0) {
            debugLog('⚠️ Nenhuma música disponível');
            if (elements.currentTrack) {
                elements.currentTrack.textContent = 'Rádio aguardando músicas... Acesse o painel admin para fazer upload.';
            }
        } else {
            debugLog(`🎵 ${totalTracks} músicas disponíveis`);
            setTimeout(() => this.playNextTrack(), 2000);
        }
        
        this.startHeartbeat();
        this.startTimeCheck();
        
        debugLog('✅ Sistema AO VIVO ativado');
    }
    
    hideLoading() {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
            debugLog('✅ Loading ocultado');
        }
    }
    
    playNextTrack() {
        debugLog('🎵 Selecionando próxima música...');
        
        // Música de exemplo para teste (caso não haja músicas)
        if (radioState.playlists.music.length === 0) {
            if (elements.currentTrack) {
                elements.currentTrack.textContent = 'Sistema funcionando! Faça upload de músicas no painel admin.';
            }
            setTimeout(() => this.playNextTrack(), 30000);
            return;
        }
        
        // Lógica normal de seleção
        const nextTrack = this.selectNextTrack();
        if (nextTrack) {
            this.loadAndPlayTrack(nextTrack);
        }
    }
    
    selectNextTrack() {
        // Implementação simplificada para debug
        const availableTracks = radioState.playlists.music;
        if (availableTracks.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        return availableTracks[randomIndex];
    }
    
    loadAndPlayTrack(track) {
        debugLog('🎵 Carregando música:', track.name);
        
        const audio = elements.audioPlayer;
        radioState.currentTrack = track;
        radioState.currentTrackStartTime = Date.now();
        
        audio.src = track.url;
        
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name;
        }
        
        if (radioState.isLive) {
            audio.play().catch(error => {
                debugLog('⚠️ Autoplay bloqueado:', error);
                this.handleAutoplayBlocked();
            });
        }
    }
    
    handleAutoplayBlocked() {
        debugLog('⚠️ Autoplay bloqueado pelo navegador');
        if (elements.currentTrack) {
            elements.currentTrack.textContent = 'Clique em PLAY para ouvir a rádio';
        }
        if (elements.playPauseBtn) {
            elements.playPauseBtn.style.border = '3px solid #ff4444';
        }
    }
    
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (radioState.isLive) {
                debugLog('💓 Heartbeat - verificando transmissão');
            }
        }, 60000); // A cada 1 minuto para debug
    }
    
    startTimeCheck() {
        debugLog('⏰ Timer de hora certa ativado');
    }
    
    handleTrackEnd() {
        debugLog('🔄 Música terminou, próxima...');
        setTimeout(() => this.playNextTrack(), 1000);
    }
    
    handlePlay() {
        radioState.isPlaying = true;
        if (elements.playPauseBtn) {
            elements.playPauseBtn.innerHTML = '<span>⏸️</span>';
        }
        this.updateTransmissionStatus();
    }
    
    handlePause() {
        radioState.isPlaying = false;
        if (elements.playPauseBtn) {
            elements.playPauseBtn.innerHTML = '<span>▶️</span>';
        }
        this.updateTransmissionStatus();
    }
    
    handleCanPlay() {
        if (elements.playPauseBtn) {
            elements.playPauseBtn.style.border = '';
        }
    }
    
    handleAudioError(error) {
        debugLog('❌ Erro no áudio, tentando próxima música');
        setTimeout(() => this.playNextTrack(), 3000);
    }
    
    updateTimeDisplay() {
        if (elements.trackTime && elements.audioPlayer) {
            const current = Math.floor(elements.audioPlayer.currentTime || 0);
            const mins = Math.floor(current / 60);
            const secs = current % 60;
            elements.trackTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    updateTransmissionStatus() {
        if (elements.playStatus) {
            elements.playStatus.textContent = radioState.isLive ? 'AO VIVO' : 'OFFLINE';
        }
        
        if (elements.liveIndicator) {
            elements.liveIndicator.textContent = radioState.isLive ? '🔴 TRANSMITINDO' : '⚫ OFFLINE';
        }
    }
    
    manualPlay() {
        debugLog('▶️ Play manual acionado');
        const audio = elements.audioPlayer;
        
        if (!radioState.currentTrack) {
            this.playNextTrack();
            return;
        }
        
        if (audio) {
            radioState.isLive = true;
            audio.play().catch(error => {
                debugLog('Erro no play manual:', error);
            });
        }
    }
    
    manualPause() {
        debugLog('⏸️ Pause manual acionado');
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
        }
    }
    
    manualSkip() {
        debugLog('⏭️ Skip manual acionado');
        this.playNextTrack();
    }
}

// Instâncias globais
let radioManager, fileManager, albumManager;

/**
 * INICIALIZAÇÃO PRINCIPAL
 */
function initializeRadio() {
    if (isInitialized) {
        debugLog('⚠️ Radio já inicializada');
        return;
    }
    
    debugLog('🚀 Iniciando Rádio Supermercado do Louro...');
    
    try {
        // Verificar elementos DOM
        if (!initializeElements()) {
            throw new Error('Falha na inicialização dos elementos');
        }
        
        isInitialized = true;
        
        // Carregar dados salvos
        loadStoredData();
        
        // Configurar controles
        setupPlayerControls();
        setupAdminControls();
        
        // Atualizar interface
        updateAlbumDisplay();
        
        // Inicializar transmissão
        radioManager = new LiveRadioManager();
        
        debugLog('✅ Rádio inicializada com sucesso');
        
    } catch (error) {
        debugLog('❌ Erro na inicialização:', error);
        showDebugMessage(`Erro na inicialização: ${error.message}. Tentando novamente em 3 segundos...`);
        
        setTimeout(() => {
            isInitialized = false;
            initializeRadio();
        }, 3000);
    }
}

function loadStoredData() {
    if (!safeLocalStorage()) return;
    
    try {
        const stored = localStorage.getItem('radioState');
        if (stored) {
            const data = JSON.parse(stored);
            
            if (data.playlists) radioState.playlists = { ...radioState.playlists, ...data.playlists };
            if (data.playHistory) radioState.playHistory = data.playHistory;
            if (data.albumCovers) radioState.albumCovers = { ...radioState.albumCovers, ...data.albumCovers };
            if (data.activeAlbum) radioState.activeAlbum = data.activeAlbum;
            if (data.volume) radioState.volume = data.volume;
            if (data.totalPlayedTracks) radioState.totalPlayedTracks = data.totalPlayedTracks;
            
            debugLog('📂 Dados carregados do localStorage');
        }
    } catch (error) {
        debugLog('⚠️ Erro ao carregar dados:', error);
    }
}

function setupPlayerControls() {
    debugLog('🎛️ Configurando controles do player...');
    
    try {
        // Volume
        if (elements.volumeSlider && elements.audioPlayer) {
            elements.audioPlayer.volume = radioState.volume / 100;
            elements.volumeSlider.value = radioState.volume;
            if (elements.volumeValue) {
                elements.volumeValue.textContent = radioState.volume + '%';
            }
            elements.volumeSlider.addEventListener('input', updateVolume);
        }
        
        // Botões
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener('click', togglePlayPause);
        }
        
        if (elements.skipBtn) {
            elements.skipBtn.addEventListener('click', () => {
                if (radioManager) radioManager.manualSkip();
            });
        }
        
        if (elements.muteBtn) {
            elements.muteBtn.addEventListener('click', toggleMute);
        }
        
        debugLog('✅ Controles do player configurados');
        
    } catch (error) {
        debugLog('❌ Erro ao configurar controles:', error);
    }
}

function setupAdminControls() {
    debugLog('🔧 Configurando controles admin...');
    
    try {
        if (elements.adminBtn) {
            elements.adminBtn.addEventListener('click', openPasswordModal);
        }
        
        if (elements.backToPlayerBtn) {
            elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
        }
        
        if (elements.adminPassword) {
            elements.adminPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') checkPassword();
            });
        }
        
        debugLog('✅ Controles admin configurados');
        
    } catch (error) {
        debugLog('❌ Erro ao configurar admin:', error);
    }
}

/**
 * CONTROLES DO PLAYER
 */
function togglePlayPause() {
    debugLog('🎵 Toggle play/pause');
    
    if (!radioManager) {
        debugLog('⚠️ RadioManager não disponível');
        return;
    }
    
    const audio = elements.audioPlayer;
    if (audio && audio.paused) {
        radioManager.manualPlay();
    } else {
        radioManager.manualPause();
    }
}

function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer) return;
    
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    
    elements.audioPlayer.volume = volume / 100;
    if (elements.volumeValue) {
        elements.volumeValue.textContent = volume + '%';
    }
    
    // Atualizar ícone do mute
    if (elements.muteBtn) {
        const icon = volume == 0 ? '🔇' : (volume < 50 ? '🔉' : '🔊');
        elements.muteBtn.innerHTML = `<span>${icon}</span>`;
    }
    
    saveData();
}

function toggleMute() {
    const audio = elements.audioPlayer;
    if (!audio) return;
    
    if (radioState.isMuted) {
        audio.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        radioState.isMuted = false;
    } else {
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
    const password = elements.adminPassword ? elements.adminPassword.value : '';
    
    if (password === 'admin123') {
        closeModal('passwordModal');
        showAdminMode();
    } else {
        alert('Senha incorreta!');
        if (elements.adminPassword) {
            elements.adminPassword.value = '';
            elements.adminPassword.focus();
        }
    }
}

function showAdminMode() {
    debugLog('🔧 Abrindo modo admin');
    elements.playerMode.style.display = 'none';
    elements.adminMode.style.display = 'block';
}

function showPlayerMode() {
    debugLog('🎵 Voltando ao player');
    elements.playerMode.style.display = 'flex';
    elements.adminMode.style.display = 'none';
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
    } catch (error) {
        debugLog('❌ Erro ao atualizar display do álbum:', error);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
}

function saveData() {
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
        } catch (error) {
            debugLog('❌ Erro ao salvar dados:', error);
        }
    }
}

// Funções básicas para admin (versões simplificadas)
function uploadFiles(category) {
    showDebugMessage('Sistema de upload em desenvolvimento. Por favor, aguarde uma atualização.');
}

function setActiveAlbum() {
    showDebugMessage('Função de álbum em desenvolvimento.');
}

function refreshReports() {
    showDebugMessage('Relatórios em desenvolvimento.');
}

function resetPlayCount() {
    radioState.playHistory = {};
    radioState.totalPlayedTracks = 0;
    saveData();
    alert('Contagem resetada!');
}

function toggleTransmission() {
    if (radioManager) {
        radioState.isLive = !radioState.isLive;
        radioManager.updateTransmissionStatus();
        const message = radioState.isLive ? 'Transmissão iniciada!' : 'Transmissão pausada';
        alert(message);
    }
}

/**
 * INICIALIZAÇÃO SEGURA
 */
function safeInitialization() {
    debugLog('🔄 Iniciando inicialização segura...');
    
    try {
        if (document.readyState === 'loading') {
            debugLog('📄 DOM ainda carregando, aguardando...');
            document.addEventListener('DOMContentLoaded', initializeRadio);
        } else {
            debugLog('📄 DOM pronto, inicializando...');
            setTimeout(initializeRadio, 500);
        }
    } catch (error) {
        debugLog('❌ Erro na inicialização segura:', error);
        showDebugMessage(`Erro crítico: ${error.message}`);
        
        setTimeout(() => {
            debugLog('🔄 Tentando novamente...');
            safeInitialization();
        }, 5000);
    }
}

// Tratamento global de erros
window.addEventListener('error', (e) => {
    debugLog('❌ Erro global capturado:', e.error);
    console.error('Erro completo:', e);
});

// Manter transmissão ativa
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive) {
        debugLog('👁️ Página visível novamente');
        
        setTimeout(() => {
            if (radioState.isLive && elements.audioPlayer && elements.audioPlayer.paused) {
                elements.audioPlayer.play().catch(() => {
                    debugLog('Autoplay ainda bloqueado');
                });
            }
        }, 1000);
    }
});

// Salvar dados antes de sair
window.addEventListener('beforeunload', () => {
    saveData();
    debugLog('💾 Dados salvos antes de sair');
});

/**
 * INICIALIZAÇÃO
 */
debugLog('🎵 Sistema carregando...');
safeInitialization();
debugLog('✅ Script inicializado!');)
