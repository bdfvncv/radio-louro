/**
 * RÁDIO SUPERMERCADO DO LOURO - SISTEMA 24H AO VIVO
 * ================================================
 * Sistema completo de rádio online com transmissão contínua 24 horas
 * Versão: 2.0 - Modo Broadcast Real
 */

// ========================================
// CONFIGURAÇÕES E CONSTANTES
// ========================================

const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

const RADIO_CONFIG = {
    autoRestart: true,
    continuousPlay: true,
    adInterval: 5,
    timeCheckInterval: 60000, // 1 minuto
    reconnectDelay: 3000,
    maxReconnectAttempts: 10,
    heartbeatInterval: 30000, // 30 segundos
    fadeTime: 2000,
    bufferSize: 3 // Próximas músicas no buffer
};

const ALBUM_DATA = {
    general: { title: '🎵 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' },
    sertanejo: { title: '🤠 Sertanejo', description: 'O melhor do sertanejo' },
    rock: { title: '🎸 Rock', description: 'Rock nacional e internacional' },
    pop: { title: '🎤 Pop', description: 'Os maiores hits pop' }
};

// ========================================
// ESTADO GLOBAL DA RÁDIO
// ========================================

let radioState = {
    // Status da transmissão
    isLive: false,
    isPlaying: false,
    isLoading: false,
    
    // Controle de áudio
    volume: 70,
    currentTrack: null,
    nextTrack: null,
    trackBuffer: [],
    
    // Estatísticas
    playCount: 0,
    uptime: 0,
    startTime: null,
    listenerCount: 1,
    
    // Controle de programação
    activeAlbum: null,
    tracksSinceAd: 0,
    tracksSinceTime: 0,
    lastTimeCheck: 0,
    lastAdTime: 0,
    
    // Playlists
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: {
            natal: [], pascoa: [], saojoao: [], carnaval: [],
            sertanejo: [], rock: [], pop: []
        }
    },
    
    // Dados
    playHistory: {},
    albumCovers: { general: null },
    
    // Configurações
    config: { ...RADIO_CONFIG },
    
    // Status de conexão
    connectionAttempts: 0,
    lastHeartbeat: null,
    isReconnecting: false
};

// ========================================
// CACHE DE ELEMENTOS DOM
// ========================================

let elements = {};
let isInitialized = false;

// ========================================
// VERIFICAÇÃO DE SUPORTE
// ========================================

function checkBrowserSupport() {
    const support = {
        localStorage: (() => {
            try {
                const test = 'test';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                console.warn('localStorage não disponível');
                return false;
            }
        })(),
        
        audio: (() => {
            const audio = document.createElement('audio');
            return !!(audio.canPlayType && audio.canPlayType('audio/mpeg;').replace(/no/, ''));
        })(),
        
        serviceWorker: 'serviceWorker' in navigator,
        
        webAudio: 'AudioContext' in window || 'webkitAudioContext' in window
    };
    
    console.log('🔍 Suporte do navegador:', support);
    return support;
}

// ========================================
// INICIALIZAÇÃO DOS ELEMENTOS DOM
// ========================================

function initElements() {
    try {
        const elementIds = [
            // Player principal
            'audioPlayer', 'playPauseBtn', 'skipBtn', 'reloadBtn', 'volumeSlider', 'volumeValue',
            'albumCover', 'trackCover', 'albumTitle', 'currentTrack', 'trackTime',
            'playStatus', 'trackCount', 'uptime', 'listenerCount', 'upcomingList',
            
            // Status
            'broadcastStatus', 'statusText', 'liveIndicator',
            
            // Admin
            'adminMode', 'playerMode', 'adminBtn', 'backToPlayerBtn', 'emergencyStop',
            'passwordModal', 'adminPassword', 'activeAlbumSelect', 'reportList',
            'coversGrid', 'coverModal', 'coverAlbumName', 'coverUpload',
            'connectionModal', 'connectionMessage',
            
            // Admin status
            'adminRadioStatus', 'adminUptime', 'adminCurrentTrack', 'nextAdTime',
            'startBroadcast', 'stopBroadcast', 'restartBroadcast', 'skipTrack',
            'autoRestart', 'continuousPlay', 'adInterval',
            
            // Contadores de arquivos
            'musicCount', 'timeCount', 'adCount', 'albumCount',
            
            // Loading
            'loadingOverlay', 'loadingText', 'loadingBar'
        ];
        
        elements = {};
        const missing = [];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                missing.push(id);
                console.warn(`Elemento não encontrado: ${id}`);
            }
        });
        
        // Verificar elementos críticos
        const critical = ['audioPlayer', 'playPauseBtn', 'currentTrack'];
        const missingCritical = critical.filter(id => !elements[id]);
        
        if (missingCritical.length > 0) {
            throw new Error(`Elementos críticos não encontrados: ${missingCritical.join(', ')}`);
        }
        
        console.log(`✅ Elementos inicializados: ${Object.keys(elements).length}`);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao inicializar elementos:', error);
        return false;
    }
}

// ========================================
// GERENCIADOR DE TRANSMISSÃO AO VIVO
// ========================================

class LiveBroadcastManager {
    constructor() {
        this.audioContext = null;
        this.heartbeatTimer = null;
        this.uptimeTimer = null;
        this.timeCheckTimer = null;
        this.bufferTimer = null;
        this.reconnectTimer = null;
        
        this.init();
    }
    
    async init() {
        try {
            // Configurar contexto de áudio
            if (window.AudioContext || window.webkitAudioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            this.setupEventListeners();
            this.loadStoredData();
            this.setupAudioPlayer();
            
            // Aguardar um pouco antes de iniciar
            setTimeout(() => {
                this.startBroadcast();
            }, 2000);
            
            console.log('🎙️ Gerenciador de transmissão inicializado');
            
        } catch (error) {
            console.error('❌ Erro na inicialização do broadcast:', error);
        }
    }
    
    setupEventListeners() {
        if (!elements.audioPlayer) return;
        
        const audioPlayer = elements.audioPlayer;
        
        // Eventos de áudio
        audioPlayer.addEventListener('loadstart', () => this.onLoadStart());
        audioPlayer.addEventListener('canplay', () => this.onCanPlay());
        audioPlayer.addEventListener('play', () => this.onPlay());
        audioPlayer.addEventListener('pause', () => this.onPause());
        audioPlayer.addEventListener('ended', () => this.onTrackEnd());
        audioPlayer.addEventListener('timeupdate', () => this.onTimeUpdate());
        audioPlayer.addEventListener('error', (e) => this.onAudioError(e));
        audioPlayer.addEventListener('waiting', () => this.onWaiting());
        audioPlayer.addEventListener('canplaythrough', () => this.onCanPlayThrough());
        
        // Eventos de conexão
        window.addEventListener('online', () => this.onConnectionRestore());
        window.addEventListener('offline', () => this.onConnectionLost());
        
        // Eventos de visibilidade da página
        document.addEventListener('visibilitychange', () => this.onVisibilityChange());
        
        // Eventos de controles
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (elements.skipBtn) {
            elements.skipBtn.addEventListener('click', () => this.skipTrack());
        }
        
        if (elements.reloadBtn) {
            elements.reloadBtn.addEventListener('click', () => this.reconnect());
        }
        
        if (elements.volumeSlider) {
            elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        }
        
        // Controles admin
        if (elements.emergencyStop) {
            elements.emergencyStop.addEventListener('click', () => this.emergencyStop());
        }
        
        if (elements.startBroadcast) {
            elements.startBroadcast.addEventListener('click', () => this.startBroadcast());
        }
        
        if (elements.stopBroadcast) {
            elements.stopBroadcast.addEventListener('click', () => this.stopBroadcast());
        }
        
        if (elements.restartBroadcast) {
            elements.restartBroadcast.addEventListener('click', () => this.restartBroadcast());
        }
        
        if (elements.skipTrack) {
            elements.skipTrack.addEventListener('click', () => this.skipTrack());
        }
        
        console.log('🎧 Event listeners configurados');
    }
    
    setupAudioPlayer() {
        if (!elements.audioPlayer) return;
        
        const audioPlayer = elements.audioPlayer;
        
        // Configurações de áudio
        audioPlayer.preload = 'auto';
        audioPlayer.volume = radioState.volume / 100;
        audioPlayer.crossOrigin = 'anonymous';
        
        // Otimizações para streaming
        if (audioPlayer.hasAttribute) {
            if (audioPlayer.hasAttribute('controls')) {
                audioPlayer.removeAttribute('controls');
            }
        }
        
        console.log('🔊 Audio player configurado');
    }
    
    // ========================================
    // CONTROLES DE TRANSMISSÃO
    // ========================================
    
    async startBroadcast() {
        if (radioState.isLive) {
            console.log('⚠️ Transmissão já está ativa');
            return;
        }
        
        try {
            console.log('🔴 Iniciando transmissão ao vivo...');
            
            radioState.isLive = true;
            radioState.startTime = Date.now();
            radioState.connectionAttempts = 0;
            radioState.isReconnecting = false;
            
            // Preparar primeira música
            await this.prepareNextTrack();
            
            // Iniciar timers
            this.startTimers();
            
            // Atualizar interface
            this.updateBroadcastStatus();
            this.updatePlayerControls();
            
            // Tocar primeira música
            if (radioState.currentTrack) {
                await this.playCurrentTrack();
            }
            
            console.log('✅ Transmissão ao vivo iniciada!');
            
        } catch (error) {
            console.error('❌ Erro ao iniciar transmissão:', error);
            this.handleBroadcastError(error);
        }
    }
    
    stopBroadcast() {
        if (!radioState.isLive) {
            console.log('⚠️ Transmissão já está parada');
            return;
        }
        
        console.log('⏹️ Parando transmissão...');
        
        radioState.isLive = false;
        radioState.isPlaying = false;
        
        // Parar áudio
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
            elements.audioPlayer.src = '';
        }
        
        // Parar timers
        this.stopTimers();
        
        // Atualizar interface
        this.updateBroadcastStatus();
        this.updatePlayerControls();
        
        console.log('✅ Transmissão parada');
    }
    
    async restartBroadcast() {
        console.log('🔄 Reiniciando transmissão...');
        
        this.stopBroadcast();
        
        setTimeout(() => {
            this.startBroadcast();
        }, 2000);
    }
    
    emergencyStop() {
        if (!confirm('🚨 PARADA DE EMERGÊNCIA - Isso irá interromper a transmissão imediatamente. Confirmar?')) {
            return;
        }
        
        console.log('🚨 PARADA DE EMERGÊNCIA ATIVADA!');
        
        radioState.isLive = false;
        radioState.isPlaying = false;
        
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
            elements.audioPlayer.src = '';
        }
        
        this.stopTimers();
        this.updateBroadcastStatus();
        this.updatePlayerControls();
        
        alert('🛑 Transmissão interrompida por parada de emergência!');
    }
    
    // ========================================
    // CONTROLE DE REPRODUÇÃO
    // ========================================
    
    async playCurrentTrack() {
        if (!radioState.currentTrack || !elements.audioPlayer) {
            console.warn('⚠️ Nenhuma música para reproduzir');
            await this.prepareNextTrack();
            return;
        }
        
        try {
            const audioPlayer = elements.audioPlayer;
            
            // Definir fonte
            if (audioPlayer.src !== radioState.currentTrack.url) {
                audioPlayer.src = radioState.currentTrack.url;
            }
            
            // Atualizar interface
            this.updateNowPlaying();
            
            // Reproduzir
            if (radioState.isLive) {
                const playPromise = audioPlayer.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        radioState.isPlaying = true;
                        this.updatePlayerControls();
                        console.log(`🎵 Tocando: ${radioState.currentTrack.name}`);
                    }).catch(error => {
                        console.error('Erro no autoplay:', error);
                        this.handleAutoplayBlocked();
                    });
                }
            }
            
            // Preparar próxima música
            this.prepareNextTrack();
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir música:', error);
            this.handlePlaybackError(error);
        }
    }
    
    async prepareNextTrack() {
        try {
            const nextTrack = this.getNextTrack();
            
            if (nextTrack) {
                radioState.nextTrack = nextTrack;
                this.updateUpcomingTracks();
                console.log(`🎼 Próxima música preparada: ${nextTrack.name}`);
            } else {
                console.warn('⚠️ Nenhuma música disponível para próxima reprodução');
                this.handleEmptyPlaylist();
            }
            
        } catch (error) {
            console.error('❌ Erro ao preparar próxima música:', error);
        }
    }
    
    getNextTrack() {
        // Verificar hora certa
        if (this.shouldPlayTimeAnnouncement()) {
            radioState.tracksSinceTime = 0;
            radioState.lastTimeCheck = Date.now();
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        // Verificar anúncios
        if (this.shouldPlayAd()) {
            radioState.tracksSinceAd = 0;
            radioState.lastAdTime = Date.now();
            return this.getRandomTrack(radioState.playlists.ads);
        }
        
        // Música regular
        let playlist = radioState.playlists.music;
        
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum]?.length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        radioState.tracksSinceTime++;
        radioState.tracksSinceAd++;
        
        return this.getRandomTrack(playlist);
    }
    
    getRandomTrack(playlist) {
        if (!playlist || playlist.length === 0) {
            console.warn('Playlist vazia');
            return null;
        }
        
        // Evitar repetir a música atual
        let availableTracks = playlist;
        if (playlist.length > 1 && radioState.currentTrack) {
            availableTracks = playlist.filter(track => 
                track.name !== radioState.currentTrack.name
            );
        }
        
        if (availableTracks.length === 0) {
            availableTracks = playlist;
        }
        
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        return availableTracks[randomIndex];
    }
    
    shouldPlayTimeAnnouncement() {
        if (radioState.playlists.time.length === 0) return false;
        
        const now = new Date();
        const minutes = now.getMinutes();
        
        // Tocar na hora exata
        if (minutes === 0 && radioState.tracksSinceTime >= 3) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            return timeSinceLastTime > 50 * 60 * 1000; // 50 minutos
        }
        
        return false;
    }
    
    shouldPlayAd() {
        if (radioState.playlists.ads.length === 0) return false;
        
        const adInterval = radioState.config.adInterval;
        return radioState.tracksSinceAd >= adInterval;
    }
    
    skipTrack() {
        if (!radioState.isLive) {
            console.log('Transmissão não está ativa');
            return;
        }
        
        console.log('⏭️ Pulando para próxima música');
        
        // Mover próxima música para atual
        if (radioState.nextTrack) {
            radioState.currentTrack = radioState.nextTrack;
            radioState.nextTrack = null;
        } else {
            radioState.currentTrack = this.getNextTrack();
        }
        
        if (radioState.currentTrack) {
            this.playCurrentTrack();
        }
    }
    
    togglePlayPause() {
        if (!elements.audioPlayer) return;
        
        if (radioState.isLive && radioState.isPlaying) {
            // Pausar transmissão
            elements.audioPlayer.pause();
            radioState.isPlaying = false;
            console.log('⏸️ Transmissão pausada');
        } else if (radioState.isLive) {
            // Retomar transmissão
            if (radioState.currentTrack) {
                elements.audioPlayer.play().catch(error => {
                    console.error('Erro ao retomar:', error);
                    this.handleAutoplayBlocked();
                });
            } else {
                this.playCurrentTrack();
            }
        } else {
            // Iniciar transmissão
            this.startBroadcast();
        }
        
        this.updatePlayerControls();
    }
    
    setVolume(volume) {
        radioState.volume = parseInt(volume);
        
        if (elements.audioPlayer) {
            elements.audioPlayer.volume = radioState.volume / 100;
        }
        
        if (elements.volumeValue) {
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        this.saveData();
    }
    
    // ========================================
    // EVENTOS DE ÁUDIO
    // ========================================
    
    onLoadStart() {
        radioState.isLoading = true;
        this.updatePlayerControls();
        console.log('⏳ Carregando música...');
    }
    
    onCanPlay() {
        radioState.isLoading = false;
        this.updatePlayerControls();
        console.log('✅ Música pronta para reprodução');
    }
    
    onPlay() {
        radioState.isPlaying = true;
        this.updatePlayerControls();
        this.updatePlayHistory();
    }
    
    onPause() {
        radioState.isPlaying = false;
        this.updatePlayerControls();
    }
    
    onTrackEnd() {
        console.log('🎵 Música finalizada, próxima...');
        
        if (radioState.isLive) {
            // Mover para próxima música
            radioState.currentTrack = radioState.nextTrack;
            radioState.nextTrack = null;
            
            if (radioState.currentTrack) {
                setTimeout(() => {
                    this.playCurrentTrack();
                }, 500);
            } else {
                this.prepareNextTrack().then(() => {
                    if (radioState.nextTrack) {
                        radioState.currentTrack = radioState.nextTrack;
                        radioState.nextTrack = null;
                        this.playCurrentTrack();
                    }
                });
            }
        }
    }
    
    onTimeUpdate() {
        this.updateTimeDisplay();
        
        // Preparar próxima música quando estiver quase acabando
        if (elements.audioPlayer && radioState.currentTrack) {
            const currentTime = elements.audioPlayer.currentTime;
            const duration = elements.audioPlayer.duration;
            
            if (duration && (duration - currentTime < 10) && !radioState.nextTrack) {
                this.prepareNextTrack();
            }
        }
    }
    
    onAudioError(error) {
        console.error('❌ Erro de áudio:', error);
        
        const audioError = elements.audioPlayer.error;
        if (audioError) {
            console.error('Código do erro:', audioError.code);
            console.error('Mensagem:', audioError.message);
        }
        
        this.handlePlaybackError(error);
    }
    
    onWaiting() {
        radioState.isLoading = true;
        this.updatePlayerControls();
        console.log('⏳ Aguardando buffer...');
    }
    
    onCanPlayThrough() {
        radioState.isLoading = false;
        this.updatePlayerControls();
        console.log('✅ Buffer completo');
    }
    
    // ========================================
    // CONTROLE DE CONEXÃO
    // ========================================
    
    onConnectionLost() {
        console.warn('📡 Conexão perdida');
        this.updateBroadcastStatus();
        
        if (radioState.config.autoRestart && radioState.isLive) {
            this.scheduleReconnect();
        }
    }
    
    onConnectionRestore() {
        console.log('📡 Conexão restaurada');
        radioState.connectionAttempts = 0;
        this.updateBroadcastStatus();
        
        if (radioState.isReconnecting) {
            this.reconnect();
        }
    }
    
    onVisibilityChange() {
        if (!document.hidden && radioState.isLive) {
            console.log('👁️ Página visível, verificando transmissão');
            
            setTimeout(() => {
                if (radioState.isLive && elements.audioPlayer?.paused) {
                    elements.audioPlayer.play().catch(() => {
                        console.log('Autoplay bloqueado após retorno');
                    });
                }
            }, 1000);
        }
    }
    
    async reconnect() {
        if (radioState.isReconnecting) return;
        
        radioState.isReconnecting = true;
        radioState.connectionAttempts++;
        
        console.log(`🔄 Tentativa de reconexão ${radioState.connectionAttempts}/${RADIO_CONFIG.maxReconnectAttempts}`);
        
        if (elements.reloadBtn) {
            elements.reloadBtn.classList.add('loading');
        }
        
        try {
            // Parar reprodução atual
            if (elements.audioPlayer) {
                elements.audioPlayer.pause();
                elements.audioPlayer.src = '';
            }
            
            // Aguardar um pouco
            await new Promise(resolve => setTimeout(resolve, RADIO_CONFIG.reconnectDelay));
            
            // Tentar reconectar
            await this.prepareNextTrack();
            
            if (radioState.nextTrack) {
                radioState.currentTrack = radioState.nextTrack;
                radioState.nextTrack = null;
                await this.playCurrentTrack();
                
                console.log('✅ Reconexão bem-sucedida');
                radioState.connectionAttempts = 0;
                radioState.isReconnecting = false;
                
                if (elements.reloadBtn) {
                    elements.reloadBtn.classList.remove('loading');
                }
                
                this.updateBroadcastStatus();
                return;
            }
            
            throw new Error('Nenhuma música disponível');
            
        } catch (error) {
            console.error('❌ Falha na reconexão:', error);
            
            if (radioState.connectionAttempts >= RADIO_CONFIG.maxReconnectAttempts) {
                console.error('🚨 Máximo de tentativas de reconexão atingido');
                this.handleMaxReconnectAttemptsReached();
            } else {
                this.scheduleReconnect();
            }
        }
        
        if (elements.reloadBtn) {
            elements.reloadBtn.classList.remove('loading');
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        const delay = Math.min(RADIO_CONFIG.reconnectDelay * radioState.connectionAttempts, 30000);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnect();
        }, delay);
        
        console.log(`⏰ Próxima tentativa de reconexão em ${delay/1000}s`);
    }
    
    // ========================================
    // TRATAMENTO DE ERROS
    // ========================================
    
    handleBroadcastError(error) {
        console.error('❌ Erro de transmissão:', error);
        
        if (radioState.config.autoRestart) {
            console.log('🔄 Tentando recuperar transmissão...');
            setTimeout(() => {
                this.restartBroadcast();
            }, 5000);
        }
    }
    
    handlePlaybackError(error) {
        console.error('❌ Erro de reprodução:', error);
        
        // Tentar próxima música
        setTimeout(() => {
            if (radioState.isLive) {
                this.skipTrack();
            }
        }, 2000);
    }
    
    handleAutoplayBlocked() {
        console.log('🔇 Autoplay bloqueado pelo navegador');
        
        this.showAutoplayPrompt();
        radioState.isPlaying = false;
        this.updatePlayerControls();
    }
    
    handleEmptyPlaylist() {
        console.warn('📭 Playlist vazia');
        
        if (elements.currentTrack) {
            elements.currentTrack.textContent = 'Aguardando músicas...';
        }
        
        // Tentar novamente em 30 segundos
        setTimeout(() => {
            if (radioState.isLive && this.getTotalTracks() > 0) {
                this.prepareNextTrack();
            }
        }, 30000);
    }
    
    handleMaxReconnectAttemptsReached() {
        console.error('🚨 Máximo de tentativas de reconexão atingido');
        
        radioState.isReconnecting = false;
        
        if (elements.connectionModal) {
            elements.connectionMessage.textContent = 'Falha na conexão. Clique para tentar novamente.';
            this.showModal('connectionModal');
        }
        
        this.updateBroadcastStatus();
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: rgba(255,107,107,0.9); color: white; padding: 15px 25px;
            border-radius: 10px; z-index: 9999; text-align: center; cursor: pointer;
            font-weight: 600; box-shadow: 0 4px 20px rgba(255,107,107,0.4);
        `;
        prompt.innerHTML = '🔊 Clique aqui para ativar o áudio da rádio';
        
        document.body.appendChild(prompt);
        
        const enableAudio = () => {
            if (radioState.isLive && elements.audioPlayer) {
                elements.audioPlayer.play().catch(() => {});
            }
            prompt.remove();
        };
        
        prompt.addEventListener('click', enableAudio);
        setTimeout(() => prompt.remove(), 10000);
    }
    
    // ========================================
    // TIMERS E HEARTBEAT
    // ========================================
    
    startTimers() {
        // Timer de uptime
        this.uptimeTimer = setInterval(() => {
            this.updateUptime();
        }, 1000);
        
        // Timer de verificação de hora
        this.timeCheckTimer = setInterval(() => {
            if (radioState.isLive) {
                this.checkTimeAnnouncement();
            }
        }, RADIO_CONFIG.timeCheckInterval);
        
        // Heartbeat para manter conexão
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, RADIO_CONFIG.heartbeatInterval);
        
        console.log('⏰ Timers iniciados');
    }
    
    stopTimers() {
        if (this.uptimeTimer) {
            clearInterval(this.uptimeTimer);
            this.uptimeTimer = null;
        }
        
        if (this.timeCheckTimer) {
            clearInterval(this.timeCheckTimer);
            this.timeCheckTimer = null;
        }
        
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        console.log('⏰ Timers parados');
    }
    
    updateUptime() {
        if (!radioState.startTime) return;
        
        const uptimeMs = Date.now() - radioState.startTime;
        const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
        
        const uptimeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (elements.uptime) {
            elements.uptime.textContent = `Uptime: ${uptimeString}`;
        }
        
        if (elements.adminUptime) {
            elements.adminUptime.textContent = uptimeString;
        }
        
        radioState.uptime = uptimeMs;
    }
    
    sendHeartbeat() {
        radioState.lastHeartbeat = Date.now();
        
        // Simular contagem de ouvintes
        radioState.listenerCount = Math.floor(Math.random() * 10) + 1;
        
        if (elements.listenerCount) {
            elements.listenerCount.textContent = `Ouvintes: ${radioState.listenerCount}`;
        }
    }
    
    checkTimeAnnouncement() {
        if (!radioState.isLive || radioState.playlists.time.length === 0) return;
        
        const now = new Date();
        if (now.getMinutes() === 0 && this.shouldPlayTimeAnnouncement()) {
            console.log('🕐 Hora para anúncio de tempo');
            radioState.tracksSinceTime = 999; // Força próximo anúncio
        }
    }
    
    // ========================================
    // ATUALIZAÇÃO DA INTERFACE
    // ========================================
    
    updateBroadcastStatus() {
        const isOnline = navigator.onLine;
        const status = radioState.isLive && isOnline;
        
        if (elements.broadcastStatus) {
            elements.broadcastStatus.className = `broadcast-status ${status ? 'online' : 'offline'}`;
        }
        
        if (elements.statusText) {
            if (status) {
                elements.statusText.textContent = 'TRANSMITINDO AO VIVO';
            } else if (!isOnline) {
                elements.statusText.textContent = 'SEM CONEXÃO COM A INTERNET';
            } else {
                elements.statusText.textContent = 'TRANSMISSÃO OFFLINE';
            }
        }
        
        if (elements.liveIndicator) {
            elements.liveIndicator.textContent = status ? '🔴 AO VIVO' : '⚫ OFFLINE';
            elements.liveIndicator.style.color = status ? '#ff4757' : '#666';
        }
        
        if (elements.adminRadioStatus) {
            elements.adminRadioStatus.textContent = status ? '🔴 AO VIVO' : '⚫ OFFLINE';
            elements.adminRadioStatus.className = `status-value ${status ? 'live' : 'offline'}`;
        }
    }
    
    updatePlayerControls() {
        if (!elements.playPauseBtn) return;
        
        const icon = elements.playPauseBtn.querySelector('span');
        if (!icon) return;
        
        if (radioState.isLive && radioState.isPlaying) {
            icon.textContent = '⏸️';
            icon.className = 'pause-icon';
        } else {
            icon.textContent = '▶️';
            icon.className = 'play-icon';
        }
        
        if (elements.playStatus) {
            if (radioState.isLive && radioState.isPlaying) {
                elements.playStatus.textContent = 'AO VIVO';
            } else if (radioState.isLive) {
                elements.playStatus.textContent = 'PAUSADO';
            } else {
                elements.playStatus.textContent = 'OFFLINE';
            }
        }
        
        // Indicador de loading
        if (elements.reloadBtn) {
            if (radioState.isLoading) {
                elements.reloadBtn.classList.add('loading');
            } else {
                elements.reloadBtn.classList.remove('loading');
            }
        }
    }
    
    updateNowPlaying() {
        if (!radioState.currentTrack) return;
        
        // Título da música
        if (elements.currentTrack) {
            elements.currentTrack.textContent = radioState.currentTrack.name;
        }
        
        if (elements.adminCurrentTrack) {
            elements.adminCurrentTrack.textContent = radioState.currentTrack.name;
        }
        
        // Capa da música
        this.updateTrackCover();
        
        // Contadores
        if (elements.trackCount) {
            elements.trackCount.textContent = `Músicas: ${radioState.playCount}`;
        }
    }
    
    updateTrackCover() {
        if (!elements.trackCover || !elements.albumCover) return;
        
        if (radioState.currentTrack?.coverUrl) {
            elements.trackCover.src = radioState.currentTrack.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.albumCover.style.display = 'none';
        } else {
            elements.trackCover.style.display = 'none';
            elements.albumCover.style.display = 'block';
        }
    }
    
    updateTimeDisplay() {
        if (!elements.trackTime || !elements.audioPlayer) return;
        
        try {
            const current = Math.floor(elements.audioPlayer.currentTime) || 0;
            const duration = Math.floor(elements.audioPlayer.duration) || 0;
            
            elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
        } catch (error) {
            elements.trackTime.textContent = '--:-- / --:--';
        }
    }
    
    updateUpcomingTracks() {
        if (!elements.upcomingList) return;
        
        // Simular próximas músicas
        const upcoming = [];
        
        if (radioState.nextTrack) {
            upcoming.push(radioState.nextTrack.name);
        }
        
        // Adicionar mais algumas músicas da playlist atual
        let playlist = radioState.playlists.music;
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum]?.length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        const shuffled = [...playlist].sort(() => 0.5 - Math.random());
        upcoming.push(...shuffled.slice(0, 3 - upcoming.length).map(track => track.name));
        
        elements.upcomingList.innerHTML = upcoming.length > 0 ? 
            upcoming.map(name => `<div class="upcoming-item">${name}</div>`).join('') :
            '<div class="upcoming-item">Carregando programação...</div>';
    }
    
    updatePlayHistory() {
        if (!radioState.currentTrack) return;
        
        const trackName = radioState.currentTrack.name;
        radioState.playHistory[trackName] = (radioState.playHistory[trackName] || 0) + 1;
        radioState.playCount++;
        
        this.saveData();
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ========================================
    // UTILITÁRIOS
    // ========================================
    
    getTotalTracks() {
        const musicCount = radioState.playlists.music.length;
        const albumCount = Object.values(radioState.playlists.albums)
            .reduce((sum, album) => sum + album.length, 0);
        return musicCount + albumCount;
    }
    
    saveData() {
        if (!checkBrowserSupport().localStorage) return;
        
        try {
            const dataToSave = {
                playlists: radioState.playlists,
                albumCovers: radioState.albumCovers,
                playHistory: radioState.playHistory,
                activeAlbum: radioState.activeAlbum,
                volume: radioState.volume,
                config: radioState.config
            };
            
            localStorage.setItem('radioState', JSON.stringify(dataToSave));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }
    
    loadStoredData() {
        if (!checkBrowserSupport().localStorage) return;
        
        try {
            const stored = localStorage.getItem('radioState');
            if (stored) {
                const parsedData = JSON.parse(stored);
                
                // Mesclar dados salvos
                radioState.playlists = { ...radioState.playlists, ...parsedData.playlists };
                radioState.albumCovers = { ...radioState.albumCovers, ...parsedData.albumCovers };
                radioState.playHistory = { ...parsedData.playHistory };
                radioState.activeAlbum = parsedData.activeAlbum || null;
                radioState.volume = parsedData.volume || 70;
                radioState.config = { ...radioState.config, ...parsedData.config };
                
                console.log('✅ Dados carregados do armazenamento local');
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }
}

// ========================================
// GERENCIADOR DE ARQUIVOS
// ========================================

class FileManager {
    constructor() {
        this.uploadQueue = [];
        this.isUploading = false;
    }
    
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        
        if (!fileInput?.files?.length) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        this.showLoading(true, 'Enviando arquivos...');
        
        try {
            const files = Array.from(fileInput.files);
            const results = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                this.updateLoadingProgress((i / files.length) * 100);
                this.updateLoadingText(`Enviando ${i + 1}/${files.length}: ${file.name}`);
                
                const result = await this.uploadToCloudinary(file, category, albumType);
                results.push(result);
                
                // Adicionar à playlist apropriada
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(result);
                } else {
                    radioState.playlists[category].push(result);
                }
            }
            
            // Salvar dados
            broadcastManager.saveData();
            
            // Limpar input
            fileInput.value = '';
            
            // Atualizar interface
            this.refreshFilesList();
            this.updateFileCounts();
            
            // Se não há música tocando, preparar próxima
            if (radioState.isLive && !radioState.currentTrack) {
                setTimeout(() => {
                    broadcastManager.prepareNextTrack().then(() => {
                        if (radioState.nextTrack) {
                            radioState.currentTrack = radioState.nextTrack;
                            radioState.nextTrack = null;
                            broadcastManager.playCurrentTrack();
                        }
                    });
                }, 1000);
            }
            
            alert(`✅ ${results.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            alert(`❌ Erro no upload: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    getFileInput(category) {
        const inputs = {
            music: elements.musicUpload || document.getElementById('musicUpload'),
            time: elements.timeUpload || document.getElementById('timeUpload'),
            ads: elements.adUpload || document.getElementById('adUpload'),
            album: elements.albumUpload || document.getElementById('albumUpload')
        };
        return inputs[category];
    }
    
    async uploadToCloudinary(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? 
            `albums/${albumType}` : 
            category;
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Upload failed: ${error}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString(),
            duration: data.duration || 0,
            format: data.format || 'mp3'
        };
    }
    
    refreshFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
    }
    
    refreshCategoryFiles(category) {
        const container = document.getElementById(`${category}Files`);
        if (!container) return;
        
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p style="color: #a0a0a0;">Nenhum arquivo encontrado.</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    ${file.duration ? `<small>(${Math.floor(file.duration/60)}:${(file.duration%60).toString().padStart(2,'0')})</small>` : ''}
                </div>
                <div class="file-actions">
                    <button onclick="playPreview('${category}', ${index})" class="btn-secondary btn-small" title="Preview">▶️</button>
                    <button onclick="deleteFile('${category}', ${index})" class="btn-danger btn-small" title="Excluir">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    refreshAlbumFiles() {
        const container = document.getElementById('albumFiles');
        if (!container) return;
        
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = ALBUM_DATA[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `<h5 style="color: #4facfe; margin: 15px 0 10px;">${album.title}</h5>`;
            
            if (files.length === 0) {
                html += '<p style="color: #a0a0a0; font-size: 0.8rem;">Nenhum arquivo encontrado.</p>';
            } else {
                html += files.map((file, index) => `
                    <div class="file-item">
                        <div class="file-info">
                            <span class="file-name">${file.name}</span>
                            ${file.duration ? `<small>(${Math.floor(file.duration/60)}:${(file.duration%60).toString().padStart(2,'0')})</small>` : ''}
                        </div>
                        <div class="file-actions">
                            <button onclick="playPreview('album', '${albumKey}', ${index})" class="btn-secondary btn-small" title="Preview">▶️</button>
                            <button onclick="deleteAlbumFile('${albumKey}', ${index})" class="btn-danger btn-small" title="Excluir">🗑️</button>
                        </div>
                    </div>
                `).join('');
            }
        });
        
        container.innerHTML = html;
    }
    
    updateFileCounts() {
        const counts = {
            music: radioState.playlists.music.length,
            time: radioState.playlists.time.length,
            ads: radioState.playlists.ads.length,
            album: Object.values(radioState.playlists.albums).reduce((sum, album) => sum + album.length, 0)
        };
        
        Object.entries(counts).forEach(([category, count]) => {
            const element = document.getElementById(`${category}Count`);
            if (element) {
                element.textContent = count;
            }
        });
    }
    
    showLoading(show, text = 'Carregando...') {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.classList.toggle('active', show);
        }
        
        if (elements.loadingText && text) {
            elements.loadingText.textContent = text;
        }
    }
    
    updateLoadingText(text) {
        if (elements.loadingText) {
            elements.loadingText.textContent = text;
        }
    }
    
    updateLoadingProgress(percentage) {
        if (elements.loadingBar) {
            elements.loadingBar.style.width = `${percentage}%`;
        }
    }
}

// ========================================
// GERENCIADOR DE ÁLBUNS
// ========================================

class AlbumManager {
    setupCoversGrid() {
        if (!elements.coversGrid) return;
        
        let html = '';
        
        Object.keys(ALBUM_DATA).forEach(albumKey => {
            const album = ALBUM_DATA[albumKey];
            let coverUrl;
            
            if (albumKey === 'general') {
                coverUrl = radioState.albumCovers.general || 
                    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
            } else {
                coverUrl = radioState.albumCovers[albumKey] || 
                    `https://via.placeholder.com/200x200/333/fff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div class="cover-item">
                    <img src="${coverUrl}" alt="${album.title}" loading="lazy">
                    <h4>${album.title}</h4>
                    <p style="color: #a0a0a0; margin-bottom: 15px; font-size: 0.9rem;">${album.description}</p>
                    <button onclick="openCoverModal('${albumKey}')" class="btn-secondary btn-small">🖼️ Alterar Capa</button>
                </div>
            `;
        });
        
        elements.coversGrid.innerHTML = html;
    }
    
    setActiveAlbum() {
        if (!elements.activeAlbumSelect) return;
        
        const selectedAlbum = elements.activeAlbumSelect.value;
        radioState.activeAlbum = selectedAlbum || null;
        
        this.updateAlbumDisplay();
        broadcastManager.saveData();
        
        const message = selectedAlbum ? 
            `Álbum "${ALBUM_DATA[selectedAlbum].title}" ativado! A rádio tocará apenas este álbum.` : 
            'Álbum desativado. A rádio voltou para a playlist geral.';
        
        alert(message);
        
        console.log(selectedAlbum ? 
            `📻 Álbum ativo: ${ALBUM_DATA[selectedAlbum].title}` : 
            '📻 Playlist geral ativa'
        );
        
        // Preparar próxima música com nova configuração
        if (radioState.isLive) {
            broadcastManager.prepareNextTrack();
        }
    }
    
    updateAlbumDisplay() {
        if (!elements.albumCover || !elements.albumTitle) return;
        
        try {
            if (radioState.activeAlbum && ALBUM_DATA[radioState.activeAlbum]) {
                const album = ALBUM_DATA[radioState.activeAlbum];
                const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
                    `https://via.placeholder.com/300x300/333/fff?text=${encodeURIComponent(album.title)}`;
                
                elements.albumCover.src = coverUrl;
                elements.albumTitle.textContent = album.title;
            } else {
                const coverUrl = radioState.albumCovers.general || 
                    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
                
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
    
    async uploadCover() {
        const albumKey = elements.coverModal.dataset.albumKey;
        const file = elements.coverUpload.files[0];
        
        if (!file) {
            alert('Selecione uma imagem!');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            alert('Selecione apenas arquivos de imagem!');
            return;
        }
        
        fileManager.showLoading(true, 'Enviando capa...');
        
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
                throw new Error('Erro no upload da capa');
            }
            
            const data = await response.json();
            radioState.albumCovers[albumKey] = data.secure_url;
            
            broadcastManager.saveData();
            this.setupCoversGrid();
            this.updateAlbumDisplay();
            
            closeModal('coverModal');
            alert('✅ Capa alterada com sucesso!');
            
        } catch (error) {
            console.error('Erro no upload da capa:', error);
            alert(`❌ Erro ao alterar a capa: ${error.message}`);
        } finally {
            fileManager.showLoading(false);
        }
    }
    
    removeCover() {
        const albumKey = elements.coverModal.dataset.albumKey;
        
        if (!radioState.albumCovers[albumKey]) {
            alert('Não há capa para remover!');
            return;
        }
        
        if (!confirm('Tem certeza que deseja remover esta capa?')) return;
        
        delete radioState.albumCovers[albumKey];
        broadcastManager.saveData();
        this.setupCoversGrid();
        this.updateAlbumDisplay();
        
        closeModal('coverModal');
        alert('✅ Capa removida com sucesso!');
    }
}

// ========================================
// GERENCIADOR DE RELATÓRIOS
// ========================================

class ReportManager {
    refreshReports() {
        if (!elements.reportList) return;
        
        if (Object.keys(radioState.playHistory).length === 0) {
            elements.reportList.innerHTML = '<p style="color: #a0a0a0;">Nenhuma música foi reproduzida ainda.</p>';
            return;
        }
        
        const sortedHistory = Object.entries(radioState.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 50); // Mostrar apenas top 50
        
        elements.reportList.innerHTML = sortedHistory.map(([track, count]) => `
            <div class="report-item">
                <span class="track-name">${track}</span>
                <span class="play-count">${count}x</span>
            </div>
        `).join('');
    }
    
    resetPlayCount() {
        if (!confirm('⚠️ Tem certeza que deseja resetar toda a contagem? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        radioState.playHistory = {};
        radioState.playCount = 0;
        
        this.refreshReports();
        broadcastManager.saveData();
        
        if (elements.trackCount) {
            elements.trackCount.textContent = 'Músicas: 0';
        }
        
        alert('✅ Contagem resetada com sucesso!');
    }
    
    exportReports() {
        if (Object.keys(radioState.playHistory).length === 0) {
            alert('Nenhum dado para exportar!');
            return;
        }
        
        const data = {
            geradoEm: new Date().toISOString(),
            totalMusicas: radioState.playCount,
            uptime: radioState.uptime,
            historicoReproducao: radioState.playHistory,
            albumAtivo: radioState.activeAlbum,
            estatisticas: {
                musicasNaPlaylist: radioState.playlists.music.length,
                anunciosNaPlaylist: radioState.playlists.ads.length,
                horasNaPlaylist: radioState.playlists.time.length,
                albumsComMusicas: Object.keys(radioState.playlists.albums)
                    .filter(key => radioState.playlists.albums[key].length > 0)
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `radio-relatorio-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('📊 Relatório exportado com sucesso!');
    }
}

// ========================================
// INSTÂNCIAS GLOBAIS
// ========================================

let broadcastManager, fileManager, albumManager, reportManager;

// ========================================
// INICIALIZAÇÃO PRINCIPAL
// ========================================

async function initializeRadio() {
    if (isInitialized) {
        console.warn('⚠️ Rádio já inicializada');
        return;
    }
    
    try {
        console.log('🚀 Iniciando Rádio Supermercado do Louro...');
        
        // Verificar suporte do navegador
        const support = checkBrowserSupport();
        if (!support.audio) {
            throw new Error('Navegador não suporta reprodução de áudio');
        }
        
        // Inicializar elementos DOM
        if (!initElements()) {
            throw new Error('Falha na inicialização dos elementos DOM');
        }
        
        // Marcar como inicializado
        isInitialized = true;
        
        // Configurar volume inicial
        if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
            elements.audioPlayer.volume = radioState.volume / 100;
            elements.volumeSlider.value = radioState.volume;
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        // Inicializar gerenciadores
        broadcastManager = new LiveBroadcastManager();
        fileManager = new FileManager();
        albumManager = new AlbumManager();
        reportManager = new ReportManager();
        
        // Configurar listeners adicionais
        setupAdditionalEventListeners();
        
        // Atualizar interface inicial
        updateInitialUI();
        
        console.log('✅ Rádio inicializada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        alert(`Erro ao inicializar a rádio: ${error.message}`);
    }
}

function setupAdditionalEventListeners() {
    try {
        // Admin
        if (elements.adminBtn) {
            elements.adminBtn.addEventListener('click', openPasswordModal);
        }
        
        if (elements.backToPlayerBtn) {
            elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
        }
        
        if (elements.adminPassword) {
            elements.adminPassword.addEventListener('keypress', e => {
                if (e.key === 'Enter') checkPassword();
            });
        }
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
        });
        
        // Configurações admin
        if (elements.autoRestart) {
            elements.autoRestart.addEventListener('change', e => {
                radioState.config.autoRestart = e.target.checked;
                broadcastManager.saveData();
            });
        }
        
        if (elements.continuousPlay) {
            elements.continuousPlay.addEventListener('change', e => {
                radioState.config.continuousPlay = e.target.checked;
                broadcastManager.saveData();
            });
        }
        
        if (elements.adInterval) {
            elements.adInterval.addEventListener('change', e => {
                radioState.config.adInterval = parseInt(e.target.value);
                broadcastManager.saveData();
            });
        }
        
        // Fechar modais clicando fora
        document.addEventListener('click', e => {
            if (e.target.classList.contains('modal')) {
                const modalId = e.target.id;
                closeModal(modalId);
            }
        });
        
        // Atalhos de teclado
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch (e.key) {
                case ' ': // Espaço - Play/Pause
                    e.preventDefault();
                    if (broadcastManager) broadcastManager.togglePlayPause();
                    break;
                case 'ArrowRight': // Seta direita - Próxima
                    if (broadcastManager) broadcastManager.skipTrack();
                    break;
                case 'ArrowUp': // Seta cima - Aumentar volume
                    e.preventDefault();
                    if (elements.volumeSlider) {
                        const newVolume = Math.min(100, parseInt(elements.volumeSlider.value) + 5);
                        elements.volumeSlider.value = newVolume;
                        broadcastManager.setVolume(newVolume);
                    }
                    break;
                case 'ArrowDown': // Seta baixo - Diminuir volume
                    e.preventDefault();
                    if (elements.volumeSlider) {
                        const newVolume = Math.max(0, parseInt(elements.volumeSlider.value) - 5);
                        elements.volumeSlider.value = newVolume;
                        broadcastManager.setVolume(newVolume);
                    }
                    break;
            }
        });
        
        console.log('✅ Event listeners adicionais configurados');
        
    } catch (error) {
        console.error('❌ Erro ao configurar listeners:', error);
    }
}

function updateInitialUI() {
    // Atualizar display do álbum
    if (albumManager) {
        albumManager.updateAlbumDisplay();
        albumManager.setupCoversGrid();
    }
    
    // Atualizar listas de arquivos
    if (fileManager) {
        fileManager.refreshFilesList();
        fileManager.updateFileCounts();
    }
    
    // Atualizar relatórios
    if (reportManager) {
        reportManager.refreshReports();
    }
    
    // Configurar configurações admin
    if (elements.autoRestart) {
        elements.autoRestart.checked = radioState.config.autoRestart;
    }
    
    if (elements.continuousPlay) {
        elements.continuousPlay.checked = radioState.config.continuousPlay;
    }
    
    if (elements.adInterval) {
        elements.adInterval.value = radioState.config.adInterval;
    }
}

// ========================================
// FUNÇÕES DE INTERFACE
// ========================================

function openPasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.classList.add('active');
        if (elements.adminPassword) {
            elements.adminPassword.focus();
        }
    }
}

function checkPassword() {
    if (!elements.adminPassword) return;
    
    if (elements.adminPassword.value === 'admin123') {
        closeModal('passwordModal');
        showAdminMode();
        elements.adminPassword.value = '';
    } else {
        alert('❌ Senha incorreta!');
        elements.adminPassword.value = '';
        elements.adminPassword.focus();
    }
}

function showAdminMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'none';
    if (elements.adminMode) elements.adminMode.style.display = 'block';
    
    // Atualizar dados admin
    if (fileManager) fileManager.refreshFilesList();
    if (reportManager) reportManager.refreshReports();
    if (albumManager) albumManager.setupCoversGrid();
    
    // Atualizar próximo anúncio
    if (elements.nextAdTime) {
        const nextAd = radioState.config.adInterval - radioState.tracksSinceAd;
        elements.nextAdTime.textContent = nextAd > 0 ? `${nextAd} músicas` : 'Próxima música';
    }
}

function showPlayerMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'flex';
    if (elements.adminMode) elements.adminMode.style.display = 'none';
}

function switchTab(tabName) {
    // Remover active de todos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adicionar active nos selecionados
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Executar ações específicas da aba
    switch (tabName) {
        case 'files':
            if (fileManager) fileManager.refreshFilesList();
            break;
        case 'reports':
            if (reportManager) reportManager.refreshReports();
            break;
        case 'albums':
            if (albumManager) albumManager.setupCoversGrid();
            break;
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
    
    // Limpar campos específicos
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal' && elements.coverUpload) {
        elements.coverUpload.value = '';
    }
}

// ========================================
// FUNÇÕES DE UPLOAD E GERENCIAMENTO
// ========================================

function uploadFiles(category) {
    const albumType = category === 'album' ? 
        document.getElementById('albumSelect')?.value : '';
    
    if (fileManager) {
        fileManager.uploadFiles(category, albumType);
    }
}

function setActiveAlbum() {
    if (albumManager) {
        albumManager.setActiveAlbum();
    }
}

function deleteFile(category, index) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists[category].splice(index, 1);
    
    if (broadcastManager) broadcastManager.saveData();
    if (fileManager) {
        fileManager.refreshFilesList();
        fileManager.updateFileCounts();
    }
    
    alert('✅ Arquivo excluído com sucesso!');
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists.albums[albumKey].splice(index, 1);
    
    if (broadcastManager) broadcastManager.saveData();
    if (fileManager) {
        fileManager.refreshFilesList();
        fileManager.updateFileCounts();
    }
    
    alert('✅ Arquivo excluído com sucesso!');
}

function openCoverModal(albumKey) {
    if (elements.coverAlbumName) {
        elements.coverAlbumName.textContent = ALBUM_DATA[albumKey].title;
    }
    
    if (elements.coverModal) {
        elements.coverModal.dataset.albumKey = albumKey;
        elements.coverModal.classList.add('active');
    }
}

function uploadCover() {
    if (albumManager) {
        albumManager.uploadCover();
    }
}

function removeCover() {
    if (albumManager) {
        albumManager.removeCover();
    }
}

function refreshReports() {
    if (reportManager) {
        reportManager.refreshReports();
    }
}

function resetPlayCount() {
    if (reportManager) {
        reportManager.resetPlayCount();
    }
}

function exportReports() {
    if (reportManager) {
        reportManager.exportReports();
    }
}

function forceReconnect() {
    closeModal('connectionModal');
    
    if (broadcastManager) {
        broadcastManager.reconnect();
    }
}

function playPreview(category, albumKeyOrIndex, index = null) {
    let track;
    
    if (index !== null) {
        // Preview de álbum
        track = radioState.playlists.albums[albumKeyOrIndex][index];
    } else {
        // Preview de categoria
        track = radioState.playlists[category][albumKeyOrIndex];
    }
    
    if (!track) {
        alert('❌ Arquivo não encontrado!');
        return;
    }
    
    // Criar preview player temporário
    const previewAudio = new Audio(track.url);
    previewAudio.volume = 0.5;
    previewAudio.currentTime = 0;
    
    // Tocar por 10 segundos
    previewAudio.play().then(() => {
        console.log(`🎵 Preview: ${track.name}`);
        setTimeout(() => {
            previewAudio.pause();
            previewAudio.src = '';
        }, 10000);
    }).catch(error => {
        console.error('Erro no preview:', error);
        alert('❌ Erro ao reproduzir preview');
    });
}

// ========================================
// INICIALIZAÇÃO SEGURA
// ========================================

function safeInitialization() {
    try {
        // Verificar se DOM está pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeRadio);
            return;
        }
        
        // Verificar elementos críticos
        const criticalElements = ['audioPlayer', 'playPauseBtn', 'currentTrack'];
        const missing = criticalElements.filter(id => !document.getElementById(id));
        
        if (missing.length > 0) {
            console.error('❌ Elementos críticos não encontrados:', missing);
            
            // Tentar novamente após delay
            setTimeout(() => {
                const stillMissing = missing.filter(id => !document.getElementById(id));
                if (stillMissing.length === 0) {
                    initializeRadio();
                } else {
                    console.error('❌ Elementos ainda não encontrados após retry:', stillMissing);
                }
            }, 2000);
            return;
        }
        
        // Inicializar após pequeno delay para garantir carregamento completo
        setTimeout(initializeRadio, 500);
        
    } catch (error) {
        console.error('❌ Erro na inicialização segura:', error);
    }
}

// ========================================
// TRATAMENTO DE ERROS GLOBAIS
// ========================================

window.addEventListener('error', (e) => {
    console.error('❌ Erro global capturado:', e.error);
    
    // Tentar recuperar transmissão em caso de erro crítico
    if (radioState.isLive && broadcastManager && radioState.config.autoRestart) {
        setTimeout(() => {
            console.log('🔄 Tentando recuperar transmissão após erro...');
            broadcastManager.reconnect();
        }, 5000);
    }
});

// ========================================
// MANUTENÇÃO DA TRANSMISSÃO
// ========================================

// Manter transmissão ativa quando página perde/ganha foco
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive && broadcastManager) {
        console.log('👁️ Página visível novamente, verificando transmissão...');
        
        setTimeout(() => {
            if (radioState.isLive && elements.audioPlayer?.paused) {
                elements.audioPlayer.play().catch(() => {
                    console.log('Autoplay bloqueado após retorno de foco');
                });
            }
        }, 1000);
    }
});

// Salvar estado antes de sair da página
window.addEventListener('beforeunload', () => {
    if (broadcastManager) {
        broadcastManager.saveData();
    }
    console.log('💾 Estado da rádio salvo antes de sair');
});

// Detectar se está rodando como PWA
window.addEventListener('appinstalled', () => {
    console.log('📱 Rádio instalada como PWA');
});

// ========================================
// INICIALIZAÇÃO PRINCIPAL
// ========================================

console.log('🎵 Sistema de Rádio 24h carregando...');
safeInitialization();

// Exportar para debug
window.radioDebug = {
    state: () => radioState,
    broadcast: () => broadcastManager,
    files: () => fileManager,
    albums: () => albumManager,
    reports: () => reportManager
};

console.log('✅ Script da rádio carregado com sucesso! Sistema 24h pronto.');