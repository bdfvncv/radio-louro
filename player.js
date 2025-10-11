// Gerenciador do Player da Rádio
class RadioPlayer {
    constructor() {
        this.audioPlayer = document.getElementById('audioPlayer');
        this.currentTimeEl = document.getElementById('currentTime');
        this.countdownEl = document.getElementById('countdown');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.currentProgramEl = document.getElementById('currentProgram');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.volumeControl = document.getElementById('volumeControl');
        
        this.currentHour = -1;
        this.currentProgram = null;
        this.subscription = null;
        this.fallbackAudio = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.startClock();
        await this.loadCurrentProgram();
        this.setupRealtimeSubscription();
        this.restoreVolume();
    }

    setupEventListeners() {
        // Botão de sincronização
        document.getElementById('syncBtn').addEventListener('click', () => {
            this.syncNow();
        });

        // Controle de volume
        document.getElementById('volumeBtn').addEventListener('click', () => {
            this.toggleVolumeControl();
        });

        this.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(e.target.value);
        });

        // Eventos do player de áudio
        this.audioPlayer.addEventListener('play', () => {
            this.updateStatus('playing', '🔴 Ao Vivo');
        });

        this.audioPlayer.addEventListener('pause', () => {
            this.updateStatus('paused', '⏸️ Pausado');
        });

        this.audioPlayer.addEventListener('error', (e) => {
            this.handleAudioError(e);
        });

        this.audioPlayer.addEventListener('ended', () => {
            this.handleAudioEnded();
        });

        this.audioPlayer.addEventListener('loadstart', () => {
            this.updateStatus('loading', '⏳ Carregando...');
        });

        this.audioPlayer.addEventListener('canplay', () => {
            this.updateStatus('ready', '✅ Pronto');
            if (this.audioPlayer.paused) {
                this.audioPlayer.play().catch(err => {
                    console.log('Autoplay bloqueado:', err);
                    this.updateStatus('ready', '▶️ Clique para reproduzir');
                });
            }
        });
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            
            this.currentTimeEl.textContent = `${hours}:${minutes}:${seconds}`;
            
            // Calcula o tempo até a próxima hora cheia
            const minutesLeft = 59 - now.getMinutes();
            const secondsLeft = 59 - now.getSeconds();
            this.countdownEl.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
            
            // Verifica se mudou a hora
            const currentHour = now.getHours();
            if (currentHour !== this.currentHour) {
                this.currentHour = currentHour;
                this.loadCurrentProgram();
            }
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    async loadCurrentProgram() {
        const hour = this.currentHour === -1 ? new Date().getHours() : this.currentHour;
        this.currentHour = hour;
        
        this.updateStatus('loading', '🔄 Buscando programação...');
        
        const program = await SupabaseService.getHourProgram(hour);
        
        if (program && program.url_audio) {
            this.currentProgram = program;
            this.playAudio(program.url_audio);
            this.currentProgramEl.textContent = `Programação das ${String(hour).padStart(2, '0')}:00`;
            this.showNotification(`🎵 Iniciando programação das ${String(hour).padStart(2, '0')}:00`);
        } else {
            this.currentProgramEl.textContent = 'Sem programação específica para este horário';
            this.playFallbackAudio();
        }
    }

    playAudio(url) {
        if (!url) {
            this.playFallbackAudio();
            return;
        }

        this.retryCount = 0;
        this.audioPlayer.src = url;
        this.audioPlayer.load();
        
        // Tenta reproduzir automaticamente
        const playPromise = this.audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('Autoplay bloqueado:', error);
                this.updateStatus('ready', '▶️ Clique no player para iniciar');
            });
        }
    }

    playFallbackAudio() {
        // URL de áudio padrão quando não há programação
        const fallbackUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        
        this.updateStatus('playing', '🎵 Música ambiente');
        this.currentProgramEl.textContent = 'Reproduzindo playlist padrão';
        this.playAudio(fallbackUrl);
    }

    handleAudioError(error) {
        console.error('Erro no áudio:', error);
        this.updateStatus('error', '❌ Erro ao carregar áudio');
        
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => {
                this.updateStatus('loading', `🔄 Tentando novamente (${this.retryCount}/${this.maxRetries})...`);
                this.audioPlayer.load();
            }, 3000);
        } else {
            this.playFallbackAudio();
        }
    }

    handleAudioEnded() {
        // Quando o áudio terminar, toca o fallback ou faz loop
        if (this.currentProgram && this.currentProgram.url_audio) {
            // Recarrega o mesmo áudio (loop)
            this.audioPlayer.play();
        } else {
            this.playFallbackAudio();
        }
    }

    setupRealtimeSubscription() {
        this.subscription = SupabaseService.subscribeToChanges((payload) => {
            console.log('Mudança detectada:', payload);
            
            if (payload.new && payload.new.hour === this.currentHour) {
                if (payload.new.enabled && payload.new.url_audio) {
                    this.showNotification('📡 Programação atualizada!');
                    this.currentProgram = payload.new;
                    this.playAudio(payload.new.url_audio);
                } else if (!payload.new.enabled) {
                    this.showNotification('⚠️ Programação desativada');
                    this.playFallbackAudio();
                }
            }
        });
    }

    syncNow() {
        this.showNotification('🔄 Sincronizando...');
        this.loadCurrentProgram();
    }

    toggleVolumeControl() {
        const isVisible = this.volumeControl.style.display === 'flex';
        this.volumeControl.style.display = isVisible ? 'none' : 'flex';
    }

    setVolume(value) {
        this.audioPlayer.volume = value / 100;
        this.volumeValue.textContent = `${value}%`;
        localStorage.setItem('radioVolume', value);
    }

    restoreVolume() {
        const savedVolume = localStorage.getItem('radioVolume') || 50;
        this.volumeSlider.value = savedVolume;
        this.setVolume(savedVolume);
    }

    updateStatus(status, text) {
        this.statusIndicator.className = `status-indicator ${status}`;
        this.statusText.textContent = text;
    }

    showNotification(message) {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('p');
        notification.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
        notification.style.animation = 'fadeIn 0.5s';
        
        notifications.insertBefore(notification, notifications.firstChild);
        
        // Remove notificações antigas (mantém apenas as últimas 5)
        while (notifications.children.length > 5) {
            notifications.removeChild(notifications.lastChild);
        }
    }

    destroy() {
        if (this.subscription) {
            SupabaseService.unsubscribe(this.subscription);
        }
    }
}

// Inicializar o player quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    const player = new RadioPlayer();
    
    // Cleanup ao sair da página
    window.addEventListener('beforeunload', () => {
        player.destroy();
    });
});