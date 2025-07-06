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
    lastTimeAnnouncement: 0, // Timestamp da última hora certa
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: {
            natal: [],
            pascoa: [],
            saojoao: [],
            carnaval: []
        }
    },
    playHistory: {},
    isAdmin: false
};

// Elementos DOM
const elements = {
    // Player
    audioPlayer: document.getElementById('audioPlayer'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    skipBtn: document.getElementById('skipBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    albumCover: document.getElementById('albumCover'),
    albumTitle: document.getElementById('albumTitle'),
    currentTrack: document.getElementById('currentTrack'),
    playStatus: document.getElementById('playStatus'),
    trackCount: document.getElementById('trackCount'),
    
    // Modos
    playerMode: document.getElementById('playerMode'),
    adminMode: document.getElementById('adminMode'),
    adminBtn: document.getElementById('adminBtn'),
    backToPlayerBtn: document.getElementById('backToPlayerBtn'),
    
    // Modal
    passwordModal: document.getElementById('passwordModal'),
    adminPassword: document.getElementById('adminPassword'),
    
    // Upload
    musicUpload: document.getElementById('musicUpload'),
    timeUpload: document.getElementById('timeUpload'),
    adUpload: document.getElementById('adUpload'),
    albumUpload: document.getElementById('albumUpload'),
    albumSelect: document.getElementById('albumSelect'),
    
    // Albums
    activeAlbumSelect: document.getElementById('activeAlbumSelect'),
    albumPreview: document.getElementById('albumPreview'),
    previewCover: document.getElementById('previewCover'),
    previewTitle: document.getElementById('previewTitle'),
    previewDescription: document.getElementById('previewDescription'),
    
    // Reports
    reportList: document.getElementById('reportList'),
    
    // Files
    musicFiles: document.getElementById('musicFiles'),
    timeFiles: document.getElementById('timeFiles'),
    adFiles: document.getElementById('adFiles'),
    albumFiles: document.getElementById('albumFiles'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay')
};

// Dados dos álbuns
const albumData = {
    natal: {
        title: '🎄 Natal',
        description: 'Músicas natalinas para o clima festivo',
        cover: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=300&h=300&fit=crop'
    },
    pascoa: {
        title: '🐰 Páscoa',
        description: 'Celebrando a ressurreição',
        cover: 'https://images.unsplash.com/photo-1491004369120-b1d7bbf1bfa9?w=300&h=300&fit=crop'
    },
    saojoao: {
        title: '🎪 São João',
        description: 'Forró e festa junina',
        cover: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop'
    },
    carnaval: {
        title: '🎭 Carnaval',
        description: 'Marchinha e alegria',
        cover: 'https://images.unsplash.com/photo-1578662584979-e4b1c6f70ddb?w=300&h=300&fit=crop'
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeRadio();
    setupEventListeners();
    loadStoredData();
    updateUI();
});

function initializeRadio() {
    // Configurar volume inicial
    elements.audioPlayer.volume = radioState.volume / 100;
    elements.volumeSlider.value = radioState.volume;
    elements.volumeValue.textContent = radioState.volume + '%';
    
    // Configurar eventos do player
    elements.audioPlayer.addEventListener('ended', playNext);
    elements.audioPlayer.addEventListener('loadstart', () => showLoading(true));
    elements.audioPlayer.addEventListener('canplay', () => showLoading(false));
    elements.audioPlayer.addEventListener('error', handleAudioError);
}

function setupEventListeners() {
    // Player controls
    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.skipBtn.addEventListener('click', playNext);
    elements.volumeSlider.addEventListener('input', updateVolume);
    
    // Admin access
    elements.adminBtn.addEventListener('click', showPasswordModal);
    elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
    
    // Modal
    elements.adminPassword.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') checkPassword();
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Album preview
    elements.activeAlbumSelect.addEventListener('change', updateAlbumPreview);
}

function loadStoredData() {
    const stored = localStorage.getItem('radioState');
    if (stored) {
        const parsedState = JSON.parse(stored);
        radioState = { ...radioState, ...parsedState };
        updateAlbumDisplay();
    }
}

function saveData() {
    localStorage.setItem('radioState', JSON.stringify(radioState));
}

// Controles do Player
function togglePlayPause() {
    if (radioState.isPlaying) {
        elements.audioPlayer.pause();
        radioState.isPlaying = false;
        elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
        elements.playStatus.textContent = 'Pausado';
    } else {
        if (!radioState.currentTrack) {
            loadNextTrack();
        }
        elements.audioPlayer.play();
        radioState.isPlaying = true;
        elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
        elements.playStatus.textContent = 'Tocando';
    }
}

function playNext() {
    loadNextTrack();
    if (radioState.isPlaying) {
        elements.audioPlayer.play();
    }
}

function updateVolume() {
    const volume = elements.volumeSlider.value;
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    saveData();
}

function loadNextTrack() {
    const nextTrack = getNextTrack();
    if (nextTrack) {
        radioState.currentTrack = nextTrack;
        elements.audioPlayer.src = nextTrack.url;
        elements.currentTrack.textContent = nextTrack.name;
        updatePlayHistory(nextTrack);
        updateTrackCount();
    }
}

function getNextTrack() {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    
    // Verificar se deve tocar hora certa (no minuto 0 de cada hora)
    if (currentMinute === 0 && 
        radioState.playlists.time.length > 0 && 
        (Date.now() - radioState.lastTimeAnnouncement) > 3540000) { // 59 minutos
        
        radioState.lastTimeAnnouncement = Date.now();
        radioState.tracksSinceTime = 0;
        radioState.tracksSinceAd++;
        
        const timePlaylist = radioState.playlists.time;
        const randomIndex = Math.floor(Math.random() * timePlaylist.length);
        return timePlaylist[randomIndex];
    }
    
    // Verificar se deve tocar aviso (a cada 6 músicas)
    if (radioState.tracksSinceAd >= 6 && radioState.playlists.ads.length > 0) {
        radioState.tracksSinceAd = 0;
        radioState.tracksSinceTime++;
        
        const adsPlaylist = radioState.playlists.ads;
        const randomIndex = Math.floor(Math.random() * adsPlaylist.length);
        return adsPlaylist[randomIndex];
    }
    
    // Tocar música normal
    let playlist = [];
    if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
        playlist = radioState.playlists.albums[radioState.activeAlbum];
    } else {
        playlist = radioState.playlists.music;
    }
    
    if (playlist.length === 0) {
        return null;
    }
    
    radioState.tracksSinceTime++;
    radioState.tracksSinceAd++;
    
    // Escolher música aleatória
    const randomIndex = Math.floor(Math.random() * playlist.length);
    return playlist[randomIndex];
}

function updatePlayHistory(track) {
    if (!radioState.playHistory[track.name]) {
        radioState.playHistory[track.name] = 0;
    }
    radioState.playHistory[track.name]++;
    radioState.playCount++;
    saveData();
}

function updateTrackCount() {
    elements.trackCount.textContent = `Músicas tocadas: ${radioState.playCount}`;
}

function handleAudioError(e) {
    console.error('Erro no áudio:', e);
    showLoading(false);
    setTimeout(playNext, 2000); // Tentar próxima música após 2 segundos
}

// Modo Administrador
function showPasswordModal() {
    elements.passwordModal.style.display = 'flex';
    elements.adminPassword.focus();
}

function closePasswordModal() {
    elements.passwordModal.style.display = 'none';
    elements.adminPassword.value = '';
}

function checkPassword() {
    const password = elements.adminPassword.value;
    if (password === 'admin123') {
        radioState.isAdmin = true;
        closePasswordModal();
        showAdminMode();
    } else {
        alert('Senha incorreta!');
        elements.adminPassword.value = '';
    }
}

function showAdminMode() {
    elements.playerMode.style.display = 'none';
    elements.adminMode.style.display = 'block';
    refreshFilesList();
    refreshReports();
}

function showPlayerMode() {
    elements.playerMode.style.display = 'flex';
    elements.adminMode.style.display = 'none';
    radioState.isAdmin = false;
}

function switchTab(tabName) {
    // Remover active de todos os botões e conteúdos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adicionar active no botão e conteúdo selecionado
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Atualizar dados se necessário
    if (tabName === 'files') {
        refreshFilesList();
    } else if (tabName === 'reports') {
        refreshReports();
    }
}

// Upload de arquivos
async function uploadFiles(category) {
    let fileInput;
    let albumType = '';
    
    switch (category) {
        case 'music':
            fileInput = elements.musicUpload;
            break;
        case 'time':
            fileInput = elements.timeUpload;
            break;
        case 'ads':
            fileInput = elements.adUpload;
            break;
        case 'album':
            fileInput = elements.albumUpload;
            albumType = elements.albumSelect.value;
            break;
        default:
            return;
    }
    
    const files = fileInput.files;
    if (files.length === 0) {
        alert('Selecione pelo menos um arquivo!');
        return;
    }
    
    showLoading(true);
    
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const uploadedFile = await uploadToCloudinary(file, category, albumType);
            
            if (category === 'album') {
                radioState.playlists.albums[albumType].push(uploadedFile);
            } else {
                radioState.playlists[category].push(uploadedFile);
            }
        }
        
        saveData();
        fileInput.value = '';
        refreshFilesList();
        alert(`${files.length} arquivo(s) enviado(s) com sucesso!`);
        
    } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro no upload. Tente novamente.');
    } finally {
        showLoading(false);
    }
}

async function uploadToCloudinary(file, category, albumType = '') {
    const formData = new FormData();
    const folder = category === 'album' ? `albums/${albumType}` : category;
    
    formData.append('file', file);
    formData.append('upload_preset', 'radio_preset');
    formData.append('folder', `radio-louro/${folder}`);
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Erro no upload');
    }
    
    const data = await response.json();
    
    return {
        name: file.name,
        url: data.secure_url,
        publicId: data.public_id,
        uploadedAt: new Date().toISOString()
    };
}

// Gerenciamento de álbuns
function updateAlbumPreview() {
    const selectedAlbum = elements.activeAlbumSelect.value;
    
    if (!selectedAlbum) {
        elements.previewCover.src = '';
        elements.previewTitle.textContent = 'Selecione um álbum';
        elements.previewDescription.textContent = 'Escolha um álbum para visualizar';
        return;
    }
    
    const album = albumData[selectedAlbum];
    elements.previewCover.src = album.cover;
    elements.previewTitle.textContent = album.title;
    elements.previewDescription.textContent = album.description;
}

function setActiveAlbum() {
    const selectedAlbum = elements.activeAlbumSelect.value;
    radioState.activeAlbum = selectedAlbum || null;
    updateAlbumDisplay();
    saveData();
    alert(selectedAlbum ? `Álbum "${albumData[selectedAlbum].title}" ativado!` : 'Álbum desativado. Tocando playlist geral.');
}

function updateAlbumDisplay() {
    if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
        const album = albumData[radioState.activeAlbum];
        elements.albumCover.src = album.cover;
        elements.albumTitle.textContent = album.title;
    } else {
        elements.albumCover.src = 'https://via.placeholder.com/300x300/1a1a1a/ffffff?text=Radio+Louro';
        elements.albumTitle.textContent = 'Playlist Geral';
    }
    
    // Atualizar seleção no admin
    if (elements.activeAlbumSelect) {
        elements.activeAlbumSelect.value = radioState.activeAlbum || '';
        updateAlbumPreview();
    }
}

// Relatórios
function refreshReports() {
    if (Object.keys(radioState.playHistory).length === 0) {
        elements.reportList.innerHTML = '<p>Nenhuma música foi reproduzida ainda.</p>';
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a);
    
    let html = '';
    sortedHistory.forEach(([track, count]) => {
        html += `
            <div class="report-item">
                <span class="track-name">${track}</span>
                <span class="play-count">${count}x</span>
            </div>
        `;
    });
    
    elements.reportList.innerHTML = html;
}

function resetPlayCount() {
    if (confirm('Tem certeza que deseja resetar toda a contagem?')) {
        radioState.playHistory = {};
        radioState.playCount = 0;
        updateTrackCount();
        refreshReports();
        saveData();
        alert('Contagem resetada com sucesso!');
    }
}

// Gerenciamento de arquivos
function refreshFilesList() {
    refreshCategoryFiles('music', elements.musicFiles);
    refreshCategoryFiles('time', elements.timeFiles);
    refreshCategoryFiles('ads', elements.adFiles);
    refreshAlbumFiles();
}

function refreshCategoryFiles(category, container) {
    const files = radioState.playlists[category] || [];
    
    if (files.length === 0) {
        container.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
        return;
    }
    
    let html = '';
    files.forEach((file, index) => {
        html += `
            <div class="file-item">
                <span class="file-name">${file.name}</span>
                <button onclick="deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️</button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function refreshAlbumFiles() {
    let html = '';
    
    Object.keys(radioState.playlists.albums).forEach(albumKey => {
        const album = albumData[albumKey];
        const files = radioState.playlists.albums[albumKey] || [];
        
        html += `<h5>${album.title}</h5>`;
        
        if (files.length === 0) {
            html += '<p>Nenhum arquivo encontrado.</p>';
        } else {
            files.forEach((file, index) => {
                html += `
                    <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <button onclick="deleteAlbumFile('${albumKey}', ${index})" class="btn-danger btn-small">🗑️</button>
                    </div>
                `;
            });
        }
        
        html += '<br>';
    });
    
    elements.albumFiles.innerHTML = html;
}

async function deleteFile(category, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const file = radioState.playlists[category][index];
        
        // Tentar deletar da Cloudinary
        try {
            await deleteFromCloudinary(file.publicId);
        } catch (cloudError) {
            console.warn('Erro ao deletar da Cloudinary:', cloudError);
            // Continuar mesmo se falhar na Cloudinary
        }
        
        // Remover do estado local
        radioState.playlists[category].splice(index, 1);
        saveData();
        refreshFilesList();
        alert('Arquivo excluído com sucesso!');
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir o arquivo.');
    } finally {
        showLoading(false);
    }
}

async function deleteAlbumFile(albumKey, index) {
    if (!confirm('Tem certeza que deseja excluir este arquivo?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const file = radioState.playlists.albums[albumKey][index];
        
        // Tentar deletar da Cloudinary
        try {
            await deleteFromCloudinary(file.publicId);
        } catch (cloudError) {
            console.warn('Erro ao deletar da Cloudinary:', cloudError);
            // Continuar mesmo se falhar na Cloudinary
        }
        
        // Remover do estado local
        radioState.playlists.albums[albumKey].splice(index, 1);
        saveData();
        refreshFilesList();
        alert('Arquivo excluído com sucesso!');
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir o arquivo.');
    } finally {
        showLoading(false);
    }
}

async function deleteFromCloudinary(publicId) {
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Gerar assinatura usando CryptoJS (se disponível) ou fazer requisição sem assinatura
    const signature = await generateSignature(publicId, timestamp);
    
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('api_key', CLOUDINARY_CONFIG.apiKey);
    formData.append('timestamp', timestamp);
    
    if (signature) {
        formData.append('signature', signature);
    }
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/destroy`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Erro ao excluir da Cloudinary');
    }
    
    return response.json();
}

// Função para gerar assinatura (simplificada)
async function generateSignature(publicId, timestamp) {
    try {
        // Usar Web Crypto API se disponível
        if (window.crypto && window.crypto.subtle) {
            const message = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_CONFIG.apiSecret}`;
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-1', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        }
    } catch (error) {
        console.warn('Erro ao gerar assinatura:', error);
    }
    
    return null; // Retornar null se não conseguir gerar assinatura
}

// Funções auxiliares
function showLoading(show) {
    elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function updateUI() {
    updateAlbumDisplay();
    updateTrackCount();
}

// Auto-play quando a página carrega
window.addEventListener('load', function() {
    // Aguardar interação do usuário para começar a tocar
    document.addEventListener('click', function() {
        if (!radioState.currentTrack && !radioState.isPlaying) {
            loadNextTrack();
        }
    }, { once: true });
});

// Salvar dados periodicamente
setInterval(saveData, 30000); // A cada 30 segundos
