/**
 * 📻 RÁDIO SUPERMERCADO DO LOURO - SISTEMA AO VIVO 24H
 * Sistema completo de rádio web com transmissão contínua
 * ===================================================
 */

// ===== CONFIGURAÇÕES GLOBAIS =====
const RADIO_CONFIG = {
    cloudinary: {
        cloudName: 'dygbrcrr6',
        uploadPreset: 'radio_preset'
    },
    intervals: {
        jinglesEvery: 3600000, // 1 hora em ms
        adsEvery: 5, // A cada 5 músicas
        trackCheck: 1000, // Verificar status a cada 1s
        uiUpdate: 5000, // Atualizar UI a cada 5s
        chatSimulation: 30000 // Mensagem simulada a cada 30s
    },
    audio: {
        crossfade: 2, // segundos
        volume: 0.7,
        quality: 128 // kbps
    }
};

// ===== ESTADO GLOBAL DA RÁDIO =====
let radioState = {
    // Status da transmissão
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    nextTracks: [],
    
    // Estatísticas
    uptime: 0,
    totalPlayCount: 0,
    todayPlayCount: 0,
    listenerCount: 0,
    
    // Bibliotecas de mídia
    playlists: {
        music: [],
        jingles: [],
        ads: [],
        albums: {
            natal: [],
            pascoa: [],
            saojoao: [],
            carnaval: []
        }
    },
    
    // Configurações
    activeAlbum: null,
    volume: 70,
    settings: {
        radioName: "Rádio Supermercado do Louro",
        description: "Sua música, sua experiência",
        jingleFrequency: 60,
        adInterval: 5,
        maxDuration: 300,
        crossfade: 2
    },
    
    // Histórico e estatísticas
    playHistory: {},
    albumCovers: {},
    
    // Contadores internos
    tracksSinceJingle: 0,
    tracksSinceAd: 0,
    lastJingleTime: 0,
    sessionStart: Date.now()
};

// ===== ELEMENTOS DOM =====
let elements = {};
let audioContext = null;
let analyser = null;
let spectrum = null;
let isInitialized = false;

// ===== SIMULAÇÃO DE OUVINTES =====
const chatMessages = [
    "Adorando essa música! 🎵",
    "Boa rádio, parabéns!",
    "Toca mais música brasileira!",
    "Som perfeito para trabalhar",
    "Qual o nome dessa música?",
    "Rádio top demais! 👏",
    "Escutando do trabalho",
    "Melhor rádio da região!",
    "Toca um samba aí!",
    "Som da minha infância ❤️",
    "Qualidade perfeita",
    "Sempre escuto essa rádio",
    "Parabéns pela programação!"
];

const userNames = [
    "João", "Maria", "Pedro", "Ana", "Carlos", "Lucia", 
    "Ricardo", "Fernanda", "Roberto", "Cristina", "Paulo", 
    "Mariana", "José", "Sandra", "Antonio", "Patricia"
];

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Rádio Supermercado do Louro...');
    initializeRadio();
});

async function initializeRadio() {
    try {
        // Mostrar loading
        showLoadingScreen(true);
        
        // Inicializar elementos DOM
        if (!initializeElements()) {
            throw new Error('Falha ao inicializar elementos DOM');
        }
        
        // Carregar dados salvos
        loadStoredData();
        
        // Configurar áudio
        await initializeAudio();
        
        // Configurar eventos
        setupEventListeners();
        
        // Inicializar sistemas
        initializeSpectrumAnalyzer();
        startLiveRadioSystem();
        startUIUpdates();
        startChatSimulation();
        
        // Esconder loading
        setTimeout(() => {
            showLoadingScreen(false);
            console.log('✅ Rádio inicializada e transmitindo AO VIVO!');
        }, 3000);
        
        isInitialized = true;
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro ao inicializar a rádio. Recarregue a página.');
    }
}

function initializeElements() {
    const elementIds = [
        'audioPlayer', 'playPauseBtn', 'refreshBtn', 'muteBtn',
        'volumeSlider', 'volumeValue', 'albumCover', 'trackCover',
        'albumTitle', 'currentTrack', 'trackTime', 'listenerCount',
        'connectionStatus', 'totalTracks', 'broadcastTime',
        'chatMessages', 'chatInput', 'sendChatBtn',
        'playerMode', 'adminMode', 'adminBtn', 'backToPlayerBtn',
        'passwordModal', 'adminPassword', 'loadingScreen',
        'spectrum', 'activeAlbumSelect', 'loadingOverlay'
    ];
    
    elements = {};
    const missing = [];
    
    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            elements[id] = element;
        } else {
            missing.push(id);
        }
    });
    
    if (missing.length > 0) {
        console.warn('⚠️ Elementos não encontrados:', missing);
    }
    
    return elements.audioPlayer && elements.currentTrack && elements.playPauseBtn;
}

// ===== SISTEMA DE ÁUDIO =====
async function initializeAudio() {
    if (!elements.audioPlayer) return;
    
    try {
        // Configurar Web Audio API para spectrum analyzer
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        
        const source = audioContext.createMediaElementSource(elements.audioPlayer);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        analyser.fftSize = 256;
        
        // Configurar volume inicial
        elements.audioPlayer.volume = radioState.volume / 100;
        if (elements.volumeSlider) {
            elements.volumeSlider.value = radioState.volume;
        }
        
        console.log('🔊 Sistema de áudio inicializado');
        
    } catch (error) {
        console.warn('⚠️ Web Audio API não disponível:', error.message);
    }
}

function initializeSpectrumAnalyzer() {
    if (!elements.spectrum || !analyser) return;
    
    const canvas = elements.spectrum;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        if (!radioState.isPlaying) {
            // Animação padrão quando não está tocando
            drawDefaultSpectrum(ctx, canvas.width, canvas.height);
        } else {
            // Spectrum real baseado no áudio
            analyser.getByteFrequencyData(dataArray);
            drawRealSpectrum(ctx, canvas.width, canvas.height, dataArray);
        }
        
        requestAnimationFrame(draw);
    }
    
    draw();
}

function drawDefaultSpectrum(ctx, width, height) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = width / 32;
    
    for (let i = 0; i < 32; i++) {
        const barHeight = Math.random() * height * 0.3 + 10;
        const hue = (i / 32) * 360;
        
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
    }
}

function drawRealSpectrum(ctx, width, height, dataArray) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = width / dataArray.length * 2;
    
    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const hue = (i / dataArray.length) * 360;
        
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
    }
}

// ===== SISTEMA DE RÁDIO AO VIVO =====
class LiveRadioManager {
    constructor() {
        this.playInterval = null;
        this.uptimeInterval = null;
        this.autoPlayQueue = [];
        this.crossfadeEnabled = false;
        
        this.setupAudioEvents();
    }
    
    setupAudioEvents() {
        if (!elements.audioPlayer) return;
        
        elements.audioPlayer.addEventListener('ended', () => {
            console.log('🎵 Música finalizada, tocando próxima...');
            this.playNextTrack();
        });
        
        elements.audioPlayer.addEventListener('error', (e) => {
            console.error('❌ Erro no áudio:', e);
            setTimeout(() => this.playNextTrack(), 3000);
        });
        
        elements.audioPlayer.addEventListener('canplay', () => {
            if (radioState.isLive && radioState.isPlaying) {
                this.startPlayback();
            }
        });
        
        elements.audioPlayer.addEventListener('timeupdate', () => {
            this.updateTrackTime();
        });
    }
    
    startTransmission() {
        if (radioState.isLive) return;
        
        console.log('🔴 Iniciando transmissão AO VIVO...');
        
        radioState.isLive = true;
        radioState.isPlaying = true;
        radioState.sessionStart = Date.now();
        
        // Iniciar contadores
        this.startUptimeCounter();
        
        // Tocar primeira música
        this.playNextTrack();
        
        // Atualizar UI
        this.updateTransmissionStatus();
        
        // Simular ouvintes
        this.startListenerSimulation();
        
        console.log('✅ Transmissão AO VIVO iniciada!');
    }
    
    stopTransmission() {
        if (!radioState.isLive) return;
        
        console.log('⏸️ Pausando transmissão...');
        
        radioState.isLive = false;
        radioState.isPlaying = false;
        
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
        }
        
        // Parar contadores
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }
        
        this.updateTransmissionStatus();
        
        console.log('⏹️ Transmissão pausada');
    }
    
    async playNextTrack() {
        try {
            const nextTrack = this.selectNextTrack();
            
            if (!nextTrack) {
                console.warn('⚠️ Nenhuma música disponível');
                setTimeout(() => this.playNextTrack(), 10000);
                return;
            }
            
            // Atualizar estado
            radioState.currentTrack = nextTrack;
            radioState.totalPlayCount++;
            radioState.todayPlayCount++;
            
            // Atualizar histórico
            if (radioState.playHistory[nextTrack.name]) {
                radioState.playHistory[nextTrack.name]++;
            } else {
                radioState.playHistory[nextTrack.name] = 1;
            }
            
            // Configurar áudio
            if (elements.audioPlayer) {
                elements.audioPlayer.src = nextTrack.url;
                elements.audioPlayer.load();
            }
            
            // Atualizar UI
            this.updateNowPlaying(nextTrack);
            
            // Gerar próximas músicas
            this.generateUpcomingTracks();
            
            // Log
            console.log(`🎵 Tocando: ${nextTrack.name}`);
            
            // Salvar estado
            saveRadioState();
            
        } catch (error) {
            console.error('❌ Erro ao tocar próxima música:', error);
            setTimeout(() => this.playNextTrack(), 5000);
        }
    }
    
    selectNextTrack() {
        // Verificar se deve tocar jingle (hora certa)
        if (this.shouldPlayJingle()) {
            const jingle = this.getRandomTrack(radioState.playlists.jingles);
            if (jingle) {
                radioState.tracksSinceJingle = 0;
                radioState.lastJingleTime = Date.now();
                return jingle;
            }
        }
        
        // Verificar se deve tocar anúncio
        if (this.shouldPlayAd()) {
            const ad = this.getRandomTrack(radioState.playlists.ads);
            if (ad) {
                radioState.tracksSinceAd = 0;
                return ad;
            }
        }
        
        // Selecionar música normal
        let musicPlaylist = radioState.playlists.music;
        
        // Se há álbum ativo, usar apenas esse álbum
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            musicPlaylist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        // Incrementar contadores
        radioState.tracksSinceJingle++;
        radioState.tracksSinceAd++;
        
        return this.getRandomTrack(musicPlaylist);
    }
    
    shouldPlayJingle() {
        const now = Date.now();
        const timeSinceLastJingle = now - radioState.lastJingleTime;
        const jingleInterval = radioState.settings.jingleFrequency * 60 * 1000; // Converter para ms
        
        return timeSinceLastJingle >= jingleInterval && radioState.playlists.jingles.length > 0;
    }
    
    shouldPlayAd() {
        return radioState.tracksSinceAd >= radioState.settings.adInterval && 
               radioState.playlists.ads.length > 0;
    }
    
    getRandomTrack(playlist) {
        if (!playlist || playlist.length === 0) return null;
        
        // Evitar repetir a música atual
        let availableTracks = playlist;
        if (radioState.currentTrack && playlist.length > 1) {
            availableTracks = playlist.filter(track => track.name !== radioState.currentTrack.name);
        }
        
        if (availableTracks.length === 0) {
            availableTracks = playlist;
        }
        
        return availableTracks[Math.floor(Math.random() * availableTracks.length)];
    }
    
    startPlayback() {
        if (elements.audioPlayer && radioState.isLive && radioState.isPlaying) {
            elements.audioPlayer.play().catch(error => {
                console.warn('⚠️ Autoplay bloqueado:', error.message);
                this.showAutoplayPrompt();
            });
        }
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: rgba(255, 71, 87, 0.95); color: white; padding: 15px 25px; 
                        border-radius: 10px; z-index: 9999; text-align: center; cursor: pointer;
                        backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2);
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);">
                🔊 Clique aqui para ativar o áudio da rádio AO VIVO
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        const enableAudio = () => {
            if (radioState.isLive && elements.audioPlayer) {
                elements.audioPlayer.play();
            }
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume();
            }
            prompt.remove();
        };
        
        prompt.addEventListener('click', enableAudio);
        
        // Remover automaticamente após 15 segundos
        setTimeout(() => {
            if (document.body.contains(prompt)) {
                prompt.remove();
            }
        }, 15000);
    }
    
    updateNowPlaying(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name || 'Música sem título';
        }
        
        if (elements.albumTitle) {
            const albumName = radioState.activeAlbum ? 
                radioState.settings.albums?.[radioState.activeAlbum]?.title || 'Álbum Especial' :
                'Playlist Geral';
            elements.albumTitle.textContent = albumName;
        }
        
        // Atualizar capa se disponível
        this.updateTrackCover(track);
        
        // Simular informações adicionais
        if (elements.trackGenre) {
            const genres = ['Pop', 'Rock', 'MPB', 'Sertanejo', 'Forró', 'Axé', 'Pagode', 'Funk'];
            elements.trackGenre.textContent = genres[Math.floor(Math.random() * genres.length)];
        }
        
        // Atualizar próximas músicas no admin
        this.updateQueuePreview();
    }
    
    updateTrackCover(track) {
        if (!elements.albumCover || !elements.trackCover) return;
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.albumCover.style.opacity = '0.5';
        } else {
            elements.trackCover.style.display = 'none';
            elements.albumCover.style.opacity = '1';
            
            // Usar capa do álbum se disponível
            const albumCover = radioState.activeAlbum ? 
                radioState.albumCovers[radioState.activeAlbum] : 
                radioState.albumCovers.general;
            
            if (albumCover) {
                elements.albumCover.src = albumCover;
            }
        }
    }
    
    generateUpcomingTracks() {
        radioState.nextTracks = [];
        
        for (let i = 0; i < 3; i++) {
            const nextTrack = this.selectNextTrack();
            if (nextTrack) {
                radioState.nextTracks.push(nextTrack);
            }
        }
    }
    
    updateQueuePreview() {
        const queueElement = document.getElementById('queuePreview');
        if (!queueElement) return;
        
        if (radioState.nextTracks.length === 0) {
            queueElement.innerHTML = `
                <div>1. Carregando...</div>
                <div>2. Carregando...</div>
                <div>3. Carregando...</div>
            `;
            return;
        }
        
        let html = '';
        for (let i = 0; i < 3; i++) {
            const track = radioState.nextTracks[i];
            html += `<div>${i + 1}. ${track ? track.name : 'Gerando playlist...'}</div>`;
        }
        
        queueElement.innerHTML = html;
    }
    
    updateTrackTime() {
        if (!elements.audioPlayer || !elements.trackTime) return;
        
        const current = elements.audioPlayer.currentTime || 0;
        const duration = elements.audioPlayer.duration || 0;
        
        const currentFormatted = this.formatTime(current);
        const durationFormatted = this.formatTime(duration);
        
        elements.trackTime.textContent = `${currentFormatted} / ${durationFormatted}`;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    startUptimeCounter() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }
        
        this.uptimeInterval = setInterval(() => {
            radioState.uptime = Date.now() - radioState.sessionStart;
            this.updateUptimeDisplay();
        }, 1000);
    }
    
    updateUptimeDisplay() {
        if (!elements.broadcastTime) return;
        
        const hours = Math.floor(radioState.uptime / (1000 * 60 * 60));
        const minutes = Math.floor((radioState.uptime % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((radioState.uptime % (1000 * 60)) / 1000);
        
        elements.broadcastTime.textContent = 
            `No ar há: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateTransmissionStatus() {
        // Atualizar status de conexão
        if (elements.connectionStatus) {
            if (radioState.isLive) {
                elements.connectionStatus.className = 'connection-status online';
                elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>ONLINE</span>';
            } else {
                elements.connectionStatus.className = 'connection-status offline';
                elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>OFFLINE</span>';
            }
        }
        
        // Atualizar botão de play/pause
        if (elements.playPauseBtn) {
            if (radioState.isLive) {
                elements.playPauseBtn.innerHTML = '<span>⏸️</span>';
                elements.playPauseBtn.title = 'Pausar Stream';
            } else {
                elements.playPauseBtn.innerHTML = '<span>▶️</span>';
                elements.playPauseBtn.title = 'Iniciar Stream';
            }
        }
        
        // Atualizar status no admin
        const adminStatus = document.getElementById('adminBroadcastStatus');
        if (adminStatus) {
            adminStatus.textContent = radioState.isLive ? '🔴 TRANSMITINDO AO VIVO' : '⚫ OFFLINE';
            adminStatus.style.color = radioState.isLive ? '#2ed573' : '#ff4757';
        }
        
        const toggleBtn = document.getElementById('toggleTransmissionBtn');
        if (toggleBtn) {
            if (radioState.isLive) {
                toggleBtn.innerHTML = '⏸️ Pausar Transmissão';
                toggleBtn.className = 'btn-danger';
            } else {
                toggleBtn.innerHTML = '▶️ Iniciar Transmissão';
                toggleBtn.className = 'btn-primary';
            }
        }
    }
    
    startListenerSimulation() {
        // Simular número de ouvintes oscilando
        setInterval(() => {
            if (radioState.isLive) {
                const baseListeners = 45;
                const variation = Math.floor(Math.random() * 20) - 10;
                radioState.listenerCount = Math.max(1, baseListeners + variation);
                
                if (elements.listenerCount) {
                    elements.listenerCount.textContent = `Ouvintes: ${radioState.listenerCount}`;
                }
            } else {
                radioState.listenerCount = 0;
                if (elements.listenerCount) {
                    elements.listenerCount.textContent = 'Ouvintes: ---';
                }
            }
        }, 15000);
    }
}

// Instância global do gerenciador
let radioManager = null;

// ===== SISTEMA DE TRANSMISSÃO =====
function startLiveRadioSystem() {
    radioManager = new LiveRadioManager();
    
    // Iniciar transmissão automaticamente
    setTimeout(() => {
        radioManager.startTransmission();
    }, 1000);
}

// ===== CONTROLES DO PLAYER =====
function toggleTransmission() {
    if (!radioManager) return;
    
    if (radioState.isLive) {
        radioManager.stopTransmission();
    } else {
        radioManager.startTransmission();
    }
}

function refreshStream() {
    if (!radioManager || !radioState.isLive) return;
    
    console.log('🔄 Reconectando stream...');
    
    if (elements.audioPlayer) {
        elements.audioPlayer.load();
        setTimeout(() => {
            if (radioState.isLive) {
                elements.audioPlayer.play();
            }
        }, 1000);
    }
}

function skipTrack() {
    if (!radioManager || !radioState.isLive) return;
    
    console.log('⏭️ Pulando música...');
    radioManager.playNextTrack();
}

function toggleMute() {
    if (!elements.audioPlayer) return;
    
    if (elements.audioPlayer.muted) {
        elements.audioPlayer.muted = false;
        elements.muteBtn.innerHTML = '<span>🔊</span>';
        elements.muteBtn.title = 'Mute';
    } else {
        elements.audioPlayer.muted = true;
        elements.muteBtn.innerHTML = '<span>🔇</span>';
        elements.muteBtn.title = 'Unmute';
    }
}

function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer) return;
    
    const volume = parseInt(elements.volumeSlider.value);
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    
    if (elements.volumeValue) {
        elements.volumeValue.textContent = `${volume}%`;
    }
    
    saveRadioState();
}

// ===== SISTEMA DE CHAT SIMULADO =====
function startChatSimulation() {
    if (!elements.chatMessages) return;
    
    setInterval(() => {
        if (radioState.isLive && Math.random() < 0.3) { // 30% de chance
            simulateChatMessage();
        }
    }, RADIO_CONFIG.intervals.chatSimulation);
}

function simulateChatMessage() {
    const message = chatMessages[Math.floor(Math.random() * chatMessages.length)];
    const username = userNames[Math.floor(Math.random() * userNames.length)];
    
    addChatMessage(`${username}: ${message}`);
}

function addChatMessage(message) {
    if (!elements.chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.textContent = message;
    
    elements.chatMessages.appendChild(messageDiv);
    
    // Remover mensagens antigas (manter apenas 10)
    const messages = elements.chatMessages.children;
    while (messages.length > 10) {
        messages[0].remove();
    }
    
    // Scroll para a última mensagem
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function sendChatMessage() {
    if (!elements.chatInput) return;
    
    const message = elements.chatInput.value.trim();
    if (message) {
        addChatMessage(`Você: ${message}`);
        elements.chatInput.value = '';
    }
}

// ===== SISTEMA DE UPLOAD =====
class CloudinaryUploader {
    static async uploadFile(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', RADIO_CONFIG.cloudinary.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${RADIO_CONFIG.cloudinary.cloudName}/auto/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Erro no upload: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0,
            uploadedAt: new Date().toISOString(),
            size: file.size
        };
    }
}

async function uploadFiles(category) {
    const fileInputs = {
        music: 'musicUpload',
        jingles: 'timeUpload',
        ads: 'adUpload',
        album: 'albumUpload'
    };
    
    const inputId = fileInputs[category === 'time' ? 'jingles' : category];
    const fileInput = document.getElementById(inputId);
    
    if (!fileInput || fileInput.files.length === 0) {
        alert('Selecione pelo menos um arquivo!');
        return;
    }
    
    showLoading(true, `Enviando ${fileInput.files.length} arquivo(s)...`);
    
    try {
        const files = Array.from(fileInput.files);
        const uploadedFiles = [];
        
        for (const file of files) {
            try {
                const albumType = category === 'album' ? 
                    document.getElementById('albumSelect')?.value : '';
                
                const uploadedFile = await CloudinaryUploader.uploadFile(file, category, albumType);
                uploadedFiles.push(uploadedFile);
                
            } catch (error) {
                console.error(`Erro ao enviar ${file.name}:`, error);
            }
        }
        
        // Adicionar arquivos às playlists
        uploadedFiles.forEach(file => {
            const targetCategory = category === 'time' ? 'jingles' : category;
            
            if (category === 'album') {
                const albumType = document.getElementById('albumSelect')?.value;
                if (albumType && radioState.playlists.albums[albumType]) {
                    radioState.playlists.albums[albumType].push(file);
                }
            } else {
                radioState.playlists[targetCategory].push(file);
            }
        });
        
        // Salvar estado e atualizar UI
        saveRadioState();
        refreshFilesList();
        updateTotalTracksDisplay();
        
        // Limpar input
        fileInput.value = '';
        
        // Regerar próximas músicas se necessário
        if (radioManager) {
            radioManager.generateUpcomingTracks();
        }
        
        alert(`${uploadedFiles.length} arquivo(s) enviado(s) com sucesso!`);
        
    } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro durante o upload. Tente novamente.');
    } finally {
        showLoading(false);
    }
}

// ===== GERENCIAMENTO DE ARQUIVOS =====
function refreshFilesList() {
    refreshCategoryFiles('music');
    refreshCategoryFiles('jingles', 'timeFiles');
    refreshCategoryFiles('ads', 'adFiles');
    refreshAlbumFiles();
}

function refreshCategoryFiles(category, elementId = null) {
    const containerId = elementId || `${category}Files`;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const files = radioState.playlists[category] || [];
    
    if (files.length === 0) {
        container.innerHTML = '<p style="color: #a0a0a0;">Nenhum arquivo encontrado.</p>';
        return;
    }
    
    container.innerHTML = files.map((file, index) => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                ${file.duration ? `<small>Duração: ${formatDuration(file.duration)}</small>` : ''}
            </div>
            <div class="file-actions">
                <button onclick="playPreview('${file.url}')" class="btn-secondary btn-small" title="Preview">▶️</button>
                <button onclick="deleteFile('${category}', ${index})" class="btn-danger btn-small" title="Excluir">🗑️</button>
            </div>
        </div>
    `).join('');
}

function refreshAlbumFiles() {
    const container = document.getElementById('albumFiles');
    if (!container) return;
    
    let html = '';
    
    Object.keys(radioState.playlists.albums).forEach(albumKey => {
        const albumNames = {
            natal: '🎄 Natal',
            pascoa: '🐰 Páscoa', 
            saojoao: '🎪 São João',
            carnaval: '🎭 Carnaval'
        };
        
        const files = radioState.playlists.albums[albumKey] || [];
        const albumName = albumNames[albumKey] || albumKey;
        
        html += `<h5 style="color: #4facfe; margin: 20px 0 10px; font-size: 1.1rem;">${albumName}</h5>`;
        
        if (files.length === 0) {
            html += '<p style="color: #a0a0a0; font-size: 0.9rem;">Nenhum arquivo encontrado.</p>';
        } else {
            html += files.map((file, index) => `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        ${file.duration ? `<small>Duração: ${formatDuration(file.duration)}</small>` : ''}
                    </div>
                    <div class="file-actions">
                        <button onclick="playPreview('${file.url}')" class="btn-secondary btn-small" title="Preview">▶️</button>
                        <button onclick="deleteAlbumFile('${albumKey}', ${index})" class="btn-danger btn-small" title="Excluir">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
    });
    
    container.innerHTML = html;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function playPreview(url) {
    const previewAudio = new Audio(url);
    previewAudio.volume = 0.5;
    previewAudio.play().catch(console.error);
    
    // Parar após 10 segundos
    setTimeout(() => {
        previewAudio.pause();
        previewAudio.currentTime = 0;
    }, 10000);
}

function deleteFile(category, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists[category].splice(index, 1);
    saveRadioState();
    refreshFilesList();
    updateTotalTracksDisplay();
    
    alert('Arquivo excluído com sucesso!');
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists.albums[albumKey].splice(index, 1);
    saveRadioState();
    refreshFilesList();
    updateTotalTracksDisplay();
    
    alert('Arquivo excluído com sucesso!');
}

// ===== GERENCIAMENTO DE ÁLBUNS =====
function setActiveAlbum() {
    const select = document.getElementById('activeAlbumSelect');
    if (!select) return;
    
    const selectedAlbum = select.value || null;
    radioState.activeAlbum = selectedAlbum;
    
    // Atualizar capa se necessário
    updateAlbumDisplay();
    
    saveRadioState();
    
    const albumNames = {
        natal: '🎄 Natal',
        pascoa: '🐰 Páscoa',
        saojoao: '🎪 São João', 
        carnaval: '🎭 Carnaval'
    };
    
    const message = selectedAlbum ? 
        `Álbum "${albumNames[selectedAlbum]}" ativado! A rádio tocará apenas este álbum.` : 
        'Álbum desativado. A rádio voltou para a playlist geral.';
    
    alert(message);
    
    // Regerar próximas músicas
    if (radioManager) {
        radioManager.generateUpcomingTracks();
    }
}

function updateAlbumDisplay() {
    if (!elements.albumCover || !elements.albumTitle) return;
    
    const albumNames = {
        natal: '🎄 Natal',
        pascoa: '🐰 Páscoa',
        saojoao: '🎪 São João',
        carnaval: '🎭 Carnaval'
    };
    
    if (radioState.activeAlbum && albumNames[radioState.activeAlbum]) {
        const albumName = albumNames[radioState.activeAlbum];
        const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
            `https://via.placeholder.com/300x300/333/fff?text=${encodeURIComponent(albumName)}`;
        
        elements.albumCover.src = coverUrl;
        elements.albumTitle.textContent = albumName;
    } else {
        const coverUrl = radioState.albumCovers.general || 
            'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
        
        elements.albumCover.src = coverUrl;
        elements.albumTitle.textContent = 'Playlist Geral';
    }
}

// ===== SISTEMA DE CAPAS =====
function setupCoversGrid() {
    const container = document.getElementById('coversGrid');
    if (!container) return;
    
    const albums = {
        general: { title: '📻 Playlist Geral', description: 'Capa principal da rádio' },
        natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
        pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
        saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
        carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' }
    };
    
    let html = '';
    
    Object.keys(albums).forEach(albumKey => {
        const album = albums[albumKey];
        const coverUrl = radioState.albumCovers[albumKey] || 
            (albumKey === 'general' ? 
                'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png' :
                `https://via.placeholder.com/200x200/333/fff?text=${encodeURIComponent(album.title)}`);
        
        html += `
            <div class="cover-item">
                <img src="${coverUrl}" alt="${album.title}">
                <h4>${album.title}</h4>
                <p style="color: #a0a0a0; font-size: 0.9rem; margin-bottom: 15px;">${album.description}</p>
                <button onclick="openCoverModal('${albumKey}')" class="btn-secondary btn-small">Alterar Capa</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function openCoverModal(albumKey) {
    const modal = document.getElementById('coverModal');
    const albumNameSpan = document.getElementById('coverAlbumName');
    
    if (!modal || !albumNameSpan) return;
    
    const albums = {
        general: '📻 Playlist Geral',
        natal: '🎄 Natal',
        pascoa: '🐰 Páscoa',
        saojoao: '🎪 São João',
        carnaval: '🎭 Carnaval'
    };
    
    albumNameSpan.textContent = albums[albumKey] || albumKey;
    modal.dataset.albumKey = albumKey;
    modal.style.display = 'flex';
}

async function uploadCover() {
    const modal = document.getElementById('coverModal');
    const albumKey = modal?.dataset.albumKey;
    const fileInput = document.getElementById('coverUpload');
    const file = fileInput?.files[0];
    
    if (!file) {
        alert('Selecione uma imagem!');
        return;
    }
    
    if (!albumKey) {
        alert('Erro: álbum não identificado.');
        return;
    }
    
    showLoading(true, 'Enviando capa...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', RADIO_CONFIG.cloudinary.uploadPreset);
        formData.append('folder', 'radio-louro/covers');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${RADIO_CONFIG.cloudinary.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) throw new Error('Erro no upload da capa');
        
        const data = await response.json();
        radioState.albumCovers[albumKey] = data.secure_url;
        
        saveRadioState();
        setupCoversGrid();
        updateAlbumDisplay();
        closeModal('coverModal');
        
        alert('Capa alterada com sucesso!');
        
    } catch (error) {
        console.error('Erro no upload da capa:', error);
        alert('Erro ao alterar a capa. Tente novamente.');
    } finally {
        showLoading(false);
    }
}

function removeCover() {
    const modal = document.getElementById('coverModal');
    const albumKey = modal?.dataset.albumKey;
    
    if (!albumKey || !radioState.albumCovers[albumKey]) {
        alert('Não há capa para remover!');
        return;
    }
    
    if (!confirm('Tem certeza que deseja remover esta capa?')) return;
    
    delete radioState.albumCovers[albumKey];
    saveRadioState();
    setupCoversGrid();
    updateAlbumDisplay();
    closeModal('coverModal');
    
    alert('Capa removida com sucesso!');
}

// ===== SISTEMA DE RELATÓRIOS =====
function refreshReports() {
    const container = document.getElementById('reportList');
    if (!container) return;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        container.innerHTML = '<p style="color: #a0a0a0;">Nenhuma música foi reproduzida ainda.</p>';
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 50); // Mostrar apenas top 50
    
    let html = `
        <div style="margin-bottom: 20px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 12px;">
            <h4 style="color: #4facfe; margin-bottom: 15px;">📊 Estatísticas Gerais</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div><strong>Total de reproduções:</strong> ${radioState.totalPlayCount}</div>
                <div><strong>Reproduções hoje:</strong> ${radioState.todayPlayCount}</div>
                <div><strong>Músicas únicas:</strong> ${Object.keys(radioState.playHistory).length}</div>
                <div><strong>Tempo no ar:</strong> ${formatUptime(radioState.uptime)}</div>
            </div>
        </div>
        
        <h4 style="color: #4facfe; margin-bottom: 20px;">🎵 Top Músicas</h4>
    `;
    
    html += sortedHistory.map(([trackName, playCount], index) => `
        <div class="report-item">
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="
                    background: ${index < 3 ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'};
                    color: white; 
                    padding: 5px 10px; 
                    border-radius: 50%; 
                    font-weight: bold; 
                    min-width: 30px; 
                    text-align: center;
                    font-size: 0.9rem;
                ">${index + 1}</span>
                <span class="track-name">${trackName}</span>
            </div>
            <span class="play-count">${playCount}x</span>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

function formatUptime(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
}

function resetPlayCount() {
    if (!confirm('Tem certeza que deseja resetar todos os contadores? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    radioState.playHistory = {};
    radioState.totalPlayCount = 0;
    radioState.todayPlayCount = 0;
    radioState.sessionStart = Date.now();
    radioState.uptime = 0;
    
    saveRadioState();
    refreshReports();
    updateTotalTracksDisplay();
    
    alert('Contadores resetados com sucesso!');
}

function exportReports() {
    const reportData = {
        timestamp: new Date().toISOString(),
        statistics: {
            totalPlays: radioState.totalPlayCount,
            todayPlays: radioState.todayPlayCount,
            uniqueTracks: Object.keys(radioState.playHistory).length,
            uptime: radioState.uptime,
            listeners: radioState.listenerCount
        },
        playHistory: radioState.playHistory,
        playlists: {
            musicCount: radioState.playlists.music.length,
            jinglesCount: radioState.playlists.jingles.length,
            adsCount: radioState.playlists.ads.length,
            albumsCount: Object.values(radioState.playlists.albums)
                .reduce((total, album) => total + album.length, 0)
        }
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], 
        { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}

// ===== CONFIGURAÇÕES =====
function saveSettings() {
    const settings = {
        radioName: document.getElementById('radioName')?.value || radioState.settings.radioName,
        description: document.getElementById('radioDescription')?.value || radioState.settings.description,
        jingleFrequency: parseInt(document.getElementById('jingleFrequency')?.value) || radioState.settings.jingleFrequency,
        adInterval: parseInt(document.getElementById('adInterval')?.value) || radioState.settings.adInterval,
        maxDuration: parseInt(document.getElementById('maxDuration')?.value) || radioState.settings.maxDuration,
        crossfade: parseInt(document.getElementById('crossfade')?.value) || radioState.settings.crossfade
    };
    
    radioState.settings = { ...radioState.settings, ...settings };
    saveRadioState();
    
    // Atualizar título da página se necessário
    if (settings.radioName !== radioState.settings.radioName) {
        document.title = `${settings.radioName} - AO VIVO 24h`;
    }
    
    alert('Configurações salvas com sucesso!');
}

// ===== EVENTOS E INTERFACE =====
function setupEventListeners() {
    // Player controls
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', toggleTransmission);
    }
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', refreshStream);
    }
    if (elements.muteBtn) {
        elements.muteBtn.addEventListener('click', toggleMute);
    }
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', updateVolume);
    }
    
    // Chat
    if (elements.sendChatBtn) {
        elements.sendChatBtn.addEventListener('click', sendChatMessage);
    }
    if (elements.chatInput) {
        elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
    }
    
    // Admin access
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
    
    // Admin controls
    const toggleTransmissionBtn = document.getElementById('toggleTransmissionBtn');
    if (toggleTransmissionBtn) {
        toggleTransmissionBtn.addEventListener('click', toggleTransmission);
    }
    
    const skipTrackBtn = document.getElementById('skipTrackBtn');
    if (skipTrackBtn) {
        skipTrackBtn.addEventListener('click', skipTrack);
    }
    
    const reloadPlaylistBtn = document.getElementById('reloadPlaylistBtn');
    if (reloadPlaylistBtn) {
        reloadPlaylistBtn.addEventListener('click', () => {
            if (radioManager) {
                radioManager.generateUpcomingTracks();
                alert('Playlist recarregada!');
            }
        });
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            if (tabName) switchTab(tabName);
        });
    });
    
    // Crossfade slider
    const crossfadeSlider = document.getElementById('crossfade');
    if (crossfadeSlider) {
        crossfadeSlider.addEventListener('input', () => {
            const value = crossfadeSlider.value;
            const valueSpan = document.getElementById('crossfadeValue');
            if (valueSpan) {
                valueSpan.textContent = `${value}s`;
            }
        });
    }
}

// ===== INTERFACE ADMINISTRATIVA =====
function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            if (elements.adminPassword) {
                elements.adminPassword.focus();
            }
        }, 100);
    }
}

function checkPassword() {
    const password = elements.adminPassword?.value;
    
    if (password === 'admin123' || password === 'louro2024') {
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
    if (elements.playerMode) elements.playerMode.style.display = 'none';
    if (elements.adminMode) elements.adminMode.style.display = 'block';
    
    // Atualizar todas as seções do admin
    refreshFilesList();
    setupCoversGrid();
    refreshReports();
    updateAdminDashboard();
}

function showPlayerMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'flex';
    if (elements.adminMode) elements.adminMode.style.display = 'none';
}

function switchTab(tabName) {
    // Remover active de todos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Adicionar active aos selecionados
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Executar ações específicas da aba
    switch (tabName) {
        case 'playlist':
            refreshFilesList();
            setupCoversGrid();
            break;
        case 'reports':
            refreshReports();
            break;
        case 'dashboard':
            updateAdminDashboard();
            break;
    }
}

function updateAdminDashboard() {
    // Atualizar estatísticas do dashboard
    const activeListenersEl = document.getElementById('activeListeners');
    if (activeListenersEl) {
        activeListenersEl.textContent = radioState.listenerCount;
    }
    
    const uptimeEl = document.getElementById('uptime');
    if (uptimeEl) {
        uptimeEl.textContent = formatUptime(radioState.uptime);
    }
    
    const tracksTodayEl = document.getElementById('tracksToday');
    if (tracksTodayEl) {
        tracksTodayEl.textContent = radioState.todayPlayCount;
    }
    
    // Atualizar informações da música atual
    const adminCurrentTrackEl = document.getElementById('adminCurrentTrack');
    if (adminCurrentTrackEl) {
        adminCurrentTrackEl.textContent = radioState.currentTrack ? 
            radioState.currentTrack.name : 'Nenhuma música tocando';
    }
    
    const adminTrackTimeEl = document.getElementById('adminTrackTime');
    if (adminTrackTimeEl && elements.audioPlayer) {
        const current = elements.audioPlayer.currentTime || 0;
        const duration = elements.audioPlayer.duration || 0;
        const currentFormatted = formatDuration(current);
        const durationFormatted = formatDuration(duration);
        adminTrackTimeEl.textContent = `${currentFormatted} / ${durationFormatted}`;
    }
}

// ===== ATUALIZAÇÕES DE UI =====
function startUIUpdates() {
    // Atualizar UI periodicamente
    setInterval(() => {
        updateTotalTracksDisplay();
        updateAdminDashboard();
        
        // Simular mudança no número de ouvintes
        if (radioState.isLive) {
            const variation = Math.floor(Math.random() * 6) - 3; // -3 a +3
            radioState.listenerCount = Math.max(1, 
                Math.min(99, radioState.listenerCount + variation));
        }
    }, RADIO_CONFIG.intervals.uiUpdate);
}

function updateTotalTracksDisplay() {
    const totalMusic = radioState.playlists.music.length;
    const totalJingles = radioState.playlists.jingles.length;
    const totalAds = radioState.playlists.ads.length;
    const totalAlbums = Object.values(radioState.playlists.albums)
        .reduce((sum, album) => sum + album.length, 0);
    
    const totalTracks = totalMusic + totalJingles + totalAds + totalAlbums;
    
    if (elements.totalTracks) {
        elements.totalTracks.textContent = `Biblioteca: ${totalTracks} arquivos`;
    }
}

// ===== UTILITÁRIOS =====
function showLoading(show, message = 'Processando...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    
    if (show) {
        overlay.style.display = 'flex';
        const messageEl = overlay.querySelector('p');
        if (messageEl) {
            messageEl.textContent = message;
        }
    } else {
        overlay.style.display = 'none';
    }
}

function showLoadingScreen(show) {
    const screen = document.getElementById('loadingScreen');
    if (!screen) return;
    
    if (show) {
        screen.style.display = 'flex';
    } else {
        screen.style.opacity = '0';
        setTimeout(() => {
            screen.style.display = 'none';
        }, 500);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        
        // Limpar campos
        if (modalId === 'passwordModal' && elements.adminPassword) {
            elements.adminPassword.value = '';
        }
        if (modalId === 'coverModal') {
            const coverUpload = document.getElementById('coverUpload');
            if (coverUpload) coverUpload.value = '';
        }
    }
}

function showError(message) {
    alert(`❌ Erro: ${message}`);
}

// ===== PERSISTÊNCIA DE DADOS =====
function saveRadioState() {
    try {
        const dataToSave = {
            ...radioState,
            // Não salvar estado de reprodução
            isLive: false,
            isPlaying: false,
            currentTrack: null,
            uptime: 0
        };
        
        localStorage.setItem('radioSupermercadoState', JSON.stringify(dataToSave));
    } catch (error) {
        console.warn('⚠️ Erro ao salvar dados:', error);
    }
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem('radioSupermercadoState');
        if (stored) {
            const parsedData = JSON.parse(stored);
            radioState = { ...radioState, ...parsedData };
            
            // Reset diário dos contadores
            const today = new Date().toDateString();
            const lastSession = new Date(parsedData.sessionStart || 0).toDateString();
            
            if (today !== lastSession) {
                radioState.todayPlayCount = 0;
            }
            
            console.log('📂 Dados carregados do armazenamento local');
        }
    } catch (error) {
        console.warn('⚠️ Erro ao carregar dados:', error);
    }
}

// ===== LIMPEZA E MANUTENÇÃO =====
window.addEventListener('beforeunload', () => {
    saveRadioState();
    console.log('💾 Estado da rádio salvo antes de sair');
});

// Limpeza periódica da memória
setInterval(() => {
    // Limpar cache de áudio se necessário
    if (elements.audioPlayer && !radioState.isLive) {
        elements.audioPlayer.src = '';
    }
    
    // Limpar mensagens antigas do chat
    if (elements.chatMessages) {
        const messages = elements.chatMessages.children;
        if (messages.length > 20) {
            while (messages.length > 15) {
                messages[0].remove();
            }
        }
    }
}, 300000); // A cada 5 minutos

// ===== TRATAMENTO DE ERROS GLOBAL =====
window.addEventListener('error', (event) => {
    console.error('Erro global capturado:', event.error);
    
    // Tentar recuperar a transmissão se houver erro crítico
    if (radioState.isLive && radioManager) {
        setTimeout(() => {
            console.log('🔄 Tentando recuperar transmissão após erro...');
            radioManager.playNextTrack();
        }, 5000);
    }
});

// Detectar quando a página perde/ganha foco
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive) {
        console.log('👁️ Página visível novamente - verificando transmissão...');
        
        // Verificar se o áudio ainda está tocando
        setTimeout(() => {
            if (elements.audioPlayer && elements.audioPlayer.paused && radioState.isPlaying) {
                console.log('🔄 Retomando reprodução...');
                elements.audioPlayer.play().catch(console.error);
            }
        }, 1000);
    }
});

// ===== DETECÇÃO DE CONECTIVIDADE =====
function checkConnection() {
    if (navigator.onLine) {
        if (elements.connectionStatus) {
            elements.connectionStatus.className = 'connection-status online';
            elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>ONLINE</span>';
        }
    } else {
        if (elements.connectionStatus) {
            elements.connectionStatus.className = 'connection-status offline';
            elements.connectionStatus.innerHTML = '<span class="status-dot"></span><span>OFFLINE</span>';
        }
        
        // Pausar transmissão se offline
        if (radioState.isLive && radioManager) {
            console.warn('⚠️ Conexão perdida - pausando transmissão');
            radioManager.stopTransmission();
        }
    }
}

window.addEventListener('online', checkConnection);
window.addEventListener('offline', checkConnection);

// ===== FUNCIONALIDADES EXTRAS =====

// Controle por teclado
document.addEventListener('keydown', (e) => {
    // Apenas se não estiver digitando em um input
    if (e.target.tagName.toLowerCase() === 'input') return;
    
    switch (e.code) {
        case 'Space':
            e.preventDefault();
            toggleTransmission();
            break;
        case 'ArrowRight':
            e.preventDefault();
            skipTrack();
            break;
        case 'ArrowUp':
            e.preventDefault();
            if (elements.volumeSlider) {
                const newVolume = Math.min(100, parseInt(elements.volumeSlider.value) + 5);
                elements.volumeSlider.value = newVolume;
                updateVolume();
            }
            break;
        case 'ArrowDown':
            e.preventDefault();
            if (elements.volumeSlider) {
                const newVolume = Math.max(0, parseInt(elements.volumeSlider.value) - 5);
                elements.volumeSlider.value = newVolume;
                updateVolume();
            }
            break;
        case 'KeyM':
            e.preventDefault();
            toggleMute();
            break;
    }
});

// Media Session API (controles de mídia do navegador/sistema)
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
        if (!radioState.isLive && radioManager) {
            radioManager.startTransmission();
        }
    });
    
    navigator.mediaSession.setActionHandler('pause', () => {
        if (radioState.isLive && radioManager) {
            radioManager.stopTransmission();
        }
    });
    
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        skipTrack();
    });
    
    // Atualizar metadados quando uma música tocar
    function updateMediaMetadata(track) {
        if ('mediaSession' in navigator && track) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.name || 'Música sem título',
                artist: 'Rádio Supermercado do Louro',
                album: radioState.activeAlbum ? 
                    `Álbum ${radioState.activeAlbum.charAt(0).toUpperCase() + radioState.activeAlbum.slice(1)}` : 
                    'Playlist Geral',
                artwork: [
                    {
                        src: track.coverUrl || radioState.albumCovers.general || 
                             'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            });
        }
    }
    
    // Atualizar metadados quando trocar música
    const originalPlayNext = radioManager?.playNextTrack;
    if (originalPlayNext) {
        radioManager.playNextTrack = function() {
            originalPlayNext.call(this);
            if (radioState.currentTrack) {
                updateMediaMetadata(radioState.currentTrack);
            }
        };
    }
}

// PWA - Service Worker (básico)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Registrar service worker se disponível
        // navigator.serviceWorker.register('/sw.js').catch(console.error);
    });
}

// ===== API PARA INTERAÇÕES EXTERNAS =====
window.RadioAPI = {
    // Status da rádio
    getStatus: () => ({
        isLive: radioState.isLive,
        isPlaying: radioState.isPlaying,
        currentTrack: radioState.currentTrack,
        uptime: radioState.uptime,
        listeners: radioState.listenerCount,
        totalTracks: radioState.totalPlayCount
    }),
    
    // Controles
    play: () => radioManager?.startTransmission(),
    pause: () => radioManager?.stopTransmission(),
    skip: () => skipTrack(),
    setVolume: (volume) => {
        if (elements.volumeSlider) {
            elements.volumeSlider.value = Math.max(0, Math.min(100, volume));
            updateVolume();
        }
    },
    
    // Playlist
    setActiveAlbum: (albumKey) => {
        radioState.activeAlbum = albumKey;
        saveRadioState();
        updateAlbumDisplay();
        if (radioManager) {
            radioManager.generateUpcomingTracks();
        }
    },
    
    // Estatísticas
    getStats: () => ({
        playHistory: radioState.playHistory,
        playlists: {
            music: radioState.playlists.music.length,
            jingles: radioState.playlists.jingles.length,
            ads: radioState.playlists.ads.length,
            albums: Object.fromEntries(
                Object.entries(radioState.playlists.albums)
                    .map(([key, value]) => [key, value.length])
            )
        }
    })
};

// ===== INICIALIZAÇÃO DE RECURSOS EXTRAS =====
function initializeExtraFeatures() {
    // Configurar tema escuro automático baseado no horário
    const hour = new Date().getHours();
    if (hour >= 18 || hour <= 6) {
        document.body.classList.add('night-mode');
    }
    
    // Detectar dispositivo móvel para otimizações
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.body.classList.add('mobile-device');
        
        // Reduzir qualidade do spectrum em dispositivos móveis
        if (analyser) {
            analyser.fftSize = 128; // Menor que 256 para melhor performance
        }
    }
    
    // Configurar notificações se suportado
    if ('Notification' in window && Notification.permission === 'default') {
        // Não pedir permissão automaticamente, apenas preparar
        console.log('📱 Notificações disponíveis');
    }
}

// ===== EASTER EGGS E RECURSOS ESPECIAIS =====
let konamiCode = [];
const konamiSequence = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'KeyB', 'KeyA'
];

document.addEventListener('keydown', (e) => {
    konamiCode.push(e.code);
    konamiCode = konamiCode.slice(-10); // Manter apenas os últimos 10
    
    if (konamiCode.join(',') === konamiSequence.join(',')) {
        activateEasterEgg();
        konamiCode = []; // Reset
    }
});

function activateEasterEgg() {
    // Easter egg: modo disco
    document.body.style.animation = 'rainbow 2s linear infinite';
    
    // Adicionar CSS da animação se não existir
    if (!document.getElementById('easter-egg-styles')) {
        const style = document.createElement('style');
        style.id = 'easter-egg-styles';
        style.textContent = `
            @keyframes rainbow {
                0% { filter: hue-rotate(0deg); }
                100% { filter: hue-rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Mostrar mensagem
    const message = document.createElement('div');
    message.innerHTML = '🎉 MODO DISCO ATIVADO! 🕺';
    message.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
        color: white;
        padding: 20px;
        border-radius: 20px;
        font-size: 2rem;
        font-weight: bold;
        z-index: 10000;
        animation: pulse 1s ease-in-out infinite;
        text-align: center;
        box-shadow: 0 0 50px rgba(255, 255, 255, 0.5);
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        document.body.style.animation = '';
        message.remove();
        const styles = document.getElementById('easter-egg-styles');
        if (styles) styles.remove();
    }, 10000);
}

// ===== CONSOLE EASTER EGG =====
console.log(`
🎵 ====================================== 🎵
📻 RÁDIO SUPERMERCADO DO LOURO - AO VIVO 📻
🎵 ====================================== 🎵

Bem-vindo ao console da rádio!

Comandos disponíveis:
• RadioAPI.play() - Iniciar transmissão
• RadioAPI.pause() - Pausar transmissão
• RadioAPI.skip() - Pular música
• RadioAPI.getStatus() - Ver status atual
• RadioAPI.getStats() - Ver estatísticas

Desenvolvido com ❤️ para o Supermercado do Louro
`);

// ===== FINALIZAÇÃO =====
console.log('🎵 Sistema de rádio AO VIVO carregado com sucesso!');
console.log('📻 Aguardando inicialização completa...');

// Exportar funções globais necessárias
window.radioFunctions = {
    uploadFiles,
    deleteFile,
    deleteAlbumFile,
    setActiveAlbum,
    openCoverModal,
    uploadCover,
    removeCover,
    refreshReports,
    resetPlayCount,
    exportReports,
    saveSettings,
    checkPassword,
    showPlayerMode,
    showAdminMode,
    closeModal,
    toggleTransmission,
    skipTrack
};