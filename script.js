const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado global da rádio - SINCRONIZADO
let radioState = {
    // Configuração de sincronização
    startTime: null, // Timestamp de quando a rádio começou
    currentTrackIndex: 0,
    lastSync: null,
    
    // Estado local
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    volume: 70,
    
    // Playlists sincronizadas
    masterPlaylist: [], // Playlist principal sincronizada
    playlists: {
        music: [],
        announcements: [],
        time: [],
        jingles: []
    },
    
    // Dados locais
    stats: {
        tracksPlayed: 0,
        requestsReceived: 0
    },
    recentTracks: [],
    requests: [],
    schedule: [],
    
    // Configuração de programação
    programConfig: {
        trackDuration: 180000, // 3 minutos por música (padrão)
        announcementInterval: 5, // A cada 5 músicas
        timeInterval: 12 // A cada 12 músicas (hora certa)
    }
};

// Sistema de sincronização
class RadioSynchronizer {
    constructor() {
        this.syncInterval = null;
        this.masterStartTime = new Date('2025-09-27T00:00:00-03:00').getTime(); // 27/09/2025 00:00 horário de Brasília
    }

    // Gerar playlist sincronizada baseada no tempo
    generateMasterPlaylist() {
        console.log('🔄 Gerando playlist sincronizada...');
        
        const playlist = [];
        const totalTracks = radioState.playlists.music.length;
        const totalAnnouncements = radioState.playlists.announcements.length;
        const totalTimeAnnouncements = radioState.playlists.time.length;
        
        if (totalTracks === 0) {
            // Adicionar tracks de exemplo se não houver conteúdo
            this.addSampleTracks();
            return this.generateMasterPlaylist();
        }
        
        // Criar sequência de 100 tracks para loop
        for (let i = 0; i < 100; i++) {
            // A cada 12 tracks, adicionar hora certa
            if (i > 0 && i % 12 === 0 && totalTimeAnnouncements > 0) {
                const timeTrack = radioState.playlists.time[i % totalTimeAnnouncements];
                playlist.push({
                    ...timeTrack,
                    type: 'time',
                    duration: 30000, // 30 segundos
                    index: i
                });
            }
            
            // A cada 5 músicas (exceto quando há hora certa), adicionar aviso
            if (i > 0 && i % 5 === 0 && i % 12 !== 0 && totalAnnouncements > 0) {
                const announcement = radioState.playlists.announcements[i % totalAnnouncements];
                playlist.push({
                    ...announcement,
                    type: 'announcement',
                    duration: 60000, // 1 minuto
                    index: i
                });
            }
            
            // Adicionar música
            const musicTrack = radioState.playlists.music[i % totalTracks];
            playlist.push({
                ...musicTrack,
                type: 'music',
                duration: 180000, // 3 minutos
                index: i
            });
        }
        
        radioState.masterPlaylist = playlist;
        console.log(`✅ Playlist sincronizada gerada: ${playlist.length} tracks`);
        return playlist;
    }

    // Calcular qual música deve estar tocando agora
    getCurrentTrackFromTime() {
        const now = Date.now();
        const elapsedTime = now - this.masterStartTime;
        
        let totalDuration = 0;
        let currentIndex = 0;
        
        // Percorrer playlist até encontrar a música atual
        for (let i = 0; i < radioState.masterPlaylist.length; i++) {
            const track = radioState.masterPlaylist[i];
            const trackDuration = track.duration || 180000;
            
            if (elapsedTime >= totalDuration && elapsedTime < totalDuration + trackDuration) {
                return {
                    track: track,
                    index: i,
                    startTime: totalDuration,
                    elapsed: elapsedTime - totalDuration,
                    remaining: trackDuration - (elapsedTime - totalDuration)
                };
            }
            
            totalDuration += trackDuration;
        }
        
        // Se chegou ao fim, recomeçar do início
        const loopTime = elapsedTime % totalDuration;
        let loopDuration = 0;
        
        for (let i = 0; i < radioState.masterPlaylist.length; i++) {
            const track = radioState.masterPlaylist[i];
            const trackDuration = track.duration || 180000;
            
            if (loopTime >= loopDuration && loopTime < loopDuration + trackDuration) {
                return {
                    track: track,
                    index: i,
                    startTime: loopDuration,
                    elapsed: loopTime - loopDuration,
                    remaining: trackDuration - (loopTime - loopDuration)
                };
            }
            
            loopDuration += trackDuration;
        }
        
        return null;
    }

    // Sincronizar com a programação global
    sync() {
        if (radioState.masterPlaylist.length === 0) {
            this.generateMasterPlaylist();
        }
        
        const currentInfo = this.getCurrentTrackFromTime();
        if (!currentInfo) return;
        
        const { track, elapsed, remaining } = currentInfo;
        
        // Verificar se mudou de música
        if (!radioState.currentTrack || radioState.currentTrack.index !== track.index) {
            console.log(`🎵 Sincronizando: ${track.name} (${track.type})`);
            
            radioState.currentTrack = track;
            radioState.currentTrackIndex = track.index;
            
            // Atualizar interface
            if (radioManager) {
                radioManager.updateTrackInfo(track);
                radioManager.addToRecentTracks(track);
                radioManager.updateStats();
            }
            
            // Tocar música sincronizada
            this.playTrackAtPosition(track, elapsed);
        }
        
        radioState.lastSync = Date.now();
    }

    // Reproduzir música na posição correta
    playTrackAtPosition(track, elapsed) {
        if (!radioManager || !radioManager.audioPlayer) return;
        
        try {
            radioManager.audioPlayer.src = track.url;
            
            radioManager.audioPlayer.addEventListener('loadeddata', () => {
                // Posicionar no tempo correto
                const seekTime = Math.min(elapsed / 1000, radioManager.audioPlayer.duration || 0);
                radioManager.audioPlayer.currentTime = seekTime;
                
                if (radioState.isLive && radioState.isPlaying) {
                    radioManager.audioPlayer.play().catch(console.warn);
                }
            }, { once: true });
            
        } catch (error) {
            console.error('Erro ao sincronizar áudio:', error);
        }
    }

    // Iniciar sincronização automática
    startSync() {
        // Sincronizar imediatamente
        this.sync();
        
        // Sincronizar a cada 5 segundos
        this.syncInterval = setInterval(() => {
            this.sync();
        }, 5000);
        
        console.log('🔄 Sincronização automática iniciada');
    }

    // Parar sincronização
    stopSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Adicionar tracks de exemplo
    addSampleTracks() {
        const sampleTracks = [
            {
                name: 'Música Exemplo 1',
                artist: 'Artista Demo',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            },
            {
                name: 'Música Exemplo 2',
                artist: 'Demo Artist',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            },
            {
                name: 'Música Exemplo 3',
                artist: 'Artista Exemplo',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            },
            {
                name: 'Música Exemplo 4',
                artist: 'Demo Music',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            },
            {
                name: 'Música Exemplo 5',
                artist: 'Exemplo Band',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            }
        ];
        
        const sampleAnnouncements = [
            {
                name: 'Aviso - Promoção do Dia',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            },
            {
                name: 'Propaganda Institucional',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            }
        ];

        const sampleTime = [
            {
                name: 'Hora Certa',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            }
        ];
        
        radioState.playlists.music = sampleTracks;
        radioState.playlists.announcements = sampleAnnouncements;
        radioState.playlists.time = sampleTime;
        
        console.log('✅ Tracks de exemplo adicionados para sincronização');
    }
}

// Instância do sincronizador
let radioSync;

// Elementos DOM
let elements = {};

// Classe principal da rádio - ATUALIZADA PARA SINCRONIZAÇÃO
class RadioManager {
    constructor() {
        this.audioPlayer = null;
        this.playInterval = null;
        this.timeInterval = null;
    }

    init() {
        console.log('Iniciando Rádio Supermercado do Louro - MODO SINCRONIZADO...');
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        try {
            this.initializeElements();
            this.loadStoredData();
            this.setupAudio();
            this.setupEventListeners();
            this.setupDefaultSchedule();
            
            // Inicializar sincronização
            radioSync = new RadioSynchronizer();
            
            this.startRadio();
            this.startTimers();
            
            console.log('Rádio inicializada em modo sincronizado!');
        } catch (error) {
            console.error('Erro na inicialização:', error);
            this.showError('Erro ao inicializar a rádio');
        }
    }

    initializeElements() {
        const elementIds = [
            'audioPlayer', 'playPauseBtn', 'skipBtn', 'requestBtn',
            'volumeSlider', 'volumeValue', 'currentTrack', 'trackArtist',
            'trackTime', 'trackType', 'albumCover', 'currentProgram',
            'programDescription', 'currentTime',
            'liveIndicator', 'equalizer', 'scheduleGrid', 'recentTracks',
            'announcementsList', 'loadingOverlay', 'totalPlayed',
            'requestModal', 'requestForm', 'adminPanel', 'passwordModal'
        ];

        elements = {};
        elementIds.forEach(id => {
            elements[id] = document.getElementById(id);
        });

        console.log('Elementos DOM inicializados');
    }

    setupAudio() {
        this.audioPlayer = elements.audioPlayer;
        if (!this.audioPlayer) {
            console.error('Player de áudio não encontrado');
            return;
        }

        this.audioPlayer.volume = radioState.volume / 100;
        
        // Event listeners para sincronização
        this.audioPlayer.addEventListener('ended', () => {
            // Não pular automaticamente - deixar sincronização cuidar
            console.log('🎵 Música terminou - aguardando sincronização...');
        });
        
        this.audioPlayer.addEventListener('timeupdate', () => this.updateTimeDisplay());
        this.audioPlayer.addEventListener('error', () => this.handleAudioError());
        
        console.log('Áudio configurado para modo sincronizado');
    }

    startRadio() {
        radioState.isLive = true;
        radioState.isPlaying = true;
        
        this.updateLiveStatus();
        
        // Inicializar sincronização
        if (radioSync) {
            radioSync.startSync();
        }
        
        console.log('🔴 Transmissão sincronizada iniciada!');
    }

    // Métodos adaptados para sincronização
    togglePlayback() {
        if (!this.audioPlayer) return;

        try {
            if (radioState.isPlaying) {
                this.audioPlayer.pause();
                radioState.isPlaying = false;
                radioState.isLive = false;
                elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
                
                // Parar sincronização
                if (radioSync) {
                    radioSync.stopSync();
                }
            } else {
                radioState.isPlaying = true;
                radioState.isLive = true;
                elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
                
                // Retomar sincronização
                if (radioSync) {
                    radioSync.startSync();
                } else {
                    this.audioPlayer.play().catch(console.warn);
                }
            }

            this.updateLiveStatus();
        } catch (error) {
            console.error('Erro no toggle playback:', error);
        }
    }

    skipTrack() {
        // Em modo sincronizado, força uma nova sincronização
        if (radioState.isLive && radioSync) {
            console.log('⏭️ Forçando nova sincronização...');
            radioSync.sync();
        }
    }

    // Métodos que permanecem iguais
    setVolume(value) {
        radioState.volume = parseInt(value);
        
        if (this.audioPlayer) {
            this.audioPlayer.volume = radioState.volume / 100;
        }
        
        if (elements.volumeValue) {
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        this.saveData();
    }

    updateLiveStatus() {
        const status = radioState.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
        
        if (elements.liveIndicator) {
            elements.liveIndicator.textContent = status;
            elements.liveIndicator.style.color = radioState.isLive ? '#dc2626' : '#666';
        }

        // Mostrar/ocultar equalizer
        if (elements.equalizer) {
            elements.equalizer.style.display = radioState.isPlaying ? 'flex' : 'none';
        }
    }

    updateTimeDisplay() {
        if (!this.audioPlayer || !elements.trackTime) return;

        const current = this.audioPlayer.currentTime || 0;
        const duration = this.audioPlayer.duration || 0;

        const currentStr = this.formatTime(current);
        const durationStr = this.formatTime(duration);

        elements.trackTime.textContent = `${currentStr} / ${durationStr}`;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateTrackInfo(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name || 'Rádio Sincronizada...';
        }
        
        if (elements.trackArtist) {
            elements.trackArtist.textContent = track.artist || 'Programação Sincronizada';
        }
        
        if (elements.trackType) {
            const typeLabels = {
                music: 'Música',
                announcement: 'Aviso',
                time: 'Hora Certa',
                jingle: 'Vinheta'
            };
            elements.trackType.textContent = typeLabels[track.type] || 'Música';
        }

        if (elements.albumCover && track.coverUrl) {
            elements.albumCover.src = track.coverUrl;
        }
    }

    updateStats() {
        radioState.stats.tracksPlayed++;
        
        if (elements.totalPlayed) {
            elements.totalPlayed.textContent = radioState.stats.tracksPlayed;
        }
        
        this.saveData();
    }

    addToRecentTracks(track) {
        radioState.recentTracks.unshift({
            ...track,
            timestamp: new Date()
        });

        if (radioState.recentTracks.length > 10) {
            radioState.recentTracks = radioState.recentTracks.slice(0, 10);
        }

        this.updateRecentTracksDisplay();
    }

    updateRecentTracksDisplay() {
        if (!elements.recentTracks) return;

        if (radioState.recentTracks.length === 0) {
            elements.recentTracks.innerHTML = '<p>Aguardando programação sincronizada...</p>';
            return;
        }

        const html = radioState.recentTracks.map(track => {
            const time = new Date(track.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="track-item">
                    <div class="track-time">${time}</div>
                    <div class="track-name">${track.name}</div>
                </div>
            `;
        }).join('');

        elements.recentTracks.innerHTML = html;
    }

    setupEventListeners() {
        // Player controls
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener('click', () => this.togglePlayback());
        }
        
        if (elements.skipBtn) {
            elements.skipBtn.addEventListener('click', () => this.skipTrack());
        }
        
        if (elements.requestBtn) {
            elements.requestBtn.addEventListener('click', () => this.showRequestModal());
        }
        
        if (elements.volumeSlider) {
            elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        }

        // Admin access
        const adminBtn = document.getElementById('adminAccessBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => this.showAdminModal());
        }

        // Admin controls
        const closeAdminBtn = document.getElementById('closeAdminBtn');
        if (closeAdminBtn) {
            closeAdminBtn.addEventListener('click', () => this.closeAdminPanel());
        }

        const toggleBroadcast = document.getElementById('adminToggleBroadcast');
        if (toggleBroadcast) {
            toggleBroadcast.addEventListener('click', () => this.adminToggleBroadcast());
        }

        const skipTrack = document.getElementById('adminSkipTrack');
        if (skipTrack) {
            skipTrack.addEventListener('click', () => this.skipTrack());
        }

        const emergencyStop = document.getElementById('adminEmergencyStop');
        if (emergencyStop) {
            emergencyStop.addEventListener('click', () => this.emergencyStop());
        }

        const testTime = document.getElementById('adminTestTime');
        if (testTime) {
            testTime.addEventListener('click', () => this.forceTimeAnnouncement());
        }

        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchAdminTab(btn.dataset.tab));
        });

        // Request form
        if (elements.requestForm) {
            elements.requestForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitRequest();
            });
        }

        // Modal close on outside click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'a') {
                e.preventDefault();
                this.showAdminModal();
            }
        });

        console.log('Event listeners configurados');
    }

    showAdminModal() {
        if (elements.passwordModal) {
            elements.passwordModal.classList.add('show');
        }
    }

    closeAdminPanel() {
        if (elements.adminPanel) {
            elements.adminPanel.classList.add('hidden');
        }
    }

    switchAdminTab(tabName) {
        // Remove active de todos os botões e conteúdos
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Adiciona active aos selecionados
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');

        // Atualizar conteúdo específico
        if (tabName === 'requests') {
            this.updateAdminRequestsList();
        } else if (tabName === 'stats') {
            this.updateAdminStats();
        } else if (tabName === 'content') {
            this.updateContentLists();
        }
    }

    adminToggleBroadcast() {
        this.togglePlayback();
        
        const btn = document.getElementById('adminToggleBroadcast');
        if (btn) {
            btn.textContent = radioState.isLive ? '⏸️ Pausar Transmissão' : '▶️ Iniciar Transmissão';
        }
        
        this.updateAdminStatus();
    }

    emergencyStop() {
        if (confirm('Tem certeza que deseja fazer uma parada de emergência?')) {
            radioState.isPlaying = false;
            radioState.isLive = false;
            
            if (this.audioPlayer) {
                this.audioPlayer.pause();
            }
            
            this.updateLiveStatus();
            this.updateAdminStatus();
            alert('Transmissão interrompida em emergência!');
        }
    }

    // Função para testar hora certa manualmente
    forceTimeAnnouncement() {
        if (radioState.playlists.time.length > 0) {
            console.log('🕐 Forçando hora certa manualmente');
            radioState.tracksSinceTime = 0;
            const timeTrack = this.getRandomFromPlaylist(radioState.playlists.time, 'time');
            if (timeTrack) {
                radioState.currentTrack = timeTrack;
                this.updateTrackInfo(timeTrack);
                
                try {
                    this.audioPlayer.src = timeTrack.url;
                    if (radioState.isLive && radioState.isPlaying) {
                        this.audioPlayer.play().catch(console.warn);
                    }
                } catch (error) {
                    console.error('Erro ao tocar hora certa:', error);
                }
                
                this.updateStats();
                this.addToRecentTracks(timeTrack);
            }
        } else {
            alert('Nenhum arquivo de hora certa disponível!');
        }
    }

    updateAdminStatus() {
        const statusElement = document.getElementById('adminLiveStatus');
        if (statusElement) {
            statusElement.textContent = radioState.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
            statusElement.style.color = radioState.isLive ? '#dc2626' : '#666';
        }
    }

    updateAdminRequestsList() {
        const container = document.getElementById('adminRequestsList');
        if (!container) return;

        if (radioState.requests.length === 0) {
            container.innerHTML = '<p style="color: #a0a0a0; text-align: center; padding: 2rem;">Nenhum pedido recebido ainda.</p>';
            return;
        }

        const html = radioState.requests.map((request, index) => `
            <div class="request-item" style="background: rgba(255,255,255,0.05); padding: 1rem; margin-bottom: 1rem; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: #a0a0a0; font-size: 0.8rem;">${new Date(request.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div style="color: #4caf50; margin-bottom: 0.5rem; font-size: 1.1rem;">${request.songRequest}</div>
                <div style="margin-top: 1rem;">
                    <button onclick="removeRequest(${index})" class="btn danger" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">🗑️ Remover</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    updateAdminStats() {
        // Atualizar estatísticas no painel admin
        const elements = {
            tracksToday: document.getElementById('adminStatsTracksToday'),
            requestsToday: document.getElementById('adminStatsRequestsToday'),
            totalTracks: document.getElementById('adminStatsTotalTracks')
        };

        if (elements.tracksToday) {
            elements.tracksToday.textContent = radioState.stats.tracksPlayed;
        }

        if (elements.requestsToday) {
            elements.requestsToday.textContent = radioState.stats.requestsReceived;
        }

        if (elements.totalTracks) {
            const totalFiles = Object.values(radioState.playlists)
                .reduce((sum, playlist) => sum + playlist.length, 0);
            elements.totalTracks.textContent = totalFiles;
        }
    }

    updateContentLists() {
        // Atualizar listas de arquivos
        const categories = ['music', 'announcements', 'time'];
        
        categories.forEach(category => {
            const container = document.getElementById(`${category}List`);
            if (!container) return;

            const files = radioState.playlists[category] || [];
            
            if (files.length === 0) {
                container.innerHTML = '<p style="color: #a0a0a0; font-size: 0.8rem; margin-top: 0.5rem;">Nenhum arquivo enviado ainda.</p>';
                return;
            }

            const html = files.map((file, index) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="color: #a0a0a0; font-size: 0.8rem; flex: 1;">${file.name}</span>
                    <button onclick="removeFile('${category}', ${index})" style="background: #dc2626; border: none; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">×</button>
                </div>
            `).join('');

            container.innerHTML = html;
        });
    }

    setupDefaultSchedule() {
        radioState.schedule = [
            { time: '06:00', name: 'Bom Dia Louro', description: 'Começando o dia com energia!', duration: 4 },
            { time: '10:00', name: 'Manhã Musical', description: 'Os melhores sucessos para sua manhã', duration: 4 },
            { time: '14:00', name: 'Tarde Animada', description: 'Música boa para animar sua tarde', duration: 4 },
            { time: '18:00', name: 'Fim de Tarde', description: 'Sucessos para o final do dia', duration: 4 },
            { time: '22:00', name: 'Noite Romântica', description: 'As mais belas canções para sua noite', duration: 8 }
        ];
        
        this.updateScheduleDisplay();
        this.updateCurrentProgram();
    }

    startRadio() {
        radioState.isLive = true;
        this.updateLiveStatus();
        
        // Adicionar dados de exemplo se não houver conteúdo
        if (radioState.playlists.music.length === 0) {
            this.addSampleTracks();
        }
        
        // Iniciar reprodução
        setTimeout(() => {
            this.playNext();
        }, 1000);
    }

    addSampleTracks() {
        const sampleTracks = [
            {
                name: 'Música Exemplo 1',
                artist: 'Artista Demo',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            },
            {
                name: 'Música Exemplo 2',
                artist: 'Demo Artist',
                url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ'
            }
        ];
        
        radioState.playlists.music = sampleTracks;
        console.log('Músicas de exemplo adicionadas');
    }

    playNext() {
        if (!this.audioPlayer) return;

        const track = this.getNextTrack();
        if (!track) {
            setTimeout(() => this.playNext(), 5000);
            return;
        }

        radioState.currentTrack = track;
        this.updateTrackInfo(track);
        
        try {
            this.audioPlayer.src = track.url;
            if (radioState.isPlive && radioState.isPlaying) {
                this.audioPlayer.play().catch(console.warn);
            }
        } catch (error) {
            console.error('Erro ao carregar áudio:', error);
            setTimeout(() => this.playNext(), 3000);
        }

        this.updateStats();
        this.addToRecentTracks(track);
    }

    getNextTrack() {
        // Verificar se deve tocar hora certa (apenas nos minutos exatos da hora)
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // Tocar hora certa apenas no minuto 0 da hora (ex: 15:00, 16:00, etc)
        // e apenas se já passaram algumas músicas desde a última hora certa
        if (minutes === 0 && seconds < 30 && radioState.tracksSinceTime >= 3 && radioState.playlists.time.length > 0) {
            console.log('🕐 Tocando hora certa');
            radioState.tracksSinceTime = 0;
            return this.getRandomFromPlaylist(radioState.playlists.time, 'time');
        }

        // Verificar se deve tocar aviso (a cada 5-7 músicas)
        const announcementInterval = 5 + Math.floor(Math.random() * 3); // Entre 5 e 7
        if (radioState.tracksSinceAnnouncement >= announcementInterval && radioState.playlists.announcements.length > 0) {
            console.log('📢 Tocando aviso/propaganda');
            radioState.tracksSinceAnnouncement = 0;
            radioState.tracksSinceTime++;
            return this.getRandomFromPlaylist(radioState.playlists.announcements, 'announcement');
        }

        // Tocar música normal
        radioState.tracksSinceAnnouncement++;
        radioState.tracksSinceTime++;
        return this.getRandomFromPlaylist(radioState.playlists.music, 'music');
    }

    getRandomFromPlaylist(playlist, type) {
        if (!playlist || playlist.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * playlist.length);
        const track = playlist[randomIndex];
        
        return {
            ...track,
            type: type,
            playTime: new Date().toISOString()
        };
    }

    updateTrackInfo(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name || 'Conectando à transmissão...';
        }
        
        if (elements.trackArtist) {
            elements.trackArtist.textContent = track.artist || 'Rádio Supermercado do Louro';
        }
        
        if (elements.trackType) {
            const typeLabels = {
                music: 'Música',
                announcement: 'Aviso',
                time: 'Hora Certa',
                jingle: 'Vinheta'
            };
            elements.trackType.textContent = typeLabels[track.type] || 'Música';
        }

        if (elements.albumCover && track.coverUrl) {
            elements.albumCover.src = track.coverUrl;
        }
    }

    togglePlayback() {
        if (!this.audioPlayer) return;

        if (radioState.isPlaying) {
            this.audioPlayer.pause();
            radioState.isPlaying = false;
            radioState.isLive = false;
            elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
        } else {
            this.audioPlayer.play().catch(console.warn);
            radioState.isPlaying = true;
            radioState.isLive = true;
            elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
        }

        this.updateLiveStatus();
    }

    skipTrack() {
        if (radioState.isLive) {
            this.playNext();
        }
    }

    setVolume(value) {
        radioState.volume = parseInt(value);
        
        if (this.audioPlayer) {
            this.audioPlayer.volume = radioState.volume / 100;
        }
        
        if (elements.volumeValue) {
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        this.saveData();
    }

    updateLiveStatus() {
        const status = radioState.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
        
        if (elements.liveIndicator) {
            elements.liveIndicator.textContent = status;
            elements.liveIndicator.style.color = radioState.isLive ? '#dc2626' : '#666';
        }

        // Mostrar/ocultar equalizer
        if (elements.equalizer) {
            elements.equalizer.style.display = radioState.isPlaying ? 'flex' : 'none';
        }
    }

    updateTimeDisplay() {
        if (!this.audioPlayer || !elements.trackTime) return;

        const current = this.audioPlayer.currentTime || 0;
        const duration = this.audioPlayer.duration || 0;

        const currentStr = this.formatTime(current);
        const durationStr = this.formatTime(duration);

        elements.trackTime.textContent = `${currentStr} / ${durationStr}`;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateStats() {
        radioState.stats.tracksPlayed++;
        
        if (elements.totalPlayed) {
            elements.totalPlayed.textContent = radioState.stats.tracksPlayed;
        }
        
        this.saveData();
    }

    addToRecentTracks(track) {
        radioState.recentTracks.unshift({
            ...track,
            timestamp: new Date()
        });

        if (radioState.recentTracks.length > 10) {
            radioState.recentTracks = radioState.recentTracks.slice(0, 10);
        }

        this.updateRecentTracksDisplay();
    }

    updateRecentTracksDisplay() {
        if (!elements.recentTracks) return;

        if (radioState.recentTracks.length === 0) {
            elements.recentTracks.innerHTML = '<p>Nenhuma faixa tocada ainda.</p>';
            return;
        }

        const html = radioState.recentTracks.map(track => {
            const time = new Date(track.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="track-item">
                    <div class="track-time">${time}</div>
                    <div class="track-name">${track.name}</div>
                </div>
            `;
        }).join('');

        elements.recentTracks.innerHTML = html;
    }

    updateScheduleDisplay() {
        if (!elements.scheduleGrid) return;

        const now = new Date();
        const currentHour = now.getHours();

        const html = radioState.schedule.map(program => {
            const [hour] = program.time.split(':').map(Number);
            const isActive = currentHour >= hour && currentHour < (hour + program.duration);

            return `
                <div class="schedule-item ${isActive ? 'current' : ''}">
                    <div class="schedule-time">${program.time}</div>
                    <div class="schedule-program">
                        <h4>${program.name}</h4>
                        <p>${program.description}</p>
                    </div>
                </div>
            `;
        }).join('');

        elements.scheduleGrid.innerHTML = html;
    }

    updateCurrentProgram() {
        const now = new Date();
        const currentHour = now.getHours();

        const currentProgram = radioState.schedule.find(program => {
            const [hour] = program.time.split(':').map(Number);
            return currentHour >= hour && currentHour < (hour + program.duration);
        });

        if (currentProgram) {
            if (elements.currentProgram) {
                elements.currentProgram.textContent = currentProgram.name;
            }
            if (elements.programDescription) {
                elements.programDescription.textContent = currentProgram.description;
            }
        }
    }

    startTimers() {
        // Atualizar hora atual
        this.timeInterval = setInterval(() => {
            this.updateCurrentTime();
            this.updateCurrentProgram();
            this.updateScheduleDisplay();
        }, 60000);

        this.updateCurrentTime();
    }

    updateCurrentTime() {
        if (elements.currentTime) {
            const now = new Date();
            elements.currentTime.textContent = now.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    showRequestModal() {
        if (elements.requestModal) {
            elements.requestModal.classList.add('show');
        }
    }

    submitRequest() {
        const songRequest = document.getElementById('songRequest')?.value;

        if (!songRequest) {
            alert('Por favor, informe a música/artista desejado.');
            return;
        }

        const request = {
            songRequest,
            timestamp: new Date().toISOString()
        };

        radioState.requests.unshift(request);
        radioState.stats.requestsReceived++;

        if (radioState.requests.length > 50) {
            radioState.requests = radioState.requests.slice(0, 50);
        }

        this.saveData();
        this.closeModal('requestModal');
        
        // Reset form
        elements.requestForm?.reset();
        
        alert('Pedido enviado com sucesso! Obrigado pela participação!');
    }

    showAdminModal() {
        if (elements.passwordModal) {
            elements.passwordModal.classList.add('show');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    handleAudioError() {
        console.error('Erro no áudio');
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 3000);
    }

    showError(message) {
        console.error(message);
        if (elements.currentTrack) {
            elements.currentTrack.textContent = message;
        }
    }

    loadStoredData() {
        try {
            const saved = localStorage.getItem('radioLouroData');
            if (saved) {
                const data = JSON.parse(saved);
                Object.assign(radioState, data);
                console.log('Dados carregados do localStorage');
            }
        } catch (error) {
            console.warn('Erro ao carregar dados:', error);
        }
    }

    saveData() {
        try {
            localStorage.setItem('radioLouroData', JSON.stringify(radioState));
        } catch (error) {
            console.warn('Erro ao salvar dados:', error);
        }
    }

    destroy() {
        if (this.playInterval) clearInterval(this.playInterval);
        if (this.timeInterval) clearInterval(this.timeInterval);
    }
}

// Instância global
let radioManager;

// Funções globais para HTML
window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
};

window.checkAdminPassword = function() {
    const password = document.getElementById('adminPassword')?.value;
    if (password === 'admin123') {
        closeModal('passwordModal');
        showAdminPanel();
        // Limpar senha
        document.getElementById('adminPassword').value = '';
    } else {
        alert('Senha incorreta!');
        document.getElementById('adminPassword').value = '';
    }
};

window.showAdminPanel = function() {
    const panel = elements.adminPanel || document.getElementById('adminPanel');
    if (panel) {
        panel.classList.remove('hidden');
        // Atualizar dados do painel
        if (radioManager) {
            radioManager.updateAdminStatus();
            radioManager.updateAdminStats();
            radioManager.updateContentLists();
            radioManager.updateAdminRequestsList();
        }
    }
};

window.closeAdminPanel = function() {
    const panel = elements.adminPanel || document.getElementById('adminPanel');
    if (panel) {
        panel.classList.add('hidden');
    }
};

window.handleUpload = async function(category) {
    const fileInputs = {
        music: 'musicUpload',
        announcements: 'announcementUpload', 
        time: 'timeUpload'
    };

    const inputId = fileInputs[category];
    const input = document.getElementById(inputId);
    
    if (!input || input.files.length === 0) {
        alert('Selecione pelo menos um arquivo!');
        return;
    }

    try {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('show');
        }

        // Simular upload (já que é só demonstração)
        const files = Array.from(input.files);
        
        for (const file of files) {
            const fakeUrl = URL.createObjectURL(file);
            const trackData = {
                name: file.name.replace(/\.[^/.]+$/, ""), // Remove extensão
                artist: 'Upload Local',
                url: fakeUrl,
                uploadedAt: new Date().toISOString(),
                size: file.size
            };

            radioState.playlists[category].push(trackData);
        }

        radioManager.saveData();
        radioManager.updateContentLists();
        
        // Limpar input
        input.value = '';
        
        alert(`${files.length} arquivo(s) adicionado(s) com sucesso à categoria ${category}!`);

        if (loadingOverlay) {
            loadingOverlay.classList.remove('show');
        }

    } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro no upload. Tente novamente.');
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('show');
        }
    }
};

window.removeFile = function(category, index) {
    if (confirm('Tem certeza que deseja remover este arquivo?')) {
        radioState.playlists[category].splice(index, 1);
        radioManager.saveData();
        radioManager.updateContentLists();
        radioManager.updateAdminStats();
        alert('Arquivo removido com sucesso!');
    }
};

window.removeRequest = function(index) {
    if (confirm('Tem certeza que deseja remover este pedido?')) {
        radioState.requests.splice(index, 1);
        radioManager.saveData();
        radioManager.updateAdminRequestsList();
        radioManager.updateAdminStats();
        alert('Pedido removido com sucesso!');
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, iniciando rádio...');
    
    radioManager = new RadioManager();
    radioManager.init();
    
    // Configurar eventos globais
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });
});

// Cleanup ao sair
window.addEventListener('beforeunload', function() {
    if (radioManager) {
        radioManager.saveData();
        radioManager.destroy();
    }
});

console.log('Script da Rádio carregado!');
