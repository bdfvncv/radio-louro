// Configurações Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    baseUrl: 'https://res.cloudinary.com/dygbrcrr6'
};

// Estado Global da Rádio
class RadioState {
    constructor() {
        this.currentPlaylist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.musicCount = 0;
        this.timeCount = 0;
        this.adsCount = 0;
        this.playStats = JSON.parse(localStorage.getItem('playStats') || '{}');
        this.activeAlbum = localStorage.getItem('activeAlbum') || null;
        this.startTime = new Date().toLocaleTimeString();
        this.audioContext = null;
        this.analyser = null;
        
        // Playlists por categoria com músicas de demonstração
        this.playlists = {
            music: [
                {
                    id: 'demo1',
                    name: 'Música Demo 1.mp3',
                    url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                    category: 'music',
                    plays: 0
                },
                {
                    id: 'demo2', 
                    name: 'Música Demo 2.mp3',
                    url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                    category: 'music',
                    plays: 0
                }
            ],
            time: [
                {
                    id: 'time1',
                    name: 'Hora Certa.mp3',
                    url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                    category: 'time',
                    plays: 0
                }
            ],
            ads: [
                {
                    id: 'ad1',
                    name: 'Aviso Supermercado.mp3',
                    url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                    category: 'ads',
                    plays: 0
                }
            ],
            albums: {
                natal: [],
                pascoa: [],
                saojoao: [],
                carnaval: []
            }
        };
        
        this.albumInfo = {
            natal: {
                name: 'Especial Natal',
                image: 'https://via.placeholder.com/300x300/e74c3c/ffffff?text=🎄+Natal'
            },
            pascoa: {
                name: 'Especial Páscoa',
                image: 'https://via.placeholder.com/300x300/f39c12/ffffff?text=🐰+Páscoa'
            },
            saojoao: {
                name: 'Especial São João',
                image: 'https://via.placeholder.com/300x300/27ae60/ffffff?text=🎪+São+João'
            },
            carnaval: {
                name: 'Especial Carnaval',
                image: 'https://via.placeholder.com/300x300/9b59b6/ffffff?text=🎭+Carnaval'
            }
        };
        
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        const savedPlaylists = localStorage.getItem('radioPlaylists');
        if (savedPlaylists) {
            try {
                const parsed = JSON.parse(savedPlaylists);
                // Mescla com as músicas demo se não houver músicas salvas
                if (parsed.music && parsed.music.length > 0) {
                    this.playlists = parsed;
                }
            } catch (e) {
                console.warn('Erro ao carregar playlists salvas:', e);
            }
        }
    }
    
    saveToStorage() {
        localStorage.setItem('radioPlaylists', JSON.stringify(this.playlists));
        localStorage.setItem('playStats', JSON.stringify(this.playStats));
    }
    
    addToPlaylist(category, files) {
        if (category === 'album') return;
        
        files.forEach(file => {
            const trackInfo = {
                id: Date.now() + Math.random(),
                name: file.name,
                url: file.url || URL.createObjectURL(file),
                category: category,
                plays: 0
            };
            this.playlists[category].push(trackInfo);
        });
        
        this.saveToStorage();
        this.updatePlaylist();
    }
    
    addToAlbum(albumName, files) {
        files.forEach(file => {
            const trackInfo = {
                id: Date.now() + Math.random(),
                name: file.name,
                url: file.url || URL.createObjectURL(file),
                category: 'album',
                album: albumName,
                plays: 0
            };
            this.playlists.albums[albumName].push(trackInfo);
        });
        
        this.saveToStorage();
        this.updatePlaylist();
    }
    
    updatePlaylist() {
        this.currentPlaylist = [];
        
        // Adiciona músicas principais
        this.currentPlaylist.push(...this.playlists.music);
        
        // Adiciona músicas do álbum ativo
        if (this.activeAlbum && this.playlists.albums[this.activeAlbum]) {
            this.currentPlaylist.push(...this.playlists.albums[this.activeAlbum]);
        }
        
        // Embaralha a playlist apenas se houver músicas
        if (this.currentPlaylist.length > 0) {
            this.shuffleArray(this.currentPlaylist);
        }
        
        this.updateUI();
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    getNextTrack() {
        // Verifica se há músicas disponíveis
        if (this.currentPlaylist.length === 0) {
            console.warn('Nenhuma música na playlist atual');
            return null;
        }
        
        let nextTrack = null;
        
        // Lógica para intercalar músicas, hora certa e avisos
        if (this.musicCount > 0 && this.musicCount % 3 === 0 && this.playlists.time.length > 0) {
            // A cada 3 músicas, toca hora certa
            nextTrack = this.playlists.time[this.timeCount % this.playlists.time.length];
            this.timeCount++;
        } else if (this.musicCount > 0 && this.musicCount % 6 === 0 && this.playlists.ads.length > 0) {
            // A cada 6 músicas, toca avisos
            nextTrack = this.playlists.ads[this.adsCount % this.playlists.ads.length];
            this.adsCount++;
        } else {
            // Toca música normal
            nextTrack = this.currentPlaylist[this.currentIndex % this.currentPlaylist.length];
            this.currentIndex++;
            this.musicCount++;
        }
        
        // Atualiza estatísticas
        if (nextTrack) {
            this.playStats[nextTrack.id] = (this.playStats[nextTrack.id] || 0) + 1;
            nextTrack.plays = this.playStats[nextTrack.id];
            this.saveToStorage();
        }
        
        return nextTrack;
    }
    
    setActiveAlbum(albumName) {
        this.activeAlbum = albumName;
        localStorage.setItem('activeAlbum', albumName);
        this.updatePlaylist();
        this.updateAlbumDisplay();
    }
    
    disableAlbum() {
        this.activeAlbum = null;
        localStorage.removeItem('activeAlbum');
        this.updatePlaylist();
        this.updateAlbumDisplay();
    }
    
    updateAlbumDisplay() {
        const albumImage = document.getElementById('album-image');
        const albumName = document.getElementById('album-name');
        
        if (this.activeAlbum && this.albumInfo[this.activeAlbum]) {
            albumImage.src = this.albumInfo[this.activeAlbum].image;
            albumName.textContent = this.albumInfo[this.activeAlbum].name;
        } else {
            albumImage.src = 'https://via.placeholder.com/300x300/333333/ffffff?text=Rádio+Louro';
            albumName.textContent = 'Programação Geral';
        }
    }
    
    updateUI() {
        const totalSongs = this.currentPlaylist.length + this.playlists.time.length + this.playlists.ads.length;
        document.getElementById('music-count').textContent = totalSongs;
        document.getElementById('start-time').textContent = this.startTime;
    }
    
    removeFile(category, fileId) {
        if (category === 'album') return;
        
        this.playlists[category] = this.playlists[category].filter(file => file.id !== fileId);
        delete this.playStats[fileId];
        this.saveToStorage();
        this.updatePlaylist();
        this.updateFilesList();
    }
    
    resetStats() {
        this.playStats = {};
        this.saveToStorage();
        this.updateReports();
        showNotification('Estatísticas resetadas!', 'success');
    }
    
    updateFilesList() {
        const categories = ['music', 'time', 'ads'];
        
        categories.forEach(category => {
            const container = document.getElementById(`${category}-files`);
            if (!container) return;
            
            container.innerHTML = '';
            
            this.playlists[category].forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span>${file.name}</span>
                    <button class="delete-file-btn" onclick="radioState.removeFile('${category}', '${file.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                container.appendChild(fileItem);
            });
        });
    }
    
    updateReports() {
        const reportContainer = document.getElementById('play-report');
        if (!reportContainer) return;
        
        reportContainer.innerHTML = '';
        
        const allTracks = [
            ...this.playlists.music,
            ...this.playlists.time,
            ...this.playlists.ads,
            ...Object.values(this.playlists.albums).flat()
        ];
        
        const sortedTracks = allTracks
            .filter(track => this.playStats[track.id] > 0)
            .sort((a, b) => (this.playStats[b.id] || 0) - (this.playStats[a.id] || 0));
        
        sortedTracks.forEach(track => {
            const reportItem = document.createElement('div');
            reportItem.className = 'report-item';
            reportItem.innerHTML = `
                <span>${track.name}</span>
                <span>${this.playStats[track.id] || 0} reproduções</span>
            `;
            reportContainer.appendChild(reportItem);
        });
    }
}

// Instância global do estado
const radioState = new RadioState();

// Player de Áudio
class AudioPlayer {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.isPlaying = false;
        this.currentTrack = null;
        this.loadAttempts = 0;
        this.maxLoadAttempts = 3;
        
        this.setupEventListeners();
        this.setupAudioEvents();
    }
    
    setupEventListeners() {
        // Controles do player
        document.getElementById('play-pause-btn').addEventListener('click', () => {
            this.togglePlay();
        });
        
        document.getElementById('volume-slider').addEventListener('input', (e) => {
            this.setVolume(e.target.value / 100);
        });
        
        // Teclas de atalho
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !document.querySelector('input:focus')) {
                e.preventDefault();
                this.togglePlay();
            }
        });
    }
    
    setupAudioEvents() {
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateTimeDisplay();
            this.loadAttempts = 0; // Reset counter on successful load
        });
        
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });
        
        this.audio.addEventListener('ended', () => {
            this.playNext();
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Erro no áudio:', e);
            this.handleAudioError();
        });
        
        this.audio.addEventListener('canplay', () => {
            showLoading(false);
        });
        
        this.audio.addEventListener('waiting', () => {
            showLoading(true);
        });
    }
    
    handleAudioError() {
        this.loadAttempts++;
        
        if (this.loadAttempts >= this.maxLoadAttempts) {
            showNotification('Erro ao carregar música. Pulando para próxima...', 'error');
            this.playNext();
        } else {
            // Tenta recarregar
            setTimeout(() => {
                if (this.currentTrack) {
                    this.loadTrack(this.currentTrack);
                }
            }, 1000);
        }
    }
    
    async togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            await this.play();
        }
    }
    
    async play() {
        try {
            if (!this.currentTrack) {
                this.currentTrack = radioState.getNextTrack();
                if (!this.currentTrack) {
                    showNotification('Nenhuma música disponível! Adicione músicas pelo painel administrativo.', 'warning');
                    document.getElementById('current-track').textContent = 'Nenhuma música disponível!';
                    return;
                }
                this.loadTrack(this.currentTrack);
            }
            
            showLoading(true);
            await this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateCurrentTrackDisplay();
            showLoading(false);
            
        } catch (error) {
            console.error('Erro ao reproduzir:', error);
            showLoading(false);
            
            // Se falhar, tenta próxima música
            if (error.name === 'NotAllowedError') {
                showNotification('Clique no botão play para iniciar a reprodução', 'info');
            } else {
                showNotification('Erro ao reproduzir música. Tentando próxima...', 'error');
                this.playNext();
            }
        }
    }
    
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
        showLoading(false);
    }
    
    async playNext() {
        this.loadAttempts = 0; // Reset counter for new track
        this.currentTrack = radioState.getNextTrack();
        
        if (!this.currentTrack) {
            this.pause();
            document.getElementById('current-track').textContent = 'Nenhuma música disponível!';
            showNotification('Playlist vazia! Adicione músicas pelo painel administrativo.', 'warning');
            return;
        }
        
        this.loadTrack(this.currentTrack);
        if (this.isPlaying) {
            try {
                await this.audio.play();
            } catch (error) {
                console.error('Erro ao tocar próxima música:', error);
                this.handleAudioError();
            }
        }
        this.updateCurrentTrackDisplay();
    }
    
    loadTrack(track) {
        if (!track || !track.url) {
            console.error('Track inválido:', track);
            return;
        }
        
        showLoading(true);
        this.audio.src = track.url;
        this.audio.load();
    }
    
    setVolume(volume) {
        this.audio.volume = Math.max(0, Math.min(1, volume));
    }
    
    updatePlayButton() {
        const btn = document.getElementById('play-pause-btn');
        const icon = btn.querySelector('i');
        
        if (this.isPlaying) {
            icon.className = 'fas fa-pause';
        } else {
            icon.className = 'fas fa-play';
        }
    }
    
    updateCurrentTrackDisplay() {
        const trackElement = document.getElementById('current-track');
        if (this.currentTrack) {
            trackElement.textContent = this.currentTrack.name.replace('.mp3', '');
        } else {
            trackElement.textContent = 'Aguardando...';
        }
    }
    
    updateProgress() {
        if (!this.audio.duration) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        
        document.getElementById('current-time').textContent = this.formatTime(this.audio.currentTime);
    }
    
    updateTimeDisplay() {
        document.getElementById('duration').textContent = this.formatTime(this.audio.duration || 0);
    }
    
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Instância global do player
const audioPlayer = new AudioPlayer();

// Gerenciador de Uploads
class UploadManager {
    constructor() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Simular uploads para demonstração
        // Em produção, integraria com Cloudinary API
    }
    
    async uploadFiles(category, files) {
        showLoading(true);
        
        try {
            // Simula upload para Cloudinary
            await this.simulateUpload(files);
            
            // Adiciona à playlist
            radioState.addToPlaylist(category, files);
            
            showNotification(`${files.length} arquivo(s) enviado(s) com sucesso!`, 'success');
            
        } catch (error) {
            console.error('Erro no upload:', error);
            showNotification('Erro ao enviar arquivos', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    async uploadAlbumFiles(albumName, files) {
        showLoading(true);
        
        try {
            await this.simulateUpload(files);
            radioState.addToAlbum(albumName, files);
            
            showNotification(`Álbum ${albumName} atualizado!`, 'success');
            
        } catch (error) {
            console.error('Erro no upload do álbum:', error);
            showNotification('Erro ao enviar arquivos do álbum', 'error');
        } finally {
            showLoading(false);
        }
    }
    
    simulateUpload(files) {
        return new Promise(resolve => {
            setTimeout(() => {
                // Simula processamento
                resolve();
            }, 1000);
        });
    }
}

// Instância global do upload manager
const uploadManager = new UploadManager();

// Gerenciador de Administração
class AdminManager {
    constructor() {
        this.isLoggedIn = false;
        this.password = 'admin123';
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Toggle admin panel
        document.getElementById('admin-btn').addEventListener('click', () => {
            this.toggleAdminPanel();
        });
        
        // Close admin panel
        document.getElementById('close-admin').addEventListener('click', () => {
            this.closeAdminPanel();
        });
        
        // Login
        document.getElementById('login-btn').addEventListener('click', () => {
            this.login();
        });
        
        // Enter key on password input
        document.getElementById('admin-password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
        
        // Reset stats
        document.getElementById('reset-stats').addEventListener('click', () => {
            if (confirm('Tem certeza que deseja resetar as estatísticas?')) {
                radioState.resetStats();
            }
        });
        
        // Disable album
        document.getElementById('disable-album').addEventListener('click', () => {
            radioState.disableAlbum();
            this.updateAlbumGrid();
            showNotification('Álbum desativado', 'success');
        });
    }
    
    toggleAdminPanel() {
        const panel = document.getElementById('admin-panel');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            if (this.isLoggedIn) {
                this.showDashboard();
            }
        } else {
            this.closeAdminPanel();
        }
    }
    
    closeAdminPanel() {
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-password').value = '';
    }
    
    login() {
        const password = document.getElementById('admin-password').value;
        
        if (password === this.password) {
            this.isLoggedIn = true;
            this.showDashboard();
            showNotification('Login realizado com sucesso!', 'success');
        } else {
            showNotification('Senha incorreta!', 'error');
            document.getElementById('admin-password').value = '';
        }
    }
    
    showDashboard() {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        
        this.updateAlbumGrid();
        radioState.updateFilesList();
        radioState.updateReports();
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        // Update content based on tab
        if (tabName === 'albums') {
            this.updateAlbumGrid();
        } else if (tabName === 'reports') {
            radioState.updateReports();
        } else if (tabName === 'files') {
            radioState.updateFilesList();
        }
    }
    
    updateAlbumGrid() {
        const grid = document.getElementById('album-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        Object.keys(radioState.albumInfo).forEach(albumKey => {
            const album = radioState.albumInfo[albumKey];
            const isActive = radioState.activeAlbum === albumKey;
            
            const albumItem = document.createElement('div');
            albumItem.className = `album-item ${isActive ? 'active' : ''}`;
            albumItem.innerHTML = `
                <img src="${album.image}" alt="${album.name}">
                <h4>${album.name}</h4>
                <p>${radioState.playlists.albums[albumKey].length} músicas</p>
            `;
            
            albumItem.addEventListener('click', () => {
                radioState.setActiveAlbum(albumKey);
                this.updateAlbumGrid();
                showNotification(`Álbum "${album.name}" ativado!`, 'success');
            });
            
            grid.appendChild(albumItem);
        });
    }
}

// Instância global do admin manager
const adminManager = new AdminManager();

// Funções globais para upload
window.uploadFiles = function(category) {
    const input = document.getElementById(`upload-${category}`);
    const files = Array.from(input.files);
    
    if (files.length === 0) {
        showNotification('Selecione pelo menos um arquivo!', 'warning');
        return;
    }
    
    uploadManager.uploadFiles(category, files);
    input.value = '';
};

window.uploadAlbumFiles = function() {
    const albumSelect = document.getElementById('album-select');
    const input = document.getElementById('upload-album');
    const files = Array.from(input.files);
    
    if (files.length === 0) {
        showNotification('Selecione pelo menos um arquivo!', 'warning');
        return;
    }
    
    uploadManager.uploadAlbumFiles(albumSelect.value, files);
    input.value = '';
};

// Utilitários
function showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar estado
    radioState.updatePlaylist();
    radioState.updateAlbumDisplay();
    radioState.updateUI();
    
    // Não auto-start - espera clique do usuário para evitar problemas de autoplay
    console.log('🎵 Rádio Supermercado do Louro inicializada!');
    console.log('👆 Clique no botão Play para iniciar a reprodução');
    
    // Mostra instruções se não houver músicas
    if (radioState.currentPlaylist.length === 0) {
        showNotification('Adicione músicas pelo painel administrativo (senha: admin123)', 'info');
    }
});
