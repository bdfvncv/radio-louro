// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado da aplicação
let radioState = {
    currentTrack: null,
    isPlaying: false,
    currentIndex: 0,
    playCount: 0,
    tracksSinceTime: 0,
    tracksSinceAd: 0,
    activeAlbum: null,
    volume: 70,
    currentTime: 0,
    sessionId: Date.now(),
    lastSync: Date.now(),
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
    },
    playHistory: {},
    isAdmin: false,
    albumCovers: {
        general: null
    }
};

// Cache de elementos DOM
const $ = id => document.getElementById(id);

// Função para inicializar elementos após DOM carregar
function initializeElements() {
    window.elements = {
        audioPlayer: $('audioPlayer'),
        playPauseBtn: $('playPauseBtn'),
        skipBtn: $('skipBtn'),
        volumeSlider: $('volumeSlider'),
        volumeValue: $('volumeValue'),
        albumCover: $('albumCover'),
        trackCover: $('trackCover'),
        albumTitle: $('albumTitle'),
        currentTrack: $('currentTrack'),
        trackTime: $('trackTime'),
        playStatus: $('playStatus'),
        trackCount: $('trackCount'),
        playerMode: $('playerMode'),
        adminMode: $('adminMode'),
        adminBtn: $('adminBtn'),
        backToPlayerBtn: $('backToPlayerBtn'),
        passwordModal: $('passwordModal'),
        adminPassword: $('adminPassword'),
        activeAlbumSelect: $('activeAlbumSelect'),
        reportList: $('reportList'),
        loadingOverlay: $('loadingOverlay'),
        coversGrid: $('coversGrid'),
        coverModal: $('coverModal'),
        coverAlbumName: $('coverAlbumName'),
        coverUpload: $('coverUpload'),
        trackCoverModal: $('trackCoverModal'),
        trackCoverSongName: $('trackCoverSongName'),
        trackCoverUpload: $('trackCoverUpload'),
        musicWithCover: $('musicWithCover'),
        musicCoverUpload: $('musicCoverUpload')
    };
}

// Dados dos álbuns
const albumData = {
    general: { title: '📻 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas para o clima festivo' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' }
};

// Sistema de sincronização ao vivo
class LiveSync {
    constructor() {
        this.syncInterval = null;
        this.startSync();
    }

    startSync() {
        this.syncInterval = setInterval(() => {
            this.syncWithServer();
        }, 5000);
    }

    syncWithServer() {
        const storedState = localStorage.getItem('radioLiveState');
        if (storedState) {
            const serverState = JSON.parse(storedState);
            
            if (serverState.sessionId !== radioState.sessionId) {
                this.updateFromServer(serverState);
            } else {
                this.updateServer();
            }
        } else {
            this.updateServer();
        }
    }

    updateFromServer(serverState) {
        const wasPlaying = radioState.isPlaying;
        radioState = { ...radioState, ...serverState };
        
        if (radioState.currentTrack && elements.audioPlayer) {
            if (elements.audioPlayer.src !== radioState.currentTrack.url) {
                elements.audioPlayer.src = radioState.currentTrack.url;
                elements.currentTrack.textContent = radioState.currentTrack.name;
            }
            
            if (Math.abs(elements.audioPlayer.currentTime - radioState.currentTime) > 2) {
                elements.audioPlayer.currentTime = radioState.currentTime;
            }
            
            if (radioState.isPlaying && !wasPlaying) {
                elements.audioPlayer.play();
            } else if (!radioState.isPlaying && wasPlaying) {
                elements.audioPlayer.pause();
            }
        }
        
        updateUI();
    }

    updateServer() {
        if (radioState.currentTrack && elements.audioPlayer && !elements.audioPlayer.paused) {
            radioState.currentTime = elements.audioPlayer.currentTime;
        }
        
        radioState.lastSync = Date.now();
        localStorage.setItem('radioLiveState', JSON.stringify(radioState));
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}

// Gerenciador de áudio
class AudioManager {
    constructor() {
        this.setupEventListeners();
        this.timeCheckInterval = null;
        this.startTimeCheck();
    }

    setupEventListeners() {
        if (!elements.audioPlayer) return;
        
        elements.audioPlayer.addEventListener('ended', () => this.playNext());
        elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
        elements.audioPlayer.addEventListener('loadstart', () => showLoading(true));
        elements.audioPlayer.addEventListener('canplay', () => showLoading(false));
        elements.audioPlayer.addEventListener('error', () => this.handleError());
    }

    startTimeCheck() {
        this.timeCheckInterval = setInterval(() => {
            this.checkTimeAnnouncement();
        }, 30000);
    }

    checkTimeAnnouncement() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        if (minutes === 0 && seconds < 30 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            if (timeSinceLastTime > 50 * 60 * 1000) {
                radioState.lastTimeCheck = Date.now();
                this.forceNextTrack('time');
            }
        }
    }

    forceNextTrack(type) {
        if (radioState.isPlaying) {
            radioState.tracksSinceTime = type === 'time' ? 999 : radioState.tracksSinceTime;
            radioState.tracksSinceAd = type === 'ads' ? 999 : radioState.tracksSinceAd;
            this.playNext();
        }
    }

    playNext() {
        const nextTrack = this.getNextTrack();
        if (nextTrack && elements.audioPlayer) {
            radioState.currentTrack = nextTrack;
            elements.audioPlayer.src = nextTrack.url;
            elements.currentTrack.textContent = nextTrack.name;
            radioState.currentTime = 0;
            
            this.updateTrackCover(nextTrack);
            this.updatePlayHistory(nextTrack);
            updateUI();
            
            if (radioState.isPlaying) {
                elements.audioPlayer.play();
            }
        }
    }

    updateTrackCover(track) {
        if (!elements.trackCover || !elements.albumCover) return;
        
        const playerMain = document.querySelector('.player-main');
        const nowPlaying = document.querySelector('.now-playing');
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.trackCover.classList.add('track-cover-fade-in');
            elements.albumCover.style.display = 'none';
            
            if (playerMain) playerMain.classList.add('has-track-cover');
            if (nowPlaying) nowPlaying.classList.add('has-cover');
            
            setTimeout(() => {
                elements.trackCover.classList.remove('track-cover-fade-in');
            }, 500);
        } else {
            elements.trackCover.classList.add('track-cover-fade-out');
            
            setTimeout(() => {
                elements.trackCover.style.display = 'none';
                elements.trackCover.classList.remove('track-cover-fade-out');
                elements.albumCover.style.display = 'block';
                
                if (playerMain) playerMain.classList.remove('has-track-cover');
                if (nowPlaying) nowPlaying.classList.remove('has-cover');
            }, 500);
        }
    }

    getNextTrack() {
        if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTime = 0;
            radioState.tracksSinceAd++;
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        if (radioState.tracksSinceAd >= 6 && radioState.playlists.ads.length > 0) {
            radioState.tracksSinceAd = 0;
            radioState.tracksSinceTime++;
            return this.getRandomTrack(radioState.playlists.ads);
        }
        
        let playlist = radioState.playlists.music;
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        radioState.tracksSinceTime++;
        radioState.tracksSinceAd++;
        
        return playlist.length > 0 ? this.getRandomTrack(playlist) : null;
    }

    getRandomTrack(playlist) {
        return playlist[Math.floor(Math.random() * playlist.length)];
    }

    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.playCount++;
    }

    updateTime() {
        if (radioState.currentTrack && elements.trackTime && elements.audioPlayer) {
            const current = Math.floor(elements.audioPlayer.currentTime);
            const duration = Math.floor(elements.audioPlayer.duration) || 0;
            
            elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
            radioState.currentTime = current;
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    handleError() {
        console.error('Erro no áudio');
        showLoading(false);
        setTimeout(() => this.playNext(), 2000);
    }
}

// Gerenciador de arquivos
class FileManager {
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput) return;
        
        const files = fileInput.files;
        
        if (files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        const withCovers = category === 'music' && elements.musicWithCover && elements.musicWithCover.checked;
        let coverFiles = [];
        
        if (withCovers && elements.musicCoverUpload) {
            coverFiles = Array.from(elements.musicCoverUpload.files);
            if (coverFiles.length > 0 && coverFiles.length !== files.length) {
                alert('O número de capas deve ser igual ao número de músicas!');
                return;
            }
        }
        
        showLoading(true);
        
        try {
            const uploadPromises = Array.from(files).map((file, index) => 
                this.uploadToCloudinary(file, category, albumType, withCovers ? coverFiles[index] : null)
            );
            
            const uploadedFiles = await Promise.all(uploadPromises);
            
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            saveData();
            fileInput.value = '';
            if (elements.musicCoverUpload) elements.musicCoverUpload.value = '';
            this.refreshFilesList();
            alert(`${files.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro no upload. Tente novamente.');
        } finally {
            showLoading(false);
        }
    }

    getFileInput(category) {
        const inputs = {
            music: $('musicUpload'),
            time: $('timeUpload'),
            ads: $('adUpload'),
            album: $('albumUpload')
        };
        return inputs[category];
    }

    async uploadToCloudinary(file, category, albumType = '', coverFile = null) {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro no upload');
        
        const data = await response.json();
        const fileData = {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString()
        };
        
        if (coverFile) {
            try {
                const coverData = await this.uploadCoverToCloudinary(coverFile);
                fileData.coverUrl = coverData.secure_url;
                fileData.coverPublicId = coverData.public_id;
            } catch (error) {
                console.warn('Erro no upload da capa:', error);
            }
        }
        
        return fileData;
    }

    async uploadCoverToCloudinary(coverFile) {
        const formData = new FormData();
        formData.append('file', coverFile);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', 'radio-louro/track-covers');
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro no upload da capa');
        return await response.json();
    }

    refreshFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
    }

    refreshCategoryFiles(category) {
        const container = $(`${category}Files`);
        if (!container) return;
        
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => {
            if (category === 'music') {
                return `
                    <div class="file-item">
                        <div class="file-info">
                            <span class="file-name">${file.name}</span>
                            ${file.coverUrl ? '<span class="file-has-cover">🖼️</span>' : ''}
                        </div>
                        <div class="file-actions">
                            ${!file.coverUrl ? 
                                `<button onclick="fileManager.addTrackCover('music', ${index})" class="btn-secondary btn-small">📷</button>` : 
                                `<button onclick="fileManager.removeTrackCover('music', ${index})" class="btn-danger btn-small">🗑️📷</button>`
                            }
                            <button onclick="fileManager.deleteFile('music', ${index})" class="btn-danger btn-small">🗑️</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <button onclick="fileManager.deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️</button>
                    </div>
                `;
            }
        }).join('');
    }

    refreshAlbumFiles() {
        const container = $('albumFiles');
        if (!container) return;
        
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = albumData[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `<h5>${album.title}</h5>`;
            html += files.length === 0 ? 
                '<p>Nenhum arquivo encontrado.</p>' :
                files.map((file, index) => `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <button onclick="fileManager.deleteFile('album', ${index}, '${albumKey}')" class="btn-danger btn-small">🗑️</button>
                    </div>    getFileInput(category) {
        const inputs = {
            music: $('musicUpload'),
            time: $('timeUpload'),
            ads: $('adUpload'),
            album: $('albumUpload')
        };
        return inputs[category];
    }// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado da aplicação - Centralizado no servidor (simulado)
let radioState = {
    currentTrack: null,
    isPlaying: false,
    currentIndex: 0,
    playCount: 0,
    tracksSinceTime: 0,
    tracksSinceAd: 0,
    activeAlbum: null,
    volume: 70,
    currentTime: 0,
    sessionId: Date.now(), // ID único da sessão
    lastSync: Date.now(),
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
    },
    playHistory: {},
    isAdmin: false,
    albumCovers: { // Capas personalizadas dos álbuns e playlist geral
        general: null // Adicionado para playlist geral
    }
};

// Cache de elementos DOM
const $ = id => document.getElementById(id);
const elements = {
    audioPlayer: $('audioPlayer'),
    playPauseBtn: $('playPauseBtn'),
    skipBtn: $('skipBtn'),
    volumeSlider: $('volumeSlider'),
    volumeValue: $('volumeValue'),
    albumCover: $('albumCover'),
    trackCover: $('trackCover'),
    albumTitle: $('albumTitle'),
    currentTrack: $('currentTrack'),
    trackTime: $('trackTime'),
    playStatus: $('playStatus'),
    trackCount: $('trackCount'),
    playerMode: $('playerMode'),
    adminMode: $('adminMode'),
    adminBtn: $('adminBtn'),
    backToPlayerBtn: $('backToPlayerBtn'),
    passwordModal: $('passwordModal'),
    adminPassword: $('adminPassword'),
    activeAlbumSelect: $('activeAlbumSelect'),
    reportList: $('reportList'),
    loadingOverlay: $('loadingOverlay'),
    coversGrid: $('coversGrid'),
    coverModal: $('coverModal'),
    coverAlbumName: $('coverAlbumName'),
    coverUpload: $('coverUpload'),
    trackCoverModal: $('trackCoverModal'),
    trackCoverSongName: $('trackCoverSongName'),
    trackCoverUpload: $('trackCoverUpload'),
    musicWithCover: $('musicWithCover'),
    musicCoverUpload: $('musicCoverUpload')
};

// Dados dos álbuns
const albumData = {
    general: { title: '📻 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas para o clima festivo' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' }
};

// Sistema de sincronização ao vivo
class LiveSync {
    constructor() {
        this.syncInterval = null;
        this.startSync();
    }

    startSync() {
        // Sincroniza a cada 5 segundos
        this.syncInterval = setInterval(() => {
            this.syncWithServer();
        }, 5000);
    }

    syncWithServer() {
        // Simula sincronização com servidor
        const storedState = localStorage.getItem('radioLiveState');
        if (storedState) {
            const serverState = JSON.parse(storedState);
            
            // Se há uma sessão ativa diferente, sincroniza
            if (serverState.sessionId !== radioState.sessionId) {
                this.updateFromServer(serverState);
            } else {
                // Atualiza o servidor com o estado atual
                this.updateServer();
            }
        } else {
            this.updateServer();
        }
    }

    updateFromServer(serverState) {
        const wasPlaying = radioState.isPlaying;
        const oldTime = radioState.currentTime;
        
        // Atualiza estado local
        radioState = { ...radioState, ...serverState };
        
        // Sincroniza o player
        if (radioState.currentTrack) {
            if (elements.audioPlayer.src !== radioState.currentTrack.url) {
                elements.audioPlayer.src = radioState.currentTrack.url;
                elements.currentTrack.textContent = radioState.currentTrack.name;
            }
            
            // Sincroniza tempo de reprodução
            if (Math.abs(elements.audioPlayer.currentTime - radioState.currentTime) > 2) {
                elements.audioPlayer.currentTime = radioState.currentTime;
            }
            
            // Sincroniza estado de reprodução
            if (radioState.isPlaying && !wasPlaying) {
                elements.audioPlayer.play();
            } else if (!radioState.isPlaying && wasPlaying) {
                elements.audioPlayer.pause();
            }
        }
        
        updateUI();
    }

    updateServer() {
        // Atualiza tempo atual
        if (radioState.currentTrack && !elements.audioPlayer.paused) {
            radioState.currentTime = elements.audioPlayer.currentTime;
        }
        
        radioState.lastSync = Date.now();
        localStorage.setItem('radioLiveState', JSON.stringify(radioState));
    }

    stop() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}

// Gerenciador de áudio otimizado
class AudioManager {
    constructor() {
        this.setupEventListeners();
        this.timeCheckInterval = null;
        this.startTimeCheck();
    }

    setupEventListeners() {
        elements.audioPlayer.addEventListener('ended', () => this.playNext());
        elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
        elements.audioPlayer.addEventListener('loadstart', () => showLoading(true));
        elements.audioPlayer.addEventListener('canplay', () => showLoading(false));
        elements.audioPlayer.addEventListener('error', () => this.handleError());
    }

    startTimeCheck() {
        // Verifica hora certa a cada 30 segundos
        this.timeCheckInterval = setInterval(() => {
            this.checkTimeAnnouncement();
        }, 30000);
    }

    checkTimeAnnouncement() {
        const now = new Date();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        // Toca hora certa aos 00 minutos de cada hora
        if (minutes === 0 && seconds < 30 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            // Só toca se passou mais de 50 minutos
            if (timeSinceLastTime > 50 * 60 * 1000) {
                radioState.lastTimeCheck = Date.now();
                this.forceNextTrack('time');
            }
        }
    }

    forceNextTrack(type) {
        if (radioState.isPlaying) {
            radioState.tracksSinceTime = type === 'time' ? 999 : radioState.tracksSinceTime;
            radioState.tracksSinceAd = type === 'ads' ? 999 : radioState.tracksSinceAd;
            this.playNext();
        }
    }

    playNext() {
        const nextTrack = this.getNextTrack();
        if (nextTrack) {
            radioState.currentTrack = nextTrack;
            elements.audioPlayer.src = nextTrack.url;
            elements.currentTrack.textContent = nextTrack.name;
            radioState.currentTime = 0;
            
            // Atualizar capa da música
            this.updateTrackCover(nextTrack);
            
            this.updatePlayHistory(nextTrack);
            updateUI();
            
            if (radioState.isPlaying) {
                elements.audioPlayer.play();
            }
        }
    }

    updateTrackCover(track) {
        const playerMain = document.querySelector('.player-main');
        const nowPlaying = document.querySelector('.now-playing');
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.trackCover.classList.add('track-cover-fade-in');
            elements.albumCover.style.display = 'none';
            
            // Adicionar classes visuais especiais
            if (playerMain) playerMain.classList.add('has-track-cover');
            if (nowPlaying) nowPlaying.classList.add('has-cover');
            
            // Remover animação após completar
            setTimeout(() => {
                elements.trackCover.classList.remove('track-cover-fade-in');
            }, 500);
        } else {
            elements.trackCover.classList.add('track-cover-fade-out');
            
            setTimeout(() => {
                elements.trackCover.style.display = 'none';
                elements.trackCover.classList.remove('track-cover-fade-out');
                elements.albumCover.style.display = 'block';
                
                // Remover classes visuais especiais
                if (playerMain) playerMain.classList.remove('has-track-cover');
                if (nowPlaying) nowPlaying.classList.remove('has-cover');
            }, 500);
        }
    }

    getNextTrack() {
        // Verificar se deve tocar hora certa
        if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTime = 0;
            radioState.tracksSinceAd++;
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        // Verificar se deve tocar aviso (a cada 6 músicas)
        if (radioState.tracksSinceAd >= 6 && radioState.playlists.ads.length > 0) {
            radioState.tracksSinceAd = 0;
            radioState.tracksSinceTime++;
            return this.getRandomTrack(radioState.playlists.ads);
        }
        
        // Tocar música normal
        let playlist = radioState.playlists.music;
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        radioState.tracksSinceTime++;
        radioState.tracksSinceAd++;
        
        return playlist.length > 0 ? this.getRandomTrack(playlist) : null;
    }

    getRandomTrack(playlist) {
        return playlist[Math.floor(Math.random() * playlist.length)];
    }

    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.playCount++;
    }

    updateTime() {
        if (radioState.currentTrack) {
            const current = Math.floor(elements.audioPlayer.currentTime);
            const duration = Math.floor(elements.audioPlayer.duration) || 0;
            
            elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
            radioState.currentTime = current;
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    handleError() {
        console.error('Erro no áudio');
        showLoading(false);
        setTimeout(() => this.playNext(), 2000);
    }
}

// Gerenciador de arquivos otimizado
class FileManager {
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        const files = fileInput.files;
        
        if (files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        // Verificar se é upload de música com capas
        const withCovers = category === 'music' && elements.musicWithCover && elements.musicWithCover.checked;
        let coverFiles = [];
        
        if (withCovers) {
            coverFiles = Array.from(elements.musicCoverUpload.files);
            if (coverFiles.length > 0 && coverFiles.length !== files.length) {
                alert('O número de capas deve ser igual ao número de músicas!');
                return;
            }
        }
        
        showLoading(true);
        
        try {
            const uploadPromises = Array.from(files).map((file, index) => 
                this.uploadToCloudinary(file, category, albumType, withCovers ? coverFiles[index] : null)
            );
            
            const uploadedFiles = await Promise.all(uploadPromises);
            
            // Adiciona aos playlists
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            saveData();
            fileInput.value = '';
            if (elements.musicCoverUpload) elements.musicCoverUpload.value = '';
            this.refreshFilesList();
            alert(`${files.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro no upload. Tente novamente.');
        } finally {
            showLoading(false);
        }
    }

    async uploadToCloudinary(file, category, albumType = '', coverFile = null) {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro no upload');
        
        const data = await response.json();
        const fileData = {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString()
        };
        
        // Upload da capa se fornecida
        if (coverFile) {
            try {
                const coverData = await this.uploadCoverToCloudinary(coverFile);
                fileData.coverUrl = coverData.secure_url;
                fileData.coverPublicId = coverData.public_id;
            } catch (error) {
                console.warn('Erro no upload da capa:', error);
            }
        }
        
        return fileData;
    }

    async uploadCoverToCloudinary(coverFile) {
        const formData = new FormData();
        formData.append('file', coverFile);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', 'radio-louro/track-covers');
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro no upload da capa');
        return await response.json();
    }

    async addTrackCover(category, index, albumKey = null) {
        const playlist = albumKey ? 
            radioState.playlists.albums[albumKey] : 
            radioState.playlists[category];
        
        const track = playlist[index];
        elements.trackCoverSongName.textContent = track.name;
        elements.trackCoverModal.dataset.category = category;
        elements.trackCoverModal.dataset.index = index;
        elements.trackCoverModal.dataset.albumKey = albumKey || '';
        elements.trackCoverModal.style.display = 'flex';
    }

    async removeTrackCover(category, index, albumKey = null) {
        if (!confirm('Tem certeza que deseja remover a capa desta música?')) return;
        
        showLoading(true);
        
        try {
            const playlist = albumKey ? 
                radioState.playlists.albums[albumKey] : 
                radioState.playlists[category];
            
            const track = playlist[index];
            
            if (track.coverPublicId) {
                await this.deleteFromCloudinary(track.coverPublicId);
            }
            
            delete track.coverUrl;
            delete track.coverPublicId;
            
            saveData();
            this.refreshFilesList();
            
            // Atualizar display se for a música atual
            if (radioState.currentTrack && radioState.currentTrack.name === track.name) {
                audioManager.updateTrackCover(track);
            }
            
            alert('Capa removida com sucesso!');
            
        } catch (error) {
            console.error('Erro ao remover capa:', error);
            alert('Erro ao remover a capa.');
        } finally {
            showLoading(false);
        }
    }

    async deleteFile(category, index, albumKey = null) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
        
        showLoading(true);
        
        try {
            const playlist = albumKey ? 
                radioState.playlists.albums[albumKey] : 
                radioState.playlists[category];
            
            const file = playlist[index];
            
            // Excluir da Cloudinary
            await this.deleteFromCloudinary(file.publicId);
            
            // Remover do estado
            playlist.splice(index, 1);
            saveData();
            this.refreshFilesList();
            alert('Arquivo excluído com sucesso!');
            
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir o arquivo.');
        } finally {
            showLoading(false);
        }
    }

    async deleteFromCloudinary(publicId) {
        const timestamp = Math.round(Date.now() / 1000);
        const signature = await this.generateSignature(publicId, timestamp);
        
        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('signature', signature);
        formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
        formData.append('timestamp', timestamp);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro ao excluir da Cloudinary');
        return await response.json();
    }

    async generateSignature(publicId, timestamp) {
        const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(stringToSign);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Erro ao gerar assinatura:', error);
            return '';
        }
    }

    refreshFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
    }

    refreshCategoryFiles(category) {
        const container = $(`${category}Files`);
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => {
            if (category === 'music') {
                return `
                    <div class="file-item">
                        <div class="file-info">
                            <span class="file-name">${file.name}</span>
                            ${file.coverUrl ? '<span class="file-has-cover">🖼️</span>' : ''}
                        </div>
                        <div class="file-actions">
                            ${!file.coverUrl ? 
                                `<button onclick="fileManager.addTrackCover('music', ${index})" class="btn-secondary btn-small">📷</button>` : 
                                `<button onclick="fileManager.removeTrackCover('music', ${index})" class="btn-danger btn-small">🗑️📷</button>`
                            }
                            <button onclick="fileManager.deleteFile('music', ${index})" class="btn-danger btn-small">🗑️</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <button onclick="fileManager.deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️</button>
                    </div>
                `;
            }
        }).join('');
    }

    refreshAlbumFiles() {
        const container = $('albumFiles');
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = albumData[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `<h5>${album.title}</h5>`;
            html += files.length === 0 ? 
                '<p>Nenhum arquivo encontrado.</p>' :
                files.map((file, index) => `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <button onclick="fileManager.deleteFile('album', ${index}, '${albumKey}')" class="btn-danger btn-small">🗑️</button>
                    </div>
                `).join('');
            html += '<br>';
        });
        
        container.innerHTML = html;
    }

    async deleteFile(category, index, albumKey = null) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
        
        showLoading(true);
        
        try {
            const playlist = albumKey ? 
                radioState.playlists.albums[albumKey] : 
                radioState.playlists[category];
            
            const file = playlist[index];
            
            if (file.publicId) {
                await this.deleteFromCloudinary(file.publicId);
            }
            
            playlist.splice(index, 1);
            saveData();
            this.refreshFilesList();
            alert('Arquivo excluído com sucesso!');
            
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir o arquivo.');
        } finally {
            showLoading(false);
        }
    }

    async deleteFromCloudinary(publicId) {
        const timestamp = Math.round(Date.now() / 1000);
        const signature = await this.generateSignature(publicId, timestamp);
        
        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('signature', signature);
        formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
        formData.append('timestamp', timestamp);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro ao excluir da Cloudinary');
        return await response.json();
    }

    async generateSignature(publicId, timestamp) {
        const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(stringToSign);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Erro ao gerar assinatura:', error);
            return '';
        }
    }

    async addTrackCover(category, index, albumKey = null) {
        const playlist = albumKey ? 
            radioState.playlists.albums[albumKey] : 
            radioState.playlists[category];
        
        const track = playlist[index];
        if (elements.trackCoverSongName) {
            elements.trackCoverSongName.textContent = track.name;
        }
        if (elements.trackCoverModal) {
            elements.trackCoverModal.dataset.category = category;
            elements.trackCoverModal.dataset.index = index;
            elements.trackCoverModal.dataset.albumKey = albumKey || '';
            elements.trackCoverModal.style.display = 'flex';
        }
    }

    async removeTrackCover(category, index, albumKey = null) {
        if (!confirm('Tem certeza que deseja remover a capa desta música?')) return;
        
        showLoading(true);
        
        try {
            const playlist = albumKey ? 
                radioState.playlists.albums[albumKey] : 
                radioState.playlists[category];
            
            const track = playlist[index];
            
            if (track.coverPublicId) {
                await this.deleteFromCloudinary(track.coverPublicId);
            }
            
            delete track.coverUrl;
            delete track.coverPublicId;
            
            saveData();
            this.refreshFilesList();
            
            if (radioState.currentTrack && radioState.currentTrack.name === track.name && window.audioManager) {
                audioManager.updateTrackCover(track);
            }
            
            alert('Capa removida com sucesso!');
            
        } catch (error) {
            console.error('Erro ao remover capa:', error);
            alert('Erro ao remover a capa.');
        } finally {
            showLoading(false);
        }
    }
}

// Gerenciador de álbuns
class AlbumManager {
    constructor() {
        this.setupCoversGrid();
    }

    setupCoversGrid() {
        if (!elements.coversGrid) return;
        
        let html = '';
        
        Object.keys(albumData).forEach(albumKey => {
            const album = albumData[albumKey];
            let coverUrl;
            
            if (albumKey === 'general') {
                coverUrl = radioState.albumCovers.general || 
                    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
            } else {
                coverUrl = radioState.albumCovers[albumKey] || 
                    `https://via.placeholder.com/150x150/1a1a1a/ffffff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div class="cover-item">
                    <img src="${coverUrl}" alt="${album.title}">
                    <h4>${album.title}</h4>
                    <button onclick="albumManager.openCoverModal('${albumKey}')" class="btn-secondary btn-small">Alterar Capa</button>
                </div>
            `;
        });
        
        elements.coversGrid.innerHTML = html;
    }

    openCoverModal(albumKey) {
        if (elements.coverAlbumName) {
            elements.coverAlbumName.textContent = albumData[albumKey].title;
        }
        if (elements.coverModal) {
            elements.coverModal.dataset.albumKey = albumKey;
            elements.coverModal.style.display = 'flex';
        }
    }

    async uploadCover() {
        const albumKey = elements.coverModal.dataset.albumKey;
        const file = elements.coverUpload.files[0];
        
        if (!file) {
            alert('Selecione uma imagem!');
            return;
        }
        
        showLoading(true);
        
        try {
            if (radioState.albumCovers[albumKey]) {
                await this.removeCoverFromCloudinary(albumKey);
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            formData.append('folder', `radio-louro/covers`);
            
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Erro no upload');
            
            const data = await response.json();
            radioState.albumCovers[albumKey] = data.secure_url;
            
            if (!radioState.coverPublicIds) radioState.coverPublicIds = {};
            radioState.coverPublicIds[albumKey] = data.public_id;
            
            saveData();
            this.setupCoversGrid();
            updateAlbumDisplay();
            closeModal('coverModal');
            alert('Capa alterada com sucesso!');
            
        } catch (error) {
            console.error('Erro no upload da capa:', error);
            alert('Erro ao alterar a capa.');
        } finally {
            showLoading(false);
        }
    }

    async removeCover() {
        const albumKey = elements.coverModal.dataset.albumKey;
        
        if (!radioState.albumCovers[albumKey]) {
            alert('Não há capa para remover!');
            return;
        }
        
        if (!confirm('Tem certeza que deseja remover esta capa?')) return;
        
        showLoading(true);
        
        try {
            await this.removeCoverFromCloudinary(albumKey);
            
            delete radioState.albumCovers[albumKey];
            if (radioState.coverPublicIds && radioState.coverPublicIds[albumKey]) {
                delete radioState.coverPublicIds[albumKey];
            }
            
            saveData();
            this.setupCoversGrid();
            updateAlbumDisplay();
            closeModal('coverModal');
            alert('Capa removida com sucesso!');
            
        } catch (error) {
            console.error('Erro ao remover capa:', error);
            alert('Erro ao remover a capa.');
        } finally {
            showLoading(false);
        }
    }

    async removeCoverFromCloudinary(albumKey) {
        if (!radioState.coverPublicIds || !radioState.coverPublicIds[albumKey]) {
            console.warn('PublicId não encontrado para', albumKey);
            return;
        }
        
        const publicId = radioState.coverPublicIds[albumKey];
        const timestamp = Math.round(Date.now() / 1000);
        const signature = await this.generateSignature(publicId, timestamp);
        
        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('signature', signature);
        formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
        formData.append('timestamp', timestamp);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro ao excluir da Cloudinary');
        return await response.json();
    }

    async generateSignature(publicId, timestamp) {
        const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(stringToSign);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Erro ao gerar assinatura:', error);
            return '';
        }
    }

    setActiveAlbum() {
        if (!elements.activeAlbumSelect) return;
        
        const selectedAlbum = elements.activeAlbumSelect.value;
        radioState.activeAlbum = selectedAlbum || null;
        updateAlbumDisplay();
        saveData();
        
        const message = selectedAlbum ? 
            `Álbum "${albumData[selectedAlbum].title}" ativado!` : 
            'Álbum desativado. Tocando playlist geral.';
        
        alert(message);
    }
}

// Instâncias globais
let liveSync, audioManager, fileManager, albumManager;

// Funções de inicialização
function initializeRadio() {
    initializeElements();
    loadStoredData();
    
    if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
        elements.audioPlayer.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        elements.volumeValue.textContent = radioState.volume + '%';
    }
    
    liveSync = new LiveSync();
    audioManager = new AudioManager();
    fileManager = new FileManager();
    albumManager = new AlbumManager();
    
    setupEventListeners();
    updateUI();
    
    setTimeout(() => {
        if (!radioState.currentTrack) {
            audioManager.playNext();
        }
    }, 1000);
}

function setupEventListeners() {
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
    }
    if (elements.skipBtn) {
        elements.skipBtn.addEventListener('click', () => audioManager.playNext());
    }
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', updateVolume);
    }
    
    if (elements.adminBtn) {
        elements.adminBtn.addEventListener('click', () => {
            if (elements.passwordModal) {
                elements.passwordModal.style.display = 'flex';
            }
        });
    }
    if (elements.backToPlayerBtn) {
        elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
    }
    if (elements.adminPassword) {
        elements.adminPassword.addEventListener('keypress', e => {
            if (e.key === 'Enter') checkPassword();
        });
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
    });
    
    if (elements.activeAlbumSelect) {
        elements.activeAlbumSelect.addEventListener('change', updateAlbumPreview);
    }
    
    if (elements.musicWithCover) {
        elements.musicWithCover.addEventListener('change', (e) => {
            if (elements.musicCoverUpload) {
                elements.musicCoverUpload.style.display = e.target.checked ? 'block' : 'none';
            }
        });
    }
}

function loadStoredData() {
    const stored = localStorage.getItem('radioState');
    if (stored) {
        const parsedState = JSON.parse(stored);
        radioState = { ...radioState, ...parsedState };
        radioState.sessionId = Date.now();
        
        if (!radioState.albumCovers.hasOwnProperty('general')) {
            radioState.albumCovers.general = null;
        }
    }
}

function saveData() {
    localStorage.setItem('radioState', JSON.stringify(radioState));
}

// Controles do player
function togglePlayPause() {
    if (!elements.audioPlayer || !elements.playPauseBtn || !elements.playStatus) return;
    
    if (radioState.isPlaying) {
        elements.audioPlayer.pause();
        radioState.isPlaying = false;
        elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
        elements.playStatus.textContent = 'Pausado';
    } else {
        if (!radioState.currentTrack) {
            audioManager.playNext();
        }
        elements.audioPlayer.play();
        radioState.isPlaying = true;
        elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
        elements.playStatus.textContent = 'Tocando';
    }
}

function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer || !elements.volumeValue) return;
    
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    saveData();
}

// Interface administrativa
function checkPassword() {
    if (!elements.adminPassword) return;
    
    if (elements.adminPassword.value === 'admin123') {
        radioState.isAdmin = true;
        closeModal('passwordModal');
        showAdminMode();
    } else {
        alert('Senha incorreta!');
        elements.adminPassword.value = '';
    }
}

function showAdminMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'none';
    if (elements.adminMode) elements.adminMode.style.display = 'block';
    fileManager.refreshFilesList();
    refreshReports();
}

function showPlayerMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'flex';
    if (elements.adminMode) elements.adminMode.style.display = 'none';
    radioState.isAdmin = false;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = $(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    if (tabName === 'files') fileManager.refreshFilesList();
    if (tabName === 'reports') refreshReports();
    if (tabName === 'albums') albumManager.setupCoversGrid();
}

// Funções de upload
function uploadFiles(category) {
    const albumType = category === 'album' ? $('albumSelect')?.value : '';
    fileManager.uploadFiles(category, albumType);
}

function setActiveAlbum() {
    albumManager.setActiveAlbum();
}

function uploadCover() {
    albumManager.uploadCover();
}

function removeCover() {
    albumManager.removeCover();
}

// Função para upload de capa de música individual
async function uploadTrackCover() {
    if (!elements.trackCoverModal || !elements.trackCoverUpload) return;
    
    const category = elements.trackCoverModal.dataset.category;
    const index = parseInt(elements.trackCoverModal.dataset.index);
    const albumKey = elements.trackCoverModal.dataset.albumKey || null;
    const file = elements.trackCoverUpload.files[0];
    
    if (!file) {
        alert('Selecione uma imagem!');
        return;
    }
    
    showLoading(true);
    
    try {
        const coverData = await fileManager.uploadCoverToCloudinary(file);
        
        const playlist = albumKey ? 
            radioState.playlists.albums[albumKey] : 
            radioState.playlists[category];
        
        const track = playlist[index];
        
        if (track.coverPublicId) {
            await fileManager.deleteFromCloudinary(track.coverPublicId);
        }
        
        track.coverUrl = coverData.secure_url;
        track.coverPublicId = coverData.public_id;
        
        saveData();
        fileManager.refreshFilesList();
        
        if (radioState.currentTrack && radioState.currentTrack.name === track.name) {
            radioState.currentTrack.coverUrl = track.coverUrl;
            audioManager.updateTrackCover(track);
        }
        
        closeModal('trackCoverModal');
        alert('Capa adicionada com sucesso!');
        
    } catch (error) {
        console.error('Erro no upload da capa:', error);
        alert('Erro ao adicionar a capa.');
    } finally {
        showLoading(false);
    }
}

// Relatórios
function refreshReports() {
    if (!elements.reportList) return;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        elements.reportList.innerHTML = '<p>Nenhuma música foi reproduzida ainda.</p>';
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a);
    
    elements.reportList.innerHTML = sortedHistory.map(([track, count]) => `
        <div class="report-item">
            <span class="track-name">${track}</span>
            <span class="play-count">${count}x</span>
        </div>
    `).join('');
}

function resetPlayCount() {
    if (confirm('Tem certeza que deseja resetar toda a contagem?')) {
        radioState.playHistory = {};
        radioState.playCount = 0;
        updateUI();
        refreshReports();
        saveData();
        alert('Contagem resetada com sucesso!');
    }
}

// Funções auxiliares
function updateUI() {
    updateAlbumDisplay();
    if (elements.trackCount) {
        elements.trackCount.textContent = `Músicas tocadas: ${radioState.playCount}`;
    }
}

function updateAlbumDisplay() {
    if (!elements.albumCover || !elements.albumTitle) return;
    
    if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
        const album = albumData[radioState.activeAlbum];
        const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
            `https://via.placeholder.com/300x300/1a1a1a/ffffff?text=${encodeURIComponent(album.title)}`;
        
        elements.albumCover.src = coverUrl;
        elements.albumTitle.textContent = album.title;
    } else {
        const coverUrl = radioState.albumCovers.general || 
            'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
        
        elements.albumCover.src = coverUrl;
        elements.albumTitle.textContent = 'Playlist Geral';
    }
    
    if (elements.activeAlbumSelect) {
        elements.activeAlbumSelect.value = radioState.activeAlbum || '';
    }
}

function updateAlbumPreview() {
    // Implementação pode ser adicionada se necessário
}

function showLoading(show) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function closeModal(modalId) {
    const modal = $(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal' && elements.coverUpload) {
        elements.coverUpload.value = '';
    }
    if (modalId === 'trackCoverModal' && elements.trackCoverUpload) {
        elements.trackCoverUpload.value = '';
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', initializeRadio);

// Limpeza ao sair
window.addEventListener('beforeunload', () => {
    if (liveSync) liveSync.stop();
    if (audioManager && audioManager.timeCheckInterval) {
        clearInterval(audioManager.timeCheckInterval);
    }
});
}

// Gerenciador de álbuns
class AlbumManager {
    constructor() {
        this.setupCoversGrid();
    }

    setupCoversGrid() {
        let html = '';
        
        // Incluir playlist geral primeiro
        Object.keys(albumData).forEach(albumKey => {
            const album = albumData[albumKey];
            let coverUrl;
            
            if (albumKey === 'general') {
                // Capa da playlist geral
                coverUrl = radioState.albumCovers.general || 
                    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
            } else {
                // Capas dos álbuns especiais
                coverUrl = radioState.albumCovers[albumKey] || 
                    `https://via.placeholder.com/150x150/1a1a1a/ffffff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div class="cover-item">
                    <img src="${coverUrl}" alt="${album.title}">
                    <h4>${album.title}</h4>
                    <button onclick="albumManager.openCoverModal('${albumKey}')" class="btn-secondary btn-small">Alterar Capa</button>
                </div>
            `;
        });
        
        elements.coversGrid.innerHTML = html;
    }

    openCoverModal(albumKey) {
        elements.coverAlbumName.textContent = albumData[albumKey].title;
        elements.coverModal.dataset.albumKey = albumKey;
        elements.coverModal.style.display = 'flex';
    }

    async uploadCover() {
        const albumKey = elements.coverModal.dataset.albumKey;
        const file = elements.coverUpload.files[0];
        
        if (!file) {
            alert('Selecione uma imagem!');
            return;
        }
        
        showLoading(true);
        
        try {
            // Remover capa anterior se existir
            if (radioState.albumCovers[albumKey]) {
                await this.removeCoverFromCloudinary(albumKey);
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            formData.append('folder', `radio-louro/covers`);
            
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Erro no upload');
            
            const data = await response.json();
            radioState.albumCovers[albumKey] = data.secure_url;
            
            // Armazenar o publicId para poder excluir depois
            if (!radioState.coverPublicIds) radioState.coverPublicIds = {};
            radioState.coverPublicIds[albumKey] = data.public_id;
            
            saveData();
            this.setupCoversGrid();
            updateAlbumDisplay();
            closeModal('coverModal');
            alert('Capa alterada com sucesso!');
            
        } catch (error) {
            console.error('Erro no upload da capa:', error);
            alert('Erro ao alterar a capa.');
        } finally {
            showLoading(false);
        }
    }

    async removeCover() {
        const albumKey = elements.coverModal.dataset.albumKey;
        
        if (!radioState.albumCovers[albumKey]) {
            alert('Não há capa para remover!');
            return;
        }
        
        if (!confirm('Tem certeza que deseja remover esta capa?')) return;
        
        showLoading(true);
        
        try {
            // Remover da Cloudinary
            await this.removeCoverFromCloudinary(albumKey);
            
            // Limpar do estado
            delete radioState.albumCovers[albumKey];
            if (radioState.coverPublicIds && radioState.coverPublicIds[albumKey]) {
                delete radioState.coverPublicIds[albumKey];
            }
            
            saveData();
            this.setupCoversGrid();
            updateAlbumDisplay();
            closeModal('coverModal');
            alert('Capa removida com sucesso!');
            
        } catch (error) {
            console.error('Erro ao remover capa:', error);
            alert('Erro ao remover a capa.');
        } finally {
            showLoading(false);
        }
    }

    async removeCoverFromCloudinary(albumKey) {
        if (!radioState.coverPublicIds || !radioState.coverPublicIds[albumKey]) {
            console.warn('PublicId não encontrado para', albumKey);
            return;
        }
        
        const publicId = radioState.coverPublicIds[albumKey];
        const timestamp = Math.round(Date.now() / 1000);
        const signature = await this.generateSignature(publicId, timestamp);
        
        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('signature', signature);
        formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
        formData.append('timestamp', timestamp);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro ao excluir da Cloudinary');
        return await response.json();
    }

    async generateSignature(publicId, timestamp) {
        const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
        
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(stringToSign);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Erro ao gerar assinatura:', error);
            return '';
        }
    }

    setActiveAlbum() {
        const selectedAlbum = elements.activeAlbumSelect.value;
        radioState.activeAlbum = selectedAlbum || null;
        updateAlbumDisplay();
        saveData();
        
        const message = selectedAlbum ? 
            `Álbum "${albumData[selectedAlbum].title}" ativado!` : 
            'Álbum desativado. Tocando playlist geral.';
        
        alert(message);
    }
}

// Instâncias globais
let liveSync, audioManager, fileManager, albumManager;

// Funções de inicialização
function initializeRadio() {
    // Carregar dados salvos
    loadStoredData();
    
    // Configurar volume
    elements.audioPlayer.volume = radioState.volume / 100;
    elements.volumeSlider.value = radioState.volume;
    elements.volumeValue.textContent = radioState.volume + '%';
    
    // Inicializar gerenciadores
    liveSync = new LiveSync();
    audioManager = new AudioManager();
    fileManager = new FileManager();
    albumManager = new AlbumManager();
    
    // Configurar eventos
    setupEventListeners();
    updateUI();
    
    // Auto-iniciar reprodução
    setTimeout(() => {
        if (!radioState.currentTrack) {
            audioManager.playNext();
        }
    }, 1000);
}

function setupEventListeners() {
    // Player
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.skipBtn.addEventListener('click', () => audioManager.playNext());
    elements.volumeSlider.addEventListener('input', updateVolume);
    
    // Admin
    elements.adminBtn.addEventListener('click', () => elements.passwordModal.style.display = 'flex');
    elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
    elements.adminPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') checkPassword();
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
    });
    
    // Albums
    elements.activeAlbumSelect.addEventListener('change', updateAlbumPreview);
    
    // Music cover upload checkbox
    if (elements.musicWithCover) {
        elements.musicWithCover.addEventListener('change', (e) => {
            elements.musicCoverUpload.style.display = e.target.checked ? 'block' : 'none';
        });
    }
}

function loadStoredData() {
    const stored = localStorage.getItem('radioState');
    if (stored) {
        const parsedState = JSON.parse(stored);
        radioState = { ...radioState, ...parsedState };
        radioState.sessionId = Date.now(); // Nova sessão
        
        // Garantir que o objeto albumCovers tenha a propriedade general
        if (!radioState.albumCovers.hasOwnProperty('general')) {
            radioState.albumCovers.general = null;
        }
    }
}

function saveData() {
    localStorage.setItem('radioState', JSON.stringify(radioState));
}

// Controles do player
function togglePlayPause() {
    if (radioState.isPlaying) {
        elements.audioPlayer.pause();
        radioState.isPlaying = false;
        elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
        elements.playStatus.textContent = 'Pausado';
    } else {
        if (!radioState.currentTrack) {
            audioManager.playNext();
        }
        elements.audioPlayer.play();
        radioState.isPlaying = true;
        elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
        elements.playStatus.textContent = 'Tocando';
    }
}

function updateVolume() {
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    saveData();
}

// Interface administrativa
function checkPassword() {
    if (elements.adminPassword.value === 'admin123') {
        radioState.isAdmin = true;
        closeModal('passwordModal');
        showAdminMode();
    } else {
        alert('Senha incorreta!');
        elements.adminPassword.value = '';
    }
}

function showAdminMode() {
    elements.playerMode.style.display = 'none';
    elements.adminMode.style.display = 'block';
    fileManager.refreshFilesList();
    refreshReports();
}

function showPlayerMode() {
    elements.playerMode.style.display = 'flex';
    elements.adminMode.style.display = 'none';
    radioState.isAdmin = false;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    $(`${tabName}-tab`).classList.add('active');
    
    if (tabName === 'files') fileManager.refreshFilesList();
    if (tabName === 'reports') refreshReports();
    if (tabName === 'albums') albumManager.setupCoversGrid();
}

// Funções de upload (interface para classes)
function uploadFiles(category) {
    const albumType = category === 'album' ? $('albumSelect').value : '';
    fileManager.uploadFiles(category, albumType);
}

function setActiveAlbum() {
    albumManager.setActiveAlbum();
}

function uploadCover() {
    albumManager.uploadCover();
}

function removeCover() {
    albumManager.removeCover();
}

// Função para upload de capa de música individual
async function uploadTrackCover() {
    const category = elements.trackCoverModal.dataset.category;
    const index = parseInt(elements.trackCoverModal.dataset.index);
    const albumKey = elements.trackCoverModal.dataset.albumKey || null;
    const file = elements.trackCoverUpload.files[0];
    
    if (!file) {
        alert('Selecione uma imagem!');
        return;
    }
    
    showLoading(true);
    
    try {
        const coverData = await fileManager.uploadCoverToCloudinary(file);
        
        const playlist = albumKey ? 
            radioState.playlists.albums[albumKey] : 
            radioState.playlists[category];
        
        const track = playlist[index];
        
        // Remover capa anterior se existir
        if (track.coverPublicId) {
            await fileManager.deleteFromCloudinary(track.coverPublicId);
        }
        
        track.coverUrl = coverData.secure_url;
        track.coverPublicId = coverData.public_id;
        
        saveData();
        fileManager.refreshFilesList();
        
        // Atualizar display se for a música atual
        if (radioState.currentTrack && radioState.currentTrack.name === track.name) {
            radioState.currentTrack.coverUrl = track.coverUrl;
            audioManager.updateTrackCover(track);
        }
        
        closeModal('trackCoverModal');
        alert('Capa adicionada com sucesso!');
        
    } catch (error) {
        console.error('Erro no upload da capa:', error);
        alert('Erro ao adicionar a capa.');
    } finally {
        showLoading(false);
    }
}

// Relatórios
function refreshReports() {
    const container = elements.reportList;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        container.innerHTML = '<p>Nenhuma música foi reproduzida ainda.</p>';
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a);
    
    container.innerHTML = sortedHistory.map(([track, count]) => `
        <div class="report-item">
            <span class="track-name">${track}</span>
            <span class="play-count">${count}x</span>
        </div>
    `).join('');
}

function resetPlayCount() {
    if (confirm('Tem certeza que deseja resetar toda a contagem?')) {
        radioState.playHistory = {};
        radioState.playCount = 0;
        updateUI();
        refreshReports();
        saveData();
        alert('Contagem resetada com sucesso!');
    }
}

// Funções auxiliares
function updateUI() {
    updateAlbumDisplay();
    elements.trackCount.textContent = `Músicas tocadas: ${radioState.playCount}`;
}

function updateAlbumDisplay() {
    if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
        const album = albumData[radioState.activeAlbum];
        const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
            `https://via.placeholder.com/300x300/1a1a1a/ffffff?text=${encodeURIComponent(album.title)}`;
        
        elements.albumCover.src = coverUrl;
        elements.albumTitle.textContent = album.title;
    } else {
        // Playlist geral
        const coverUrl = radioState.albumCovers.general || 
            'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
        
        elements.albumCover.src = coverUrl;
        elements.albumTitle.textContent = 'Playlist Geral';
    }
    
    if (elements.activeAlbumSelect) {
        elements.activeAlbumSelect.value = radioState.activeAlbum || '';
    }
}

function updateAlbumPreview() {
    // Implementação pode ser adicionada se necessário
}

function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function closeModal(modalId) {
    $(modalId).style.display = 'none';
    if (modalId === 'passwordModal') {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal') {
        elements.coverUpload.value = '';
    }
    if (modalId === 'trackCoverModal') {
        elements.trackCoverUpload.value = '';
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', initializeRadio);

// Limpeza ao sair
window.addEventListener('beforeunload', () => {
    if (liveSync) liveSync.stop();
    if (audioManager && audioManager.timeCheckInterval) {
        clearInterval(audioManager.timeCheckInterval);
    }
});
