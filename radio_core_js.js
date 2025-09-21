// 📻 SISTEMA DE TRANSMISSÃO 24 HORAS
console.log('📻 Carregando sistema de transmissão...');

window.RadioCore = {
    audioElement: null,
    intervalIds: new Map(),
    isInitialized: false,
    
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('📻 Inicializando RadioCore...');
            
            // Configurar elemento de áudio
            this.audioElement = document.getElementById('radioStream');
            if (!this.audioElement) {
                throw new Error('Elemento de áudio não encontrado');
            }
            
            // Configurar propriedades do áudio
            this.audioElement.volume = window.RADIO_CONFIG.radio.audio.defaultVolume;
            this.audioElement.preload = 'auto';
            
            // Event listeners
            this.audioElement.addEventListener('ended', () => this.playNext());
            this.audioElement.addEventListener('error', (e) => this.handleError(e));
            this.audioElement.addEventListener('canplay', () => {
                if (window.RADIO_STATE.transmission.isLive && !window.RADIO_STATE.transmission.isPlaying) {
                    this.playCurrentTrack();
                }
            });
            
            // Iniciar sistema
            this.startHeartbeat();
            
            this.isInitialized = true;
            window.RADIO_UTILS.log('Sistema de transmissão inicializado');
            
            return true;
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            return false;
        }
    },
    
    startTransmission() {
        if (window.RADIO_STATE.transmission.isLive) return;
        
        window.RADIO_UTILS.log('🔴 Iniciando transmissão ao vivo');
        
        window.RADIO_STATE.transmission.isLive = true;
        window.RADIO_STATE.transmission.startTime = Date.now();
        
        // Resetar contadores
        window.RADIO_STATE.schedule.tracksSinceTime = 0;
        window.RADIO_STATE.schedule.tracksSinceAd = 0;
        
        // Tocar primeira música
        setTimeout(() => this.playNext(), 1000);
        
        this.updateUI();
    },
    
    stopTransmission() {
        window.RADIO_UTILS.log('⚫ Parando transmissão');
        
        window.RADIO_STATE.transmission.isLive = false;
        window.RADIO_STATE.transmission.isPlaying = false;
        
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
        
        this.updateUI();
    },
    
    playNext() {
        if (!window.RADIO_STATE.transmission.isLive) return;
        
        try {
            const nextTrack = this.selectNextTrack();
            
            if (!nextTrack) {
                window.RADIO_UTILS.log('⚠️ Nenhuma música disponível');
                this.showMessage('Aguardando upload de músicas...');
                setTimeout(() => this.playNext(), 30000);
                return;
            }
            
            // Configurar nova faixa
            window.RADIO_STATE.transmission.currentTrack = nextTrack;
            
            this.loadAndPlayTrack(nextTrack);
            this.updatePlayStats(nextTrack);
            this.updateUI();
            
            window.RADIO_UTILS.log(`🎵 Tocando: ${nextTrack.name}`);
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir:', error);
            this.handlePlaybackError();
        }
    },
    
    selectNextTrack() {
        // 1. Verificar se deve tocar hora certa
        if (window.RADIO_STATE.schedule.tracksSinceTime >= window.RADIO_CONFIG.radio.schedule.timeInterval && 
            window.RADIO_STATE.library.time.length > 0) {
            window.RADIO_STATE.schedule.tracksSinceTime = 0;
            window.RADIO_STATE.schedule.tracksSinceAd++;
            return this.getRandomFromPlaylist(window.RADIO_STATE.library.time);
        }
        
        // 2. Verificar se deve tocar aviso
        if (window.RADIO_STATE.schedule.tracksSinceAd >= window.RADIO_CONFIG.radio.schedule.adInterval && 
            window.RADIO_STATE.library.ads.length > 0) {
            window.RADIO_STATE.schedule.tracksSinceAd = 0;
            window.RADIO_STATE.schedule.tracksSinceTime++;
            return this.getRandomFromPlaylist(window.RADIO_STATE.library.ads);
        }
        
        // 3. Tocar música regular
        window.RADIO_STATE.schedule.tracksSinceTime++;
        window.RADIO_STATE.schedule.tracksSinceAd++;
        
        // Verificar se há álbum ativo
        if (window.RADIO_STATE.schedule.activeAlbum && 
            window.RADIO_STATE.library.albums[window.RADIO_STATE.schedule.activeAlbum]?.length > 0) {
            return this.getRandomFromPlaylist(window.RADIO_STATE.library.albums[window.RADIO_STATE.schedule.activeAlbum]);
        }
        
        // Playlist geral
        return this.getRandomFromPlaylist(window.RADIO_STATE.library.music);
    },
    
    getRandomFromPlaylist(playlist) {
        if (!playlist || playlist.length === 0) return null;
        
        // Evitar repetir a música anterior
        if (playlist.length > 1 && window.RADIO_STATE.transmission.currentTrack) {
            const filtered = playlist.filter(track => 
                track.name !== window.RADIO_STATE.transmission.currentTrack.name
            );
            if (filtered.length > 0) {
                playlist = filtered;
            }
        }
        
        return playlist[Math.floor(Math.random() * playlist.length)];
    },
    
    async loadAndPlayTrack(track) {
        if (!track || !this.audioElement) return;
        
        try {
            this.audioElement.src = track.url;
            this.showMessage(track.name);
            
            if (window.RADIO_STATE.transmission.isLive) {
                await this.playCurrentTrack();
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar faixa:', error);
            throw error;
        }
    },
    
    async playCurrentTrack() {
        if (!this.audioElement || !window.RADIO_STATE.transmission.isLive) return;
        
        try {
            await this.audioElement.play();
            window.RADIO_STATE.transmission.isPlaying = true;
            
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                window.RADIO_UTILS.log('⚠️ Autoplay bloqueado');
                this.showAutoplayPrompt();
            } else {
                console.error('❌ Erro ao reproduzir:', error);
                throw error;
            }
        }
    },
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: rgba(255,107,107,0.9); color: white; padding: 15px 25px; 
                        border-radius: 25px; z-index: 9999; cursor: pointer; font-weight: 600;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
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
        setTimeout(() => {
            if (prompt.parentNode) prompt.remove();
        }, 15000);
    },
    
    updatePlayStats(track) {
        window.RADIO_STATE.stats.totalPlayed++;
        window.RADIO_STATE.stats.playHistory[track.name] = (window.RADIO_STATE.stats.playHistory[track.name] || 0) + 1;
        window.RADIO_UTILS.save();
    },
    
    handleError(event) {
        const error = event.target.error;
        console.error('❌ Erro de áudio:', error);
        this.handlePlaybackError();
    },
    
    handlePlaybackError() {
        window.RADIO_UTILS.log('🔄 Tentando recuperar transmissão...');
        
        setTimeout(() => {
            if (window.RADIO_STATE.transmission.isLive) {
                this.playNext();
            }
        }, 3000);
    },
    
    startHeartbeat() {
        const heartbeatId = setInterval(() => {
            this.updateUI();
        }, 3000);
        
        this.intervalIds.set('heartbeat', heartbeatId);
    },
    
    updateUI() {
        try {
            // Status ao vivo
            const liveStatus = document.getElementById('liveStatus');
            if (liveStatus) {
                liveStatus.textContent = window.RADIO_STATE.transmission.isLive ? 'AO VIVO' : 'OFFLINE';
            }
            
            // Música atual
            const nowPlaying = document.getElementById('nowPlaying');
            if (nowPlaying) {
                if (window.RADIO_STATE.transmission.currentTrack) {
                    nowPlaying.textContent = window.RADIO_STATE.transmission.currentTrack.name;
                } else if (window.RADIO_STATE.transmission.isLive) {
                    nowPlaying.textContent = 'Carregando próxima música...';
                } else {
                    nowPlaying.textContent = 'Transmissão pausada';
                }
            }
            
            // Status de transmissão
            const transmissionStatus = document.getElementById('transmissionStatus');
            if (transmissionStatus) {
                transmissionStatus.textContent = window.RADIO_STATE.transmission.isLive ? 'Transmitindo' : 'Offline';
            }
            
            // Contador de músicas
            const songsCount = document.getElementById('songsCount');
            if (songsCount) {
                songsCount.textContent = window.RADIO_STATE.stats.totalPlayed.toString();
            }
            
            // Última atualização
            const lastUpdate = document.getElementById('lastUpdate');
            if (lastUpdate) {
                lastUpdate.textContent = new Date().toLocaleTimeString('pt-BR');
            }
            
            // Botão play/pause
            this.updatePlayButton();
            
            // Admin UI
            this.updateAdminUI();
            
        } catch (error) {
            console.error('❌ Erro ao atualizar UI:', error);
        }
    },
    
    updatePlayButton() {
        const playBtn = document.getElementById('playStopBtn');
        if (!playBtn) return;
        
        const icon = playBtn.querySelector('.control-icon');
        const text = playBtn.querySelector('.control-text');
        
        if (window.RADIO_STATE.transmission.isLive) {
            if (icon) icon.textContent = '⏸️';
            if (text) text.textContent = 'PAUSAR';
            playBtn.classList.add('playing');
        } else {
            if (icon) icon.textContent = '▶️';
            if (text) text.textContent = 'ESCUTAR';
            playBtn.classList.remove('playing');
        }
    },
    
    updateAdminUI() {
        // Status online no admin
        const onlineStatus = document.getElementById('onlineStatus');
        if (onlineStatus) {
            onlineStatus.textContent = window.RADIO_STATE.transmission.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
        }
        
        // Música atual no admin
        const currentTrackAdmin = document.getElementById('currentTrackAdmin');
        if (currentTrackAdmin) {
            currentTrackAdmin.textContent = window.RADIO_STATE.transmission.currentTrack?.name || 'Nenhuma';
        }
        
        // Total de faixas
        const totalTracks = document.getElementById('totalTracks');
        if (totalTracks) {
            const total = this.getTotalTracks();
            totalTracks.textContent = total.toString();
        }
        
        // Tempo online
        const uptime = document.getElementById('uptime');
        if (uptime && window.RADIO_STATE.transmission.startTime) {
            const uptimeMs = Date.now() - window.RADIO_STATE.transmission.startTime;
            uptime.textContent = window.RADIO_UTILS.formatTime(uptimeMs / 1000);
        }
        
        // Botão de transmissão
        const transmissionBtn = document.getElementById('transmissionBtnText');
        if (transmissionBtn) {
            transmissionBtn.textContent = window.RADIO_STATE.transmission.isLive ? 
                '⏸️ PAUSAR TRANSMISSÃO' : '▶️ INICIAR TRANSMISSÃO';
        }
    },
    
    getTotalTracks() {
        let total = 0;
        total += window.RADIO_STATE.library.music.length;
        total += window.RADIO_STATE.library.time.length;
        total += window.RADIO_STATE.library.ads.length;
        
        Object.values(window.RADIO_STATE.library.albums).forEach(album => {
            total += album.length;
        });
        
        return total;
    },
    
    showMessage(message) {
        const nowPlaying = document.getElementById('nowPlaying');
        if (nowPlaying) {
            nowPlaying.textContent = message;
        }
    },
    
    // Métodos públicos
    toggleTransmission() {
        if (window.RADIO_STATE.transmission.isLive) {
            this.stopTransmission();
        } else {
            this.startTransmission();
        }
    },
    
    skipToNext() {
        if (window.RADIO_STATE.transmission.isLive) {
            this.playNext();
        }
    },
    
    setVolume(volume) {
        const normalizedVolume = Math.max(0, Math.min(1, volume));
        window.RADIO_CONFIG.radio.audio.defaultVolume = normalizedVolume;
        
        if (this.audioElement) {
            this.audioElement.volume = normalizedVolume;
        }
        
        window.RADIO_STATE.transmission.volume = normalizedVolume;
        window.RADIO_UTILS.save();
    },
    
    getStatus() {
        return {
            isLive: window.RADIO_STATE.transmission.isLive,
            isPlaying: window.RADIO_STATE.transmission.isPlaying,
            currentTrack: window.RADIO_STATE.transmission.currentTrack,
            totalPlayed: window.RADIO_STATE.stats.totalPlayed,
            totalTracks: this.getTotalTracks()
        };
    }
};

console.log('✅ RadioCore carregado com sucesso!');
