// Rádio Supermercado do Louro - Script Otimizado
// Sistema de rádio automatizada com integração Cloudinary

// Estado Global da Aplicação
class RadioApp {
    constructor() {
        this.state = {
            currentPlaylist: [],
            currentIndex: 0,
            isPlaying: false,
            currentTrack: null,
            musicCount: 0,
            timeCount: 0,
            adsCount: 0,
            startTime: new Date().toLocaleTimeString(),
            activeAlbum: localStorage.getItem('activeAlbum') || null,
            playStats: JSON.parse(localStorage.getItem('playStats') || '{}'),
            playlists: {
                music: [],
                time: [],
                ads: [],
                albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
            }
        };

        this.config = {
            adminPassword: 'admin123',
            cloudinary: {
                cloudName: 'dygbrcrr6',
                apiKey: '853591251513134',
                uploadPreset: 'radio_louro'
            },
            albumInfo: {
                natal: { name: 'Especial Natal', image: 'https://via.placeholder.com/300x300/e74c3c/ffffff?text=🎄+Natal' },
                pascoa: { name: 'Especial Páscoa', image: 'https://via.placeholder.com/300x300/f39c12/ffffff?text=🐰+Páscoa' },
                saojoao: { name: 'Especial São João', image: 'https://via.placeholder.com/300x300/27ae60/ffffff?text=🎪+São+João' },
                carnaval: { name: 'Especial Carnaval', image: 'https://via.placeholder.com/300x300/9b59b6/ffffff?text=🎭+Carnaval' }
            }
        };

        this.audio = null;
        this.isLoggedIn = false;
        this.cloudinaryManager = null;

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.loadFromStorage();
        this.initializeElements();
        this.bindEvents();
        this.initializeCloudinary();
        this.updateUI();
        console.log('🎵 Rádio Supermercado do Louro inicializada!');
    }

    initializeElements() {
        this.audio = document.getElementById('audio-player');
        if (!this.audio) {
            console.error('Elemento audio não encontrado');
            return;
        }
        this.setupAudioEvents();
    }

    bindEvents() {
        // Player controls
        this.bindElement('play-pause-btn', 'click', () => this.togglePlay());
        this.bindElement('volume-slider', 'input', (e) => this.setVolume(e.target.value / 100));
        
        // Admin controls
        this.bindElement('admin-btn', 'click', () => this.toggleAdminPanel());
        this.bindElement('close-admin', 'click', () => this.closeAdminPanel());
        this.bindElement('login-btn', 'click', () => this.login());
        this.bindElement('admin-password', 'keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
        this.bindElement('reset-stats', 'click', () => this.resetStats());
        this.bindElement('disable-album', 'click', () => this.disableAlbum());

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !document.querySelector('input:focus')) {
                e.preventDefault();
                this.togglePlay();
            }
        });
    }

    bindElement(id, event, handler) {
        const element = document.getElementById(id);
        if (element) element.addEventListener(event, handler);
    }

    setupAudioEvents() {
        const events = {
            'loadedmetadata': () => this.updateTimeDisplay(),
            'timeupdate': () => this.updateProgress(),
            'ended': () => this.playNext(),
            'error': (e) => {
                console.error('Erro no áudio:', e);
                this.playNext();
            }
        };

        Object.entries(events).forEach(([event, handler]) => {
            this.audio.addEventListener(event, handler);
        });
    }

    initializeCloudinary() {
        if (window.cloudinaryManager) {
            this.cloudinaryManager = window.cloudinaryManager;
        } else {
            console.warn('Cloudinary Manager não encontrado');
        }
    }

    // Storage Management
    loadFromStorage() {
        const savedPlaylists = localStorage.getItem('radioPlaylists');
        if (savedPlaylists) {
            try {
                this.state.playlists = JSON.parse(savedPlaylists);
            } catch (error) {
                console.error('Erro ao carregar playlists:', error);
            }
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('radioPlaylists', JSON.stringify(this.state.playlists));
            localStorage.setItem('playStats', JSON.stringify(this.state.playStats));
            if (this.state.activeAlbum) {
                localStorage.setItem('activeAlbum', this.state.activeAlbum);
            }
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }

    // Playlist Management
    updatePlaylist() {
        this.state.currentPlaylist = [...this.state.playlists.music];
        
        if (this.state.activeAlbum && this.state.playlists.albums[this.state.activeAlbum]) {
            this.state.currentPlaylist.push(...this.state.playlists.albums[this.state.activeAlbum]);
        }
        
        this.shuffleArray(this.state.currentPlaylist);
        this.updateUI();
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    getNextTrack() {
        if (this.state.currentPlaylist.length === 0) return null;

        let nextTrack = null;

        // Lógica de intercalação
        if (this.state.musicCount > 0 && this.state.musicCount % 3 === 0 && this.state.playlists.time.length > 0) {
            nextTrack = this.state.playlists.time[this.state.timeCount % this.state.playlists.time.length];
            this.state.timeCount++;
        } else if (this.state.musicCount > 0 && this.state.musicCount % 6 === 0 && this.state.playlists.ads.length > 0) {
            nextTrack = this.state.playlists.ads[this.state.adsCount % this.state.playlists.ads.length];
            this.state.adsCount++;
        } else {
            nextTrack = this.state.currentPlaylist[this.state.currentIndex % this.state.currentPlaylist.length];
            this.state.currentIndex++;
            this.state.musicCount++;
        }

        if (nextTrack) {
            this.state.playStats[nextTrack.id] = (this.state.playStats[nextTrack.id] || 0) + 1;
            nextTrack.plays = this.state.playStats[nextTrack.id];
            this.saveToStorage();
        }

        return nextTrack;
    }

    // Audio Player Methods
    async togglePlay() {
        if (!this.audio) return;
        
        if (this.state.isPlaying) {
            this.pause();
        } else {
            await this.play();
        }
    }

    async play() {
        try {
            if (!this.state.currentTrack) {
                this.state.currentTrack = this.getNextTrack();
                if (!this.state.currentTrack) {
                    this.showNotification('Nenhuma música disponível! Faça upload no painel admin.', 'warning');
                    return;
                }
                this.loadTrack(this.state.currentTrack);
            }

            await this.audio.play();
            this.state.isPlaying = true;
            this.updatePlayButton();
            this.updateCurrentTrackDisplay();

        } catch (error) {
            console.error('Erro ao reproduzir:', error);
            this.showNotification('Erro ao reproduzir música', 'error');
        }
    }

    pause() {
        if (this.audio) this.audio.pause();
        this.state.isPlaying = false;
        this.updatePlayButton();
    }

    async playNext() {
        this.state.currentTrack = this.getNextTrack();
        if (!this.state.currentTrack) {
            this.pause();
            return;
        }

        this.loadTrack(this.state.currentTrack);
        if (this.state.isPlaying) {
            try {
                await this.audio.play();
            } catch (error) {
                console.error('Erro ao tocar próxima música:', error);
            }
        }
        this.updateCurrentTrackDisplay();
    }

    loadTrack(track) {
        if (this.audio && track) {
            this.audio.src = track.url;
            this.audio.load();
        }
    }

    setVolume(volume) {
        if (this.audio) {
            this.audio.volume = Math.max(0, Math.min(1, volume));
        }
    }

    // Upload Management
    async uploadFiles(category, files) {
        this.showLoading(true);
        
        try {
            const fileArray = Array.from(files);
            const results = [];

            if (this.cloudinaryManager) {
                // Upload real para Cloudinary
                const uploadResult = await this.cloudinaryManager.uploadMultipleFiles(fileArray, `radio-louro/${category}`);
                results.push(...uploadResult.successful);
                
                if (uploadResult.failed.length > 0) {
                    console.warn('Alguns uploads falharam:', uploadResult.failed);
                }
            } else {
                // Fallback para URLs locais
                fileArray.forEach(file => {
                    results.push({
                        name: file.name,
                        url: URL.createObjectURL(file),
                        success: true
                    });
                });
            }

            // Adicionar à playlist
            const tracks = results.filter(r => r.success).map(file => ({
                id: Date.now() + Math.random(),
                name: file.originalName || file.name,
                url: file.url,
                category: category,
                plays: 0
            }));

            this.state.playlists[category].push(...tracks);
            this.saveToStorage();
            this.updatePlaylist();

            this.showNotification(`${tracks.length} arquivo(s) enviado(s) com sucesso!`, 'success');

        } catch (error) {
            console.error('Erro no upload:', error);
            this.showNotification('Erro ao enviar arquivos', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async uploadAlbumFiles(albumName, files) {
        this.showLoading(true);
        
        try {
            const fileArray = Array.from(files);
            const results = [];

            if (this.cloudinaryManager) {
                const uploadResult = await this.cloudinaryManager.uploadMultipleFiles(fileArray, `radio-louro/albums/${albumName}`);
                results.push(...uploadResult.successful);
            } else {
                fileArray.forEach(file => {
                    results.push({
                        name: file.name,
                        url: URL.createObjectURL(file),
                        success: true
                    });
                });
            }

            const tracks = results.filter(r => r.success).map(file => ({
                id: Date.now() + Math.random(),
                name: file.originalName || file.name,
                url: file.url,
                category: 'album',
                album: albumName,
                plays: 0
            }));

            this.state.playlists.albums[albumName].push(...tracks);
            this.saveToStorage();
            this.updatePlaylist();

            this.showNotification(`Álbum ${albumName} atualizado!`, 'success');

        } catch (error) {
            console.error('Erro no upload do álbum:', error);
            this.showNotification('Erro ao enviar arquivos do álbum', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Admin Methods
    toggleAdminPanel() {
        const panel = document.getElementById('admin-panel');
        if (panel) {
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden') && this.isLoggedIn) {
                this.showDashboard();
            }
        }
    }

    closeAdminPanel() {
        const panel = document.getElementById('admin-panel');
        const passwordInput = document.getElementById('admin-password');
        
        if (panel) panel.classList.add('hidden');
        if (passwordInput) passwordInput.value = '';
    }

    login() {
        const passwordInput = document.getElementById('admin-password');
        if (!passwordInput) return;

        if (passwordInput.value === this.config.adminPassword) {
            this.isLoggedIn = true;
            this.showDashboard();
            this.showNotification('Login realizado com sucesso!', 'success');
        } else {
            this.showNotification('Senha incorreta!', 'error');
            passwordInput.value = '';
        }
    }

    showDashboard() {
        const loginForm = document.getElementById('admin-login');
        const dashboard = document.getElementById('admin-dashboard');
        
        if (loginForm) loginForm.classList.add('hidden');
        if (dashboard) dashboard.classList.remove('hidden');
        
        this.updateAlbumGrid();
        this.updateFilesList();
        this.updateReports();
    }

    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const activeContent = document.getElementById(`tab-${tabName}`);
        if (activeContent) activeContent.classList.add('active');

        // Update content based on tab
        const updateMethods = {
            'albums': () => this.updateAlbumGrid(),
            'reports': () => this.updateReports(),
            'files': () => this.updateFilesList()
        };

        if (updateMethods[tabName]) updateMethods[tabName]();
    }

    setActiveAlbum(albumName) {
        this.state.activeAlbum = albumName;
        this.saveToStorage();
        this.updatePlaylist();
        this.updateAlbumDisplay();
    }

    disableAlbum() {
        this.state.activeAlbum = null;
        localStorage.removeItem('activeAlbum');
        this.updatePlaylist();
        this.updateAlbumDisplay();
        this.updateAlbumGrid();
        this.showNotification('Álbum desativado', 'success');
    }

    resetStats() {
        if (confirm('Tem certeza que deseja resetar as estatísticas?')) {
            this.state.playStats = {};
            this.saveToStorage();
            this.updateReports();
            this.showNotification('Estatísticas resetadas!', 'success');
        }
    }

    removeFile(category, fileId) {
        this.state.playlists[category] = this.state.playlists[category].filter(file => file.id !== fileId);
        delete this.state.playStats[fileId];
        this.saveToStorage();
        this.updatePlaylist();
        this.updateFilesList();
    }

    // UI Update Methods
    updateUI() {
        this.updateElement('music-count', this.state.currentPlaylist.length);
        this.updateElement('start-time', this.state.startTime);
        this.updateAlbumDisplay();
    }

    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) element.textContent = content;
    }

    updatePlayButton() {
        const btn = document.getElementById('play-pause-btn');
        if (!btn) return;
        
        const icon = btn.querySelector('i');
        if (icon) {
            icon.className = this.state.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }

    updateCurrentTrackDisplay() {
        if (this.state.currentTrack) {
            this.updateElement('current-track', this.state.currentTrack.name.replace('.mp3', ''));
        }
    }

    updateProgress() {
        if (!this.audio || !this.audio.duration) return;

        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        const progressFill = document.getElementById('progress-fill');
        
        if (progressFill) progressFill.style.width = `${progress}%`;
        this.updateElement('current-time', this.formatTime(this.audio.currentTime));
    }

    updateTimeDisplay() {
        this.updateElement('duration', this.formatTime(this.audio.duration || 0));
    }

    updateAlbumDisplay() {
        const albumImage = document.getElementById('album-image');
        const albumName = document.getElementById('album-name');
        
        if (albumImage && albumName) {
            if (this.state.activeAlbum && this.config.albumInfo[this.state.activeAlbum]) {
                const info = this.config.albumInfo[this.state.activeAlbum];
                albumImage.src = info.image;
                albumName.textContent = info.name;
            } else {
                albumImage.src = 'https://via.placeholder.com/300x300/333333/ffffff?text=Rádio+Louro';
                albumName.textContent = 'Programação Geral';
            }
        }
    }

    updateAlbumGrid() {
        const grid = document.getElementById('album-grid');
        if (!grid) return;

        grid.innerHTML = '';

        Object.entries(this.config.albumInfo).forEach(([albumKey, album]) => {
            const isActive = this.state.activeAlbum === albumKey;
            const albumItem = document.createElement('div');
            albumItem.className = `album-item ${isActive ? 'active' : ''}`;
            albumItem.innerHTML = `
                <img src="${album.image}" alt="${album.name}">
                <h4>${album.name}</h4>
                <p>${this.state.playlists.albums[albumKey].length} músicas</p>
            `;

            albumItem.addEventListener('click', () => {
                this.setActiveAlbum(albumKey);
                this.updateAlbumGrid();
                this.showNotification(`Álbum "${album.name}" ativado!`, 'success');
            });

            grid.appendChild(albumItem);
        });
    }

    updateFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            const container = document.getElementById(`${category}-files`);
            if (!container) return;

            container.innerHTML = '';

            this.state.playlists[category].forEach(file => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span>${file.name}</span>
                    <button class="delete-file-btn" onclick="radioApp.removeFile('${category}', '${file.id}')">
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
            ...this.state.playlists.music,
            ...this.state.playlists.time,
            ...this.state.playlists.ads,
            ...Object.values(this.state.playlists.albums).flat()
        ];

        const sortedTracks = allTracks
            .filter(track => this.state.playStats[track.id] > 0)
            .sort((a, b) => (this.state.playStats[b.id] || 0) - (this.state.playStats[a.id] || 0));

        sortedTracks.forEach(track => {
            const reportItem = document.createElement('div');
            reportItem.className = 'report-item';
            reportItem.innerHTML = `
                <span>${track.name}</span>
                <span>${this.state.playStats[track.id] || 0} reproduções</span>
            `;
            reportContainer.appendChild(reportItem);
        });
    }

    // Utility Methods
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    }
}

// Instância global da aplicação
const radioApp = new RadioApp();

// Funções globais para upload (compatibilidade com HTML)
window.uploadFiles = function(category) {
    const input = document.getElementById(`upload-${category}`);
    if (!input || input.files.length === 0) {
        radioApp.showNotification('Selecione pelo menos um arquivo!', 'warning');
        return;
    }
    
    radioApp.uploadFiles(category, input.files);
    input.value = '';
};

window.uploadAlbumFiles = function() {
    const albumSelect = document.getElementById('album-select');
    const input = document.getElementById('upload-album');
    
    if (!albumSelect || !input || input.files.length === 0) {
        radioApp.showNotification('Selecione pelo menos um arquivo!', 'warning');
        return;
    }
    
    radioApp.uploadAlbumFiles(albumSelect.value, input.files);
    input.value = '';
};

// Verificação de compatibilidade
if (!window.Audio) {
    alert('Seu navegador não suporta reprodução de áudio');
}

// Tratamento de erros globais
window.addEventListener('error', function(e) {
    console.error('Erro detectado:', e.error);
});

console.log('🔧 Script da Rádio Supermercado do Louro carregado!');
