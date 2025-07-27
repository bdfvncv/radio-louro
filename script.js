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
    volume: 70,
    playCount: 0,
    activeAlbum: null,
    tracksSinceTime: 0,
    tracksSinceAd: 0,
    lastTimeCheck: 0,
    isLive: false, // Novo: controla se a rádio está ao vivo
    autoPlay: true, // Novo: reprodução automática
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
    },
    playHistory: {},
    albumCovers: { general: null }
};

// Dados dos álbuns
const albumData = {
    general: { title: '📻 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' }
};

// Cache de elementos DOM
let elements = {};

// Inicialização dos elementos
function initElements() {
    try {
        elements = {
            audioPlayer: document.getElementById('audioPlayer'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            skipBtn: document.getElementById('skipBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            albumCover: document.getElementById('albumCover'),
            trackCover: document.getElementById('trackCover'),
            albumTitle: document.getElementById('albumTitle'),
            currentTrack: document.getElementById('currentTrack'),
            trackTime: document.getElementById('trackTime'),
            playStatus: document.getElementById('playStatus'),
            trackCount: document.getElementById('trackCount'),
            playerMode: document.getElementById('playerMode'),
            adminMode: document.getElementById('adminMode'),
            adminBtn: document.getElementById('adminBtn'),
            backToPlayerBtn: document.getElementById('backToPlayerBtn'),
            passwordModal: document.getElementById('passwordModal'),
            adminPassword: document.getElementById('adminPassword'),
            activeAlbumSelect: document.getElementById('activeAlbumSelect'),
            reportList: document.getElementById('reportList'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            coversGrid: document.getElementById('coversGrid'),
            coverModal: document.getElementById('coverModal'),
            coverAlbumName: document.getElementById('coverAlbumName'),
            coverUpload: document.getElementById('coverUpload'),
            liveIndicator: document.getElementById('liveIndicator')
        };
        console.log('Elementos inicializados com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao inicializar elementos:', error);
        return false;
    }
}

// Gerenciador de rádio ao vivo
class LiveRadioManager {
    constructor() {
        this.timeCheckInterval = null;
        this.autoPlayInterval = null;
        this.setupEvents();
        this.startLiveBroadcast();
    }
    
    setupEvents() {
        if (!elements.audioPlayer) return;
        
        elements.audioPlayer.addEventListener('ended', () => this.playNext());
        elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
        elements.audioPlayer.addEventListener('error', () => this.handleError());
        elements.audioPlayer.addEventListener('canplay', () => {
            if (radioState.isLive && radioState.autoPlay) {
                elements.audioPlayer.play().catch(e => console.log('Autoplay bloqueado:', e));
            }
        });
    }
    
    startLiveBroadcast() {
        console.log('🔴 Iniciando transmissão ao vivo...');
        radioState.isLive = true;
        
        // Atualizar status visual
        this.updateLiveStatus();
        
        // Verificar hora certa a cada minuto
        this.timeCheckInterval = setInterval(() => {
            this.checkTimeAnnouncement();
        }, 60000); // 1 minuto
        
        // Iniciar primeira música automaticamente
        setTimeout(() => {
            this.playNext();
            this.enableAutoPlay();
        }, 2000);
        
        // Verificar se há músicas suficientes
        this.checkPlaylistStatus();
    }
    
    enableAutoPlay() {
        if (!radioState.isPlaying && radioState.isLive) {
            radioState.isPlaying = true;
            radioState.autoPlay = true;
            elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
            elements.playStatus.textContent = 'AO VIVO';
            console.log('✅ Rádio ao vivo ativada');
        }
    }
    
    checkPlaylistStatus() {
        const totalMusic = radioState.playlists.music.length;
        const totalAlbumMusic = Object.values(radioState.playlists.albums)
            .reduce((sum, album) => sum + album.length, 0);
        const totalTracks = totalMusic + totalAlbumMusic;
        
        if (totalTracks === 0) {
            elements.currentTrack.textContent = 'Rádio aguardando músicas...';
            console.log('⚠️ Nenhuma música disponível para transmissão');
        } else {
            console.log(`🎵 ${totalTracks} músicas disponíveis para transmissão`);
        }
    }
    
    checkTimeAnnouncement() {
        const now = new Date();
        const minutes = now.getMinutes();
        
        // Hora certa a cada hora cheia (00 minutos)
        if (minutes === 0 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            // Só toca se passou mais de 50 minutos
            if (timeSinceLastTime > 50 * 60 * 1000) {
                console.log('🕐 Tocando hora certa');
                radioState.lastTimeCheck = Date.now();
                radioState.tracksSinceTime = 999; // Força hora certa
                this.playNext();
            }
        }
    }
    
    playNext() {
        const nextTrack = this.getNextTrack();
        
        if (!nextTrack) {
            // Se não há músicas, tenta novamente em 30 segundos
            setTimeout(() => this.playNext(), 30000);
            elements.currentTrack.textContent = 'Aguardando próxima música...';
            return;
        }
        
        radioState.currentTrack = nextTrack;
        elements.audioPlayer.src = nextTrack.url;
        elements.currentTrack.textContent = nextTrack.name;
        
        this.updateTrackCover(nextTrack);
        this.updatePlayHistory(nextTrack);
        
        // Auto-reproduzir se estiver ao vivo
        if (radioState.isLive) {
            elements.audioPlayer.play().catch(e => {
                console.log('Erro no autoplay:', e);
                // Tenta novamente em 5 segundos
                setTimeout(() => {
                    if (radioState.isLive) {
                        elements.audioPlayer.play().catch(() => {});
                    }
                }, 5000);
            });
        }
        
        console.log(`🎵 Tocando: ${nextTrack.name}`);
    }
    
    getNextTrack() {
        // 1. Verificar se deve tocar hora certa
        if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTime = 0;
            radioState.tracksSinceAd++;
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        // 2. Verificar se deve tocar aviso (a cada 5-7 músicas)
        const adInterval = 5 + Math.floor(Math.random() * 3); // 5-7 músicas
        if (radioState.tracksSinceAd >= adInterval && radioState.playlists.ads.length > 0) {
            radioState.tracksSinceAd = 0;
            radioState.tracksSinceTime++;
            return this.getRandomTrack(radioState.playlists.ads);
        }
        
        // 3. Tocar música normal
        let playlist = radioState.playlists.music;
        
        // Se há álbum ativo e tem músicas
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        radioState.tracksSinceTime++;
        radioState.tracksSinceAd++;
        
        return playlist.length > 0 ? this.getRandomTrack(playlist) : null;
    }
    
    getRandomTrack(playlist) {
        if (playlist.length === 0) return null;
        
        // Evitar repetir a música anterior se houver mais de uma opção
        if (playlist.length > 1 && radioState.currentTrack) {
            const filteredPlaylist = playlist.filter(track => 
                track.name !== radioState.currentTrack.name
            );
            if (filteredPlaylist.length > 0) {
                playlist = filteredPlaylist;
            }
        }
        
        return playlist[Math.floor(Math.random() * playlist.length)];
    }
    
    updateTrackCover(track) {
        if (!elements.trackCover || !elements.albumCover) return;
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.albumCover.style.display = 'none';
        } else {
            elements.trackCover.style.display = 'none';
            elements.albumCover.style.display = 'block';
        }
    }
    
    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.playCount++;
        updateUI();
    }
    
    updateTime() {
        if (!radioState.currentTrack || !elements.trackTime) return;
        
        const current = Math.floor(elements.audioPlayer.currentTime);
        const duration = Math.floor(elements.audioPlayer.duration) || 0;
        
        elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateLiveStatus() {
        if (elements.liveIndicator) {
            elements.liveIndicator.textContent = radioState.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
            elements.liveIndicator.style.color = radioState.isLive ? '#ff4757' : '#666';
        }
        
        if (elements.playStatus) {
            elements.playStatus.textContent = radioState.isLive ? 'AO VIVO' : 'Pausado';
        }
    }
    
    handleError() {
        console.error('❌ Erro no áudio, tentando próxima música...');
        // Tenta próxima música após erro
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 3000);
    }
    
    // Método para pausar/retomar transmissão (admin)
    toggleLive() {
        radioState.isLive = !radioState.isLive;
        
        if (radioState.isLive) {
            console.log('🔴 Retomando transmissão ao vivo');
            this.startLiveBroadcast();
        } else {
            console.log('⚫ Pausando transmissão');
            if (this.timeCheckInterval) {
                clearInterval(this.timeCheckInterval);
            }
            elements.audioPlayer.pause();
            radioState.isPlaying = false;
        }
        
        this.updateLiveStatus();
    }
}

// Gerenciador de arquivos (mantido igual)
class SimpleFileManager {
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        showLoading(true);
        
        try {
            const files = Array.from(fileInput.files);
            const uploadedFiles = [];
            
            for (const file of files) {
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
            }
            
            // Adicionar aos playlists
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            this.saveData();
            fileInput.value = '';
            this.refreshFilesList();
            
            // Verificar se deve iniciar transmissão automaticamente
            if (radioState.isLive && !radioState.currentTrack) {
                setTimeout(() => radioManager.playNext(), 1000);
            }
            
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
            music: document.getElementById('musicUpload'),
            time: document.getElementById('timeUpload'),
            ads: document.getElementById('adUpload'),
            album: document.getElementById('albumUpload')
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
    
    refreshFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
    }
    
    refreshCategoryFiles(category) {
        const container = document.getElementById(`${category}Files`);
        if (!container) return;
        
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p style="color: #a0a0a0;">Nenhum arquivo encontrado.</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #a0a0a0; font-size: 0.9rem;">${file.name}</span>
                <button onclick="deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️</button>
            </div>
        `).join('');
    }
    
    refreshAlbumFiles() {
        const container = document.getElementById('albumFiles');
        if (!container) return;
        
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = albumData[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `<h5 style="color: #4facfe; margin: 15px 0 10px;">${album.title}</h5>`;
            if (files.length === 0) {
                html += '<p style="color: #a0a0a0; font-size: 0.8rem;">Nenhum arquivo encontrado.</p>';
            } else {
                html += files.map((file, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #a0a0a0; font-size: 0.8rem;">${file.name}</span>
                        <button onclick="deleteAlbumFile('${albumKey}', ${index})" class="btn-danger btn-small">🗑️</button>
                    </div>
                `).join('');
            }
        });
        
        container.innerHTML = html;
    }
    
    saveData() {
        try {
            localStorage.setItem('radioState', JSON.stringify(radioState));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }
}

// Gerenciador de álbuns (mantido igual)
class SimpleAlbumManager {
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
                    `https://via.placeholder.com/150x150/333/fff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; text-align: center;">
                    <img src="${coverUrl}" alt="${album.title}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="color: #fff; margin-bottom: 10px; font-size: 1rem;">${album.title}</h4>
                    <button onclick="openCoverModal('${albumKey}')" class="btn-secondary btn-small">Alterar</button>
                </div>
            `;
        });
        
        elements.coversGrid.innerHTML = html;
    }
    
    setActiveAlbum() {
        if (!elements.activeAlbumSelect) return;
        
        const selectedAlbum = elements.activeAlbumSelect.value;
        radioState.activeAlbum = selectedAlbum || null;
        updateAlbumDisplay();
        fileManager.saveData();
        
        const message = selectedAlbum ? 
            `Álbum "${albumData[selectedAlbum].title}" ativado! A rádio tocará apenas este álbum.` : 
            'Álbum desativado. A rádio voltou para a playlist geral.';
        
        alert(message);
        
        console.log(selectedAlbum ? 
            `📻 Álbum ativo: ${albumData[selectedAlbum].title}` : 
            '📻 Playlist geral ativa'
        );
    }
}

// Instâncias globais
let radioManager, fileManager, albumManager;

// Inicialização principal
function initializeRadio() {
    console.log('🚀 Iniciando Rádio Supermercado do Louro...');
    
    if (!initElements()) {
        console.error('❌ Falha na inicialização dos elementos');
        return;
    }
    
    loadStoredData();
    
    // Configurar volume
    if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
        elements.audioPlayer.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        elements.volumeValue.textContent = radioState.volume + '%';
    }
    
    // Inicializar gerenciadores
    radioManager = new LiveRadioManager(); // Nova classe principal
    fileManager = new SimpleFileManager();
    albumManager = new SimpleAlbumManager();
    
    setupEventListeners();
    updateUI();
    
    console.log('✅ Rádio inicializada e transmitindo AO VIVO!');
}

function setupEventListeners() {
    // Player - agora controla transmissão ao vivo
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', toggleLiveTransmission);
    }
    if (elements.skipBtn) {
        elements.skipBtn.addEventListener('click', () => {
            if (radioState.isLive) {
                radioManager.playNext();
            }
        });
    }
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', updateVolume);
    }
    
    // Admin
    if (elements.adminBtn) {
        elements.adminBtn.addEventListener('click', openPasswordModal);
    }
    if (elements.backToPlayerBtn) {
        elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
    }
    if (elements.adminPassword) {
        elements.adminPassword.addEventListener('keypress', e => {
            if (e.key === 'Enter') checkPassword();
        });
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
    });
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem('radioState');
        if (stored) {
            const parsedState = JSON.parse(stored);
            radioState = { ...radioState, ...parsedState };
            
            if (!radioState.albumCovers.hasOwnProperty('general')) {
                radioState.albumCovers.general = null;
            }
            
            // Resetar estado de transmissão ao carregar
            radioState.isLive = false;
            radioState.isPlaying = false;
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

// Controles do player - adaptados para rádio ao vivo
function toggleLiveTransmission() {
    if (radioManager) {
        radioManager.toggleLive();
        
        // Atualizar botão
        if (radioState.isLive) {
            elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
            elements.playStatus.textContent = 'AO VIVO';
        } else {
            elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
            elements.playStatus.textContent = 'OFFLINE';
        }
    }
}

function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer || !elements.volumeValue) return;
    
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    fileManager.saveData();
}

// Interface administrativa (mantida igual)
function openPasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.style.display = 'flex';
    }
}

function checkPassword() {
    if (!elements.adminPassword) return;
    
    if (elements.adminPassword.value === 'admin123') {
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
    albumManager.setupCoversGrid();
}

function showPlayerMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'flex';
    if (elements.adminMode) elements.adminMode.style.display = 'none';
}

function switchTab(tabName) {
    // Remove active de todos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adiciona active nos selecionados
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Executa ações específicas da aba
    if (tabName === 'files') fileManager.refreshFilesList();
    if (tabName === 'reports') refreshReports();
    if (tabName === 'albums') albumManager.setupCoversGrid();
}

// Funções de upload
function uploadFiles(category) {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    fileManager.uploadFiles(category, albumType);
}

function setActiveAlbum() {
    albumManager.setActiveAlbum();
}

// Funções de gerenciamento de arquivos
function deleteFile(category, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists[category].splice(index, 1);
    fileManager.saveData();
    fileManager.refreshFilesList();
    alert('Arquivo excluído com sucesso!');
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists.albums[albumKey].splice(index, 1);
    fileManager.saveData();
    fileManager.refreshFilesList();
    alert('Arquivo excluído com sucesso!');
}

// Funções de capa (mantidas iguais)
function openCoverModal(albumKey) {
    if (elements.coverAlbumName) {
        elements.coverAlbumName.textContent = albumData[albumKey].title;
    }
    if (elements.coverModal) {
        elements.coverModal.dataset.albumKey = albumKey;
        elements.coverModal.style.display = 'flex';
    }
}

async function uploadCover() {
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
        
        fileManager.saveData();
        albumManager.setupCoversGrid();
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

function removeCover() {
    const albumKey = elements.coverModal.dataset.albumKey;
    
    if (!radioState.albumCovers[albumKey]) {
        alert('Não há capa para remover!');
        return;
    }
    
    if (!confirm('Tem certeza que deseja remover esta capa?')) return;
    
    delete radioState.albumCovers[albumKey];
    fileManager.saveData();
    albumManager.setupCoversGrid();
    updateAlbumDisplay();
    closeModal('coverModal');
    alert('Capa removida com sucesso!');
}

// Relatórios
function refreshReports() {
    if (!elements.reportList) return;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        elements.reportList.innerHTML = '<p style="color: #a0a0a0;">Nenhuma música foi reproduzida ainda.</p>';
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a);
    
    elements.reportList.innerHTML = sortedHistory.map(([track, count]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #fff; font-size: 1rem;">${track}</span>
            <span style="background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; padding: 5px 12px; border-radius: 15px; font-weight: bold; font-size: 0.8rem;">${count}x</span>
        </div>
    `).join('');
}

function resetPlayCount() {
    if (confirm('Tem certeza que deseja resetar toda a contagem?')) {
        radioState.playHistory = {};
        radioState.playCount = 0;
        updateUI();
        refreshReports();
        fileManager.saveData();
        alert('Contagem resetada com sucesso!');
    }
}

// Funções auxiliares
function updateUI() {
    updateAlbumDisplay();
    if (elements.trackCount) {
        elements.trackCount.textContent = `Músicas: ${radioState.playCount}`;
    }
}

function updateAlbumDisplay() {
    if (!elements.albumCover || !elements.albumTitle) return;
    
    if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
        const album = albumData[radioState.activeAlbum];
        const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
            `https://via.placeholder.com/300x300/333/fff?text=${encodeURIComponent(album.title)}`;
        
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

function showLoading(show) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Limpar campos específicos
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal' && elements.coverUpload) {
        elements.coverUpload.value = '';
    }
}

// Função adicional para controle manual da transmissão (admin)
function toggleTransmission() {
    if (radioManager) {
        radioManager.toggleLive();
        alert(radioState.isLive ? 
            '🔴 Transmissão AO VIVO iniciada!' : 
            '⚫ Transmissão pausada'
        );
    }
}

// Adicionar algumas músicas de exemplo se não houver nenhuma
function addSampleTracks() {
    if (radioState.playlists.music.length === 0) {
        console.log('📻 Adicionando faixas de exemplo...');
        
        // Adicionar algumas URLs de exemplo (substitua por suas músicas)
        const sampleTracks = [
            {
                name: 'Música de Exemplo 1',
                url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                publicId: 'sample1',
                uploadedAt: new Date().toISOString()
            },
            {
                name: 'Música de Exemplo 2', 
                url: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
                publicId: 'sample2',
                uploadedAt: new Date().toISOString()
            }
        ];
        
        // Adicionar apenas se não houver músicas
        radioState.playlists.music = sampleTracks;
        fileManager.saveData();
        
        console.log('✅ Faixas de exemplo adicionadas');
    }
}

// Função para verificar compatibilidade do navegador
function checkBrowserCompatibility() {
    // Verificar se o navegador suporta autoplay
    const audio = document.createElement('audio');
    audio.muted = true;
    audio.play().then(() => {
        console.log('✅ Autoplay suportado');
    }).catch(() => {
        console.log('⚠️ Autoplay bloqueado - usuário precisa interagir primeiro');
        
        // Mostrar aviso para o usuário
        const notice = document.createElement('div');
        notice.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: rgba(255,107,107,0.9); color: white; padding: 15px 25px; 
                        border-radius: 10px; z-index: 9999; text-align: center;">
                <strong>🔊 Clique em qualquer lugar para ativar o áudio da rádio</strong>
                <br><small>Seu navegador requer interação do usuário para reproduzir áudio</small>
            </div>
        `;
        document.body.appendChild(notice);
        
        // Remover aviso após interação
        const enableAudio = () => {
            if (radioState.isLive && elements.audioPlayer) {
                elements.audioPlayer.play().catch(() => {});
            }
            notice.remove();
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
        };
        
        document.addEventListener('click', enableAudio);
        document.addEventListener('touchstart', enableAudio);
    });
}

// Inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, iniciando sistema de rádio ao vivo...');
    
    setTimeout(() => {
        initializeRadio();
        checkBrowserCompatibility();
        
        // Adicionar músicas de exemplo se necessário (descomente se quiser)
        // addSampleTracks();
        
    }, 100);
});

// Inicialização alternativa caso DOMContentLoaded já tenha passado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRadio);
} else {
    initializeRadio();
}

// Manter transmissão ativa mesmo se a página perder foco
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && radioState.isLive) {
        console.log('👁️ Página visível novamente, verificando transmissão...');
        
        // Retomar se necessário
        setTimeout(() => {
            if (radioState.isLive && elements.audioPlayer && elements.audioPlayer.paused) {
                elements.audioPlayer.play().catch(() => {});
            }
        }, 1000);
    }
});

// Limpeza ao sair da página
window.addEventListener('beforeunload', () => {
    if (fileManager) {
        fileManager.saveData();
    }
    console.log('📻 Salvando estado da rádio...');
});

// Tratamento de erros globais
window.addEventListener('error', (e) => {
    console.error('❌ Erro global capturado:', e.error);
    
    // Se houver erro crítico, tentar reiniciar a transmissão
    if (radioState.isLive && radioManager) {
        setTimeout(() => {
            console.log('🔄 Tentando recuperar transmissão...');
            radioManager.playNext();
        }, 5000);
    }
});

console.log('🎵 Sistema de Rádio AO VIVO carregado com sucesso!');
console.log('📻 A rádio iniciará automaticamente e tocará 24h!');
console.log('🔴 Status: Transmissão contínua ativada');
console.log('⏰ Hora certa: A cada hora cheia (se houver arquivos)');
console.log('📢 Avisos: A cada 5-7 músicas (se houver arquivos)');
console.log('🎵 Música: Reprodução aleatória contínua');// Configuração da Cloudinary
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
    volume: 70,
    playCount: 0,
    activeAlbum: null,
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
    },
    playHistory: {},
    albumCovers: { general: null }
};

// Dados dos álbuns
const albumData = {
    general: { title: '📻 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' }
};

// Cache de elementos DOM
let elements = {};

// Inicialização dos elementos
function initElements() {
    try {
        elements = {
            audioPlayer: document.getElementById('audioPlayer'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            skipBtn: document.getElementById('skipBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            albumCover: document.getElementById('albumCover'),
            trackCover: document.getElementById('trackCover'),
            albumTitle: document.getElementById('albumTitle'),
            currentTrack: document.getElementById('currentTrack'),
            trackTime: document.getElementById('trackTime'),
            playStatus: document.getElementById('playStatus'),
            trackCount: document.getElementById('trackCount'),
            playerMode: document.getElementById('playerMode'),
            adminMode: document.getElementById('adminMode'),
            adminBtn: document.getElementById('adminBtn'),
            backToPlayerBtn: document.getElementById('backToPlayerBtn'),
            passwordModal: document.getElementById('passwordModal'),
            adminPassword: document.getElementById('adminPassword'),
            activeAlbumSelect: document.getElementById('activeAlbumSelect'),
            reportList: document.getElementById('reportList'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            coversGrid: document.getElementById('coversGrid'),
            coverModal: document.getElementById('coverModal'),
            coverAlbumName: document.getElementById('coverAlbumName'),
            coverUpload: document.getElementById('coverUpload')
        };
        console.log('Elementos inicializados com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao inicializar elementos:', error);
        return false;
    }
}

// Gerenciador de áudio simplificado
class SimpleAudioManager {
    constructor() {
        this.setupEvents();
    }
    
    setupEvents() {
        if (!elements.audioPlayer) return;
        
        elements.audioPlayer.addEventListener('ended', () => this.playNext());
        elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
        elements.audioPlayer.addEventListener('error', () => this.handleError());
    }
    
    playNext() {
        const playlist = radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0 
            ? radioState.playlists.albums[radioState.activeAlbum]
            : radioState.playlists.music;
            
        if (playlist.length === 0) {
            elements.currentTrack.textContent = 'Nenhuma música disponível';
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * playlist.length);
        const track = playlist[randomIndex];
        
        radioState.currentTrack = track;
        elements.audioPlayer.src = track.url;
        elements.currentTrack.textContent = track.name;
        
        this.updateTrackCover(track);
        this.updatePlayHistory(track);
        
        if (radioState.isPlaying) {
            elements.audioPlayer.play().catch(e => console.log('Erro ao reproduzir:', e));
        }
    }
    
    updateTrackCover(track) {
        if (!elements.trackCover || !elements.albumCover) return;
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.albumCover.style.display = 'none';
        } else {
            elements.trackCover.style.display = 'none';
            elements.albumCover.style.display = 'block';
        }
    }
    
    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.playCount++;
        updateUI();
    }
    
    updateTime() {
        if (!radioState.currentTrack || !elements.trackTime) return;
        
        const current = Math.floor(elements.audioPlayer.currentTime);
        const duration = Math.floor(elements.audioPlayer.duration) || 0;
        
        elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    handleError() {
        console.error('Erro no áudio');
        setTimeout(() => this.playNext(), 2000);
    }
}

// Gerenciador de arquivos
class SimpleFileManager {
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        showLoading(true);
        
        try {
            const files = Array.from(fileInput.files);
            const uploadedFiles = [];
            
            for (const file of files) {
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
            }
            
            // Adicionar aos playlists
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            this.saveData();
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
            music: document.getElementById('musicUpload'),
            time: document.getElementById('timeUpload'),
            ads: document.getElementById('adUpload'),
            album: document.getElementById('albumUpload')
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
    
    refreshFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
    }
    
    refreshCategoryFiles(category) {
        const container = document.getElementById(`${category}Files`);
        if (!container) return;
        
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p style="color: #a0a0a0;">Nenhum arquivo encontrado.</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span style="color: #a0a0a0; font-size: 0.9rem;">${file.name}</span>
                <button onclick="deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️</button>
            </div>
        `).join('');
    }
    
    refreshAlbumFiles() {
        const container = document.getElementById('albumFiles');
        if (!container) return;
        
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = albumData[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `<h5 style="color: #4facfe; margin: 15px 0 10px;">${album.title}</h5>`;
            if (files.length === 0) {
                html += '<p style="color: #a0a0a0; font-size: 0.8rem;">Nenhum arquivo encontrado.</p>';
            } else {
                html += files.map((file, index) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="color: #a0a0a0; font-size: 0.8rem;">${file.name}</span>
                        <button onclick="deleteAlbumFile('${albumKey}', ${index})" class="btn-danger btn-small">🗑️</button>
                    </div>
                `).join('');
            }
        });
        
        container.innerHTML = html;
    }
    
    saveData() {
        try {
            localStorage.setItem('radioState', JSON.stringify(radioState));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }
}

// Gerenciador de álbuns
class SimpleAlbumManager {
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
                    `https://via.placeholder.com/150x150/333/fff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div style="background: rgba(255,255,255,0.05); border-radius: 10px; padding: 15px; text-align: center;">
                    <img src="${coverUrl}" alt="${album.title}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;">
                    <h4 style="color: #fff; margin-bottom: 10px; font-size: 1rem;">${album.title}</h4>
                    <button onclick="openCoverModal('${albumKey}')" class="btn-secondary btn-small">Alterar</button>
                </div>
            `;
        });
        
        elements.coversGrid.innerHTML = html;
    }
    
    setActiveAlbum() {
        if (!elements.activeAlbumSelect) return;
        
        const selectedAlbum = elements.activeAlbumSelect.value;
        radioState.activeAlbum = selectedAlbum || null;
        updateAlbumDisplay();
        fileManager.saveData();
        
        const message = selectedAlbum ? 
            `Álbum "${albumData[selectedAlbum].title}" ativado!` : 
            'Álbum desativado. Tocando playlist geral.';
        
        alert(message);
    }
}

// Instâncias globais
let audioManager, fileManager, albumManager;

// Inicialização principal
function initializeRadio() {
    console.log('Iniciando rádio...');
    
    if (!initElements()) {
        console.error('Falha na inicialização dos elementos');
        return;
    }
    
    loadStoredData();
    
    // Configurar volume
    if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
        elements.audioPlayer.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        elements.volumeValue.textContent = radioState.volume + '%';
    }
    
    // Inicializar gerenciadores
    audioManager = new SimpleAudioManager();
    fileManager = new SimpleFileManager();
    albumManager = new SimpleAlbumManager();
    
    setupEventListeners();
    updateUI();
    
    console.log('Rádio inicializada com sucesso!');
}

function setupEventListeners() {
    // Player
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
    }
    if (elements.skipBtn) {
        elements.skipBtn.addEventListener('click', () => audioManager.playNext());
    }
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', updateVolume);
    }
    
    // Admin
    if (elements.adminBtn) {
        elements.adminBtn.addEventListener('click', openPasswordModal);
    }
    if (elements.backToPlayerBtn) {
        elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
    }
    if (elements.adminPassword) {
        elements.adminPassword.addEventListener('keypress', e => {
            if (e.key === 'Enter') checkPassword();
        });
    }
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
    });
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem('radioState');
        if (stored) {
            const parsedState = JSON.parse(stored);
            radioState = { ...radioState, ...parsedState };
            
            if (!radioState.albumCovers.hasOwnProperty('general')) {
                radioState.albumCovers.general = null;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
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
        elements.audioPlayer.play().catch(e => console.log('Erro ao reproduzir:', e));
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
    fileManager.saveData();
}

// Interface administrativa
function openPasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.style.display = 'flex';
    }
}

function checkPassword() {
    if (!elements.adminPassword) return;
    
    if (elements.adminPassword.value === 'admin123') {
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
    albumManager.setupCoversGrid();
}

function showPlayerMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'flex';
    if (elements.adminMode) elements.adminMode.style.display = 'none';
}

function switchTab(tabName) {
    // Remove active de todos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adiciona active nos selecionados
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Executa ações específicas da aba
    if (tabName === 'files') fileManager.refreshFilesList();
    if (tabName === 'reports') refreshReports();
    if (tabName === 'albums') albumManager.setupCoversGrid();
}

// Funções de upload
function uploadFiles(category) {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    fileManager.uploadFiles(category, albumType);
}

function setActiveAlbum() {
    albumManager.setActiveAlbum();
}

// Funções de gerenciamento de arquivos
function deleteFile(category, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists[category].splice(index, 1);
    fileManager.saveData();
    fileManager.refreshFilesList();
    alert('Arquivo excluído com sucesso!');
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists.albums[albumKey].splice(index, 1);
    fileManager.saveData();
    fileManager.refreshFilesList();
    alert('Arquivo excluído com sucesso!');
}

// Funções de capa
function openCoverModal(albumKey) {
    if (elements.coverAlbumName) {
        elements.coverAlbumName.textContent = albumData[albumKey].title;
    }
    if (elements.coverModal) {
        elements.coverModal.dataset.albumKey = albumKey;
        elements.coverModal.style.display = 'flex';
    }
}

async function uploadCover() {
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
        
        fileManager.saveData();
        albumManager.setupCoversGrid();
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

function removeCover() {
    const albumKey = elements.coverModal.dataset.albumKey;
    
    if (!radioState.albumCovers[albumKey]) {
        alert('Não há capa para remover!');
        return;
    }
    
    if (!confirm('Tem certeza que deseja remover esta capa?')) return;
    
    delete radioState.albumCovers[albumKey];
    fileManager.saveData();
    albumManager.setupCoversGrid();
    updateAlbumDisplay();
    closeModal('coverModal');
    alert('Capa removida com sucesso!');
}

// Relatórios
function refreshReports() {
    if (!elements.reportList) return;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        elements.reportList.innerHTML = '<p style="color: #a0a0a0;">Nenhuma música foi reproduzida ainda.</p>';
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a);
    
    elements.reportList.innerHTML = sortedHistory.map(([track, count]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <span style="color: #fff; font-size: 1rem;">${track}</span>
            <span style="background: linear-gradient(135deg, #4facfe, #00f2fe); color: white; padding: 5px 12px; border-radius: 15px; font-weight: bold; font-size: 0.8rem;">${count}x</span>
        </div>
    `).join('');
}

function resetPlayCount() {
    if (confirm('Tem certeza que deseja resetar toda a contagem?')) {
        radioState.playHistory = {};
        radioState.playCount = 0;
        updateUI();
        refreshReports();
        fileManager.saveData();
        alert('Contagem resetada com sucesso!');
    }
}

// Funções auxiliares
function updateUI() {
    updateAlbumDisplay();
    if (elements.trackCount) {
        elements.trackCount.textContent = `Músicas: ${radioState.playCount}`;
    }
}

function updateAlbumDisplay() {
    if (!elements.albumCover || !elements.albumTitle) return;
    
    if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
        const album = albumData[radioState.activeAlbum];
        const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
            `https://via.placeholder.com/300x300/333/fff?text=${encodeURIComponent(album.title)}`;
        
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

function showLoading(show) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Limpar campos específicos
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal' && elements.coverUpload) {
        elements.coverUpload.value = '';
    }
}

// Inicialização quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando rádio...');
    setTimeout(initializeRadio, 100);
});

// Inicialização alternativa caso DOMContentLoaded já tenha passado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeRadio);
} else {
    initializeRadio();
}

// Limpeza ao sair da página
window.addEventListener('beforeunload', () => {
    if (fileManager) {
        fileManager.saveData();
    }
});

console.log('Script da rádio carregado com sucesso!');
