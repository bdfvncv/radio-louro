// Configuração do Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'playlist_preset' // Você precisa criar este preset no Cloudinary
};

// Estado da aplicação
let currentState = {
    playlists: [],
    currentPlaylist: null,
    currentSong: null,
    isPlaying: false,
    audio: new Audio(),
    currentPhotoUrl: null,
    isDarkMode: false
};

// Elementos DOM
const elements = {
    playlistsContainer: null,
    songsContainer: null,
    currentSongInfo: null,
    progressBar: null,
    timeDisplay: null,
    playPauseBtn: null,
    volumeSlider: null,
    photoUpload: null,
    photoPreview: null,
    removePhotoBtn: null,
    createPlaylistBtn: null,
    addSongBtn: null,
    searchInput: null,
    themeToggle: null
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadStoredData();
    setupEventListeners();
    setupAudioEvents();
    setupCloudinaryWidget();
    applyTheme();
});

// Inicializar elementos DOM
function initializeElements() {
    elements.playlistsContainer = document.getElementById('playlists-container');
    elements.songsContainer = document.getElementById('songs-container');
    elements.currentSongInfo = document.getElementById('current-song-info');
    elements.progressBar = document.getElementById('progress-bar');
    elements.timeDisplay = document.getElementById('time-display');
    elements.playPauseBtn = document.getElementById('play-pause-btn');
    elements.volumeSlider = document.getElementById('volume-slider');
    elements.photoUpload = document.getElementById('photo-upload');
    elements.photoPreview = document.getElementById('photo-preview');
    elements.removePhotoBtn = document.getElementById('remove-photo-btn');
    elements.createPlaylistBtn = document.getElementById('create-playlist-btn');
    elements.addSongBtn = document.getElementById('add-song-btn');
    elements.searchInput = document.getElementById('search-input');
    elements.themeToggle = document.getElementById('theme-toggle');
}

// Configurar event listeners
function setupEventListeners() {
    // Controles do player
    elements.playPauseBtn?.addEventListener('click', togglePlayPause);
    elements.progressBar?.addEventListener('click', seekTo);
    elements.volumeSlider?.addEventListener('input', changeVolume);
    
    // Gerenciamento de fotos
    elements.photoUpload?.addEventListener('change', handlePhotoUpload);
    elements.removePhotoBtn?.addEventListener('click', removePhoto);
    
    // Playlist e música
    elements.createPlaylistBtn?.addEventListener('click', showCreatePlaylistModal);
    elements.addSongBtn?.addEventListener('click', showAddSongModal);
    elements.searchInput?.addEventListener('input', debounce(searchSongs, 300));
    
    // Tema
    elements.themeToggle?.addEventListener('click', toggleTheme);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Configurar eventos do áudio
function setupAudioEvents() {
    const audio = currentState.audio;
    
    audio.addEventListener('loadedmetadata', updateTimeDisplay);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', playNextSong);
    audio.addEventListener('error', handleAudioError);
    audio.addEventListener('canplay', () => {
        console.log('Áudio carregado e pronto para reproduzir');
    });
}

// Configurar widget do Cloudinary
function setupCloudinaryWidget() {
    if (typeof cloudinary !== 'undefined') {
        window.cloudinaryWidget = cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            sources: ['local', 'url', 'camera'],
            multiple: false,
            resourceType: 'image',
            clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'],
            maxFileSize: 10000000, // 10MB
            transformation: [
                { width: 400, height: 400, crop: 'fill', quality: 'auto' }
            ],
            styles: {
                palette: {
                    window: "#1a1a1a",
                    sourceBg: "#2a2a2a",
                    windowBorder: "#444",
                    tabIcon: "#fff",
                    inactiveTabIcon: "#999",
                    menuIcons: "#fff",
                    link: "#3b82f6",
                    action: "#3b82f6",
                    inProgress: "#10b981",
                    complete: "#10b981",
                    error: "#ef4444",
                    textDark: "#000",
                    textLight: "#fff"
                }
            }
        }, (error, result) => {
            if (!error && result && result.event === "success") {
                handleCloudinaryUpload(result.info);
            }
            if (error) {
                console.error('Erro no upload:', error);
                showNotification('Erro ao fazer upload da imagem', 'error');
            }
        });
    }
}

// Carregar dados salvos
function loadStoredData() {
    try {
        const savedPlaylists = JSON.parse(localStorage.getItem('playlists') || '[]');
        const savedTheme = localStorage.getItem('darkMode') === 'true';
        
        currentState.playlists = savedPlaylists;
        currentState.isDarkMode = savedTheme;
        
        renderPlaylists();
        
        if (savedPlaylists.length > 0) {
            selectPlaylist(savedPlaylists[0].id);
        }
        
        // Restaurar volume
        const savedVolume = localStorage.getItem('volume');
        if (savedVolume && elements.volumeSlider) {
            elements.volumeSlider.value = savedVolume;
            currentState.audio.volume = savedVolume / 100;
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        currentState.playlists = [];
    }
}

// Salvar dados
function saveData() {
    try {
        localStorage.setItem('playlists', JSON.stringify(currentState.playlists));
        localStorage.setItem('darkMode', currentState.isDarkMode.toString());
        localStorage.setItem('volume', elements.volumeSlider?.value || '50');
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
    }
}

// Renderizar playlists
function renderPlaylists() {
    if (!elements.playlistsContainer) return;
    
    elements.playlistsContainer.innerHTML = '';
    
    currentState.playlists.forEach(playlist => {
        const playlistElement = createPlaylistElement(playlist);
        elements.playlistsContainer.appendChild(playlistElement);
    });
    
    if (currentState.playlists.length === 0) {
        elements.playlistsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎵</div>
                <h3>Nenhuma playlist encontrada</h3>
                <p>Crie sua primeira playlist para começar</p>
                <button class="btn-primary" onclick="showCreatePlaylistModal()">
                    Criar Playlist
                </button>
            </div>
        `;
    }
}

// Criar elemento de playlist
function createPlaylistElement(playlist) {
    const div = document.createElement('div');
    div.className = `playlist-card ${currentState.currentPlaylist?.id === playlist.id ? 'active' : ''}`;
    div.dataset.playlistId = playlist.id;
    
    div.innerHTML = `
        <div class="playlist-image">
            ${playlist.photo ? 
                `<img src="${playlist.photo}" alt="${playlist.name}" loading="lazy">` : 
                '<div class="playlist-placeholder"><i class="fas fa-music"></i></div>'
            }
            <div class="playlist-overlay">
                <button class="play-playlist-btn" onclick="playPlaylist('${playlist.id}')">
                    <i class="fas fa-play"></i>
                </button>
            </div>
        </div>
        <div class="playlist-info">
            <h3 class="playlist-name">${escapeHtml(playlist.name)}</h3>
            <p class="playlist-count">${playlist.songs.length} música${playlist.songs.length !== 1 ? 's' : ''}</p>
            <div class="playlist-actions">
                <button class="btn-icon" onclick="editPlaylist('${playlist.id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" onclick="deletePlaylist('${playlist.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.playlist-actions') && !e.target.closest('.play-playlist-btn')) {
            selectPlaylist(playlist.id);
        }
    });
    
    return div;
}

// Renderizar músicas
function renderSongs() {
    if (!elements.songsContainer || !currentState.currentPlaylist) return;
    
    elements.songsContainer.innerHTML = '';
    
    const playlist = currentState.currentPlaylist;
    const filteredSongs = filterSongs(playlist.songs);
    
    if (filteredSongs.length === 0) {
        elements.songsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎶</div>
                <h3>Nenhuma música encontrada</h3>
                <p>Adicione músicas à sua playlist</p>
                <button class="btn-primary" onclick="showAddSongModal()">
                    Adicionar Música
                </button>
            </div>
        `;
        return;
    }
    
    filteredSongs.forEach((song, index) => {
        const songElement = createSongElement(song, index);
        elements.songsContainer.appendChild(songElement);
    });
}

// Criar elemento de música
function createSongElement(song, index) {
    const div = document.createElement('div');
    div.className = `song-item ${currentState.currentSong?.id === song.id ? 'playing' : ''}`;
    div.dataset.songId = song.id;
    
    div.innerHTML = `
        <div class="song-index">
            ${currentState.currentSong?.id === song.id && currentState.isPlaying ? 
                '<i class="fas fa-volume-up playing-icon"></i>' : 
                `<span class="track-number">${index + 1}</span>`
            }
        </div>
        <div class="song-info">
            <div class="song-title">${escapeHtml(song.title)}</div>
            <div class="song-artist">${escapeHtml(song.artist || 'Artista Desconhecido')}</div>
        </div>
        <div class="song-duration">${formatTime(song.duration || 0)}</div>
        <div class="song-actions">
            <button class="btn-icon" onclick="editSong('${song.id}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="removeSong('${song.id}')" title="Remover">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    div.addEventListener('dblclick', () => playSong(song));
    
    return div;
}

// Filtrar músicas
function filterSongs(songs) {
    const searchTerm = elements.searchInput?.value.toLowerCase() || '';
    if (!searchTerm) return songs;
    
    return songs.filter(song => 
        song.title.toLowerCase().includes(searchTerm) ||
        (song.artist && song.artist.toLowerCase().includes(searchTerm))
    );
}

// Selecionar playlist
function selectPlaylist(playlistId) {
    const playlist = currentState.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    currentState.currentPlaylist = playlist;
    
    // Atualizar interface
    document.querySelectorAll('.playlist-card').forEach(card => {
        card.classList.toggle('active', card.dataset.playlistId === playlistId);
    });
    
    renderSongs();
    updatePlaylistHeader();
}

// Atualizar cabeçalho da playlist
function updatePlaylistHeader() {
    const header = document.getElementById('playlist-header');
    if (!header || !currentState.currentPlaylist) return;
    
    const playlist = currentState.currentPlaylist;
    header.innerHTML = `
        <div class="playlist-header-content">
            <div class="playlist-header-image">
                ${playlist.photo ? 
                    `<img src="${playlist.photo}" alt="${playlist.name}">` : 
                    '<div class="playlist-placeholder-large"><i class="fas fa-music"></i></div>'
                }
            </div>
            <div class="playlist-header-info">
                <h1>${escapeHtml(playlist.name)}</h1>
                <p>${playlist.songs.length} música${playlist.songs.length !== 1 ? 's' : ''}</p>
                <div class="playlist-header-actions">
                    <button class="btn-primary" onclick="playPlaylist('${playlist.id}')">
                        <i class="fas fa-play"></i> Reproduzir
                    </button>
                    <button class="btn-secondary" onclick="editPlaylist('${playlist.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Reproduzir playlist
function playPlaylist(playlistId) {
    const playlist = currentState.playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.songs.length === 0) return;
    
    selectPlaylist(playlistId);
    playSong(playlist.songs[0]);
}

// Reproduzir música
function playSong(song) {
    if (!song || !song.file) {
        showNotification('Arquivo de música não encontrado', 'error');
        return;
    }
    
    currentState.currentSong = song;
    currentState.audio.src = song.file;
    currentState.audio.load();
    
    currentState.audio.play().then(() => {
        currentState.isPlaying = true;
        updatePlayButton();
        updateCurrentSongInfo();
        updateSongHighlight();
    }).catch(error => {
        console.error('Erro ao reproduzir música:', error);
        showNotification('Erro ao reproduzir música', 'error');
    });
}

// Toggle play/pause
function togglePlayPause() {
    if (!currentState.currentSong) {
        // Se não há música atual, reproduzir a primeira da playlist atual
        if (currentState.currentPlaylist && currentState.currentPlaylist.songs.length > 0) {
            playSong(currentState.currentPlaylist.songs[0]);
        }
        return;
    }
    
    if (currentState.isPlaying) {
        currentState.audio.pause();
        currentState.isPlaying = false;
    } else {
        currentState.audio.play().then(() => {
            currentState.isPlaying = true;
        }).catch(error => {
            console.error('Erro ao reproduzir:', error);
            showNotification('Erro ao reproduzir música', 'error');
        });
    }
    
    updatePlayButton();
}

// Próxima música
function playNextSong() {
    if (!currentState.currentPlaylist || !currentState.currentSong) return;
    
    const songs = currentState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(song => song.id === currentState.currentSong.id);
    
    if (currentIndex < songs.length - 1) {
        playSong(songs[currentIndex + 1]);
    } else {
        // Repetir playlist
        playSong(songs[0]);
    }
}

// Música anterior
function playPrevSong() {
    if (!currentState.currentPlaylist || !currentState.currentSong) return;
    
    const songs = currentState.currentPlaylist.songs;
    const currentIndex = songs.findIndex(song => song.id === currentState.currentSong.id);
    
    if (currentIndex > 0) {
        playSong(songs[currentIndex - 1]);
    } else {
        // Ir para a última música
        playSong(songs[songs.length - 1]);
    }
}

// Buscar posição na música
function seekTo(event) {
    if (!currentState.audio.duration) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newTime = percent * currentState.audio.duration;
    
    currentState.audio.currentTime = newTime;
}

// Alterar volume
function changeVolume(event) {
    const volume = event.target.value / 100;
    currentState.audio.volume = volume;
    saveData();
}

// Atualizar botão play/pause
function updatePlayButton() {
    if (!elements.playPauseBtn) return;
    
    const icon = elements.playPauseBtn.querySelector('i');
    if (icon) {
        icon.className = currentState.isPlaying ? 'fas fa-pause' : 'fas fa-play';
    }
}

// Atualizar informações da música atual
function updateCurrentSongInfo() {
    if (!elements.currentSongInfo || !currentState.currentSong) return;
    
    const song = currentState.currentSong;
    elements.currentSongInfo.innerHTML = `
        <div class="current-song-title">${escapeHtml(song.title)}</div>
        <div class="current-song-artist">${escapeHtml(song.artist || 'Artista Desconhecido')}</div>
    `;
}

// Atualizar destaque da música
function updateSongHighlight() {
    document.querySelectorAll('.song-item').forEach(item => {
        const isPlaying = item.dataset.songId === currentState.currentSong?.id;
        item.classList.toggle('playing', isPlaying);
        
        const indexElement = item.querySelector('.song-index');
        if (isPlaying && currentState.isPlaying) {
            indexElement.innerHTML = '<i class="fas fa-volume-up playing-icon"></i>';
        } else {
            const trackNumber = indexElement.querySelector('.track-number')?.textContent || '1';
            indexElement.innerHTML = `<span class="track-number">${trackNumber}</span>`;
        }
    });
}

// Atualizar progresso
function updateProgress() {
    if (!elements.progressBar || !currentState.audio.duration) return;
    
    const percent = (currentState.audio.currentTime / currentState.audio.duration) * 100;
    elements.progressBar.style.setProperty('--progress', `${percent}%`);
    
    updateTimeDisplay();
}

// Atualizar display de tempo
function updateTimeDisplay() {
    if (!elements.timeDisplay) return;
    
    const current = formatTime(currentState.audio.currentTime || 0);
    const duration = formatTime(currentState.audio.duration || 0);
    
    elements.timeDisplay.textContent = `${current} / ${duration}`;
}

// Upload de foto
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecione uma imagem válida', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB
        showNotification('A imagem deve ter menos de 10MB', 'error');
        return;
    }
    
    // Abrir widget do Cloudinary
    if (window.cloudinaryWidget) {
        window.cloudinaryWidget.open();
    } else {
        // Fallback para upload direto
        uploadToCloudinary(file);
    }
}

// Upload para Cloudinary
async function uploadToCloudinary(file) {
    try {
        showNotification('Fazendo upload da imagem...', 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Erro no upload');
        }
        
        const data = await response.json();
        handleCloudinaryUpload(data);
        
    } catch (error) {
        console.error('Erro no upload:', error);
        showNotification('Erro ao fazer upload da imagem', 'error');
    }
}

// Manipular upload do Cloudinary
function handleCloudinaryUpload(result) {
    currentState.currentPhotoUrl = result.secure_url;
    
    if (elements.photoPreview) {
        elements.photoPreview.innerHTML = `
            <img src="${result.secure_url}" alt="Preview" class="photo-preview-img">
        `;
        elements.photoPreview.style.display = 'block';
    }
    
    if (elements.removePhotoBtn) {
        elements.removePhotoBtn.style.display = 'inline-block';
    }
    
    showNotification('Imagem carregada com sucesso!', 'success');
}

// Remover foto
function removePhoto() {
    currentState.currentPhotoUrl = null;
    
    if (elements.photoPreview) {
        elements.photoPreview.innerHTML = '';
        elements.photoPreview.style.display = 'none';
    }
    
    if (elements.removePhotoBtn) {
        elements.removePhotoBtn.style.display = 'none';
    }
    
    if (elements.photoUpload) {
        elements.photoUpload.value = '';
    }
}

// Modais
function showCreatePlaylistModal() {
    const modal = createModal('Criar Nova Playlist', `
        <form id="create-playlist-form" class="modal-form">
            <div class="form-group">
                <label for="playlist-name-input">Nome da Playlist</label>
                <input type="text" id="playlist-name-input" placeholder="Digite o nome da playlist" required>
            </div>
            <div class="form-group">
                <label>Imagem da Playlist (Opcional)</label>
                <div class="photo-upload-area">
                    <input type="file" id="modal-photo-upload" accept="image/*" style="display: none;">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('modal-photo-upload').click()">
                        <i class="fas fa-image"></i> Escolher Imagem
                    </button>
                    <div id="modal-photo-preview" class="photo-preview" style="display: none;"></div>
                    <button type="button" id="modal-remove-photo" class="btn-danger btn-small" style="display: none;" onclick="removeModalPhoto()">
                        <i class="fas fa-times"></i> Remover Imagem
                    </button>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Criar Playlist</button>
            </div>
        </form>
    `);
    
    // Setup do upload de foto no modal
    const modalPhotoUpload = document.getElementById('modal-photo-upload');
    modalPhotoUpload.addEventListener('change', handleModalPhotoUpload);
    
    // Setup do form
    const form = document.getElementById('create-playlist-form');
    form.addEventListener('submit', handleCreatePlaylist);
    
    // Focar no input
    setTimeout(() => {
        document.getElementById('playlist-name-input')?.focus();
    }, 100);
}

function showAddSongModal() {
    if (!currentState.currentPlaylist) {
        showNotification('Selecione uma playlist primeiro', 'warning');
        return;
    }
    
    const modal = createModal('Adicionar Música', `
        <form id="add-song-form" class="modal-form">
            <div class="form-group">
                <label for="song-title-input">Título da Música</label>
                <input type="text" id="song-title-input" placeholder="Digite o título da música" required>
            </div>
            <div class="form-group">
                <label for="song-artist-input">Artista</label>
                <input type="text" id="song-artist-input" placeholder="Digite o nome do artista">
            </div>
            <div class="form-group">
                <label for="song-file-input">Arquivo de Música</label>
                <input type="file" id="song-file-input" accept="audio/*" required>
                <small>Formatos suportados: MP3, WAV, OGG, M4A</small>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Adicionar Música</button>
            </div>
        </form>
    `);
    
    const form = document.getElementById('add-song-form');
    form.addEventListener('submit', handleAddSong);
    
    setTimeout(() => {
        document.getElementById('song-title-input')?.focus();
    }, 100);
}

// Criar modal
function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-content">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    return modal;
}

// Fechar modal
function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
    currentState.currentPhotoUrl = null;
}

// Manipuladores de formulários
async function handleCreatePlaylist(event) {
    event.preventDefault();
    
    const nameInput = document.getElementById('playlist-name-input');
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Por favor, digite um nome para a playlist', 'warning');
        return;
    }
    
    // Verificar se já existe uma playlist com esse nome
    if (currentState.playlists.find(p => p.name.toLowerCase() === name.toLowerCase())) {
        showNotification('Já existe uma playlist com esse nome', 'warning');
        return;
    }
    
    const newPlaylist = {
        id: generateId(),
        name: name,
        songs: [],
        photo: currentState.currentPhotoUrl,
        createdAt: new Date().toISOString()
    };
    
    currentState.playlists.push(newPlaylist);
    saveData();
    renderPlaylists();
    selectPlaylist(newPlaylist.id);
    closeModal();
    
    showNotification('Playlist criada com sucesso!', 'success');
}

async function handleAddSong(event) {
    event.preventDefault();
    
    const titleInput = document.getElementById('song-title-input');
    const artistInput = document.getElementById('song-artist-input');
    const fileInput = document.getElementById('song-file-input');
    
    const title = titleInput.value.trim();
    const artist = artistInput.value.trim();
    const file = fileInput.files[0];
    
    if (!title || !file) {
        showNotification('Por favor, preencha todos os campos obrigatórios', 'warning');
        return;
    }
    
    try {
        showNotification('Processando arquivo de música...', 'info');
        
        // Criar URL do arquivo
        const fileUrl = URL.createObjectURL(file);
        
        // Obter duração do arquivo
        const duration = await getAudioDuration(fileUrl);
        
        const newSong = {
            id: generateId(),
            title: title,
            artist: artist || 'Artista Desconhecido',
            file: fileUrl,
            duration: duration,
            addedAt: new Date().toISOString()
        };
        
        currentState.currentPlaylist.songs.push(newSong);
        saveData();
        renderSongs();
        closeModal();
        
        showNotification('Música adicionada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao adicionar música:', error);
        showNotification('Erro ao processar arquivo de música', 'error');
    }
}

// Obter duração do áudio
function getAudioDuration(src) {
    return new Promise((resolve) => {
        const audio = new Audio(src);
        audio.addEventListener('loadedmetadata', () => {
            resolve(audio.duration || 0);
        });
        audio.addEventListener('error', () => {
            resolve(0);
        });
        audio.load();
    });
}

// Upload de foto no modal
function handleModalPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecione uma imagem válida', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('A imagem deve ter menos de 10MB', 'error');
        return;
    }
    
    uploadToCloudinaryModal(file);
}

// Upload para Cloudinary no modal
async function uploadToCloudinaryModal(file) {
    try {
        showNotification('Fazendo upload da imagem...', 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Erro no upload');
        }
        
        const data = await response.json();
        handleModalCloudinaryUpload(data);
        
    } catch (error) {
        console.error('Erro no upload:', error);
        showNotification('Erro ao fazer upload da imagem', 'error');
    }
}

// Manipular upload do Cloudinary no modal
function handleModalCloudinaryUpload(result) {
    currentState.currentPhotoUrl = result.secure_url;
    
    const preview = document.getElementById('modal-photo-preview');
    const removeBtn = document.getElementById('modal-remove-photo');
    
    if (preview) {
        preview.innerHTML = `
            <img src="${result.secure_url}" alt="Preview" class="photo-preview-img">
        `;
        preview.style.display = 'block';
    }
    
    if (removeBtn) {
        removeBtn.style.display = 'inline-block';
    }
    
    showNotification('Imagem carregada com sucesso!', 'success');
}

// Remover foto do modal
function removeModalPhoto() {
    currentState.currentPhotoUrl = null;
    
    const preview = document.getElementById('modal-photo-preview');
    const removeBtn = document.getElementById('modal-remove-photo');
    const input = document.getElementById('modal-photo-upload');
    
    if (preview) {
        preview.innerHTML = '';
        preview.style.display = 'none';
    }
    
    if (removeBtn) {
        removeBtn.style.display = 'none';
    }
    
    if (input) {
        input.value = '';
    }
}

// Editar playlist
function editPlaylist(playlistId) {
    const playlist = currentState.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    currentState.currentPhotoUrl = playlist.photo;
    
    const modal = createModal('Editar Playlist', `
        <form id="edit-playlist-form" class="modal-form">
            <div class="form-group">
                <label for="edit-playlist-name-input">Nome da Playlist</label>
                <input type="text" id="edit-playlist-name-input" value="${escapeHtml(playlist.name)}" required>
            </div>
            <div class="form-group">
                <label>Imagem da Playlist</label>
                <div class="photo-upload-area">
                    <input type="file" id="edit-modal-photo-upload" accept="image/*" style="display: none;">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('edit-modal-photo-upload').click()">
                        <i class="fas fa-image"></i> Escolher Nova Imagem
                    </button>
                    <div id="edit-modal-photo-preview" class="photo-preview" style="display: ${playlist.photo ? 'block' : 'none'};">
                        ${playlist.photo ? `<img src="${playlist.photo}" alt="Preview" class="photo-preview-img">` : ''}
                    </div>
                    <button type="button" id="edit-modal-remove-photo" class="btn-danger btn-small" style="display: ${playlist.photo ? 'inline-block' : 'none'};" onclick="removeEditModalPhoto()">
                        <i class="fas fa-times"></i> Remover Imagem
                    </button>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Salvar Alterações</button>
            </div>
        </form>
    `);
    
    // Setup do upload de foto
    const photoUpload = document.getElementById('edit-modal-photo-upload');
    photoUpload.addEventListener('change', handleEditModalPhotoUpload);
    
    // Setup do form
    const form = document.getElementById('edit-playlist-form');
    form.addEventListener('submit', (e) => handleEditPlaylist(e, playlistId));
    
    setTimeout(() => {
        document.getElementById('edit-playlist-name-input')?.focus();
    }, 100);
}

// Upload de foto no modal de edição
function handleEditModalPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecione uma imagem válida', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showNotification('A imagem deve ter menos de 10MB', 'error');
        return;
    }
    
    uploadToCloudinaryEditModal(file);
}

// Upload para Cloudinary no modal de edição
async function uploadToCloudinaryEditModal(file) {
    try {
        showNotification('Fazendo upload da imagem...', 'info');
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Erro no upload');
        }
        
        const data = await response.json();
        handleEditModalCloudinaryUpload(data);
        
    } catch (error) {
        console.error('Erro no upload:', error);
        showNotification('Erro ao fazer upload da imagem', 'error');
    }
}

// Manipular upload do Cloudinary no modal de edição
function handleEditModalCloudinaryUpload(result) {
    currentState.currentPhotoUrl = result.secure_url;
    
    const preview = document.getElementById('edit-modal-photo-preview');
    const removeBtn = document.getElementById('edit-modal-remove-photo');
    
    if (preview) {
        preview.innerHTML = `
            <img src="${result.secure_url}" alt="Preview" class="photo-preview-img">
        `;
        preview.style.display = 'block';
    }
    
    if (removeBtn) {
        removeBtn.style.display = 'inline-block';
    }
    
    showNotification('Imagem carregada com sucesso!', 'success');
}

// Remover foto do modal de edição
function removeEditModalPhoto() {
    currentState.currentPhotoUrl = null;
    
    const preview = document.getElementById('edit-modal-photo-preview');
    const removeBtn = document.getElementById('edit-modal-remove-photo');
    const input = document.getElementById('edit-modal-photo-upload');
    
    if (preview) {
        preview.innerHTML = '';
        preview.style.display = 'none';
    }
    
    if (removeBtn) {
        removeBtn.style.display = 'none';
    }
    
    if (input) {
        input.value = '';
    }
}

// Manipular edição de playlist
function handleEditPlaylist(event, playlistId) {
    event.preventDefault();
    
    const nameInput = document.getElementById('edit-playlist-name-input');
    const name = nameInput.value.trim();
    
    if (!name) {
        showNotification('Por favor, digite um nome para a playlist', 'warning');
        return;
    }
    
    const playlist = currentState.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    // Verificar se já existe outra playlist com esse nome
    const existingPlaylist = currentState.playlists.find(p => 
        p.id !== playlistId && p.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingPlaylist) {
        showNotification('Já existe uma playlist com esse nome', 'warning');
        return;
    }
    
    playlist.name = name;
    playlist.photo = currentState.currentPhotoUrl;
    playlist.updatedAt = new Date().toISOString();
    
    saveData();
    renderPlaylists();
    
    if (currentState.currentPlaylist?.id === playlistId) {
        updatePlaylistHeader();
    }
    
    closeModal();
    showNotification('Playlist atualizada com sucesso!', 'success');
}

// Excluir playlist
function deletePlaylist(playlistId) {
    const playlist = currentState.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    if (!confirm(`Tem certeza que deseja excluir a playlist "${playlist.name}"? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    // Parar reprodução se estiver reproduzindo desta playlist
    if (currentState.currentPlaylist?.id === playlistId) {
        currentState.audio.pause();
        currentState.isPlaying = false;
        currentState.currentSong = null;
        currentState.currentPlaylist = null;
        updatePlayButton();
        updateCurrentSongInfo();
    }
    
    // Remover playlist
    currentState.playlists = currentState.playlists.filter(p => p.id !== playlistId);
    saveData();
    renderPlaylists();
    
    // Selecionar primeira playlist disponível
    if (currentState.playlists.length > 0 && !currentState.currentPlaylist) {
        selectPlaylist(currentState.playlists[0].id);
    } else if (currentState.playlists.length === 0) {
        elements.songsContainer.innerHTML = '';
        const header = document.getElementById('playlist-header');
        if (header) header.innerHTML = '';
    }
    
    showNotification('Playlist excluída com sucesso!', 'success');
}

// Editar música
function editSong(songId) {
    if (!currentState.currentPlaylist) return;
    
    const song = currentState.currentPlaylist.songs.find(s => s.id === songId);
    if (!song) return;
    
    const modal = createModal('Editar Música', `
        <form id="edit-song-form" class="modal-form">
            <div class="form-group">
                <label for="edit-song-title-input">Título da Música</label>
                <input type="text" id="edit-song-title-input" value="${escapeHtml(song.title)}" required>
            </div>
            <div class="form-group">
                <label for="edit-song-artist-input">Artista</label>
                <input type="text" id="edit-song-artist-input" value="${escapeHtml(song.artist || '')}" placeholder="Nome do artista">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn-primary">Salvar Alterações</button>
            </div>
        </form>
    `);
    
    const form = document.getElementById('edit-song-form');
    form.addEventListener('submit', (e) => handleEditSong(e, songId));
    
    setTimeout(() => {
        document.getElementById('edit-song-title-input')?.focus();
    }, 100);
}

// Manipular edição de música
function handleEditSong(event, songId) {
    event.preventDefault();
    
    const titleInput = document.getElementById('edit-song-title-input');
    const artistInput = document.getElementById('edit-song-artist-input');
    
    const title = titleInput.value.trim();
    const artist = artistInput.value.trim();
    
    if (!title) {
        showNotification('Por favor, digite um título para a música', 'warning');
        return;
    }
    
    const song = currentState.currentPlaylist.songs.find(s => s.id === songId);
    if (!song) return;
    
    song.title = title;
    song.artist = artist || 'Artista Desconhecido';
    song.updatedAt = new Date().toISOString();
    
    saveData();
    renderSongs();
    
    // Atualizar info da música atual se necessário
    if (currentState.currentSong?.id === songId) {
        updateCurrentSongInfo();
    }
    
    closeModal();
    showNotification('Música atualizada com sucesso!', 'success');
}

// Remover música
function removeSong(songId) {
    if (!currentState.currentPlaylist) return;
    
    const song = currentState.currentPlaylist.songs.find(s => s.id === songId);
    if (!song) return;
    
    if (!confirm(`Tem certeza que deseja remover "${song.title}"? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    // Parar reprodução se estiver reproduzindo esta música
    if (currentState.currentSong?.id === songId) {
        currentState.audio.pause();
        currentState.isPlaying = false;
        currentState.currentSong = null;
        updatePlayButton();
        updateCurrentSongInfo();
    }
    
    // Remover música
    currentState.currentPlaylist.songs = currentState.currentPlaylist.songs.filter(s => s.id !== songId);
    saveData();
    renderSongs();
    renderPlaylists(); // Atualizar contador de músicas
    
    showNotification('Música removida com sucesso!', 'success');
}

// Pesquisar músicas (debounced)
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function searchSongs() {
    renderSongs();
}

// Atalhos de teclado
function handleKeyboardShortcuts(event) {
    // Ignorar se estiver digitando em um input
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch (event.key) {
        case ' ':
            event.preventDefault();
            togglePlayPause();
            break;
        case 'ArrowRight':
            event.preventDefault();
            playNextSong();
            break;
        case 'ArrowLeft':
            event.preventDefault();
            playPrevSong();
            break;
        case 'ArrowUp':
            event.preventDefault();
            changeVolumeByStep(5);
            break;
        case 'ArrowDown':
            event.preventDefault();
            changeVolumeByStep(-5);
            break;
        case 'Escape':
            closeModal();
            break;
    }
}

// Alterar volume por incremento
function changeVolumeByStep(step) {
    if (!elements.volumeSlider) return;
    
    const currentVolume = parseInt(elements.volumeSlider.value);
    const newVolume = Math.max(0, Math.min(100, currentVolume + step));
    
    elements.volumeSlider.value = newVolume;
    currentState.audio.volume = newVolume / 100;
    saveData();
}

// Toggle tema
function toggleTheme() {
    currentState.isDarkMode = !currentState.isDarkMode;
    applyTheme();
    saveData();
}

// Aplicar tema
function applyTheme() {
    if (currentState.isDarkMode) {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    
    // Atualizar ícone do botão de tema
    if (elements.themeToggle) {
        const icon = elements.themeToggle.querySelector('i');
        if (icon) {
            icon.className = currentState.isDarkMode ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}

// Manipular erro de áudio
function handleAudioError(event) {
    console.error('Erro no áudio:', event);
    showNotification('Erro ao reproduzir o arquivo de áudio', 'error');
    
    currentState.isPlaying = false;
    updatePlayButton();
    
    // Tentar próxima música
    setTimeout(() => {
        playNextSong();
    }, 1000);
}

// Notificações
function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Mostrar notificação
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto remover após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Ícones de notificação
function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Utilitários
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Drag and Drop para reorganizar músicas
function enableSongReordering() {
    if (!elements.songsContainer) return;
    
    let draggedElement = null;
    
    elements.songsContainer.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('song-item')) {
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
        }
    });
    
    elements.songsContainer.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('song-item')) {
            e.target.style.opacity = '';
            draggedElement = null;
        }
    });
    
    elements.songsContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    elements.songsContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        
        if (!draggedElement) return;
        
        const targetElement = e.target.closest('.song-item');
        if (!targetElement || targetElement === draggedElement) return;
        
        const draggedId = draggedElement.dataset.songId;
        const targetId = targetElement.dataset.songId;
        
        reorderSongs(draggedId, targetId);
    });
}

// Reorganizar músicas
function reorderSongs(draggedId, targetId) {
    if (!currentState.currentPlaylist) return;
    
    const songs = currentState.currentPlaylist.songs;
    const draggedIndex = songs.findIndex(s => s.id === draggedId);
    const targetIndex = songs.findIndex(s => s.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Mover música
    const [draggedSong] = songs.splice(draggedIndex, 1);
    songs.splice(targetIndex, 0, draggedSong);
    
    saveData();
    renderSongs();
    showNotification('Ordem das músicas atualizada!', 'success');
}

// Exportar playlist
function exportPlaylist(playlistId) {
    const playlist = currentState.playlists.find(p => p.id === playlistId);
    if (!playlist) return;
    
    const exportData = {
        name: playlist.name,
        songs: playlist.songs.map(song => ({
            title: song.title,
            artist: song.artist,
            duration: song.duration
        })),
        photo: playlist.photo,
        exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlist.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_playlist.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    showNotification('Playlist exportada com sucesso!', 'success');
}

// Inicializar drag and drop após renderização
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(enableSongReordering, 1000);
});

// PWA Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registrado com sucesso:', registration);
            })
            .catch((registrationError) => {
                console.log('Falha ao registrar SW:', registrationError);
            });
    });
}

// Controles de media session
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
        if (!currentState.isPlaying) togglePlayPause();
    });
    
    navigator.mediaSession.setActionHandler('pause', () => {
        if (currentState.isPlaying) togglePlayPause();
    });
    
    navigator.mediaSession.setActionHandler('previoustrack', playPrevSong);
    navigator.mediaSession.setActionHandler('nexttrack', playNextSong);
}

// Atualizar media session
function updateMediaSession() {
    if ('mediaSession' in navigator && currentState.currentSong) {
        const song = currentState.currentSong;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist || 'Artista Desconhecido',
            album: currentState.currentPlaylist?.name || 'Playlist',
            artwork: currentState.currentPlaylist?.photo ? [
                { src: currentState.currentPlaylist.photo, sizes: '400x400', type: 'image/jpeg' }
            ] : []
        });
    }
}

// Controles de volume mais suaves
function setupVolumeControls() {
    if (!elements.volumeSlider) return;
    
    let isChanging = false;
    
    elements.volumeSlider.addEventListener('mousedown', () => {
        isChanging = true;
    });
    
    elements.volumeSlider.addEventListener('mouseup', () => {
        isChanging = false;
    });
    
    elements.volumeSlider.addEventListener('input', (e) => {
        if (isChanging) {
            const volume = e.target.value / 100;
            currentState.audio.volume = volume;
        }
    });
}

// Chamada final para inicializar controles avançados
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        setupVolumeControls();
        enableSongReordering();
    }, 500);
});
