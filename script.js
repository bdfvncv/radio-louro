/**
 * Script principal da Rádio Supermercado do Louro
 * Sistema completo de reprodução automática e gerenciamento
 */

class RadioSystem {
    constructor() {
        console.log('🚀 Inicializando Rádio Supermercado do Louro...');
        
        // Estado do sistema
        this.isPlaying = false;
        this.currentTrack = null;
        this.currentTrackIndex = 0;
        this.volume = 0.7;
        this.startTime = null;
        this.isAdmin = false;
        
        // Contadores para controle de programação
        this.musicCounter = 0;
        this.lastTimeAnnouncement = 0;
        this.lastAdAnnouncement = 0;
        
        // Playlists do sistema
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
        
        // Estatísticas
        this.stats = {
            totalPlayed: 0,
            sessionStart: new Date(),
            playHistory: []
        };
        
        // Referencias DOM
        this.audioPlayer = null;
        this.elements = {};
        
        this.init();
    }
    
    async init() {
        console.log('⚙️ Configurando sistema...');
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupDOM());
        } else {
            this.setupDOM();
        }
    }
    
    setupDOM() {
        console.log('🔧 Configurando interface...');
        
        // Obter referências dos elementos
        this.audioPlayer = document.getElementById('audio-player');
        this.elements = {
            playPauseBtn: document.getElementById('play-pause-btn'),
            volumeSlider: document.getElementById('volume-slider'),
            currentTrack: document.getElementById('current-track'),
            albumName: document.getElementById('album-name'),
            albumImage: document.getElementById('album-image'),
            currentTime: document.getElementById('current-time'),
            duration: document.getElementById('duration'),
            progressFill: document.getElementById('progress-fill'),
            musicCount: document.getElementById('music-count'),
            startTime: document.getElementById('start-time'),
            adminBtn: document.getElementById('admin-btn'),
            adminPanel: document.getElementById('admin-panel'),
            adminLogin: document.getElementById('admin-login'),
            adminDashboard: document.getElementById('admin-dashboard'),
            closeAdmin: document.getElementById('close-admin'),
            loginBtn: document.getElementById('login-btn'),
            adminPassword: document.getElementById('admin-password'),
            loading: document.getElementById('loading'),
            notifications: document.getElementById('notifications')
        };
        
        // Verificar se elementos essenciais existem
        if (!this.audioPlayer) {
            this.showError('Elemento de áudio não encontrado');
            return;
        }
        
        this.setupEventListeners();
        this.loadStoredData();
        this.setupDefaultPlaylists();
        this.updateUI();
        this.hideLoading();
        
        console.log('✅ Sistema inicializado com sucesso!');
    }
    
    setupEventListeners() {
        console.log('🎧 Configurando eventos...');
        
        // Controles do player
        if (this.elements.playPauseBtn) {
            this.elements.playPauseBtn.addEventListener('click', () => this.togglePlay());
        }
        
        if (this.elements.volumeSlider) {
            this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
        }
        
        // Eventos do áudio
        this.audioPlayer.addEventListener('loadstart', () => this.showLoading());
        this.audioPlayer.addEventListener('canplay', () => this.hideLoading());
        this.audioPlayer.addEventListener('ended', () => this.playNext());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('error', (e) => this.handleAudioError(e));
        
        // Admin
        if (this.elements.adminBtn) {
            this.elements.adminBtn.addEventListener('click', () => this.toggleAdminPanel());
        }
        
        if (this.elements.closeAdmin) {
            this.elements.closeAdmin.addEventListener('click', () => this.closeAdminPanel());
        }
        
        if (this.elements.loginBtn) {
            this.elements.loginBtn.addEventListener('click', () => this.adminLogin());
        }
        
        if (this.elements.adminPassword) {
            this.elements.adminPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.adminLogin();
            });
        }
        
        // Tabs do admin
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Upload buttons
        document.querySelectorAll('.upload-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.onclick?.toString().match(/'([^']+)'/)?.[1];
                if (category) this.handleUpload(category);
            });
        });
    }
    
    setupDefaultPlaylists() {
        console.log('🎵 Configurando playlists padrão...');
        
        // Se não há músicas, adicionar algumas de demonstração
        if (this.playlists.music.length === 0) {
            this.playlists.music = [
                {
                    title: 'pancada-de-mulher',
                    url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751504378/d4al5xcgdzl43ugk8ffz.mp3',
                    duration: 02:17,
                    type: 'music'
                },
                {
                    title: 'Leonardo-Nao-Aprendi-A-Dizer-Adeus', 
                    url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751504859/a6i8wjf9owtqfr32haxb.mp3',
                    duration: 01:30,
                    type: 'music'
                }
            ];
        }
        
        // Hora certa padrão
        if (this.playlists.time.length === 0) {
            this.playlists.time = [
                {
                    title: 'hora-certa-1-hora',
                    url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751505070/pfiyrl9uuzzsud4hxuvo.mp3',
                    duration: 00:06,
                    type: 'music'
                }
            ];
        }
        
        // Avisos padrão
        if (this.playlists.ads.length === 0) {
            this.playlists.ads = [
                {
                    title: 'aqui-voce-compra-mais-barato-',
                    url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751505219/jcu59rbwi8u3covg80l5.mp3',
                    duration: 00:03,
                    type: 'music'
                }
            ];
        }
        
        this.updateMusicCount();
    }
    
    loadStoredData() {
        console.log('💾 Carregando dados salvos...');
        
        try {
            // Carregar playlists
            const storedPlaylists = localStorage.getItem('radioPlaylists');
            if (storedPlaylists) {
                this.playlists = { ...this.playlists, ...JSON.parse(storedPlaylists) };
            }
            
            // Carregar estatísticas
            const storedStats = localStorage.getItem('playStats');
            if (storedStats) {
                this.stats = { ...this.stats, ...JSON.parse(storedStats) };
            }
            
            // Carregar volume
            const storedVolume = localStorage.getItem('radioVolume');
            if (storedVolume) {
                this.volume = parseFloat(storedVolume);
                if (this.elements.volumeSlider) {
                    this.elements.volumeSlider.value = this.volume * 100;
                }
            }
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar dados salvos:', error);
        }
    }
    
    saveData() {
        try {
            localStorage.setItem('radioPlaylists', JSON.stringify(this.playlists));
            localStorage.setItem('playStats', JSON.stringify(this.stats));
            localStorage.setItem('radioVolume', this.volume.toString());
        } catch (error) {
            console.warn('⚠️ Erro ao salvar dados:', error);
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
        console.log('▶️ Iniciando reprodução...');
        
        if (!this.startTime) {
            this.startTime = new Date();
            this.updateStartTime();
        }
        
        // Se não há track atual, selecionar próximo
        if (!this.currentTrack) {
            this.selectNextTrack();
        }
        
        if (this.currentTrack) {
            try {
                this.showLoading();
                
                // Configurar áudio
                this.audioPlayer.src = this.currentTrack.url;
                this.audioPlayer.volume = this.volume;
                
                await this.audioPlayer.play();
                
                this.isPlaying = true;
                this.updatePlayButton();
                this.updateCurrentTrackInfo();
                this.hideLoading();
                
                // Registrar estatística
                this.recordPlay(this.currentTrack);
                
                console.log('✅ Reprodução iniciada:', this.currentTrack.title);
                
            } catch (error) {
                console.error('❌ Erro na reprodução:', error);
                this.handleAudioError(error);
                this.playNext();
            }
        } else {
            this.showNotification('Nenhuma música disponível', 'warning');
        }
    }
    
    pause() {
        console.log('⏸️ Pausando reprodução...');
        
        this.audioPlayer.pause();
        this.isPlaying = false;
        this.updatePlayButton();
    }
    
    playNext() {
        console.log('⏭️ Próxima música...');
        
        this.selectNextTrack();
        if (this.isPlaying && this.currentTrack) {
            this.play();
        }
    }
    
    selectNextTrack() {
        const activeAlbum = localStorage.getItem('activeAlbum');
        let availableTracks = [];
        
        // Verificar se deve tocar hora certa
        const now = new Date();
        const minutes = now.getMinutes();
        const shouldPlayTime = minutes === 0 || minutes === 30; // A cada 30 minutos
        
        if (shouldPlayTime && this.musicCounter > 0 && this.playlists.time.length > 0) {
            availableTracks = this.playlists.time;
            this.lastTimeAnnouncement = Date.now();
            console.log('🕐 Tocando hora certa');
        }
        // Verificar se deve tocar aviso
        else if (this.musicCounter > 0 && this.musicCounter % 6 === 0 && this.playlists.ads.length > 0) {
            availableTracks = this.playlists.ads;
            this.lastAdAnnouncement = Date.now();
            console.log('📢 Tocando aviso');
        }
        // Tocar música do álbum ativo ou música normal
        else {
            if (activeAlbum && this.playlists.albums[activeAlbum]?.length > 0) {
                availableTracks = this.playlists.albums[activeAlbum];
                console.log(`🎵 Tocando do álbum: ${activeAlbum}`);
            } else {
                availableTracks = this.playlists.music;
                console.log('🎵 Tocando música normal');
            }
            this.musicCounter++;
        }
        
        if (availableTracks.length > 0) {
            // Seleção aleatória
            const randomIndex = Math.floor(Math.random() * availableTracks.length);
            this.currentTrack = availableTracks[randomIndex];
            this.currentTrackIndex = randomIndex;
        } else {
            this.currentTrack = null;
            console.warn('⚠️ Nenhuma música disponível');
        }
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.audioPlayer.volume = this.volume;
        this.saveData();
    }
    
    updateProgress() {
        if (this.audioPlayer.duration && this.elements.progressFill) {
            const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            this.elements.progressFill.style.width = `${progress}%`;
        }
        
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(this.audioPlayer.currentTime || 0);
        }
        
        if (this.elements.duration) {
            this.elements.duration.textContent = this.formatTime(this.audioPlayer.duration || 0);
        }
    }
    
    updatePlayButton() {
        if (this.elements.playPauseBtn) {
            const icon = this.elements.playPauseBtn.querySelector('i');
            if (icon) {
                icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }
    }
    
    updateCurrentTrackInfo() {
        if (this.elements.currentTrack && this.currentTrack) {
            this.elements.currentTrack.textContent = this.currentTrack.title || 'Música sem título';
        }
        
        const activeAlbum = localStorage.getItem('activeAlbum');
        if (this.elements.albumName) {
            if (activeAlbum && window.RADIO_CONFIG?.albums?.[activeAlbum]) {
                this.elements.albumName.textContent = window.RADIO_CONFIG.albums[activeAlbum].name;
            } else {
                this.elements.albumName.textContent = 'Programação Geral';
            }
        }
        
        // Atualizar imagem do álbum
        if (this.elements.albumImage && activeAlbum && window.RADIO_CONFIG?.albums?.[activeAlbum]) {
            this.elements.albumImage.src = window.RADIO_CONFIG.albums[activeAlbum].image;
        }
    }
    
    updateMusicCount() {
        const totalMusic = this.playlists.music.length + 
                          Object.values(this.playlists.albums).reduce((acc, album) => acc + album.length, 0);
        
        if (this.elements.musicCount) {
            this.elements.musicCount.textContent = totalMusic;
        }
    }
    
    updateStartTime() {
        if (this.elements.startTime && this.startTime) {
            this.elements.startTime.textContent = this.startTime.toLocaleTimeString();
        }
    }
    
    updateUI() {
        this.updatePlayButton();
        this.updateCurrentTrackInfo(); 
        this.updateMusicCount();
        this.updateStartTime();
    }
    
    recordPlay(track) {
        this.stats.totalPlayed++;
        this.stats.playHistory.push({
            track: track.title,
            time: new Date(),
            type: track.type || 'music'
        });
        
        // Manter apenas últimas 100 reproduções
        if (this.stats.playHistory.length > 100) {
            this.stats.playHistory = this.stats.playHistory.slice(-100);
        }
        
        this.saveData();
    }
    
    // Funções Admin
    toggleAdminPanel() {
        if (this.elements.adminPanel) {
            this.elements.adminPanel.classList.toggle('hidden');
        }
    }
    
    closeAdminPanel() {
        if (this.elements.adminPanel) {
            this.elements.adminPanel.classList.add('hidden');
        }
        this.isAdmin = false;
        if (this.elements.adminLogin) this.elements.adminLogin.classList.remove('hidden');
        if (this.elements.adminDashboard) this.elements.adminDashboard.classList.add('hidden');
    }
    
    adminLogin() {
        const password = this.elements.adminPassword?.value;
        const correctPassword = window.RADIO_CONFIG?.admin?.password || 'admin123';
        
        if (password === correctPassword) {
            this.isAdmin = true;
            if (this.elements.adminLogin) this.elements.adminLogin.classList.add('hidden');
            if (this.elements.adminDashboard) this.elements.adminDashboard.classList.remove('hidden');
            this.loadAdminData();
            this.showNotification('Login realizado com sucesso!', 'success');
        } else {
            this.showNotification('Senha incorreta!', 'error');
        }
        
        if (this.elements.adminPassword) this.elements.adminPassword.value = '';
    }
    
    switchTab(tabName) {
        // Atualizar botões
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Atualizar conteúdo
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
        
        // Carregar dados específicos da tab
        if (tabName === 'reports') {
            this.loadReports();
        } else if (tabName === 'albums') {
            this.loadAlbumsManager();
        } else if (tabName === 'files') {
            this.loadFilesManager();
        }
    }
    
    loadAdminData() {
        this.loadAlbumsManager();
        this.loadReports();
        this.loadFilesManager();
    }
    
    loadAlbumsManager() {
        const albumGrid = document.getElementById('album-grid');
        if (!albumGrid) return;
        
        albumGrid.innerHTML = '';
        
        const albums = window.RADIO_CONFIG?.albums || {};
        const activeAlbum = localStorage.getItem('activeAlbum');
        
        Object.entries(albums).forEach(([key, album]) => {
            const albumItem = document.createElement('div');
            albumItem.className = `album-item ${activeAlbum === key ? 'active' : ''}`;
            albumItem.innerHTML = `
                <img src="${album.image}" alt="${album.name}">
                <h4>${album.name}</h4>
                <p>${this.playlists.albums[key]?.length || 0} músicas</p>
            `;
            
            albumItem.addEventListener('click', () => this.activateAlbum(key));
            albumGrid.appendChild(albumItem);
        });
    }
    
    activateAlbum(albumKey) {
        localStorage.setItem('activeAlbum', albumKey);
        this.loadAlbumsManager();
        this.updateCurrentTrackInfo();
        this.showNotification(`Álbum ${albumKey} ativado!`, 'success');
    }
    
    loadReports() {
        const reportList = document.getElementById('play-report');
        if (!reportList) return;
        
        reportList.innerHTML = '';
        
        this.stats.playHistory.slice(-20).reverse().forEach(entry => {
            const reportItem = document.createElement('div');
            reportItem.className = 'report-item';
            reportItem.innerHTML = `
                <div>
                    <strong>${entry.track}</strong>
                    <small>${entry.type}</small>
                </div>
                <div>${new Date(entry.time).toLocaleString()}</div>
            `;
            reportList.appendChild(reportItem);
        });
    }
    
    loadFilesManager() {
        const categories = ['music', 'time', 'ads'];
        
        categories.forEach(category => {
            const container = document.getElementById(`${category}-files`);
            if (!container) return;
            
            container.innerHTML = '';
            
            this.playlists[category].forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <span>${file.title}</span>
                    <button onclick="radioSystem.deleteFile('${category}', ${index})" class="delete-file-btn">
                        Excluir
                    </button>
                `;
                container.appendChild(fileItem);
            });
        });
    }
    
    deleteFile(category, index) {
        if (confirm('Tem certeza que deseja excluir este arquivo?')) {
            this.playlists[category].splice(index, 1);
            this.saveData();
            this.loadFilesManager();
            this.updateMusicCount();
            this.showNotification('Arquivo excluído!', 'success');
        }
    }
    
    // Função simulada de upload (sem Cloudinary)
    handleUpload(category) {
        this.showNotification('Upload simulado - funcionalidade em desenvolvimento', 'warning');
        
        // Simular adição de arquivo
        const newFile = {
            title: `Nova música ${category} ${Date.now()}`,
            url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
            duration: 30,
            type: category
        };
        
        if (category === 'album') {
            const albumSelect = document.getElementById('album-select');
            const selectedAlbum = albumSelect?.value || 'natal';
            this.playlists.albums[selectedAlbum].push(newFile);
        } else {
            this.playlists[category].push(newFile);
        }
        
        this.saveData();
        this.updateMusicCount();
        this.loadFilesManager();
    }
    
    // Utilitários
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    showLoading() {
        if (this.elements.loading) {
            this.elements.loading.classList.remove('hidden');
        }
    }
    
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.classList.add('hidden');
        }
    }
    
    showNotification(message, type = 'info') {
        if (!this.elements.notifications) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.elements.notifications.appendChild(notification);
        
        // Auto remover após 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    showError(message) {
        console.error('❌ Erro:', message);
        this.showNotification(message, 'error');
    }
    
    handleAudioError(error) {
        console.error('❌ Erro de áudio:', error);
        this.hideLoading();
        this.isPlaying = false;
        this.updatePlayButton();
        this.showNotification('Erro na reprodução do áudio', 'error');
    }
}

// Funções globais para compatibilidade
window.uploadFiles = function(category) {
    if (window.radioSystem) {
        window.radioSystem.handleUpload(category);
    }
};

window.uploadAlbumFiles = function() {
    if (window.radioSystem) {
        window.radioSystem.handleUpload('album');
    }
};

// Inicializar sistema quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.radioSystem = new RadioSystem();
    });
} else {
    window.radioSystem = new RadioSystem();
}

// Carregar configurações do setup se disponível
if (typeof window.initializeRadioConfig === 'function') {
    window.initializeRadioConfig();
}

console.log('🎵 Script principal da rádio carregado!');
