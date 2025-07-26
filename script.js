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
