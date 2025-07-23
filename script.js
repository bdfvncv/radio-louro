// Configuração da Cloudinary
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
    albumCovers: {} // Capas personalizadas dos álbuns
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
    coverUpload: $('coverUpload')
};

// Dados dos álbuns
const albumData = {
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
            
            this.updatePlayHistory(nextTrack);
            updateUI();
            
            if (radioState.isPlaying) {
                elements.audioPlayer.play();
            }
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
        
        showLoading(true);
        
        try {
            const uploadPromises = Array.from(files).map(file => 
                this.uploadToCloudinary(file, category, albumType)
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

    async uploadToCloudinary(file, category, albumType = '') {
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
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString()
        };
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
        
        container.innerHTML = files.length === 0 ? 
            '<p>Nenhum arquivo encontrado.</p>' :
            files.map((file, index) => `
                <div class="file-item">
                    <span class="file-name">${file.name}</span>
                    <button onclick="fileManager.deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️</button>
                </div>
            `).join('');
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
}

// Gerenciador de álbuns
class AlbumManager {
    constructor() {
        this.setupCoversGrid();
    }

    setupCoversGrid() {
        let html = '';
        Object.keys(albumData).forEach(albumKey => {
            const album = albumData[albumKey];
            const coverUrl = radioState.albumCovers[albumKey] || 
                `https://via.placeholder.com/150x150/1a1a1a/ffffff?text=${encodeURIComponent(album.title)}`;
            
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
}

function loadStoredData() {
    const stored = localStorage.getItem('radioState');
    if (stored) {
        const parsedState = JSON.parse(stored);
        radioState = { ...radioState, ...parsedState };
        radioState.sessionId = Date.now(); // Nova sessão
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
        elements.albumCover.src = 'https://via.placeholder.com/300x300/1a1a1a/ffffff?text=Radio+Louro';
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
