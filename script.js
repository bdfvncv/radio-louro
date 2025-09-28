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
        requestsReceived: 0
    },
    recentTracks: [],
    requests: [],
    schedule: [],
    // Configuração de sincronização com duração real
    startDate: new Date('2025-09-27T00:00:00-03:00').getTime(),
    playlistSequence: [], // Sequência de músicas com durações reais
    totalDuration: 0, // Duração total da sequência
    currentSequenceIndex: -1
};

// Elementos DOM
let elements = {};

// Função para gerar sequência com durações reais
function generatePlaylistSequence() {
    if (radioState.playlists.music.length === 0) return [];
    
    const sequence = [];
    let totalTime = 0;
    
    // Criar sequência de 50 músicas para loop
    for (let i = 0; i < 50; i++) {
        const musicIndex = i % radioState.playlists.music.length;
        const track = radioState.playlists.music[musicIndex];
        
        // Estimar duração (3-5 minutos aleatoriamente se não conhecida)
        const estimatedDuration = track.duration || (180 + Math.random() * 120) * 1000; // 3-5 minutos
        
        sequence.push({
            ...track,
            sequenceIndex: i,
            startTime: totalTime,
            duration: estimatedDuration,
            endTime: totalTime + estimatedDuration
        });
        
        totalTime += estimatedDuration;
    }
    
    radioState.playlistSequence = sequence;
    radioState.totalDuration = totalTime;
    
    console.log(`Sequência gerada: ${sequence.length} músicas, duração total: ${Math.round(totalTime/1000/60)} minutos`);
    return sequence;
}

// Função para encontrar música atual baseada no tempo real
function getCurrentSyncTrack() {
    if (radioState.playlistSequence.length === 0) {
        generatePlaylistSequence();
    }
    
    const now = Date.now();
    const elapsed = now - radioState.startDate;
    
    // Calcular posição no loop
    const loopPosition = elapsed % radioState.totalDuration;
    
    // Encontrar música atual na sequência
    for (let i = 0; i < radioState.playlistSequence.length; i++) {
        const track = radioState.playlistSequence[i];
        
        if (loopPosition >= track.startTime && loopPosition < track.endTime) {
            const trackElapsed = loopPosition - track.startTime;
            
            return {
                track: track,
                position: trackElapsed / 1000, // em segundos
                remaining: (track.duration - trackElapsed) / 1000,
                sequenceIndex: i,
                isNearEnd: (track.duration - trackElapsed) < 5000 // últimos 5 segundos
            };
        }
    }
    
    // Se não encontrou, pegar a primeira
    if (radioState.playlistSequence.length > 0) {
        return {
            track: radioState.playlistSequence[0],
            position: 0,
            remaining: radioState.playlistSequence[0].duration / 1000,
            sequenceIndex: 0,
            isNearEnd: false
        };
    }
    
    return null;
}

// Classe principal da rádio
class RadioManager {
    constructor() {
        this.audioPlayer = null;
        this.syncInterval = null;
        this.timeInterval = null;
        this.currentSyncIndex = -1;
    }

    init() {
        console.log('Iniciando Rádio Supermercado do Louro...');
        
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
            this.addSampleTracks();
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
            elements.skipBtn.addEventListener('click', () => this.sync());
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
            skipTrack.addEventListener('click', () => this.sync());
        }

        const testTime = document.getElementById('adminTestTime');
        if (testTime) {
            testTime.addEventListener('click', () => this.forceTimeAnnouncement());
        }

        const emergencyStop = document.getElementById('adminEmergencyStop');
        if (emergencyStop) {
            emergencyStop.addEventListener('click', () => this.emergencyStop());
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

        // Modal close
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

    addSampleTracks() {
        if (radioState.playlists.music.length === 0) {
            const sampleTracks = [
                { name: 'Música Exemplo 1', artist: 'Artista Demo', url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ' },
                { name: 'Música Exemplo 2', artist: 'Demo Artist', url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ' },
                { name: 'Música Exemplo 3', artist: 'Artista Exemplo', url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ' },
                { name: 'Música Exemplo 4', artist: 'Demo Music', url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ' },
                { name: 'Música Exemplo 5', artist: 'Exemplo Band', url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEZ' }
            ];
            
            radioState.playlists.music = sampleTracks;
            console.log('Músicas de exemplo adicionadas');
        }
    }

    startRadio() {
        radioState.isLive = true;
        radioState.isPlaying = true;
        this.updateLiveStatus();
        
        // Iniciar sincronização
        this.sync();
        
        console.log('Transmissão sincronizada iniciada!');
    }

    // Função principal de sincronização
    sync() {
        const syncData = getCurrentSyncTrack();
        if (!syncData) return;

        const { track, position, index } = syncData;

        // Verificar se mudou de música
        if (this.currentSyncIndex !== index) {
            console.log(`Sincronizando: ${track.name}`);
            
            this.currentSyncIndex = index;
            radioState.currentTrack = track;
            
            this.updateTrackInfo(track);
            this.addToRecentTracks(track);
            this.updateStats();
            
            // Carregar e posicionar áudio
            this.loadTrackAtPosition(track, position);
        }
    }

    loadTrackAtPosition(track, position) {
        if (!this.audioPlayer) return;

        try {
            this.audioPlayer.src = track.url;
            
            this.audioPlayer.addEventListener('loadeddata', () => {
                if (position > 0 && position < this.audioPlayer.duration) {
                    this.audioPlayer.currentTime = position;
                }
                
                if (radioState.isPlaying && radioState.isLive) {
                    this.audioPlayer.play().catch(console.warn);
                }
            }, { once: true });
            
        } catch (error) {
            console.error('Erro ao carregar áudio:', error);
        }
    }

    startTimers() {
        // Sincronizar a cada 10 segundos
        this.syncInterval = setInterval(() => {
            if (radioState.isLive) {
                this.sync();
            }
        }, 10000);

        // Atualizar interface a cada minuto
        this.timeInterval = setInterval(() => {
            this.updateCurrentTime();
            this.updateCurrentProgram();
            this.updateScheduleDisplay();
        }, 60000);

        this.updateCurrentTime();
    }

    // Métodos da interface (inalterados)
    togglePlayback() {
        if (!this.audioPlayer) return;

        if (radioState.isPlaying) {
            this.audioPlayer.pause();
            radioState.isPlaying = false;
            radioState.isLive = false;
            elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
        } else {
            radioState.isPlaying = true;
            radioState.isLive = true;
            elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
            this.sync();
        }

        this.updateLiveStatus();
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

        if (elements.equalizer) {
            elements.equalizer.style.display = radioState.isPlaying ? 'flex' : 'none';
        }
    }

    updateTimeDisplay() {
        if (!this.audioPlayer || !elements.trackTime) return;

        const current = this.audioPlayer.currentTime || 0;
        const duration = this.audioPlayer.duration || 0;

        elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    updateTrackInfo(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name || 'Conectando à transmissão...';
        }
        
        if (elements.trackArtist) {
            elements.trackArtist.textContent = track.artist || 'Rádio Supermercado do Louro';
        }
        
        if (elements.trackType) {
            elements.trackType.textContent = 'Música';
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

    updateCurrentTime() {
        if (elements.currentTime) {
            const now = new Date();
            elements.currentTime.textContent = now.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // Métodos administrativos
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
        
        elements.requestForm?.reset();
        
        alert('Pedido enviado com sucesso! Obrigado pela participação!');
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
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);

        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');

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

    forceTimeAnnouncement() {
        if (radioState.playlists.time.length > 0) {
            console.log('Forçando hora certa manualmente');
            const timeTrack = radioState.playlists.time[0];
            this.currentSyncIndex = -1; // Forçar mudança
            this.loadTrackAtPosition(timeTrack, 0);
            this.updateTrackInfo(timeTrack);
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
                this.sync();
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
        if (this.syncInterval) clearInterval(this.syncInterval);
        if (this.preciseSyncInterval) clearInterval(this.preciseSyncInterval);
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
        if (radioManager) {
            radioManager.updateAdminStatus();
            radioManager.updateAdminStats();
            radioManager.updateContentLists();
            radioManager.updateAdminRequestsList();
        }
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

        const files = Array.from(input.files);
        
        for (const file of files) {
            const fakeUrl = URL.createObjectURL(file);
            const trackData = {
                name: file.name.replace(/\.[^/.]+$/, ""),
                artist: 'Upload Local',
                url: fakeUrl,
                uploadedAt: new Date().toISOString(),
                size: file.size
            };

            radioState.playlists[category].push(trackData);
        }

        radioManager.saveData();
        radioManager.updateContentLists();
        
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
