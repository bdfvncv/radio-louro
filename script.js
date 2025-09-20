// 🎵 RÁDIO SUPERMERCADO DO LOURO - SCRIPT CORRIGIDO
// ===================================================

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
    isLive: false,
    autoPlay: true,
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
let isInitialized = false;

// Verificar localStorage
function safeLocalStorage() {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.warn('localStorage não disponível, usando memória');
        return false;
    }
}

// Inicialização dos elementos
function initElements() {
    try {
        const elementIds = [
            'audioPlayer', 'playPauseBtn', 'skipBtn', 'volumeSlider',
            'volumeValue', 'albumCover', 'trackCover', 'albumTitle',
            'currentTrack', 'trackTime', 'playStatus', 'trackCount',
            'playerMode', 'adminMode', 'adminBtn', 'backToPlayerBtn',
            'passwordModal', 'adminPassword', 'activeAlbumSelect',
            'reportList', 'loadingOverlay', 'coversGrid',
            'coverModal', 'coverAlbumName', 'coverUpload', 'liveIndicator'
        ];
        
        elements = {};
        let missing = [];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                missing.push(id);
                console.warn(`Elemento não encontrado: ${id}`);
            }
        });
        
        // Verificar elementos críticos
        const critical = ['audioPlayer', 'playPauseBtn', 'currentTrack'];
        const missingCritical = critical.filter(id => !elements[id]);
        
        if (missingCritical.length > 0) {
            console.error('❌ Elementos críticos não encontrados:', missingCritical);
            return false;
        }
        
        console.log('✅ Elementos inicializados:', Object.keys(elements).length);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao inicializar elementos:', error);
        return false;
    }
}

// Gerenciador de rádio ao vivo
class LiveRadioManager {
    constructor() {
        this.timeCheckInterval = null;
        this.isManagerInitialized = false;
        this.setupEvents();
        
        setTimeout(() => {
            this.startLiveBroadcast();
        }, 1000);
    }
    
    setupEvents() {
        if (!elements.audioPlayer) {
            console.error('❌ AudioPlayer não encontrado');
            return;
        }
        
        try {
            elements.audioPlayer.addEventListener('ended', () => this.playNext());
            elements.audioPlayer.addEventListener('timeupdate', () => this.updateTime());
            elements.audioPlayer.addEventListener('error', (e) => this.handleError(e));
            elements.audioPlayer.addEventListener('canplay', () => {
                if (radioState.isLive && radioState.autoPlay) {
                    elements.audioPlayer.play().catch(e => {
                        console.log('Autoplay bloqueado:', e.message);
                        this.showAutoplayPrompt();
                    });
                }
            });
            
            console.log('✅ Event listeners configurados');
            
        } catch (error) {
            console.error('❌ Erro ao configurar eventos:', error);
        }
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.innerHTML = `
            <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                        background: rgba(255,107,107,0.9); color: white; padding: 15px 25px; 
                        border-radius: 10px; z-index: 9999; text-align: center; cursor: pointer;">
                🔊 Clique aqui para ativar o áudio da rádio
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        const enableAudio = () => {
            if (radioState.isLive && elements.audioPlayer) {
                elements.audioPlayer.play().catch(() => {});
            }
            prompt.remove();
        };
        
        prompt.addEventListener('click', enableAudio);
        setTimeout(() => prompt.remove(), 10000);
    }
    
    startLiveBroadcast() {
        if (this.isManagerInitialized) return;
        
        console.log('🔴 Iniciando transmissão ao vivo...');
        radioState.isLive = true;
        this.isManagerInitialized = true;
        
        this.updateLiveStatus();
        
        // Verificar hora certa com segurança
        this.timeCheckInterval = setInterval(() => {
            try {
                this.checkTimeAnnouncement();
            } catch (error) {
                console.error('Erro na verificação de hora:', error);
            }
        }, 60000);
        
        setTimeout(() => {
            this.playNext();
            this.enableAutoPlay();
        }, 2000);
        
        this.checkPlaylistStatus();
    }
    
    enableAutoPlay() {
        if (!radioState.isPlaying && radioState.isLive) {
            radioState.isPlaying = true;
            radioState.autoPlay = true;
            if (elements.playPauseBtn) {
                elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
            }
            if (elements.playStatus) {
                elements.playStatus.textContent = 'AO VIVO';
            }
            console.log('✅ Rádio ao vivo ativada');
        }
    }
    
    checkPlaylistStatus() {
        const totalMusic = radioState.playlists.music.length;
        const totalAlbumMusic = Object.values(radioState.playlists.albums)
            .reduce((sum, album) => sum + album.length, 0);
        const totalTracks = totalMusic + totalAlbumMusic;
        
        if (totalTracks === 0) {
            if (elements.currentTrack) {
                elements.currentTrack.textContent = 'Rádio aguardando músicas...';
            }
            console.log('⚠️ Nenhuma música disponível para transmissão');
        } else {
            console.log(`🎵 ${totalTracks} músicas disponíveis para transmissão`);
        }
    }
    
    checkTimeAnnouncement() {
        const now = new Date();
        const minutes = now.getMinutes();
        
        if (minutes === 0 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            if (timeSinceLastTime > 50 * 60 * 1000) {
                console.log('🕐 Tocando hora certa');
                radioState.lastTimeCheck = Date.now();
                radioState.tracksSinceTime = 999;
                this.playNext();
            }
        }
    }
    
    playNext() {
        try {
            const nextTrack = this.getNextTrack();
            
            if (!nextTrack) {
                if (elements.currentTrack) {
                    elements.currentTrack.textContent = 'Aguardando próxima música...';
                }
                setTimeout(() => this.playNext(), 30000);
                return;
            }
            
            radioState.currentTrack = nextTrack;
            elements.audioPlayer.src = nextTrack.url;
            if (elements.currentTrack) {
                elements.currentTrack.textContent = nextTrack.name;
            }
            
            this.updateTrackCover(nextTrack);
            this.updatePlayHistory(nextTrack);
            
            if (radioState.isLive) {
                elements.audioPlayer.play().catch(e => {
                    console.log('Erro no autoplay:', e.message);
                    setTimeout(() => {
                        if (radioState.isLive) {
                            elements.audioPlayer.play().catch(() => {});
                        }
                    }, 5000);
                });
            }
            
            console.log(`🎵 Tocando: ${nextTrack.name}`);
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir próxima música:', error);
            setTimeout(() => this.playNext(), 5000);
        }
    }
    
    getNextTrack() {
        if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTime = 0;
            radioState.tracksSinceAd++;
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        const adInterval = 5 + Math.floor(Math.random() * 3);
        if (radioState.tracksSinceAd >= adInterval && radioState.playlists.ads.length > 0) {
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
        if (playlist.length === 0) return null;
        
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
        if (!radioState.currentTrack || !elements.trackTime || !elements.audioPlayer) return;
        
        try {
            const current = Math.floor(elements.audioPlayer.currentTime);
            const duration = Math.floor(elements.audioPlayer.duration) || 0;
            
            elements.trackTime.textContent = `${this.formatTime(current)} / ${this.formatTime(duration)}`;
        } catch (error) {
            console.error('Erro ao atualizar tempo:', error);
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    updateLiveStatus() {
        try {
            if (elements.liveIndicator) {
                elements.liveIndicator.textContent = radioState.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
                elements.liveIndicator.style.color = radioState.isLive ? '#ff4757' : '#666';
            }
            
            if (elements.playStatus) {
                elements.playStatus.textContent = radioState.isLive ? 'AO VIVO' : 'Pausado';
            }
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
        }
    }
    
    handleError(error) {
        console.error('❌ Erro no áudio:', error);
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 3000);
    }
    
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
            if (elements.audioPlayer) {
                elements.audioPlayer.pause();
            }
            radioState.isPlaying = false;
        }
        
        this.updateLiveStatus();
    }
}

// Gerenciador de arquivos simplificado
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
        if (safeLocalStorage()) {
            try {
                localStorage.setItem('radioState', JSON.stringify(radioState));
            } catch (error) {
                console.error('Erro ao salvar dados:', error);
            }
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
    if (isInitialized) {
        console.warn('⚠️ Rádio já inicializada');
        return;
    }
    
    console.log('🚀 Iniciando Rádio Supermercado do Louro...');
    
    if (!initElements()) {
        console.error('❌ Falha na inicialização dos elementos');
        return;
    }
    
    isInitialized = true;
    loadStoredData();
    
    // Configurar volume
    if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
        elements.audioPlayer.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        elements.volumeValue.textContent = radioState.volume + '%';
    }
    
    // Inicializar gerenciadores
    radioManager = new LiveRadioManager();
    fileManager = new SimpleFileManager();
    albumManager = new SimpleAlbumManager();
    
    setupEventListeners();
    updateUI();
    
    console.log('✅ Rádio inicializada e transmitindo AO VIVO!');
}

function setupEventListeners() {
    try {
        // Player - controla transmissão ao vivo
        if (elements.playPauseBtn) {
            elements.playPauseBtn.addEventListener('click', toggleLiveTransmission);
        }
        if (elements.skipBtn) {
            elements.skipBtn.addEventListener('click', () => {
                if (radioState.isLive && radioManager) {
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
        
        console.log('✅ Event listeners configurados');
        
    } catch (error) {
        console.error('❌ Erro ao configurar listeners:', error);
    }
}

function loadStoredData() {
    if (!safeLocalStorage()) return;
    
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

// Controles do player
function toggleLiveTransmission() {
    if (radioManager) {
        radioManager.toggleLive();
        
        // Atualizar botão
        if (radioState.isLive) {
            elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
            if (elements.playStatus) {
                elements.playStatus.textContent = 'AO VIVO';
            }
        } else {
            elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
            if (elements.playStatus) {
                elements.playStatus.textContent = 'OFFLINE';
            }
        }
    }
}

function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer || !elements.volumeValue) return;
    
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    if (fileManager) {
        fileManager.saveData();
    }
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
    if (fileManager) fileManager.refreshFilesList();
    refreshReports();
    if (albumManager) albumManager.setupCoversGrid();
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
    if (tabName === 'files' && fileManager) fileManager.refreshFilesList();
    if (tabName === 'reports') refreshReports();
    if (tabName === 'albums' && albumManager) albumManager.setupCoversGrid();
}

// Funções de upload
function uploadFiles(category) {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    if (fileManager) {
        fileManager.uploadFiles(category, albumType);
    }
}

function setActiveAlbum() {
    if (albumManager) {
        albumManager.setActiveAlbum();
    }
}

// Funções de gerenciamento de arquivos
function deleteFile(category, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists[category].splice(index, 1);
    if (fileManager) {
        fileManager.saveData();
        fileManager.refreshFilesList();
    }
    alert('Arquivo excluído com sucesso!');
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
    
    radioState.playlists.albums[albumKey].splice(index, 1);
    if (fileManager) {
        fileManager.saveData();
        fileManager.refreshFilesList();
    }
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
        
        if (fileManager) fileManager.saveData();
        if (albumManager) albumManager.setupCoversGrid();
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
    if (fileManager) fileManager.saveData();
    if (albumManager) albumManager.setupCoversGrid();
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
        if (fileManager) fileManager.saveData();
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
    
    try {
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
    } catch (error) {
        console.error('Erro ao atualizar display do álbum:', error);
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

// Função para controle manual da transmissão (admin)
function toggleTransmission() {
    if (radioManager) {
        radioManager.toggleLive();
        alert(radioState.isLive ? 
            '🔴 Transmissão AO VIVO iniciada!' : 
            '⚫ Transmissão pausada'
        );
    }
}

// Inicialização segura
function safeInitialization() {
    try {
        // Verificar se DOM está pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeRadio);
            return;
        }
        
        // Verificar elementos críticos
        const criticalElements = ['audioPlayer', 'playPauseBtn', 'currentTrack'];
        const missing = criticalElements.filter(id => !document.getElementById(id));
        
        if (missing.length > 0) {
            console.error('❌ Elementos críticos não encontrados:', missing);
            // Tentar novamente após 1 segundo
            setTimeout(() => {
                if (missing.filter(id => !document.getElementById(id)).length === 0) {
                    initializeRadio();
                }
            }, 1000);
            return;
        }
        
        // Inicializar após pequeno delay
        setTimeout(initializeRadio, 100);
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
    }
}

// Tratamento de erro global
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

// Manter transmissão ativa mesmo se a página perder foco
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && radioState.isLive) {
        console.log('👁️ Página visível novamente, verificando transmissão...');
        
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

// INICIALIZAÇÃO PRINCIPAL
console.log('🎵 Carregando sistema de rádio...');
safeInitialization();

console.log('✅ Script carregado com sucesso!');
