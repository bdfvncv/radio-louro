// 🎵 RÁDIO SUPERMERCADO DO LOURO - SCRIPT CORRIGIDO E ATUALIZADO
// ===================================================

// Configuração da Cloudinary (atualizado com suas credenciais)
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
    activeAlbum: 'general',
    tracksSinceTime: 0,
    tracksSinceAd: 0,
    lastTimeCheck: 0,
    isLive: false,
    autoPlay: true,
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: {
            general: [],
            natal: [],
            pascoa: [],
            saojoao: [],
            carnaval: []
        }
    },
    playHistory: {},
    albumCovers: {
        general: null
    },
    // Nova fila de reprodução para o modo 24/7
    playQueue: [],
    // Avisos de texto
    currentAlert: ""
};

// Dados dos álbuns
const albumData = {
    general: { title: '📻 Playlist Geral', description: 'Todas as músicas da rádio' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎊 Carnaval', description: 'Marchinhas e axé' }
};

// Mapeamento de elementos HTML
const elements = {
    audioPlayer: document.getElementById('audioPlayer'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    volumeSlider: document.getElementById('volumeSlider'),
    currentTrackTitle: document.getElementById('currentTrackTitle'),
    artistName: document.getElementById('artistName'),
    coverImage: document.getElementById('coverImage'),
    playlistSelect: document.getElementById('playlistSelect'),
    fileList: document.getElementById('fileList'),
    passwordModal: document.getElementById('passwordModal'),
    adminPanel: document.getElementById('adminPanel'),
    adminPassword: document.getElementById('adminPassword'),
    coverModal: document.getElementById('coverModal'),
    coverAlbumName: document.getElementById('coverAlbumName'),
    coverUpload: document.getElementById('coverUpload'),
    albumCoversGrid: document.getElementById('albumCoversGrid'),
    albumSelect: document.getElementById('albumSelect'),
    albumFiles: document.getElementById('albumFiles'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    liveStatus: document.getElementById('live-status'),
    alertModal: document.getElementById('alertModal'),
    alertText: document.getElementById('alertText')
};

// CLOUDINARY UPLOAD WIDGET
let myWidget;

const cloudinaryManager = {
    init: () => {
        myWidget = cloudinary.createUploadWidget({
            cloudName: CLOUDINARY_CONFIG.cloudName,
            uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
            folder: `radio/${radioState.activeAlbum}`
        }, (error, result) => {
            if (!error && result && result.event === "success") {
                console.log('✅ Upload concluído com sucesso:', result.info);
                fileManager.addFile(result.info.original_filename, result.info.secure_url, radioState.activeAlbum);
            }
        });
    }
};

const fileManager = {
    // Carrega os dados do localStorage
    loadData: () => {
        try {
            const data = JSON.parse(localStorage.getItem('radioData'));
            if (data) {
                radioState.playlists = data.playlists || radioState.playlists;
                radioState.albumCovers = data.albumCovers || radioState.albumCovers;
                radioState.playHistory = data.playHistory || radioState.playHistory;
                radioState.currentAlert = data.currentAlert || "";
                console.log('📊 Dados de playlists carregados com sucesso!');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados do localStorage:', error);
        }
    },

    // Salva os dados no localStorage
    saveData: () => {
        try {
            localStorage.setItem('radioData', JSON.stringify({
                playlists: radioState.playlists,
                albumCovers: radioState.albumCovers,
                playHistory: radioState.playHistory,
                currentAlert: radioState.currentAlert
            }));
            console.log('💾 Dados salvos com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao salvar dados no localStorage:', error);
        }
    },

    // Adiciona um novo arquivo à playlist e salva
    addFile: (title, url, album) => {
        if (!radioState.playlists.albums[album]) {
            radioState.playlists.albums[album] = [];
        }
        radioState.playlists.albums[album].push({ title, url });
        fileManager.distributePlaylists();
        fileManager.saveData();
        uiManager.renderFileList(radioState.playlists[elements.playlistSelect.value]);
    },

    // Remove um arquivo e salva
    removeFile: (url, album) => {
        const playlist = radioState.playlists.albums[album];
        if (playlist) {
            const newPlaylist = playlist.filter(track => track.url !== url);
            radioState.playlists.albums[album] = newPlaylist;
            fileManager.distributePlaylists();
            fileManager.saveData();
            uiManager.renderFileList(newPlaylist);
        }
    },
    
    // Distribui os arquivos dos álbuns para as playlists principais
    distributePlaylists: () => {
        // Zera as playlists principais antes de redistribuir
        radioState.playlists.music = [];
        radioState.playlists.time = [];
        radioState.playlists.ads = [];

        for (const album in radioState.playlists.albums) {
            const albumName = album.toLowerCase();
            const playlist = radioState.playlists.albums[album];
            if (playlist) {
                // Copia as músicas do álbum 'geral' para a playlist de música
                if (albumName === 'general' || albumName === 'natal' || albumName === 'pascoa' || albumName === 'saojoao' || albumName === 'carnaval') {
                    radioState.playlists.music.push(...playlist);
                }
                // Adiciona comerciais
                if (albumName.includes('ads')) {
                    radioState.playlists.ads.push(...playlist);
                }
                // Adiciona vinhetas de tempo
                if (albumName.includes('time')) {
                    radioState.playlists.time.push(...playlist);
                }
            }
        }
    }
};

const radioManager = {
    // Inicializa o player e a rádio
    init: () => {
        // Carrega os dados salvos
        fileManager.loadData();
        fileManager.distributePlaylists();
        
        // Verifica se há músicas para tocar
        if (radioState.playlists.music.length === 0) {
            uiManager.setPlayerInfo('Nenhuma música encontrada.', 'Faça upload no painel admin.');
            return;
        }

        // Preenche a fila de reprodução inicial
        radioManager.fillQueue();

        // Configura o volume
        elements.audioPlayer.volume = radioState.volume / 100;

        // Inicia a reprodução automática se habilitado
        if (radioState.autoPlay) {
            radioManager.startLiveStream();
        }
    },

    // Inicia a transmissão ao vivo
    startLiveStream: () => {
        radioState.isLive = true;
        elements.liveStatus.style.display = 'flex';
        uiManager.updatePlayPauseIcon('play');
        radioManager.playNext();
    },

    // Gerencia a fila de reprodução
    fillQueue: () => {
        // Se a fila estiver vazia, recarrega
        if (radioState.playQueue.length <= 1) {
            console.log('🔄 Reabastecendo fila de reprodução...');
            const newQueue = [...radioState.playlists.music];
            // Embaralha a nova fila
            for (let i = newQueue.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]];
            }
            radioState.playQueue = [...radioState.playQueue, ...newQueue];
        }

        // Insere vinheta de tempo se for a hora
        const now = new Date();
        const lastCheck = new Date(radioState.lastTimeCheck);
        if (now - lastCheck >= 30 * 60 * 1000) { // 30 minutos
            if (radioState.playlists.time.length > 0) {
                const timeTrack = radioState.playlists.time[Math.floor(Math.random() * radioState.playlists.time.length)];
                radioState.playQueue.splice(1, 0, timeTrack); // Insere no início da fila
                radioState.lastTimeCheck = now.getTime();
                console.log('🕒 Inserindo vinheta de tempo na fila.');
            }
        }

        // Insere um comercial a cada 5 músicas
        if (radioState.tracksSinceAd >= 5) {
            if (radioState.playlists.ads.length > 0) {
                const adTrack = radioState.playlists.ads[Math.floor(Math.random() * radioState.playlists.ads.length)];
                radioState.playQueue.splice(1, 0, adTrack); // Insere no início da fila
                radioState.tracksSinceAd = 0;
                console.log('💰 Inserindo comercial na fila.');
            }
        }
    },

    // Toca a próxima música da fila
    playNext: async () => {
        if (radioState.playQueue.length === 0) {
            radioManager.fillQueue();
            if (radioState.playQueue.length === 0) {
                console.log('🛑 Fila de reprodução vazia. Rádio parou.');
                radioManager.stop();
                return;
            }
        }

        const nextTrack = radioState.playQueue.shift();
        radioState.currentTrack = nextTrack;

        // Se for um comercial ou vinheta, não conta para o contador de músicas
        if (!nextTrack.url.includes('/ads/') && !nextTrack.url.includes('/time/')) {
            radioState.tracksSinceAd++;
        }
        
        uiManager.updatePlayer(nextTrack);

        try {
            elements.audioPlayer.src = nextTrack.url;
            await elements.audioPlayer.play();
            radioState.isPlaying = true;
            uiManager.updatePlayPauseIcon('pause');
            console.log(`▶️ Tocando: ${nextTrack.title}`);
        } catch (error) {
            console.error('❌ Erro ao tentar reproduzir:', error);
            // Tenta a próxima faixa em caso de erro
            radioManager.playNext();
        }
        
        // Garante que a fila é reabastecida para não esvaziar
        radioManager.fillQueue();
    },

    // Controla o play/pause
    togglePlayPause: () => {
        if (radioState.isPlaying) {
            elements.audioPlayer.pause();
            radioState.isPlaying = false;
            uiManager.updatePlayPauseIcon('play');
        } else {
            elements.audioPlayer.play();
            radioState.isPlaying = true;
            uiManager.updatePlayPauseIcon('pause');
        }
    },

    // Para a transmissão
    stop: () => {
        elements.audioPlayer.pause();
        elements.audioPlayer.src = '';
        radioState.isPlaying = false;
        radioState.isLive = false;
        uiManager.updatePlayPauseIcon('play');
        uiManager.setPlayerInfo('Rádio Parada', 'Reinicie a página para começar.');
    }
};

const uiManager = {
    // Atualiza a interface do player
    updatePlayer: (track) => {
        elements.currentTrackTitle.textContent = track.title;
        elements.artistName.textContent = track.artist || 'Rádio Supermercado do Louro';
        uiManager.updateCover(track.album);
    },

    // Atualiza o ícone de play/pause
    updatePlayPauseIcon: (state) => {
        const icon = state === 'play' ? 'play-outline' : 'pause-outline';
        elements.playPauseBtn.innerHTML = `<ion-icon name="${icon}"></ion-icon>`;
    },

    // Renderiza a lista de arquivos
    renderFileList: (files) => {
        if (!files) return;
        elements.fileList.innerHTML = '';
        files.forEach(file => {
            const item = document.createElement('div');
            item.className = 'report-item';
            item.innerHTML = `
                <span class="file-name" title="${file.title}">${file.title}</span>
                <div class="controls">
                    <button onclick="radioManager.playFile('${file.url}')"><ion-icon name="play-circle-outline"></ion-icon></button>
                    <button onclick="fileManager.removeFile('${file.url}', radioState.activeAlbum)"><ion-icon name="trash-outline"></ion-icon></button>
                </div>
            `;
            elements.fileList.appendChild(item);
        });
    },

    // Renderiza as capas dos álbuns
    renderAlbumCovers: () => {
        elements.albumCoversGrid.innerHTML = '';
        const albums = Object.keys(albumData);
        albums.forEach(albumKey => {
            const album = albumData[albumKey];
            const cover = radioState.albumCovers[albumKey] || 'https://res.cloudinary.com/dygbrcrr6/image/upload/v1/radio-covers/general_cover';
            
            const item = document.createElement('div');
            item.className = 'cover-item';
            item.dataset.album = albumKey;
            item.innerHTML = `
                <img src="${cover}" alt="Capa do Álbum ${album.title}">
                <h4>${album.title}</h4>
            `;
            elements.albumCoversGrid.appendChild(item);
            
            item.addEventListener('click', () => {
                uiManager.changeActiveAlbum(albumKey);
            });
        });
    },

    // Atualiza a capa do player
    updateCover: (albumKey) => {
        const coverUrl = radioState.albumCovers[albumKey] || radioState.albumCovers.general;
        elements.coverImage.src = coverUrl;
    },

    // Atualiza as informações do player
    setPlayerInfo: (title, artist) => {
        elements.currentTrackTitle.textContent = title;
        elements.artistName.textContent = artist;
    },
    
    // Altera o álbum ativo e renderiza a lista de arquivos correspondente
    changeActiveAlbum: (albumKey) => {
        radioState.activeAlbum = albumKey;
        // Seção não mais necessária na nova lógica
        // const playlist = radioState.playlists.albums[albumKey];
        // uiManager.renderFileList(playlist);
        // uiManager.updateCover(albumKey);
        // elements.playlistSelect.value = 'music';
        console.log(`📁 Álbum ativo alterado para: ${albumKey}`);
    }
};

// Funções do Admin e Modals
function showLoading() { elements.loadingOverlay.style.display = 'flex'; }
function hideLoading() { elements.loadingOverlay.style.display = 'none'; }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

window.checkPassword = () => {
    const password = elements.adminPassword.value;
    // Senha codificada para segurança básica. Mude para algo mais complexo.
    if (btoa(password) === 'YWJjZDEyMw==') { // Exemplo: 'abcd123'
        closeModal('passwordModal');
        openModal('adminPanel');
        uiManager.renderFileList(radioState.playlists[elements.playlistSelect.value]);
    } else {
        alert('Senha incorreta!');
    }
};

window.toggleAdminPanel = () => {
    openModal('passwordModal');
};

window.uploadFiles = () => {
    myWidget.open();
};

window.loadAlbumFiles = () => {
    const album = elements.albumSelect.value;
    if (album) {
        radioState.activeAlbum = album;
        const playlist = radioState.playlists.albums[album];
        if (playlist) {
            uiManager.renderFileList(playlist);
        } else {
            elements.albumFiles.innerHTML = '<p>Nenhum arquivo encontrado para este álbum.</p>';
        }
    }
};

window.uploadCover = () => {
    showLoading();
    const file = elements.coverUpload.files[0];
    if (!file) {
        alert('Selecione uma imagem primeiro.');
        hideLoading();
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', 'radio-covers');
    formData.append('public_id', radioState.activeAlbum);

    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.secure_url) {
            radioState.albumCovers[radioState.activeAlbum] = data.secure_url;
            fileManager.saveData();
            uiManager.renderAlbumCovers();
            uiManager.updateCover(radioState.activeAlbum);
            alert('Capa alterada com sucesso!');
        } else {
            alert('Erro ao fazer upload da capa.');
        }
    })
    .catch(error => {
        console.error('Erro:', error);
        alert('Erro ao fazer upload da capa.');
    })
    .finally(() => {
        hideLoading();
        closeModal('coverModal');
    });
};

window.removeCover = () => {
    radioState.albumCovers[radioState.activeAlbum] = null;
    fileManager.saveData();
    uiManager.renderAlbumCovers();
    uiManager.updateCover('general');
    alert('Capa removida com sucesso!');
    closeModal('coverModal');
};

window.saveAlert = () => {
    radioState.currentAlert = elements.alertText.value;
    fileManager.saveData();
    closeModal('alertModal');
    alert('Aviso salvo!');
};

// Event Listeners
elements.playPauseBtn.addEventListener('click', radioManager.togglePlayPause);
elements.volumeSlider.addEventListener('input', (e) => {
    radioState.volume = e.target.value;
    elements.audioPlayer.volume = radioState.volume / 100;
});
elements.audioPlayer.addEventListener('ended', radioManager.playNext);

// Evento para quando o player estiver pronto
elements.audioPlayer.addEventListener('canplay', () => {
    hideLoading();
});

elements.playlistSelect.addEventListener('change', (e) => {
    uiManager.renderFileList(radioState.playlists[e.target.value]);
});

// Inicialização segura
function safeInitialization() {
    try {
        uiManager.renderAlbumCovers();
        cloudinaryManager.init();
        radioManager.init();
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
    }
}

// Tratamento de erro global
window.addEventListener('error', (e) => {
    console.error('❌ Erro global capturado:', e.error);
    if (radioState.isLive && radioManager) {
        setTimeout(() => {
            console.log('🔄 Tentando recuperar transmissão...');
            radioManager.playNext();
        }, 5000);
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
