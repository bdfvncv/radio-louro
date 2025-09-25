// 🎵 RÁDIO SUPERMERCADO DO LOURO - SISTEMA 24/7
// ===================================================

// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// --- Estado da aplicação ---
let radioState = {
    currentTrack: null,
    isPlaying: false,
    volume: 70,
    playCount: 0,
    activeAlbum: null,
    tracksSinceTime: 0,
    tracksSinceAd: 0,
    isLive: false,
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
    },
    playHistory: {},
    albumCovers: { general: null }
};

// --- Mapeamento de elementos do DOM ---
const elements = {
    audioPlayer: document.getElementById('audioPlayer'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    prevTrackBtn: document.getElementById('prevTrackBtn'),
    nextTrackBtn: document.getElementById('nextTrackBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    progressBar: document.getElementById('progressBar'),
    currentTimeEl: document.getElementById('currentTime'),
    durationTimeEl: document.getElementById('durationTime'),
    trackCover: document.getElementById('trackCover'),
    trackTitleEl: document.getElementById('trackTitle'),
    albumNameEl: document.getElementById('albumName'),
    albumList: document.getElementById('albumList'),
    passwordModal: document.getElementById('passwordModal'),
    coverModal: document.getElementById('coverModal'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    liveModeToggle: document.getElementById('liveModeToggle'),
    liveIndicator: document.getElementById('liveIndicator'),
    announcementList: document.getElementById('announcementList')
};

// --- Dados dos álbuns ---
const albumData = {
    general: { title: '📻 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎉 Carnaval', description: 'Marchinhas e axé' },
};

// --- Classes para gerenciar o sistema de rádio ---

class FileManager {
    constructor() {
        this.baseApi = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}`;
    }

    async fetchPlaylists() {
        showLoading();
        try {
            const musicRes = await axios.get(`${this.baseApi}/resources/search?expression=folder:radio_louro/music&max_results=500`);
            const timeRes = await axios.get(`${this.baseApi}/resources/search?expression=folder:radio_louro/time&max_results=500`);
            const adsRes = await axios.get(`${this.baseApi}/resources/search?expression=folder:radio_louro/ads&max_results=500`);
            const coversRes = await axios.get(`${this.baseApi}/resources/search?expression=folder:radio_louro/covers&max_results=500`);

            const parseResources = (resources) => resources.map(res => ({
                id: res.asset_id,
                title: res.context?.custom?.caption || this.parseTitle(res.public_id),
                url: res.secure_url,
                album: this.parseAlbum(res.folder)
            }));

            radioState.playlists.music = parseResources(musicRes.data.resources);
            radioState.playlists.time = parseResources(timeRes.data.resources);
            radioState.playlists.ads = parseResources(adsRes.data.resources);

            // Adicionar músicas aos álbuns
            for (const album in radioState.playlists.albums) {
                radioState.playlists.albums[album] = radioState.playlists.music.filter(t => t.album === album);
            }

            // Mapear capas
            coversRes.data.resources.forEach(res => {
                const folder = res.folder.split('/').pop();
                radioState.albumCovers[folder] = res.secure_url;
            });

            console.log('✅ Playlists e capas carregadas:', radioState.playlists);
            this.saveData();

        } catch (error) {
            console.error('❌ Erro ao carregar dados da Cloudinary:', error);
        } finally {
            hideLoading();
        }
    }

    saveData() {
        try {
            localStorage.setItem('radioState', JSON.stringify(radioState));
            console.log('💾 Estado da rádio salvo localmente.');
        } catch (error) {
            console.error('❌ Erro ao salvar dados:', error);
        }
    }

    loadData() {
        try {
            const savedState = JSON.parse(localStorage.getItem('radioState'));
            if (savedState) {
                radioState = { ...radioState, ...savedState };
                console.log('🔄 Estado da rádio carregado do localStorage.');
                return true;
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados salvos:', error);
        }
        return false;
    }

    parseTitle(publicId) {
        const parts = publicId.split('/');
        let filename = parts.pop().replace(/_/g, ' ').replace(/\.mp3$/, '');
        const match = filename.match(/^(\d+-\d+-\d+)?\s*(.*)$/);
        return match ? match[2].trim() : filename;
    }

    parseAlbum(folderPath) {
        const parts = folderPath.split('/');
        return parts.length > 1 ? parts[parts.length - 1] : 'general';
    }
}

class UIManager {
    constructor() {
        this.albumData = albumData;
    }

    updatePlayerInfo(track) {
        if (!track) {
            elements.trackTitleEl.textContent = 'Rádio Supermercado do Louro';
            elements.albumNameEl.textContent = 'A trilha sonora do seu dia!';
            elements.trackCover.src = radioState.albumCovers.general || 'https://res.cloudinary.com/dygbrcrr6/image/upload/v1633333333/default_cover.png';
            return;
        }

        elements.trackTitleEl.textContent = track.title;
        elements.albumNameEl.textContent = this.albumData[track.album]?.title || 'Playlist Geral';
        const coverUrl = radioState.albumCovers[track.album] || radioState.albumCovers.general || 'https://res.cloudinary.com/dygbrcrr6/image/upload/v1633333333/default_cover.png';
        elements.trackCover.src = coverUrl;
    }

    updateLiveIndicator() {
        if (radioState.isLive) {
            elements.liveIndicator.textContent = '● AO VIVO';
            elements.liveIndicator.className = 'live-indicator live';
            elements.liveModeToggle.textContent = 'Parar Transmissão';
        } else {
            elements.liveIndicator.textContent = '● PAUSADO';
            elements.liveIndicator.className = 'live-indicator paused';
            elements.liveModeToggle.textContent = 'Ficar ao Vivo 24/7';
        }
    }

    updatePlayPauseButton() {
        if (radioState.isPlaying) {
            elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    updateVolume() {
        elements.audioPlayer.volume = elements.volumeSlider.value / 100;
        radioState.volume = elements.volumeSlider.value;
    }

    updateProgressBar() {
        const { currentTime, duration } = elements.audioPlayer;
        if (duration) {
            const progress = (currentTime / duration) * 100;
            elements.progressBar.style.width = `${progress}%`;
            elements.currentTimeEl.textContent = formatTime(currentTime);
            elements.durationTimeEl.textContent = formatTime(duration);
        } else {
            elements.progressBar.style.width = '0%';
            elements.currentTimeEl.textContent = '0:00';
            elements.durationTimeEl.textContent = '0:00';
        }
    }

    renderAlbums() {
        elements.albumList.innerHTML = '';
        const albumsToRender = ['general', 'natal', 'pascoa', 'saojoao', 'carnaval'];
        albumsToRender.forEach(albumKey => {
            const albumInfo = this.albumData[albumKey];
            const coverUrl = radioState.albumCovers[albumKey] || radioState.albumCovers.general || 'https://res.cloudinary.com/dygbrcrr6/image/upload/v1633333333/default_cover.png';

            const albumItem = document.createElement('div');
            albumItem.className = 'cover-item';
            albumItem.innerHTML = `
                <img src="${coverUrl}" alt="Capa do Álbum ${albumInfo.title}">
                <h4>${albumInfo.title}</h4>
                <p>${albumInfo.description}</p>
            `;
            albumItem.onclick = () => {
                radioState.activeAlbum = albumKey;
                alert(`Tocando álbum: ${albumInfo.title}`);
                // Implementar lógica de reprodução do álbum
            };
            elements.albumList.appendChild(albumItem);
        });
    }

    // Função para atualizar a programação
    updateProgramSchedule() {
        const programListEl = document.querySelector('.program-list');
        programListEl.innerHTML = '';

        const nowPlaying = `Músicas do Momento`;
        const nextTime = `Aviso: Horário de pico`;
        const nextAd = `Aviso Comercial`;

        programListEl.innerHTML += `
            <div class="program-item">
                <span class="program-time">Agora:</span>
                <span class="program-title">${nowPlaying}</span>
            </div>
            <div class="program-item">
                <span class="program-time">Em breve:</span>
                <span class="program-title">${nextTime}</span>
            </div>
            <div class="program-item">
                <span class="program-time">Em seguida:</span>
                <span class="program-title">${nextAd}</span>
            </div>
        `;
    }
}

class RadioManager {
    constructor(ui, fileManager) {
        this.ui = ui;
        this.fileManager = fileManager;
        this.shuffledMusic = [];
        this.musicIndex = -1;
    }

    // Inicia ou para o modo 24/7
    toggleLiveMode() {
        radioState.isLive = !radioState.isLive;
        this.ui.updateLiveIndicator();

        if (radioState.isLive) {
            console.log('📻 Modo ao vivo 24/7 ativado.');
            this.preparePlaylist();
            this.playNext();
        } else {
            console.log('🛑 Modo ao vivo 24/7 desativado.');
            elements.audioPlayer.pause();
            radioState.isPlaying = false;
            this.ui.updatePlayPauseButton();
        }
    }

    // Prepara a playlist e a embaralha
    preparePlaylist() {
        if (radioState.playlists.music.length === 0) {
            console.warn('Playlist de música vazia. Tentando recarregar.');
            this.fileManager.fetchPlaylists().then(() => this.preparePlaylist());
            return;
        }
        this.shuffledMusic = [...radioState.playlists.music].sort(() => 0.5 - Math.random());
        this.musicIndex = 0;
    }

    // Toca a próxima faixa na sequência
    playNext() {
        if (!radioState.isLive) return;

        let nextTrack = null;

        // Lógica de Programação:
        // 1. Toca um aviso a cada 5 músicas
        if (radioState.tracksSinceTime >= 5 && radioState.playlists.time.length > 0) {
            nextTrack = this.getRandomTrack(radioState.playlists.time);
            radioState.tracksSinceTime = 0;
            console.log('🎵 Tocando aviso...');
        }
        // 2. Toca um anúncio a cada 10 músicas
        else if (radioState.tracksSinceAd >= 10 && radioState.playlists.ads.length > 0) {
            nextTrack = this.getRandomTrack(radioState.playlists.ads);
            radioState.tracksSinceAd = 0;
            console.log('🎵 Tocando anúncio...');
        }
        // 3. Toca uma música
        else {
            nextTrack = this.shuffledMusic[this.musicIndex];
            this.musicIndex = (this.musicIndex + 1) % this.shuffledMusic.length;
            
            // Se a música for um 'general', conta para os avisos
            if (nextTrack && nextTrack.album === 'general') {
                radioState.tracksSinceTime++;
                radioState.tracksSinceAd++;
            }
        }
        
        // Se a playlist principal estiver vazia, recomeça
        if (!nextTrack) {
            console.warn('Não há faixas para tocar. Reiniciando a playlist...');
            this.preparePlaylist();
            nextTrack = this.shuffledMusic[0];
        }

        this.playTrack(nextTrack);
    }

    getRandomTrack(playlist) {
        return playlist[Math.floor(Math.random() * playlist.length)];
    }

    playTrack(track) {
        if (!track || !track.url) {
            console.error('❌ Faixa inválida. Pulando.');
            this.playNext();
            return;
        }

        radioState.currentTrack = track;
        elements.audioPlayer.src = track.url;
        this.ui.updatePlayerInfo(track);
        this.ui.updatePlayPauseButton();
        
        const playPromise = elements.audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                radioState.isPlaying = true;
                this.ui.updateLiveIndicator();
                this.ui.updatePlayPauseButton();
            }).catch(error => {
                console.error('❌ Erro de reprodução:', error);
                radioState.isPlaying = false;
                this.ui.updatePlayPauseButton();
                this.ui.updateLiveIndicator();
                // Tenta a próxima faixa em caso de erro
                setTimeout(() => this.playNext(), 2000);
            });
        }
    }
}

// --- Funções Auxiliares ---

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function showLoading() {
    elements.loadingOverlay.classList.add('visible');
}

function hideLoading() {
    elements.loadingOverlay.classList.remove('visible');
}

// --- Event Listeners ---

function setupEventListeners(radioManager, ui) {
    elements.playPauseBtn.addEventListener('click', () => {
        if (radioState.isPlaying) {
            elements.audioPlayer.pause();
            radioState.isPlaying = false;
        } else {
            elements.audioPlayer.play().catch(e => console.error('Erro ao tocar:', e));
            radioState.isPlaying = true;
        }
        ui.updatePlayPauseButton();
        ui.updateLiveIndicator();
    });

    elements.nextTrackBtn.addEventListener('click', () => {
        radioManager.playNext();
    });

    elements.prevTrackBtn.addEventListener('click', () => {
        // Lógica para voltar, se desejado.
        // Por enquanto, vamos apenas tocar a próxima.
        radioManager.playNext();
    });
    
    elements.volumeSlider.addEventListener('input', () => {
        ui.updateVolume();
    });

    elements.audioPlayer.addEventListener('timeupdate', () => {
        ui.updateProgressBar();
    });

    elements.audioPlayer.addEventListener('ended', () => {
        console.log('▶️ Faixa encerrada. Trocando para a próxima...');
        radioManager.playNext();
    });

    elements.liveModeToggle.addEventListener('click', () => {
        radioManager.toggleLiveMode();
    });
}

// --- Funções de Acesso Admin ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('visible');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('visible');
}

function checkPassword() {
    const passwordInput = document.getElementById('adminPassword').value;
    if (passwordInput === 'admin123') { // Senha de exemplo, mudar para algo seguro!
        alert('Acesso admin concedido!');
        closeModal('passwordModal');
        // Implementar redirecionamento ou mostrar controles de admin
    } else {
        alert('Senha incorreta!');
    }
}

// --- INICIALIZAÇÃO PRINCIPAL ---

async function safeInitialization() {
    console.log('🎵 Carregando sistema de rádio...');
    showLoading();
    try {
        const fileManager = new FileManager();
        const uiManager = new UIManager();
        const radioManager = new RadioManager(uiManager, fileManager);

        const isLoaded = fileManager.loadData();
        if (!isLoaded) {
            await fileManager.fetchPlaylists();
        }

        // Renderizar UI inicial
        uiManager.updatePlayerInfo();
        uiManager.updateVolume();
        uiManager.renderAlbums();
        uiManager.updateLiveIndicator();
        uiManager.updateProgramSchedule();

        setupEventListeners(radioManager, uiManager);
        
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
    } finally {
        hideLoading();
    }
}

safeInitialization();
