// 📻 RÁDIO CORE - SISTEMA DE TRANSMISSÃO 24 HORAS
// =================================================

class RadioTransmission {
    constructor() {
        this.isInitialized = false;
        this.audioContext = null;
        this.audioElement = null;
        this.gainNode = null;
        this.intervalIds = new Map();
        this.failureCount = 0;
        this.lastTrackChange = Date.now();
        
        // Bind methods
        this.handleTrackEnd = this.handleTrackEnd.bind(this);
        this.handleAudioError = this.handleAudioError.bind(this);
        this.updateUI = this.updateUI.bind(this);
        
        console.log('📻 RadioTransmission inicializada');
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Inicializar contexto de áudio
            await this.initAudioContext();
            
            // Configurar elemento de áudio
            this.setupAudioElement();
            
            // Iniciar sistemas de monitoramento
            this.startHeartbeat();
            this.startTimeChecker();
            this.startUIUpdater();
            
            // Marcar como inicializada
            this.isInitialized = true;
            STATE.transmission.isLive = true;
            STATE.transmission.startTime = Date.now();
            
            UTILS.log('info', '✅ Sistema de transmissão inicializado');
            
            // Iniciar transmissão automaticamente
            setTimeout(() => {
                this.startTransmission();
            }, 1000);
            
        } catch (error) {
            UTILS.log('error', '❌ Erro na inicialização da transmissão', error);
            throw error;
        }
    }
    
    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Configurar Web Audio API para melhor controle
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = CONFIG.radio.audio.defaultVolume;
            
            UTILS.log('debug', 'AudioContext inicializado');
        } catch (error) {
            UTILS.log('warn', 'Fallback para áudio HTML5', error);
        }
    }
    
    setupAudioElement() {
        this.audioElement = document.getElementById('radioStream');
        if (!this.audioElement) {
            throw new Error('Elemento de áudio não encontrado');
        }
        
        // Configurar propriedades do áudio
        this.audioElement.preload = 'auto';
        this.audioElement.volume = CONFIG.radio.audio.defaultVolume;
        
        // Event listeners para controle da transmissão
        this.audioElement.addEventListener('ended', this.handleTrackEnd);
        this.audioElement.addEventListener('error', this.handleAudioError);
        this.audioElement.addEventListener('canplay', () => {
            if (STATE.transmission.isLive && !STATE.transmission.isPlaying) {
                this.playCurrentTrack();
            }
        });
        
        // Conectar ao Web Audio Context se disponível
        if (this.audioContext && this.gainNode) {
            const source = this.audioContext.createMediaElementSource(this.audioElement);
            source.connect(this.gainNode);
        }
        
        UTILS.log('debug', 'Elemento de áudio configurado');
    }
    
    startTransmission() {
        if (!STATE.transmission.isLive) return;
        
        UTILS.log('info', '🔴 Iniciando transmissão ao vivo');
        
        // Resetar contadores
        STATE.schedule.tracksSinceTime = 0;
        STATE.schedule.tracksSinceAd = 0;
        STATE.schedule.lastTimeAnnouncement = Date.now();
        
        // Tocar primeira música
        this.playNextTrack();
    }
    
    stopTransmission() {
        UTILS.log('info', '⚫ Parando transmissão');
        
        STATE.transmission.isLive = false;
        STATE.transmission.isPlaying = false;
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
        
        // Limpar intervalos
        this.intervalIds.forEach((id, name) => {
            clearInterval(id);
            this.intervalIds.delete(name);
        });
        
        this.updateUI();
    }
    
    async playNextTrack() {
        try {
            if (!STATE.transmission.isLive) return;
            
            // Selecionar próxima faixa baseada na programação
            const nextTrack = this.selectNextTrack();
            
            if (!nextTrack) {
                UTILS.log('warn', '⚠️ Nenhuma música disponível, aguardando...');
                setTimeout(() => this.playNextTrack(), 30000);
                return;
            }
            
            // Configurar nova faixa
            STATE.transmission.currentTrack = nextTrack;
            this.lastTrackChange = Date.now();
            
            // Aplicar crossfade se habilitado
            if (CONFIG.radio.audio.fadeTransitions && STATE.transmission.isPlaying) {
                await this.crossfadeToTrack(nextTrack);
            } else {
                await this.loadAndPlayTrack(nextTrack);
            }
            
            // Atualizar estatísticas
            this.updatePlayStats(nextTrack);
            
            // Atualizar UI
            this.updateUI();
            
            UTILS.log('info', `🎵 Tocando: ${nextTrack.name}`);
            
        } catch (error) {
            UTILS.log('error', '❌ Erro ao reproduzir próxima música', error);
            this.handlePlaybackError(error);
        }
    }
    
    selectNextTrack() {
        // 1. Verificar se é hora de tocar hora certa
        const timeSinceLastTime = Date.now() - STATE.schedule.lastTimeAnnouncement;
        const timeInterval = CONFIG.radio.schedule.timeAnnouncementInterval * 60 * 1000;
        
        if (timeSinceLastTime >= timeInterval && STATE.library.time.length > 0) {
            STATE.schedule.lastTimeAnnouncement = Date.now();
            STATE.schedule.tracksSinceTime = 0;
            STATE.schedule.tracksSinceAd++;
            return this.getRandomFromPlaylist(STATE.library.time);
        }
        
        // 2. Verificar se é hora de tocar aviso
        const adInterval = CONFIG.radio.schedule.adInterval;
        if (STATE.schedule.tracksSinceAd >= adInterval && STATE.library.ads.length > 0) {
            STATE.schedule.tracksSinceAd = 0;
            STATE.schedule.tracksSinceTime++;
            return this.getRandomFromPlaylist(STATE.library.ads);
        }
        
        // 3. Tocar música regular
        STATE.schedule.tracksSinceTime++;
        STATE.schedule.tracksSinceAd++;
        
        // Verificar se há álbum ativo
        if (STATE.schedule.activeAlbum && STATE.library.albums[STATE.schedule.activeAlbum]?.length > 0) {
            return this.getRandomFromPlaylist(STATE.library.albums[STATE.schedule.activeAlbum]);
        }
        
        // Playlist geral
        return this.getRandomFromPlaylist(STATE.library.music);
    }
    
    getRandomFromPlaylist(playlist) {
        if (!playlist || playlist.length === 0) return null;
        
        // Evitar repetir a música anterior se houver mais opções
        if (playlist.length > 1 && STATE.transmission.currentTrack) {
            const filtered = playlist.filter(track => 
                track.name !== STATE.transmission.currentTrack.name
            );
            if (filtered.length > 0) {
                playlist = filtered;
            }
        }
        
        return playlist[Math.floor(Math.random() * playlist.length)];
    }
    
    async loadAndPlayTrack(track) {
        if (!track || !this.audioElement) return;
        
        try {
            // Carregar nova faixa
            this.audioElement.src = track.url;
            
            // Aguardar carregamento e reproduzir
            await new Promise((resolve, reject) => {
                const onCanPlay = () => {
                    this.audioElement.removeEventListener('canplay', onCanPlay);
                    this.audioElement.removeEventListener('error', onError);
                    resolve();
                };
                
                const onError = (error) => {
                    this.audioElement.removeEventListener('canplay', onCanPlay);
                    this.audioElement.removeEventListener('error', onError);
                    reject(error);
                };
                
                this.audioElement.addEventListener('canplay', onCanPlay);
                this.audioElement.addEventListener('error', onError);
                
                this.audioElement.load();
                
                // Timeout de 30 segundos
                setTimeout(() => {
                    this.audioElement.removeEventListener('canplay', onCanPlay);
                    this.audioElement.removeEventListener('error', onError);
                    reject(new Error('Timeout ao carregar faixa'));
                }, 30000);
            });
            
            // Reproduzir
            await this.playCurrentTrack();
            
        } catch (error) {
            UTILS.log('error', 'Erro ao carregar faixa', error);
            throw error;
        }
    }
    
    async crossfadeToTrack(nextTrack) {
        if (!CONFIG.radio.audio.fadeTransitions || !this.gainNode) {
            return await this.loadAndPlayTrack(nextTrack);
        }
        
        try {
            const fadeDuration = CONFIG.radio.audio.crossfadeDuration / 1000;
            const currentTime = this.audioContext.currentTime;
            
            // Fade out da música atual
            this.gainNode.gain.cancelScheduledValues(currentTime);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeDuration);
            
            // Aguardar fade out
            await new Promise(resolve => setTimeout(resolve, fadeDuration * 1000));
            
            // Carregar nova faixa
            await this.loadAndPlayTrack(nextTrack);
            
            // Fade in da nova música
            this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(
                CONFIG.radio.audio.defaultVolume, 
                this.audioContext.currentTime + fadeDuration
            );
            
        } catch (error) {
            UTILS.log('warn', 'Erro no crossfade, usando transição normal', error);
            await this.loadAndPlayTrack(nextTrack);
        }
    }
    
    async playCurrentTrack() {
        if (!this.audioElement || !STATE.transmission.isLive) return;
        
        try {
            // Resumir contexto de áudio se suspenso
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            await this.audioElement.play();
            STATE.transmission.isPlaying = true;
            this.failureCount = 0; // Reset contador de falhas
            
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                UTILS.log('warn', 'Autoplay bloqueado, aguardando interação do usuário');
                this.showAutoplayPrompt();
            } else {
                UTILS.log('error', 'Erro ao reproduzir faixa', error);
                throw error;
            }
        }
    }
    
    showAutoplayPrompt() {
        // Criar prompt discreto para ativar áudio
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <span class="prompt-icon">🔊</span>
                <span class="prompt-text">Clique para ativar o áudio da rádio</span>
            </div>
        `;
        
        prompt.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 107, 107, 0.95);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 9999;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            animation: pulse 2s infinite;
        `;
        
        document.body.appendChild(prompt);
        
        const activateAudio = async () => {
            try {
                await this.playCurrentTrack();
                prompt.remove();
            } catch (error) {
                UTILS.log('error', 'Erro ao ativar áudio', error);
            }
        };
        
        prompt.addEventListener('click', activateAudio);
        
        // Auto-remover após 15 segundos
        setTimeout(() => {
            if (prompt.parentNode) {
                prompt.remove();
            }
        }, 15000);
    }
    
    handleTrackEnd() {
        if (!STATE.transmission.isLive) return;
        
        UTILS.log('debug', 'Faixa finalizada, próxima em 1 segundo');
        
        // Pequena pausa antes da próxima música
        setTimeout(() => {
            this.playNextTrack();
        }, 1000);
    }
    
    handleAudioError(event) {
        this.failureCount++;
        const error = event.target.error;
        
        UTILS.log('error', `Erro de áudio (${this.failureCount}/5)`, {
            code: error?.code,
            message: error?.message,
            currentTrack: STATE.transmission.currentTrack?.name
        });
        
        // Tentar recuperação automática
        if (this.failureCount < CONFIG.radio.transmission.maxRetries) {
            setTimeout(() => {
                this.handlePlaybackError(error);
            }, CONFIG.radio.transmission.retryDelay);
        } else {
            UTILS.log('error', 'Muitas falhas consecutivas, parando transmissão');
            this.stopTransmission();
        }
    }
    
    async handlePlaybackError(error) {
        if (!CONFIG.radio.transmission.autoRestart) return;
        
        UTILS.log('info', '🔄 Tentando recuperar transmissão...');
        
        try {
            // Tentar próxima música
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            if (STATE.transmission.isLive) {
                this.playNextTrack();
            }
            
        } catch (recoveryError) {
            UTILS.log('error', 'Falha na recuperação automática', recoveryError);
            
            // Se há faixas de emergência, usar
            if (CONFIG.radio.transmission.fallback.enabled && 
                CONFIG.radio.transmission.fallback.emergencyTracks.length > 0) {
                this.playEmergencyTrack();
            }
        }
    }
    
    playEmergencyTrack() {
        const emergencyTracks = CONFIG.radio.transmission.fallback.emergencyTracks;
        const randomTrack = emergencyTracks[Math.floor(Math.random() * emergencyTracks.length)];
        
        UTILS.log('info', '🚨 Reproduzindo faixa de emergência');
        this.loadAndPlayTrack(randomTrack);
    }
    
    updatePlayStats(track) {
        STATE.stats.totalPlayed++;
        STATE.stats.playHistory[track.name] = (STATE.stats.playHistory[track.name] || 0) + 1;
        
        // Adicionar ao histórico recente
        STATE.schedule.playHistory.unshift({
            track,
            timestamp: Date.now(),
            duration: track.duration || 0
        });
        
        // Manter apenas os últimos 50 itens
        if (STATE.schedule.playHistory.length > 50) {
            STATE.schedule.playHistory = STATE.schedule.playHistory.slice(0, 50);
        }
    }
    
    startHeartbeat() {
        const heartbeatId = setInterval(() => {
            STATE.transmission.lastHeartbeat = Date.now();
            STATE.transmission.uptime = Date.now() - STATE.transmission.startTime;
            
            // Verificar se a transmissão ainda está ativa
            const timeSinceLastTrack = Date.now() - this.lastTrackChange;
            const maxSilence = CONFIG.radio.transmission.fallback.silenceThreshold;
            
            if (timeSinceLastTrack > maxSilence && STATE.transmission.isLive) {
                UTILS.log('warn', '⚠️ Possível problema na transmissão detectado');
                this.handlePlaybackError(new Error('Transmissão silenciosa detectada'));
            }
            
        }, CONFIG.radio.transmission.heartbeatInterval);
        
        this.intervalIds.set('heartbeat', heartbeatId);
    }
    
    startTimeChecker() {
        // Verificar a cada minuto se é hora de tocar hora certa
        const timeCheckerId = setInterval(() => {
            const now = new Date();
            const minutes = now.getMinutes();
            
            // Hora certa nos minutos 00
            if (minutes === 0 && STATE.library.time.length > 0) {
                const timeSinceLastTime = Date.now() - STATE.schedule.lastTimeAnnouncement;
                const minInterval = 50 * 60 * 1000; // Mínimo 50 minutos entre horas certas
                
                if (timeSinceLastTime > minInterval) {
                    UTILS.log('info', '🕐 Forçando hora certa');
                    STATE.schedule.tracksSinceTime = 999; // Força próxima hora certa
                }
            }
        }, 60000);
        
        this.intervalIds.set('timeChecker', timeCheckerId);
    }
    
    startUIUpdater() {
        const uiUpdateId = setInterval(() => {
            this.updateUI();
        }, 5000); // Atualizar UI a cada 5 segundos
        
        this.intervalIds.set('uiUpdater', uiUpdateId);
    }
    
    updateUI() {
        try {
            // Atualizar status de transmissão
            const liveStatus = document.getElementById('liveStatus');
            if (liveStatus) {
                liveStatus.textContent = STATE.transmission.isLive ? 'AO VIVO' : 'OFFLINE';
                liveStatus.className = STATE.transmission.isLive ? 'live-active' : 'live-inactive';
            }
            
            // Atualizar música atual
            const nowPlaying = document.getElementById('nowPlaying');
            if (nowPlaying && STATE.transmission.currentTrack) {
                nowPlaying.textContent = STATE.transmission.currentTrack.name;
            }
            
            // Atualizar informações de transmissão
            const transmissionStatus = document.getElementById('transmissionStatus');
            if (transmissionStatus) {
                transmissionStatus.textContent = STATE.transmission.isPlaying ? 'Transmitindo' : 'Pausado';
            }
            
            const songsCount = document.getElementById('songsCount');
            if (songsCount) {
                songsCount.textContent = STATE.stats.totalPlayed.toString();
            }
            
            const lastUpdate = document.getElementById('lastUpdate');
            if (lastUpdate) {
                lastUpdate.textContent = new Date().toLocaleTimeString('pt-BR');
            }
            
            // Atualizar histórico recente
            this.updateRecentTracks();
            
            // Atualizar equalizer visual
            this.updateEqualizer();
            
        } catch (error) {
            UTILS.log('error', 'Erro ao atualizar UI', error);
        }
    }
    
    updateRecentTracks() {
        const trackHistory = document.getElementById('trackHistory');
        if (!trackHistory || STATE.schedule.playHistory.length === 0) return;
        
        const recentTracks = STATE.schedule.playHistory.slice(0, CONFIG.ui.maxRecentTracks);
        
        trackHistory.innerHTML = recentTracks.map(item => {
            const timeAgo = this.getTimeAgo(item.timestamp);
            return `
                <div class="track-item">
                    <span class="track-name">${item.track.name}</span>
                    <span class="track-time">${timeAgo}</span>
                </div>
            `;
        }).join('') || '<div class="track-item loading">Nenhuma música tocada ainda</div>';
    }
    
    updateEqualizer() {
        if (!STATE.transmission.isPlaying) return;
        
        const eqBars = document.querySelectorAll('.eq-bar');
        eqBars.forEach((bar, index) => {
            const height = Math.random() * 100 + 20;
            bar.style.height = `${height}%`;
            bar.style.animationDelay = `${index * 0.1}s`;
        });
    }
    
    getTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'agora';
        if (minutes === 1) return '1 min';
        if (minutes < 60) return `${minutes} min`;
        
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return '1h';
        return `${hours}h`;
    }
    
    // Métodos públicos para controle da transmissão
    toggleTransmission() {
        if (STATE.transmission.isLive) {
            this.stopTransmission();
        } else {
            STATE.transmission.isLive = true;
            this.startTransmission();
        }
        this.updateUI();
    }
    
    skipToNext() {
        if (STATE.transmission.isLive) {
            UTILS.log('info', '⏭️ Pulando para próxima música');
            this.playNextTrack();
        }
    }
    
    setVolume(volume) {
        const normalizedVolume = Math.max(0, Math.min(1, volume));
        CONFIG.radio.audio.defaultVolume = normalizedVolume;
        
        if (this.audioElement) {
            this.audioElement.volume = normalizedVolume;
        }
        
        if (this.gainNode) {
            this.gainNode.gain.value = normalizedVolume;
        }
        
        STATE.transmission.volume = normalizedVolume;
        UTILS.save();
    }
    
    getStatus() {
        return {
            isLive: STATE.transmission.isLive,
            isPlaying: STATE.transmission.isPlaying,
            currentTrack: STATE.transmission.currentTrack,
            uptime: STATE.transmission.uptime,
            totalPlayed: STATE.stats.totalPlayed,
            volume: STATE.transmission.volume,
            failureCount: this.failureCount
        };
    }
}

// Instância global da transmissão
window.RadioCore = new RadioTransmission();