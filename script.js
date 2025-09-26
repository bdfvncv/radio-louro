// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado global da rádio
let radioState = {
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    volume: 70,
    playlists: {
        music: [],
        announcements: [],
        time: [],
        jingles: []
    },
    stats: {
        tracksPlayed: 0,
        requestsReceived: 0,
        listenersCount: 127
    },
    recentTracks: [],
    requests: [],
    schedule: [],
    tracksSinceAnnouncement: 0,
    tracksSinceTime: 0
};

// Elementos DOM
let elements = {};

// Classe principal da rádio
class RadioManager {
    constructor() {
        this.audioPlayer = null;
        this.playInterval = null;
        this.timeInterval = null;
    }

    init() {
        console.log('Iniciando Rádio Supermercado do Louro...');
        
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
            this.startRadio();
            this.startTimers();
            
            console.log('Rádio inicializada com sucesso!');
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
            'programDescription', 'currentTime', 'listenerCount',
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
        this.audioPlayer.addEventListener('ended', () => this.playNext());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateTimeDisplay());
        this.audioPlayer.addEventListener('error', () => this.handleAudioError());
        
        console.log('Áudio configurado');
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

        // Request form
        if (elements.requestForm) {
            elements.requestForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitRequest();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'a') {
                e.preventDefault();
                this.showAdminModal();
            }
        });

        console.log('Event listeners configurados');
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
        // Verificar se deve tocar hora certa
        const now = new Date();
        if (now.getMinutes() === 0 && radioState.tracksSinceTime > 0 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTime = 0;
            return this.getRandomFromPlaylist(radioState.playlists.time, 'time');
        }

        // Verificar se deve tocar aviso
        if (radioState.tracksSinceAnnouncement >= 5 && radioState.playlists.announcements.length > 0) {
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
            this.simulateListeners();
        }, 60000);

        this.updateCurrentTime();
        this.simulateListeners();
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

    simulateListeners() {
        const baseCount = 120;
        const variation = Math.floor(Math.random() * 20) - 10;
        radioState.stats.listenersCount = Math.max(baseCount + variation, 50);

        if (elements.listenerCount) {
            elements.listenerCount.textContent = radioState.stats.listenersCount;
        }
    }

    showRequestModal() {
        if (elements.requestModal) {
            elements.requestModal.classList.add('show');
        }
    }

    submitRequest() {
        const requesterName = document.getElementById('requesterName')?.value;
        const songRequest = document.getElementById('songRequest')?.value;
        const dedicateTo = document.getElementById('dedicateTo')?.value;
        const message = document.getElementById('message')?.value;

        if (!requesterName || !songRequest) {
            alert('Por favor, preencha seu nome e o pedido musical.');
            return;
        }

        const request = {
            requesterName,
            songRequest,
            dedicateTo,
            message,
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
    } else {
        alert('Senha incorreta!');
    }
};

window.showAdminPanel = function() {
    const panel = elements.adminPanel || document.getElementById('adminPanel');
    if (panel) {
        panel.classList.remove('hidden');
    }
};

window.closeAdminPanel = function() {
    const panel = elements.adminPanel || document.getElementById('adminPanel');
    if (panel) {
        panel.classList.add('hidden');
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
