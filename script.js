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
    playHistory: [],
    playCount: 0,
    
    // Bibliotecas de conteúdo
    content: {
        music: [],
        jingles: [],
        time: [],
        programs: {
            morning: [],
            afternoon: [],
            evening: [],
            late: []
        }
    },
    
    // Configurações de programação
    schedule: {
        morning: { type: 'mixed', jingleFreq: 15 },
        afternoon: { type: 'mixed', jingleFreq: 10 },
        evening: { type: 'mixed', jingleFreq: 20 },
        late: { type: 'music', jingleFreq: 30 }
    },
    
    // Estatísticas
    stats: {
        totalPlayed: 0,
        popularTracks: {},
        requests: []
    }
};

// Cache de elementos DOM
let elements = {};

// Classe principal da rádio
class RadioLive24 {
    constructor() {
        this.currentPeriod = 'morning';
        this.programTimer = null;
        this.uptimeTimer = null;
        this.playbackQueue = [];
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        try {
            this.initElements();
            this.loadStoredData();
            this.setupEventListeners();
            this.updateUI();
            this.startUptime();
            
            console.log('Rádio inicializada com sucesso!');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Erro na inicialização:', error);
            this.showError('Erro na inicialização da rádio');
        }
    }
    
    initElements() {
        const elementIds = [
            'audioPlayer', 'playPauseBtn', 'volumeSlider', 'volumeValue',
            'albumCover', 'trackCover', 'albumTitle', 'currentTrack',
            'trackTime', 'broadcastStatus', 'playCount',
            'scheduleList', 'recentTracks', 'requestsList', 'adminBtn',
            'playerMode', 'adminMode', 'passwordModal', 'adminPassword'
        ];
        
        elements = {};
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                console.warn(`Elemento não encontrado: ${id}`);
            }
        });
        
        // Verificar elementos críticos
        if (!elements.audioPlayer) {
            throw new Error('Player de áudio não encontrado');
        }
    }
    
    loadStoredData() {
        try {
            const stored = localStorage.getItem('radioState');
            if (stored) {
                const data = JSON.parse(stored);
                radioState = { ...radioState, ...data };
            }
        } catch (error) {
            console.warn('Erro ao carregar dados:', error);
        }
    }
    
    saveData() {
        try {
            localStorage.setItem('radioState', JSON.stringify(radioState));
        } catch (error) {
            console.warn('Erro ao salvar dados:', error);
        }
    }
    
    setupEventListeners() {
        try {
            // Player controls
            if (elements.playPauseBtn) {
                elements.playPauseBtn.addEventListener('click', () => this.togglePlayback());
            }
            
            if (elements.volumeSlider) {
                elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
            }
            
            // Audio events
            if (elements.audioPlayer) {
                elements.audioPlayer.addEventListener('ended', () => this.playNext());
                elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
                elements.audioPlayer.addEventListener('error', (e) => this.handleAudioError(e));
                elements.audioPlayer.addEventListener('canplay', () => this.onTrackReady());
            }
            
            // Admin button
            if (elements.adminBtn) {
                elements.adminBtn.addEventListener('click', () => this.openAdminModal());
            }
            
            // Info tabs
            document.querySelectorAll('.info-tab').forEach(tab => {
                tab.addEventListener('click', (e) => this.switchInfoTab(e.target.dataset.tab));
            });
            
            // Admin tabs
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.switchAdminTab(e.target.dataset.tab));
            });
            
            // Request form
            const sendRequestBtn = document.getElementById('sendRequest');
            if (sendRequestBtn) {
                sendRequestBtn.addEventListener('click', () => this.sendRequest());
            }
            
            // Admin password
            if (elements.adminPassword) {
                elements.adminPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') this.checkAdminPassword();
                });
            }
            
            // Back to player
            const backToPlayer = document.getElementById('backToPlayerBtn');
            if (backToPlayer) {
                backToPlayer.addEventListener('click', () => this.showPlayer());
            }
            
        } catch (error) {
            console.error('Erro ao configurar eventos:', error);
        }
    }
    
    updateUI() {
        // Configurar volume inicial
        if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
            elements.audioPlayer.volume = radioState.volume / 100;
            elements.volumeSlider.value = radioState.volume;
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        // Atualizar informações
        this.updateCurrentPeriod();
        this.updatePlayCount();
        this.updateScheduleDisplay();
        this.updateRecentTracks();
    }
    
    togglePlayback() {
        try {
            if (!elements.audioPlayer) return;
            
            if (!radioState.isLive) {
                this.startBroadcast();
            } else {
                if (radioState.isPlaying) {
                    elements.audioPlayer.pause();
                    radioState.isPlaying = false;
                } else {
                    if (radioState.currentTrack) {
                        elements.audioPlayer.play();
                    } else {
                        this.playNext();
                    }
                    radioState.isPlaying = true;
                }
            }
            
            this.updatePlayPauseButton();
            
        } catch (error) {
            console.error('Erro no toggle playback:', error);
        }
    }
    
    startBroadcast() {
        if (radioState.isLive) return;
        
        radioState.isLive = true;
        this.updateBroadcastStatus('🔴 AO VIVO');
        
        this.updateCurrentPeriod();
        this.playNext();
        
        // Timer para verificações periódicas
        this.programTimer = setInterval(() => {
            this.updateCurrentPeriod();
        }, 30000);
        
        console.log('Transmissão iniciada');
    }
    
    playNext() {
        try {
            const nextTrack = this.getNextTrack();
            
            if (!nextTrack) {
                if (elements.currentTrack) {
                    elements.currentTrack.textContent = 'Nenhuma música disponível';
                }
                return;
            }
            
            radioState.currentTrack = nextTrack;
            
            if (elements.audioPlayer) {
                elements.audioPlayer.src = nextTrack.url;
                elements.audioPlayer.volume = radioState.volume / 100;
                
                if (radioState.isLive) {
                    elements.audioPlayer.play().catch(e => {
                        console.log('Autoplay bloqueado:', e.message);
                        this.showAutoplayPrompt();
                    });
                }
            }
            
            this.updateTrackInfo(nextTrack);
            this.addToHistory(nextTrack);
            
        } catch (error) {
            console.error('Erro ao reproduzir:', error);
        }
    }
    
    getNextTrack() {
        const music = radioState.content.music;
        if (music.length === 0) return null;
        
        return music[Math.floor(Math.random() * music.length)];
    }
    
    updateTrackInfo(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = this.formatTrackName(track.name);
        }
        if (elements.albumTitle) {
            elements.albumTitle.textContent = '🎵 Música';
        }
    }
    
    formatTrackName(filename) {
        return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
    }
    
    addToHistory(track) {
        const historyEntry = {
            ...track,
            playedAt: new Date().toISOString()
        };
        
        radioState.playHistory.push(historyEntry);
        radioState.stats.totalPlayed++;
        
        // Manter apenas últimas 20 entradas
        if (radioState.playHistory.length > 20) {
            radioState.playHistory = radioState.playHistory.slice(-20);
        }
        
        this.updateRecentTracks();
        this.updatePlayCount();
        this.saveData();
    }
    
    updateCurrentPeriod() {
        const hour = new Date().getHours();
        let newPeriod;
        
        if (hour >= 6 && hour < 12) newPeriod = 'morning';
        else if (hour >= 12 && hour < 18) newPeriod = 'afternoon';
        else if (hour >= 18 && hour < 24) newPeriod = 'evening';
        else newPeriod = 'late';
        
        this.currentPeriod = newPeriod;
    }
    
    updatePlayPauseButton() {
        if (!elements.playPauseBtn) return;
        
        const playIcon = elements.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = elements.playPauseBtn.querySelector('.pause-icon');
        
        if (radioState.isPlaying && radioState.isLive) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
        } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
        }
    }
    
    setVolume(value) {
        radioState.volume = parseInt(value);
        
        if (elements.audioPlayer) {
            elements.audioPlayer.volume = radioState.volume / 100;
        }
        if (elements.volumeValue) {
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        this.saveData();
    }
    
    updateTime() {
        if (!elements.trackTime || !elements.audioPlayer) return;
        
        try {
            const current = elements.audioPlayer.currentTime || 0;
            const duration = elements.audioPlayer.duration || 0;
            
            elements.trackTime.textContent = 
                `${this.formatTime(current)} / ${this.formatTime(duration)}`;
        } catch (error) {
            console.error('Erro ao atualizar tempo:', error);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    onTrackReady() {
        radioState.isPlaying = true;
        this.updatePlayPauseButton();
    }
    
    updatePlayCount() {
        if (elements.playCount) {
            elements.playCount.textContent = `Faixas: ${radioState.stats.totalPlayed}`;
        }
    }
    
    handleAudioError(error) {
        console.error('Erro no áudio:', error);
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 3000);
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <span>🔊 Clique para ativar o áudio</span>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        prompt.addEventListener('click', () => {
            if (elements.audioPlayer && radioState.isLive) {
                elements.audioPlayer.play();
            }
            prompt.remove();
        });
        
        setTimeout(() => prompt.remove(), 10000);
    }
    
    updateBroadcastStatus(status) {
        if (elements.broadcastStatus) {
            elements.broadcastStatus.textContent = status;
        }
    }
    
    startUptime() {
        // Data de início da rádio: 27/09/2025
        const radioStartDate = new Date('2025-09-27T00:00:00');
        
        this.uptimeTimer = setInterval(() => {
            const now = new Date();
            const uptime = Math.floor((now - radioStartDate) / 1000);
            
            // Se ainda não chegou na data de início
            if (uptime < 0) {
                const timeToStart = Math.abs(uptime);
                const days = Math.floor(timeToStart / (24 * 3600));
                const hours = Math.floor((timeToStart % (24 * 3600)) / 3600);
                const minutes = Math.floor((timeToStart % 3600) / 60);
                
                const uptimeStr = `Inicia em: ${days}d ${hours}h ${minutes}m`;
                
                const uptimeElement = document.getElementById('uptime');
                if (uptimeElement) {
                    uptimeElement.textContent = uptimeStr;
                }
                return;
            }
            
            const days = Math.floor(uptime / (24 * 3600));
            const hours = Math.floor((uptime % (24 * 3600)) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            let uptimeStr;
            if (days > 0) {
                uptimeStr = `${days}d ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                uptimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) {
                uptimeElement.textContent = uptimeStr;
            }
        }, 1000);
    }
    
    // Métodos de interface
    switchInfoTab(tabName) {
        // Remove active de todas as abas
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.info-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Ativa aba selecionada
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-section`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        // Atualizar conteúdo se necessário
        if (tabName === 'recent') {
            this.updateRecentTracks();
        } else if (tabName === 'schedule') {
            this.updateScheduleDisplay();
        } else if (tabName === 'requests') {
            this.updateRequestsList();
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
        
        if (tabName === 'content') {
            this.updateContentLibrary();
        } else if (tabName === 'reports') {
            this.updateReports();
        }
    }
    
    sendRequest() {
        const requestInput = document.getElementById('requestSong');
        if (!requestInput || !requestInput.value.trim()) {
            alert('Digite o nome da música!');
            return;
        }
        
        const request = {
            song: requestInput.value.trim(),
            timestamp: new Date().toISOString(),
            id: Date.now()
        };
        
        radioState.stats.requests.push(request);
        this.saveData();
        
        requestInput.value = '';
        this.updateRequestsList();
        
        alert('Pedido enviado com sucesso!');
    }
    
    updateRequestsList() {
        const requestsList = document.getElementById('requestsList');
        if (!requestsList) return;
        
        if (radioState.stats.requests.length === 0) {
            requestsList.innerHTML = '<p>Nenhum pedido ainda hoje.</p>';
            return;
        }
        
        const recent = radioState.stats.requests.slice(-10).reverse();
        requestsList.innerHTML = recent.map(request => `
            <div class="request-item">
                <span class="request-song">${request.song}</span>
                <span class="request-time">${new Date(request.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}</span>
            </div>
        `).join('');
    }
    
    updateScheduleDisplay() {
        if (!elements.scheduleList) return;
        
        const scheduleItems = [
            { time: '06:00 - 12:00', program: '🌅 Manhã Musical', current: this.currentPeriod === 'morning' },
            { time: '12:00 - 18:00', program: '☀️ Tarde Animada', current: this.currentPeriod === 'afternoon' },
            { time: '18:00 - 00:00', program: '🌆 Noite Especial', current: this.currentPeriod === 'evening' },
            { time: '00:00 - 06:00', program: '🌙 Madrugada Suave', current: this.currentPeriod === 'late' }
        ];
        
        elements.scheduleList.innerHTML = scheduleItems.map(item => `
            <div class="schedule-item ${item.current ? 'current' : ''}">
                <span class="schedule-time">${item.time}</span>
                <span class="schedule-program">${item.program}</span>
            </div>
        `).join('');
    }
    
    updateRecentTracks() {
        if (!elements.recentTracks) return;
        
        const recent = radioState.playHistory.slice(-5).reverse();
        
        if (recent.length === 0) {
            elements.recentTracks.innerHTML = '<p>Nenhuma música tocada ainda.</p>';
            return;
        }
        
        elements.recentTracks.innerHTML = recent.map(track => `
            <div class="recent-track">
                <span class="track-name">${this.formatTrackName(track.name)}</span>
                <span class="track-time">${new Date(track.playedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}</span>
            </div>
        `).join('');
    }
    
    // Métodos administrativos
    openAdminModal() {
        this.showModal('passwordModal');
    }
    
    checkAdminPassword() {
        const password = elements.adminPassword?.value;
        if (password === 'admin123') {
            this.closeModal('passwordModal');
            this.showAdmin();
        } else {
            alert('Senha incorreta!');
            if (elements.adminPassword) {
                elements.adminPassword.value = '';
            }
        }
    }
    
    showAdmin() {
        if (elements.playerMode) elements.playerMode.style.display = 'none';
        if (elements.adminMode) elements.adminMode.style.display = 'block';
        
        this.updateContentLibrary();
        this.updateReports();
    }
    
    showPlayer() {
        if (elements.playerMode) elements.playerMode.style.display = 'flex';
        if (elements.adminMode) elements.adminMode.style.display = 'none';
    }
    
    updateContentLibrary() {
        this.updateLibraryCount('music', radioState.content.music);
        this.updateLibraryCount('jingle', radioState.content.jingles);
        this.updateLibraryCount('time', radioState.content.time);
        
        const totalPrograms = Object.values(radioState.content.programs)
            .reduce((total, programs) => total + programs.length, 0);
        this.updateLibraryCount('program', { length: totalPrograms });
        
        this.updateLibraryList('musicList', radioState.content.music);
        this.updateLibraryList('jingleList', radioState.content.jingles);
        this.updateLibraryList('timeList', radioState.content.time);
    }
    
    updateLibraryCount(type, content) {
        const countElement = document.getElementById(`${type}Count`);
        if (countElement) {
            countElement.textContent = content.length || 0;
        }
    }
    
    updateLibraryList(listId, content) {
        const listElement = document.getElementById(listId);
        if (!listElement) return;
        
        if (content.length === 0) {
            listElement.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
            return;
        }
        
        listElement.innerHTML = content.map((item, index) => `
            <div class="file-item">
                <span class="file-name">${this.formatTrackName(item.name)}</span>
                <button onclick="deleteFile('${listId.replace('List', '')}', ${index})" class="btn-danger btn-small">🗑️</button>
            </div>
        `).join('');
    }
    
    updateReports() {
        this.updateTopTracks();
        this.updateStats();
    }
    
    updateTopTracks() {
        const topTracksElement = document.getElementById('topTracks');
        if (!topTracksElement) return;
        
        if (Object.keys(radioState.stats.popularTracks).length === 0) {
            topTracksElement.innerHTML = '<p>Nenhuma estatística ainda.</p>';
            return;
        }
        
        const sorted = Object.entries(radioState.stats.popularTracks)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        topTracksElement.innerHTML = sorted.map(([track, count]) => `
            <div class="report-item">
                <span class="track-name">${this.formatTrackName(track)}</span>
                <span class="play-count">${count}x</span>
            </div>
        `).join('');
    }
    
    updateStats() {
        const totalPlayedElement = document.getElementById('totalPlayed');
        if (totalPlayedElement) {
            totalPlayedElement.textContent = radioState.stats.totalPlayed;
        }
        
        const serverStatusElement = document.getElementById('serverStatus');
        if (serverStatusElement) {
            serverStatusElement.textContent = radioState.isLive ? '🟢 Online' : '🔴 Offline';
        }
    }
    
    // Métodos utilitários
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    showError(message) {
        console.error(message);
        alert(message);
    }
}

// Classe para gerenciar uploads
class ContentUploader {
    constructor(radioSystem) {
        this.radio = radioSystem;
    }
    
    async uploadContent(type) {
        const fileInputs = {
            music: 'musicUpload',
            jingles: 'jingleUpload',
            time: 'timeUpload',
            programs: 'programUpload'
        };
        
        const fileInput = document.getElementById(fileInputs[type]);
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        const files = Array.from(fileInput.files);
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const uploadedFile = await this.uploadToCloudinary(file, type);
                this.addToLibrary(uploadedFile, type);
            }
            
            fileInput.value = '';
            this.radio.saveData();
            this.radio.updateContentLibrary();
            
            alert(`${files.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro no upload: ' + error.message);
        }
    }
    
    async uploadToCloudinary(file, type) {
        const formData = new FormData();
        
        let folder = type;
        if (type === 'programs') {
            const programSelect = document.getElementById('programSelect');
            folder = `programs/${programSelect ? programSelect.value : 'general'}`;
        }
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString()
        };
    }
    
    addToLibrary(file, type) {
        if (type === 'programs') {
            const programSelect = document.getElementById('programSelect');
            const period = programSelect ? programSelect.value : 'morning';
            radioState.content.programs[period].push(file);
        } else {
            radioState.content[type].push(file);
        }
    }
}

// Funções globais
let radioSystem;
let uploader;

function uploadContent(type) {
    if (uploader) {
        uploader.uploadContent(type);
    }
}

function checkAdminPassword() {
    if (radioSystem) {
        radioSystem.checkAdminPassword();
    }
}

function closeModal(modalId) {
    if (radioSystem) {
        radioSystem.closeModal(modalId);
    }
}

function deleteFile(type, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.content[type].splice(index, 1);
    if (radioSystem) {
        radioSystem.saveData();
        radioSystem.updateContentLibrary();
    }
    alert('Arquivo excluído com sucesso!');
}

// Inicialização
function initRadioSystem() {
    try {
        console.log('Inicializando sistema...');
        radioSystem = new RadioLive24();
        uploader = new ContentUploader(radioSystem);
        
        console.log('Sistema inicializado com sucesso!');
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        setTimeout(initRadioSystem, 2000);
    }
}

// Inicialização quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRadioSystem);
} else {
    initRadioSystem();
}

console.log('Script carregado!');
