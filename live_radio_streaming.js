// 📡 SISTEMA DE STREAMING AO VIVO
// ==================================

class LiveStreamManager {
    constructor() {
        this.audio = null;
        this.isPlaying = false;
        this.volume = 0.8;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = RADIO_CONFIG.connection.maxReconnectAttempts;
        this.reconnectInterval = null;
        this.heartbeatInterval = null;
        this.statsInterval = null;
        
        // Estado do stream
        this.streamState = {
            isLive: false,
            listeners: 0,
            currentTrack: null,
            bitrate: RADIO_CONFIG.stream.bitrate,
            uptime: 0,
            lastUpdate: Date.now()
        };
        
        // Cache de metadados
        this.metadataCache = new Map();
        this.recentTracks = [];
        
        this.init();
    }
    
    async init() {
        console.log('🎵 Inicializando sistema de streaming...');
        
        try {
            await this.setupAudio();
            await this.setupEventListeners();
            await this.checkStreamStatus();
            this.startHeartbeat();
            this.startStatsUpdate();
            
            console.log('✅ Sistema de streaming inicializado');
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar streaming:', error);
            this.showError('Erro ao conectar com o servidor');
        }
    }
    
    async setupAudio() {
        this.audio = document.getElementById('radioStream');
        if (!this.audio) {
            throw new Error('Elemento de áudio não encontrado');
        }
        
        // Configurar áudio para streaming
        this.audio.preload = 'none';
        this.audio.volume = this.volume;
        this.audio.crossOrigin = 'anonymous';
        
        // URLs de stream (principal e backup)
        this.streamUrls = [
            RADIO_CONFIG.stream.url,
            RADIO_CONFIG.stream.fallbackUrl
        ].filter(Boolean);
        
        if (this.streamUrls.length === 0) {
            throw new Error('Nenhuma URL de stream configurada');
        }
        
        console.log('🔊 URLs de stream configuradas:', this.streamUrls);
    }
    
    setupEventListeners() {
        // Eventos de áudio
        this.audio.addEventListener('loadstart', () => this.onLoadStart());
        this.audio.addEventListener('loadeddata', () => this.onLoadedData());
        this.audio.addEventListener('canplay', () => this.onCanPlay());
        this.audio.addEventListener('play', () => this.onPlay());
        this.audio.addEventListener('pause', () => this.onPause());
        this.audio.addEventListener('ended', () => this.onEnded());
        this.audio.addEventListener('error', (e) => this.onError(e));
        this.audio.addEventListener('stalled', () => this.onStalled());
        this.audio.addEventListener('waiting', () => this.onWaiting());
        this.audio.addEventListener('playing', () => this.onPlaying());
        
        // Controles da UI
        this.setupUIControls();
        
        // Eventos de rede
        window.addEventListener('online', () => this.onNetworkOnline());
        window.addEventListener('offline', () => this.onNetworkOffline());
        
        // Eventos de página
        document.addEventListener('visibilitychange', () => this.onVisibilityChange());
        window.addEventListener('beforeunload', () => this.onBeforeUnload());
    }
    
    setupUIControls() {
        const playBtn = document.getElementById('playBtn');
        const volumeSlider = document.getElementById('volumeSlider');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlay());
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }
    }
    
    // === CONTROLES DE REPRODUÇÃO ===
    
    async togglePlay() {
        if (this.isPlaying) {
            await this.stop();
        } else {
            await this.play();
        }
    }
    
    async play() {
        try {
            console.log('🎵 Iniciando reprodução...');
            this.showLoading(true);
            
            // Configurar URL do stream
            await this.setStreamUrl();
            
            // Tentar reproduzir
            await this.audio.play();
            
            this.isPlaying = true;
            this.reconnectAttempts = 0;
            
            console.log('✅ Reprodução iniciada');
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir:', error);
            
            if (error.name === 'NotAllowedError') {
                this.showError('Clique para ativar o áudio');
                this.showAutoplayPrompt();
            } else {
                await this.handlePlayError();
            }
        } finally {
            this.showLoading(false);
        }
    }
    
    async stop() {
        console.log('⏹️ Parando reprodução...');
        
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        
        this.updatePlayButton();
        this.updateStatus('Parado');
    }
    
    async setStreamUrl() {
        const url = this.getCurrentStreamUrl();
        
        if (this.audio.src !== url) {
            this.audio.src = url;
            this.audio.load();
            console.log('🔗 Stream URL configurada:', url);
        }
    }
    
    getCurrentStreamUrl() {
        // Usar URL principal, ou backup se houver falhas recentes
        const urlIndex = this.reconnectAttempts > 2 && this.streamUrls.length > 1 ? 1 : 0;
        return this.streamUrls[urlIndex] || this.streamUrls[0];
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audio.volume = this.volume;
        
        // Atualizar UI
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        
        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
        }
        
        if (volumeValue) {
            volumeValue.textContent = Math.round(this.volume * 100) + '%';
        }
        
        // Salvar volume
        this.saveVolume();
    }
    
    // === EVENTOS DE ÁUDIO ===
    
    onLoadStart() {
        console.log('📡 Carregando stream...');
        this.updateStatus('Conectando...');
    }
    
    onLoadedData() {
        console.log('📊 Dados carregados');
        this.updateStatus('Carregado');
    }
    
    onCanPlay() {
        console.log('▶️ Pronto para reproduzir');
        this.streamState.isLive = true;
        this.updateStatus('Pronto');
    }
    
    onPlay() {
        console.log('🎵 Reproduzindo');
        this.isPlaying = true;
        this.updatePlayButton();
        this.updateStatus('AO VIVO');
        this.startEqualizer();
    }
    
    onPause() {
        console.log('⏸️ Pausado');
        this.isPlaying = false;
        this.updatePlayButton();
        this.updateStatus('Pausado');
        this.stopEqualizer();
    }
    
    onEnded() {
        console.log('🔚 Stream encerrado');
        this.onConnectionLost();
    }
    
    onError(event) {
        const error = this.audio.error;
        console.error('❌ Erro no áudio:', error);
        
        let errorMessage = 'Erro desconhecido';
        
        if (error) {
            switch (error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                    errorMessage = 'Reprodução cancelada';
                    break;
                case MediaError.MEDIA_ERR_NETWORK:
                    errorMessage = 'Erro de rede';
                    break;
                case MediaError.MEDIA_ERR_DECODE:
                    errorMessage = 'Erro de decodificação';
                    break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                    errorMessage = 'Stream não suportado';
                    break;
            }
        }
        
        this.handleStreamError(errorMessage);
    }
    
    onStalled() {
        console.warn('⚠️ Stream travado, tentando reconectar...');
        this.updateStatus('Reconectando...');
        this.attemptReconnect();
    }
    
    onWaiting() {
        console.log('⏳ Buffering...');
        this.updateStatus('Carregando...');
    }
    
    onPlaying() {
        console.log('🎶 Tocando normalmente');
        this.updateStatus('AO VIVO');
        this.reconnectAttempts = 0;
    }
    
    // === RECONEXÃO AUTOMÁTICA ===
    
    async handleStreamError(errorMessage) {
        console.error('🚨 Erro no stream:', errorMessage);
        
        this.streamState.isLive = false;
        this.isPlaying = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            await this.attemptReconnect();
        } else {
            this.showError('Stream offline - Verifique sua conexão');
            this.updateStatus('Offline');
        }
    }
    
    async attemptReconnect() {
        if (this.reconnectInterval) return;
        
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        
        console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay}ms`);
        
        this.reconnectInterval = setTimeout(async () => {
            try {
                await this.setStreamUrl();
                await this.audio.play();
                
                this.reconnectInterval = null;
                console.log('✅ Reconexão bem-sucedida');
                
            } catch (error) {
                this.reconnectInterval = null;
                console.error('❌ Falha na reconexão:', error);
                
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.attemptReconnect();
                } else {
                    this.onMaxReconnectAttemptsReached();
                }
            }
        }, delay);
    }
    
    onMaxReconnectAttemptsReached() {
        console.error('💀 Máximo de tentativas de reconexão atingido');
        this.showError('Não foi possível conectar ao stream');
        this.updateStatus('Offline');
        this.streamState.isLive = false;
    }
    
    // === EVENTOS DE REDE ===
    
    onNetworkOnline() {
        console.log('🌐 Rede online');
        if (!this.streamState.isLive && this.reconnectAttempts > 0) {
            this.reconnectAttempts = 0;
            this.attemptReconnect();
        }
    }
    
    onNetworkOffline() {
        console.log('📴 Rede offline');
        this.showError('Sem conexão com a internet');
        this.updateStatus('Sem conexão');
    }
    
    onConnectionLost() {
        console.warn('📡 Conexão perdida com o stream');
        this.streamState.isLive = false;
        this.attemptReconnect();
    }
    
    onVisibilityChange() {
        if (document.hidden) {
            console.log('👁️ Página oculta');
        } else {
            console.log('👁️ Página visível - verificando stream');
            if (this.isPlaying && this.audio.paused) {
                this.attemptReconnect();
            }
        }
    }
    
    onBeforeUnload() {
        this.cleanup();
    }
    
    // === METADADOS E ESTATÍSTICAS ===
    
    async checkStreamStatus() {
        try {
            const statsUrl = STREAMING_URLS.icecast?.stats;
            if (!statsUrl) return;
            
            const response = await fetch(statsUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.updateStreamStats(data);
            }
            
        } catch (error) {
            console.warn('⚠️ Não foi possível obter estatísticas do stream:', error);
        }
    }
    
    updateStreamStats(data) {
        if (data.icestats && data.icestats.source) {
            const source = Array.isArray(data.icestats.source) 
                ? data.icestats.source[0] 
                : data.icestats.source;
            
            this.streamState.listeners = source.listeners || 0;
            this.streamState.bitrate = source.bitrate || this.streamState.bitrate;
            this.streamState.currentTrack = source.title || this.streamState.currentTrack;
            
            if (source.title && source.title !== this.streamState.currentTrack) {
                this.onNewTrack(source.title, source.artist);
            }
        }
        
        this.updateStatsUI();
    }
    
    onNewTrack(title, artist = '') {
        const track = {
            title: title,
            artist: artist,
            timestamp: Date.now(),
            listeners: this.streamState.listeners
        };
        
        console.log('🎵 Nova música:', track);
        
        // Adicionar ao histórico
        this.recentTracks.unshift(track);
        if (this.recentTracks.length > RADIO_CONFIG.ui.maxRecentTracks) {
            this.recentTracks.pop();
        }
        
        // Atualizar UI
        this.updateCurrentTrack(track);
        this.updateRecentTracks();
        
        // Mostrar notificação (se suportado)
        this.showTrackNotification(track);
    }
    
    // === INTERFACE DO USUÁRIO ===
    
    updateUI() {
        this.updatePlayButton();
        this.updateStatus(this.isPlaying ? 'AO VIVO' : 'Parado');
        this.updateStatsUI();
    }
    
    updatePlayButton() {
        const playBtn = document.getElementById('playBtn');
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        
        if (playBtn && playIcon && pauseIcon) {
            if (this.isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'inline';
                playBtn.classList.add('playing');
            } else {
                playIcon.style.display = 'inline';
                pauseIcon.style.display = 'none';
                playBtn.classList.remove('playing');
            }
        }
    }
    
    updateStatus(status) {
        const statusElement = document.getElementById('playStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
        
        const liveStatus = document.getElementById('liveStatus');
        if (liveStatus) {
            if (this.streamState.isLive) {
                liveStatus.textContent = '🔴';
                liveStatus.classList.add('live');
            } else {
                liveStatus.textContent = '⚫';
                liveStatus.classList.remove('live');
            }
        }
    }
    
    updateStatsUI() {
        const listenerCount = document.getElementById('listenerCount');
        const listenerCountAdmin = document.getElementById('listenerCountAdmin');
        
        if (listenerCount) {
            listenerCount.textContent = `Ouvintes: ${this.streamState.listeners}`;
        }
        
        if (listenerCountAdmin) {
            listenerCountAdmin.textContent = this.streamState.listeners;
        }
    }
    
    updateCurrentTrack(track) {
        const trackTitle = document.getElementById('trackTitle');
        const trackArtist = document.getElementById('trackArtist');
        
        if (trackTitle) {
            trackTitle.textContent = track.title || 'Sem informação';
        }
        
        if (trackArtist) {
            trackArtist.textContent = track.artist || 'Rádio Supermercado do Louro';
        }
    }
    
    updateRecentTracks() {
        const recentContainer = document.getElementById('recentTracks');
        if (!recentContainer || this.recentTracks.length === 0) return;
        
        const html = this.recentTracks.map(track => `
            <div class="recent-item">
                <div class="track-info">
                    <span class="track-title">${track.title}</span>
                    ${track.artist ? `<span class="track-artist">${track.artist}</span>` : ''}
                </div>
                <span class="track-time">${this.formatTime(track.timestamp)}</span>
            </div>
        `).join('');
        
        recentContainer.innerHTML = html;
    }
    
    // === EFEITOS VISUAIS ===
    
    startEqualizer() {
        const equalizer = document.getElementById('equalizer');
        if (equalizer) {
            equalizer.classList.add('active');
        }
    }
    
    stopEqualizer() {
        const equalizer = document.getElementById('equalizer');
        if (equalizer) {
            equalizer.classList.remove('active');
        }
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.innerHTML = `
            <div class="prompt-content glass">
                <h3>🔊 Ativar Áudio</h3>
                <p>Clique no botão abaixo para ouvir a rádio</p>
                <button onclick="streamManager.play(); this.parentElement.parentElement.remove();" 
                        class="btn-primary">▶️ Ouvir Rádio</button>
            </div>
        `;
        
        document.body.appendChild(prompt);
        setTimeout(() => prompt.remove(), 10000);
    }
    
    showError(message) {
        console.error('UI Error:', message);
        
        // Atualizar status
        this.updateStatus(message);
        
        // Mostrar toast (se implementado)
        this.showToast(message, 'error');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
    
    showLoading(show) {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
    
    // === NOTIFICAÇÕES ===
    
    showTrackNotification(track) {
        if (!MOBILE_CONFIG.notifications.enabled || !('Notification' in window)) {
            return;
        }
        
        if (Notification.permission === 'granted') {
            new Notification(`🎵 ${RADIO_CONFIG.radio.name}`, {
                body: `${track.title}${track.artist ? ` - ${track.artist}` : ''}`,
                icon: 'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png',
                tag: 'now-playing',
                silent: false
            });
        }
    }
    
    // === HEARTBEAT E INTERVALOS ===
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.isPlaying && this.audio.readyState < 3) {
                console.warn('💓 Heartbeat: Stream não está respondendo');
                this.attemptReconnect();
            }
        }, RADIO_CONFIG.connection.heartbeatInterval);
    }
    
    startStatsUpdate() {
        this.statsInterval = setInterval(() => {
            if (this.streamState.isLive) {
                this.checkStreamStatus();
                this.streamState.uptime += 30; // 30 segundos
            }
        }, 30000);
    }
    
    // === UTILIDADES ===
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    saveVolume() {
        try {
            localStorage.setItem('radioVolume', this.volume);
        } catch (e) {
            console.warn('Não foi possível salvar volume');
        }
    }
    
    loadVolume() {
        try {
            const saved = localStorage.getItem('radioVolume');
            if (saved) {
                this.setVolume(parseFloat(saved));
            }
        } catch (e) {
            console.warn('Não foi possível carregar volume');
        }
    }
    
    cleanup() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
        }
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        
        if (this.audio) {
            this.audio.pause();
        }
    }
    
    // === API PÚBLICA ===
    
    getStreamState() {
        return { ...this.streamState };
    }
    
    getCurrentTrack() {
        return this.recentTracks[0] || null;
    }
    
    getRecentTracks() {
        return [...this.recentTracks];
    }
    
    async forceReconnect() {
        this.reconnectAttempts = 0;
        await this.stop();
        setTimeout(() => this.play(), 1000);
    }
}

// Inicialização global
window.LiveStreamManager = LiveStreamManager;
console.log('📡 Sistema de streaming carregado');