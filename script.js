// Configurações Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    baseUrl: 'https://res.cloudinary.com/dygbrcrr6'
};

// Debug e logs
console.log('🚀 Iniciando Rádio Supermercado do Louro...');

// Estado Global da Rádio
class RadioState {
    constructor() {
        console.log('📻 Inicializando RadioState...');
        this.currentPlaylist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.musicCount = 0;
        this.timeCount = 0;
        this.adsCount = 0;
        this.playStats = this.safeGetFromStorage('playStats', {});
        this.activeAlbum = this.safeGetFromStorage('activeAlbum', null);
        this.startTime = new Date().toLocaleTimeString();
        this.audioContext = null;
        this.analyser = null;
        
        // Playlists por categoria
        this.playlists = {
            music: [],
            time: [],
            ads: [],
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
        console.log('✅ RadioState inicializado');
    }
    
    safeGetFromStorage(key, defaultValue) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Erro ao carregar ${key} do localStorage:`, error);
            return defaultValue;
        }
    }
    
    loadFromStorage() {
        try {
            const savedPlaylists = localStorage.getItem('radioPlaylists');
            if (savedPlaylists) {
                this.playlists = JSON.parse(savedPlaylists);
            }
            console.log('📂 Playlists carregadas do storage');
        } catch (error) {
            console.warn('Erro ao carregar playlists:', error);
        }
    }
    
    saveToStorage() {
        try {
            localStorage.setItem('radioPlaylists', JSON.stringify(this.playlists));
            localStorage.setItem('playStats', JSON.stringify(this.playStats));
        } catch (error) {
            console.warn('Erro ao salvar no storage:', error);
        }
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
        
        // Embaralha a playlist
        this.shuffleArray(this.currentPlaylist);
        
        this.updateUI();
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    
    getNextTrack() {
        if (this.currentPlaylist.length === 0) {
            console.log('⚠️ Nenhuma música na playlist');
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
        try {
            localStorage.setItem('activeAlbum', albumName);
        } catch (error) {
            console.warn('Erro ao salvar álbum ativo:', error);
        }
        this.updatePlaylist();
        this.updateAlbumDisplay();
    }
    
    disableAlbum() {
        this.activeAlbum = null;
        try {
            localStorage.removeItem('activeAlbum');
        } catch (error) {
            console.warn('Erro ao remover álbum ativo:', error);
        }
        this.updatePlaylist();
        this.updateAlbumDisplay();
    }
    
    updateAlbumDisplay() {
        const albumImage = document.getElementById('album-image');
        const albumName = document.getElementById('album-name');
        
        if (albumImage && albumName) {
            if (this.activeAlbum && this.albumInfo[this.activeAlbum]) {
                albumImage.src = this.albumInfo[this.activeAlbum].image;
                albumName.textContent = this.albumInfo[this.activeAlbum].name;
            } else {
                albumImage.src = 'https://via.placeholder.com/300x300/333333/ffffff?text=Rádio+Louro';
                albumName.textContent = 'Programação Geral';
            }
        }
    }
    
    updateUI() {
        const musicCountEl = document.getElementById('music-count');
        const startTimeEl = document.getElementById('start-time');
        
        if (musicCountEl) {
            musicCountEl.textContent = this.currentPlaylist.length;
        }
        if (startTimeEl) {
            startTimeEl.textContent = this.startTime;
        }
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

// Player de Áudio
class AudioPlayer {
    constructor() {
        console.log('🎵 Inicializando AudioPlayer...');
        this.audio = null;
        this.isPlaying = false;
        this.currentTrack = null;
        this.initialized = false;
    }
    
    async init() {
        try {
            // Aguarda o DOM estar pronto
            await this.waitForElement('audio-player');
            
            this.audio = document.getElementById('audio-player');
            if (!this.audio) {
                throw new Error('Elemento audio-player não encontrado');
            }
            
            this.setupEventListeners();
            this.setupAudioEvents();
            this.initialized = true;
            console.log('✅ AudioPlayer inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar AudioPlayer:', error);
        }
    }
    
    waitForElement(id, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const element = document.getElementById(id);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Elemento ${id} não encontrado após ${timeout}ms`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };
            
            checkElement();
        });
    }
    
    setupEventListeners() {
        // Controles do player
        const playBtn = document.getElementById('play-pause-btn');
        const volumeSlider = document.getElementById('volume-slider');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                this.togglePlay();
            });
        }
        
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }
        
        // Teclas de atalho
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !document.querySelector('input:focus')) {
                e.preventDefault();
                this.togglePlay();
            }
        });
    }
    
    setupAudioEvents() {
        if (!this.audio) return;
        
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateTimeDisplay();
        });
        
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });
        
        this.audio.addEventListener('ended', () => {
            this.playNext();
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Erro no áudio:', e);
            this.playNext();
        });
    }
    
    async togglePlay() {
        if (!this.initialized) {
            console.log('⚠️ Player não inicializado ainda');
            return;
        }
        
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
                    showNotification('Nenhuma música disponível! Carregue algumas músicas.', 'warning');
                    return;
                }
                this.loadTrack(this.currentTrack);
            }
            
            // Tenta reproduzir
            await this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateCurrentTrackDisplay();
            
            console.log('▶️ Reproduzindo:', this.currentTrack.name);
            
        } catch (error) {
            console.error('Erro ao reproduzir:', error);
            showNotification('Erro ao reproduzir música', 'error');
        }
    }
    
    pause() {
        if (this.audio) {
            this.audio.pause();
        }
        this.isPlaying = false;
        this.updatePlayButton();
    }
    
    async playNext() {
        this.currentTrack = radioState.getNextTrack();
        if (!this.currentTrack) {
            this.pause();
            return;
        }
        
        this.loadTrack(this.currentTrack);
        if (this.isPlaying) {
            try {
                await this.audio.play();
            } catch (error) {
                console.error('Erro ao reproduzir próxima música:', error);
            }
        }
        this.updateCurrentTrackDisplay();
    }
    
    loadTrack(track) {
        if (this.audio) {
            this.audio.src = track.url;
            this.audio.load();
        }
    }
    
    setVolume(volume) {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, volume));
        }
    }
    
    updatePlayButton() {
        const btn = document.getElementById('play-pause-btn');
        if (!btn) return;
        
        const icon = btn.querySelector('i');
        if (icon) {
            if (this.isPlaying) {
                icon.className = 'fas fa-pause';
            } else {
                icon.className = 'fas fa-play';
            }
        }
    }
    
    updateCurrentTrackDisplay() {
        const trackElement = document.getElementById('current-track');
        if (trackElement && this.currentTrack) {
            trackElement.textContent = this.currentTrack.name.replace('.mp3', '');
        }
    }
    
    updateProgress() {
        if (!this.audio || !this.audio.duration) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        const currentTimeEl = document.getElementById('current-time');
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
    }
    
    updateTimeDisplay() {
        const durationEl = document.getElementById('duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.audio.duration || 0);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

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

// Gerenciador de Administração
class AdminManager {
    constructor() {
        this.isLoggedIn = false;
        this.password = 'admin123';
    }
    
    async init() {
        try {
            await this.waitForElement('admin-btn');
            this.setupEventListeners();
            console.log('✅ AdminManager inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar AdminManager:', error);
        }
    }
    
    waitForElement(id, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkElement = () => {
                const element = document.getElementById(id);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Elemento ${id} não encontrado após ${timeout}ms`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };
            
            checkElement();
        });
    }
    
    setupEventListeners() {
        // Toggle admin panel
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                this.toggleAdminPanel();
            });
        }
        
        // Close admin panel
        const closeAdmin = document.getElementById('close-admin');
        if (closeAdmin) {
            closeAdmin.addEventListener('click', () => {
                this.closeAdminPanel();
            });
        }
        
        // Login
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.login();
            });
        }
        
        // Enter key on password input
        const passwordInput = document.getElementById('admin-password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.login();
                }
            });
        }
        
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
            });
        });
        
        // Reset stats
        const resetStats = document.getElementById('reset-stats');
        if (resetStats) {
            resetStats.addEventListener('click', () => {
                if (confirm('Tem certeza que deseja resetar as estatísticas?')) {
                    radioState.resetStats();
                }
            });
        }
        
        // Disable album
        const disableAlbum = document.getElementById('disable-album');
        if (disableAlbum) {
            disableAlbum.addEventListener('click', () => {
                radioState.disableAlbum();
                this.updateAlbumGrid();
                showNotification('Álbum desativado', 'success');
            });
        }
    }
    
    toggleAdminPanel() {
        const panel = document.getElementById('admin-panel');
        if (panel) {
            if (panel.classList.contains('hidden')) {
                panel.classList.remove('hidden');
                if (this.isLoggedIn) {
                    this.showDashboard();
                }
            } else {
                this.closeAdminPanel();
            }
        }
    }
    
    closeAdminPanel() {
        const panel = document.getElementById('admin-panel');
        const passwordInput = document.getElementById('admin-password');
        
        if (panel) {
            panel.classList.add('hidden');
        }
        if (passwordInput) {
            passwordInput.value = '';
        }
    }
    
    login() {
        const passwordInput = document.getElementById('admin-password');
        if (!passwordInput) return;
        
        const password = passwordInput.value;
        
        if (password === this.password) {
            this.isLoggedIn = true;
            this.showDashboard();
            showNotification('Login realizado com sucesso!', 'success');
        } else {
            showNotification('Senha incorreta!', 'error');
            passwordInput.value = '';
        }
    }
    
    showDashboard() {
        const loginEl = document.getElementById('admin-login');
        const dashboardEl = document.getElementById('admin-dashboard');
        
        if (loginEl) {
            loginEl.classList.add('hidden');
        }
        if (dashboardEl) {
            dashboardEl.classList.remove('hidden');
        }
        
        this.updateAlbumGrid();
        radioState.updateFilesList();
        radioState.updateReports();
    }
    
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const activeContent = document.getElementById(`tab-${tabName}`);
        if (activeContent) {
            activeContent.classList.add('active');
        }
        
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

// Instâncias globais
let radioState;
let audioPlayer;
let uploadManager;
let adminManager;

// Funções globais para upload
window.uploadFiles = function(category) {
    const input = document.getElementById(`upload-${category}`);
    if (!input) return;
    
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
    
    if (!albumSelect || !input) return;
    
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
    if (!container) {
        console.log(`Notificação: ${message}`);
        return;
    }
    
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
    if (loading) {
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }
}

// Função para esconder o loading inicial
function hideInitialLoading() {
    const initialLoading = document.querySelector('.loading-screen');
    if (initialLoading) {
        initialLoading.style.display = 'none';
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 DOM carregado, iniciando aplicação...');
    
    try {
        // Inicializar componentes
        radioState = new RadioState();
        audioPlayer = new AudioPlayer();
        uploadManager = new UploadManager();
        adminManager = new AdminManager();
        
        // Aguardar inicialização dos componentes que dependem do DOM
        await Promise.all([
            audioPlayer.init(),
            adminManager.init()
        ]);
        
        // Inicializar estado
        radioState.updatePlaylist();
        radioState.updateAlbumDisplay();
        radioState.updateUI();
        
        // Esconder loading
        hideInitialLoading();
        
        // Auto-start do player após um delay
        setTimeout(() => {
            if (radioState.currentPlaylist.length > 0) {
                audioPlayer.play();
            } else {
                showNotification('Bem-vindo! Adicione algumas músicas para começar a tocar.', 'info');
            }
        }, 2000);
        
        console.log('🎵 Rádio Supermercado do Louro inicializada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        hideInitialLoading();
        showNotification('Erro na inicialização da rádio', 'error');
    }
});
