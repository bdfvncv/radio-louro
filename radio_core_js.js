// 📻 SISTEMA DE TRANSMISSÃO 24 HORAS
console.log('📻 Carregando sistema de transmissão...');

class RadioCore {
    constructor() {
        this.audioElement = null;
        this.intervalIds = new Map();
        this.isInitialized = false;
        
        console.log('📻 RadioCore inicializado');
    }
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Configurar elemento de áudio
            this.audioElement = document.getElementById('radioStream');
            if (!this.audioElement) {
                throw new Error('Elemento de áudio não encontrado');
            }
            
            // Configurar propriedades do áudio
            this.audioElement.volume = RADIO_CONFIG.radio.audio.defaultVolume;
            this.audioElement.preload = 'auto';
            
            // Event listeners
            this.audioElement.addEventListener('ended', () => this.playNext());
            this.audioElement.addEventListener('error', (e) => this.handleError(e));
            this.audioElement.addEventListener('canplay', () => {
                if (RADIO_STATE.transmission.isLive && !RADIO_STATE.transmission.isPlaying) {
                    this.playCurrentTrack();
                }
            });
            
            // Iniciar sistema
            this.startHeartbeat();
            this.startTimeChecker();
            
            this.isInitialized = true;
            RADIO_UTILS.log('Sistema de transmissão inicializado');
            
            return true;
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            return false;
        }
    }
    
    startTransmission() {
        if (RADIO_STATE.transmission.isLive) return;
        
        RADIO_UTILS.log('🔴 Iniciando transmissão ao vivo');
        
        RADIO_STATE.transmission.isLive = true;
        RADIO_STATE.transmission.startTime = Date.now();
        
        // Resetar contadores
        RADIO_STATE.schedule.tracksSinceTime = 0;
        RADIO_STATE.schedule.tracksSinceAd = 0;
        
        // Tocar primeira música
        setTimeout(() => this.playNext(), 1000);
        
        this.updateUI();
    }
    
    stopTransmission() {
        RADIO_UTILS.log('⚫ Parando transmissão');
        
        RADIO_STATE.transmission.isLive = false;
        RADIO_STATE.transmission.isPlaying = false;
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
        
        this.updateUI();
    }
    
    playNext() {
        if (!RADIO_STATE.transmission.isLive) return;
        
        try {
            const nextTrack = this.selectNextTrack();
            
            if (!nextTrack) {
                RADIO_UTILS.log('⚠️ Nenhuma música disponível');
                this.showMessage('Aguardando upload de músicas...');
                setTimeout(() => this.playNext(), 30000);
                return;
            }
            
            // Configurar nova faixa
            RADIO_STATE.transmission.currentTrack = nextTrack;
            
            this.loadAndPlayTrack(nextTrack);
            this.updatePlayStats(nextTrack);
            this.updateUI();
            
            RADIO_UTILS.log(`🎵 Tocando: ${nextTrack.name}`);
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir:', error);
            this.handlePlaybackError();
        }
    }
    
    selectNextTrack() {
        // 1. Verificar se deve tocar hora certa
        if (RADIO_STATE.schedule.tracksSinceTime >= RADIO_CONFIG.radio.schedule.timeInterval && 
            RADIO_STATE.library.time.length > 0) {
            RADIO_STATE.schedule.tracksSinceTime = 0;
            RADIO_STATE.schedule.tracksSinceAd++;
            return this.getRandomFromPlaylist(RADIO_STATE.library.time);
        }
        
        // 2. Verificar se deve tocar aviso
        if (RADIO_STATE.schedule.tracksSinceAd >= RADIO_CONFIG.radio.schedule.adInterval && 
            RADIO_STATE.library.ads.length > 0) {
            RADIO_STATE.schedule.tracksSinceAd = 0;
            RADIO_STATE.schedule.tracksSinceTime++;
            return this.getRandomFromPlaylist(RADIO_STATE.library.ads);
        }
        
        // 3. Tocar música regular
        RADIO_STATE.schedule.tracksSinceTime++;
        RADIO_STATE.schedule.tracksSinceAd++;
        
        // Verificar se há álbum ativo
        if (RADIO_STATE.schedule.activeAlbum && 
            RADIO_STATE.library.albums[RADIO_STATE.schedule.activeAlbum]?.length > 0) {
            return this.getRandomFromPlaylist(RADIO_STATE.library.albums[RADIO_STATE.schedule.activeAlbum]);
        }
        
        // Playlist geral
        return this.getRandomFromPlaylist(RADIO_STATE.library.music);
    }
    
    getRandomFromPlaylist(playlist) {
        if (!playlist || playlist.length === 0) return null;
        
        // Evitar repetir a música anterior
        if (playlist.length > 1 && RADIO_STATE.transmission.currentTrack) {
            const filtered = playlist.filter(track => 
                track.name !== RADIO_STATE.transmission.currentTrack.name
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
            this.audioElement.src = track.url;
            this.showMessage(track.name);
            
            if (RADIO_STATE.transmission.isLive) {
                await this.playCurrentTrack();
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar faixa:', error);
            throw error;
        }
    }
    
    async playCurrentTrack() {
        if (!this.audioElement || !RADIO_STATE.transmission.isLive) return;
        
        try {
            await this.audioElement.play();
            RADIO_STATE.transmission.isPlaying = true;
            
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                RADIO_UTILS.log('⚠️ Autoplay bloqueado');
                this.showAutoplayPrompt();
            } else {
                console.error('❌ Erro ao reproduzir:', error);
                throw error;
            }
        }
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: rgba(255,107,107,0.9); color: white; padding: 15px 25px; 
                        border-radius: 25px; z-index: 9999; cursor: pointer; font-weight: 600;">
                🔊 Clique para ativar o áudio da rádio
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        const enableAudio = async () => {
            try {
                await this.playCurrentTrack();
                prompt.remove();
            } catch (error) {
                console.error('❌ Erro ao ativar áudio:', error);
            }
        };
        
        prompt.addEventListener('click', enableAudio);
        setTimeout(() => prompt.remove(), 15000);
    }
    
    updatePlayStats(track) {
        RADIO_STATE.stats.totalPlayed++;
        RADIO_STATE.stats.playHistory[track.name] = (RADIO_STATE.stats.playHistory[track.name] || 0) + 1;
        RADIO_UTILS.save();
    }
    
    handleError(event) {
        const error = event.target.error;
        console.error('❌ Erro de áudio:', error);
        this.handlePlaybackError();
    }
    
    handlePlaybackError() {
        RADIO_UTILS.log('🔄 Tentando recuperar transmissão...');
        
        setTimeout(() => {
            if (RADIO_STATE.transmission.isLive) {
                this.playNext();
            }
        }, 3000);
    }
    
    startHeartbeat() {
        const heartbeatId = setInterval(() => {
            this.updateUI();
        }, 5000);
        
        this.intervalIds.set('heartbeat', heartbeatId);
    }
    
    startTimeChecker() {
        const timeCheckId = setInterval(() => {
            const now = new Date();
            if (now.getMinutes() === 0 && RADIO_STATE.library.time.length > 0) {
                const timeSinceLastCheck = Date.now() - RADIO_STATE.schedule.lastTimeCheck;
                if (timeSinceLastCheck > 50 * 60 * 1000) { // 50 minutos
                    RADIO_UTILS.log('🕐 Forçando hora certa');
                    RADIO_STATE.schedule.tracksSinceTime = 999;
                    RADIO_STATE.schedule.lastTimeCheck = Date.now();
                }
            }
        }, 60000); // Verificar a cada minuto
        
        this.intervalIds.set('timeChecker', timeCheckId);
    }
    
    updateUI() {
        try {
            // Status ao vivo
            const liveStatus = document.getElementById('liveStatus');
            if (liveStatus) {
                liveStatus.textContent = RADIO_STATE.transmission.isLive ? 'AO VIVO' : 'OFFLINE';
            }
            
            // Música atual
            const nowPlaying = document.getElementById('nowPlaying');
            if (nowPlaying) {
                if (RADIO_STATE.transmission.currentTrack) {
                    nowPlaying.textContent = RADIO_STATE.transmission.currentTrack.name;
                } else if (RADIO_STATE.transmission.isLive) {
                    nowPlaying.textContent = 'Carregando próxima música...';
                } else {
                    nowPlaying.textContent = 'Transmissão pausada';
                }
            }
            
            // Status de transmissão
            const transmissionStatus = document.getElementById('transmissionStatus');
            if (transmissionStatus) {
                transmissionStatus.textContent = RADIO_STATE.transmission.isLive ? 'Transmitindo' : 'Offline';
            }
            
            // Contador de músicas
            const songsCount = document.getElementById('songsCount');
            if (songsCount) {
                songsCount.textContent = RADIO_STATE.stats.totalPlayed.toString();
            }
            
            // Última atualização
            const lastUpdate = document.getElementById('lastUpdate');
            if (lastUpdate) {
                lastUpdate.textContent = new Date().toLocaleTimeString('pt-BR');
            }
            
            // Botão play/pause
            const playBtn = document.getElementById('playStopBtn');
            if (playBtn) {
                const icon = playBtn.querySelector('.control-icon');
                const text = playBtn.querySelector('.control-text');
                
                if (RADIO_STATE.transmission.isLive) {
                    if (icon) icon.textContent = '⏸️';
                    if (text) text.textContent = 'PAUSAR';
                    playBtn.classList.add('playing');
                } else {
                    if (icon) icon.textContent = '▶️';
                    if (text) text.textContent = 'ESCUTAR';
                    playBtn.classList.remove('playing');
                }
            }
            
            // Admin status
            this.updateAdminUI();
            
        } catch (error) {
            console.error('❌ Erro ao atualizar UI:', error);
        }
    }
    
    updateAdminUI() {
        // Status online no admin
        const onlineStatus = document.getElementById('onlineStatus');
        if (onlineStatus) {
            onlineStatus.textContent = RADIO_STATE.transmission.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
        }
        
        // Música atual no admin
        const currentTrackAdmin = document.getElementById('currentTrackAdmin');
        if (currentTrackAdmin) {
            currentTrackAdmin.textContent = RADIO_STATE.transmission.currentTrack?.name || 'Nenhuma';
        }
        
        // Total de faixas
        const totalTracks = document.getElementById('totalTracks');
        if (totalTracks) {
            const total = this.getTotalTracks();
            totalTracks.textContent = total.toString();
        }
        
        // Tempo online
        const uptime = document.getElementById('uptime');
        if (uptime && RADIO_STATE.transmission.startTime) {
            const uptimeMs = Date.now() - RADIO_STATE.transmission.startTime;
            uptime.textContent = RADIO_UTILS.formatTime(uptimeMs / 1000);
        }
        
        // Botão de transmissão
        const transmissionBtn = document.getElementById('transmissionBtnText');
        if (transmissionBtn) {
            transmissionBtn.textContent = RADIO_STATE.transmission.isLive ? 
                '⏸️ PAUSAR TRANSMISSÃO' : '▶️ INICIAR TRANSMISSÃO';
        }
    }
    
    getTotalTracks() {
        let total = 0;
        total += RADIO_STATE.library.music.length;
        total += RADIO_STATE.library.time.length;
        total += RADIO_STATE.library.ads.length;
        
        Object.values(RADIO_STATE.library.albums).forEach(album => {
            total += album.length;
        });
        
        return total;
    }
    
    showMessage(message) {
        const nowPlaying = document.getElementById('nowPlaying');
        if (nowPlaying) {
            nowPlaying.textContent = message;
        }
    }
    
    // Métodos públicos
    toggleTransmission() {
        if (RADIO_STATE.transmission.isLive) {
            this.stopTransmission();
        } else {
            this.startTransmission();
        }
    }
    
    skipToNext() {
        if (RADIO_STATE.transmission.isLive) {
            this.playNext();
        }
    }
    
    setVolume(volume) {
        const normalizedVolume = Math.max(0, Math.min(1, volume));
        RADIO_CONFIG.radio.audio.defaultVolume = normalizedVolume;
        
        if (this.audioElement) {
            this.audioElement.volume = normalizedVolume;
        }
        
        RADIO_STATE.transmission.volume = normalizedVolume;
        RADIO_UTILS.save();
    }
    
    getStatus() {
        return {
            isLive: RADIO_STATE.transmission.isLive,
            isPlaying: RADIO_STATE.transmission.isPlaying,
            currentTrack: RADIO_STATE.transmission.currentTrack,
            totalPlayed: RADIO_STATE.stats.totalPlayed,
            totalTracks: this.getTotalTracks()
        };
    }
}

// Criar instância global
window.RadioCore = new RadioCore();

console.log('✅ RadioCore carregado com sucesso!');
