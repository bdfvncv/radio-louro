// ===== RÁDIO SUPERMERCADO DO LOURO - SISTEMA PROFISSIONAL 24H =====
// Configurações da Cloudinary (atualizadas)
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado global da rádio
let radioState = {
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    currentProgram: null,
    volume: 70,
    listeners: 0,
    startTime: null,
    
    // Contadores para programação
    tracksPlayed: 0,
    lastTimeAnnouncement: 0,
    lastAdvertisement: 0,
    
    // Playlists organizadas
    content: {
        music: [],
        time: [],
        ads: [],
        jingles: [],
        programs: []
    },
    
    // Histórico e estatísticas
    playHistory: {},
    recentTracks: [],
    
    // Programação
    schedule: [
        { time: '06:00', title: 'Manhã no Supermercado', description: 'Música para começar bem o dia', type: 'program' },
        { time: '09:00', title: 'Hora Certa', description: 'Informações e música', type: 'time' },
        { time: '12:00', title: 'Almoço Musical', description: 'As melhores para o almoço', type: 'program' },
        { time: '15:00', title: 'Tarde Animada', description: 'Música e entretenimento', type: 'program' },
        { time: '18:00', title: 'Final de Tarde', description: 'Música para relaxar', type: 'program' },
        { time: '21:00', title: 'Noite no Supermercado', description: 'Música para a noite', type: 'program' }
    ]
};

// Elementos DOM
let elements = {};
let radioManager = null;
let isInitialized = false;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎵 Inicializando Rádio Supermercado do Louro...');
    
    try {
        initializeElements();
        loadStoredData();
        initializeRadioManager();
        setupEventListeners();
        startLiveBroadcast();
        updateUI();
        
        console.log('✅ Rádio inicializada com sucesso!');
        isInitialized = true;
    } catch (error) {
        console.error('❌ Erro na inicialização:', error);
        showError('Erro ao inicializar a rádio. Recarregue a página.');
    }
});

function initializeElements() {
    const elementIds = [
        // Player elements
        'audioPlayer', 'playPauseBtn', 'volumeBtn', 'volumeSlider', 'volumeDisplay',
        'currentTrack', 'artistName', 'trackCover', 'currentTime', 'duration', 'progressFill',
        'currentProgram', 'programDescription', 'currentDjInfo', 'nextTrackInfo', 'currentHour',
        'listenersCount', 'liveIndicator',
        
        // Containers
        'scheduleContainer', 'recentTracks',
        
        // Admin elements
        'adminAccessBtn', 'adminPanel', 'closeAdminBtn', 'passwordModal',
        'adminPassword', 'confirmPasswordBtn', 'cancelPasswordBtn',
        
        // Broadcast controls
        'broadcastStatus', 'toggleBroadcast', 'playNextBtn', 'playTimeBtn', 'playAdBtn',
        'activeProgramSelect', 'setProgramBtn',
        
        // Upload elements
        'musicUpload', 'timeUpload', 'adsUpload', 'jinglesUpload',
        'musicList', 'timeList', 'adsList', 'jinglesList',
        
        // Schedule elements
        'scheduleTime', 'scheduleType', 'scheduleTitle', 'addScheduleBtn', 'scheduleList',
        
        // Reports
        'refreshReportsBtn', 'reportsList',
        
        // Loading
        'loadingOverlay'
    ];
    
    elements = {};
    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            elements[id] = element;
        } else {
            console.warn(`Elemento não encontrado: ${id}`);
        }
    });
    
    console.log(`✅ ${Object.keys(elements).length} elementos carregados`);
}

function loadStoredData() {
    try {
        const stored = localStorage.getItem('radioState');
        if (stored) {
            const parsedState = JSON.parse(stored);
            radioState = { ...radioState, ...parsedState };
            console.log('📂 Dados carregados do localStorage');
        }
    } catch (error) {
        console.warn('⚠️ Erro ao carregar dados:', error);
    }
}

function saveData() {
    try {
        localStorage.setItem('radioState', JSON.stringify({
            content: radioState.content,
            playHistory: radioState.playHistory,
            schedule: radioState.schedule,
            volume: radioState.volume
        }));
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
    }
}

// ===== GERENCIADOR DE RÁDIO =====
class RadioManager {
    constructor() {
        this.broadcastInterval = null;
        this.timeUpdateInterval = null;
        this.scheduleCheckInterval = null;
        
        this.setupAudioEvents();
        console.log('📊 RadioManager inicializado');
    }
    
    setupAudioEvents() {
        if (!elements.audioPlayer) return;
        
        const audio = elements.audioPlayer;
        
        audio.addEventListener('loadstart', () => {
            console.log('📻 Carregando áudio...');
        });
        
        audio.addEventListener('canplay', () => {
            console.log('✅ Áudio pronto para reprodução');
            if (radioState.isLive && radioState.isPlaying) {
                audio.play().catch(e => console.log('Autoplay bloqueado:', e.message));
            }
        });
        
        audio.addEventListener('playing', () => {
            radioState.isPlaying = true;
            this.updatePlayButton();
            console.log('▶️ Reprodução iniciada');
        });
        
        audio.addEventListener('pause', () => {
            radioState.isPlaying = false;
            this.updatePlayButton();
            console.log('⏸️ Reprodução pausada');
        });
        
        audio.addEventListener('ended', () => {
            console.log('⏭️ Música finalizada, próxima...');
            this.playNext();
        });
        
        audio.addEventListener('timeupdate', () => {
            this.updateTimeDisplay();
        });
        
        audio.addEventListener('error', (e) => {
            console.error('❌ Erro no áudio:', e);
            setTimeout(() => this.playNext(), 3000);
        });
        
        // Configurar volume inicial
        audio.volume = radioState.volume / 100;
    }
    
    startBroadcast() {
        if (radioState.isLive) return;
        
        console.log('🔴 INICIANDO TRANSMISSÃO AO VIVO');
        radioState.isLive = true;
        radioState.startTime = Date.now();
        
        // Atualizar interface
        this.updateBroadcastStatus();
        this.updateLiveIndicator();
        
        // Iniciar intervalos
        this.startScheduleCheck();
        this.startTimeUpdate();
        
        // Primeira música (música simulada se não houver uploads)
        setTimeout(() => {
            this.playNext();
        }, 1000);
        
        // Simular ouvintes
        this.startListenersSimulation();
    }
    
    stopBroadcast() {
        console.log('⏹️ PARANDO TRANSMISSÃO');
        radioState.isLive = false;
        radioState.isPlaying = false;
        
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
        }
        
        // Parar intervalos
        if (this.scheduleCheckInterval) {
            clearInterval(this.scheduleCheckInterval);
        }
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        this.updateBroadcastStatus();
        this.updateLiveIndicator();
    }
    
    playNext() {
        const nextTrack = this.getNextTrack();
        if (!nextTrack) {
            console.log('⚠️ Nenhuma música disponível - usando música de demonstração');
            this.playDemoTrack();
            return;
        }
        
        this.loadTrack(nextTrack);
    }
    
    playDemoTrack() {
        // Música de demonstração quando não há uploads
        const demoTrack = {
            name: 'Música de Demonstração',
            artist: 'Rádio Supermercado do Louro',
            url: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeBjqO0vPPfzAGG2q+8+N8NwsVXrjo4KxbFgpKn+PufmM=',
            coverUrl: 'https://via.placeholder.com/200x200/1a4332/ffffff?text=DEMO',
            category: 'demo'
        };
        
        this.loadTrack(demoTrack);
    }
    
    getNextTrack() {
        // Verificar se precisa tocar hora certa (a cada hora)
        const now = new Date();
        if (now.getMinutes() === 0 && 
            (Date.now() - radioState.lastTimeAnnouncement) > 3500000 && // 58 minutos
            radioState.content.time.length > 0) {
            radioState.lastTimeAnnouncement = Date.now();
            return this.getRandomFromCategory('time');
        }
        
        // Verificar se precisa tocar propaganda (a cada 5-7 músicas)
        if (radioState.tracksPlayed > 0 && 
            radioState.tracksPlayed % (5 + Math.floor(Math.random() * 3)) === 0 &&
            (Date.now() - radioState.lastAdvertisement) > 300000 && // 5 minutos mínimo
            radioState.content.ads.length > 0) {
            radioState.lastAdvertisement = Date.now();
            return this.getRandomFromCategory('ads');
        }
        
        // Tocar vinheta ocasionalmente (10% chance)
        if (Math.random() < 0.1 && radioState.content.jingles.length > 0) {
            return this.getRandomFromCategory('jingles');
        }
        
        // Música normal
        return this.getRandomFromCategory('music');
    }
    
    getRandomFromCategory(category) {
        const items = radioState.content[category];
        if (!items || items.length === 0) return null;
        
        // Evitar repetir a música atual
        let availableItems = items;
        if (radioState.currentTrack && items.length > 1) {
            availableItems = items.filter(item => item.url !== radioState.currentTrack.url);
        }
        
        if (availableItems.length === 0) availableItems = items;
        
        return availableItems[Math.floor(Math.random() * availableItems.length)];
    }
    
    loadTrack(track) {
        if (!track || !elements.audioPlayer) return;
        
        console.log(`🎵 Carregando: ${track.name}`);
        
        radioState.currentTrack = track;
        elements.audioPlayer.src = track.url;
        
        // Atualizar interface
        this.updateTrackDisplay(track);
        this.updateRecentTracks(track);
        
        // Estatísticas
        this.updatePlayHistory(track);
        radioState.tracksPlayed++;
        
        // Reproduzir se estiver ao vivo
        if (radioState.isLive) {
            elements.audioPlayer.play().catch(e => {
                console.log('Erro no autoplay:', e.message);
            });
        }
    }
    
    updateTrackDisplay(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name || 'Música sem título';
        }
        
        if (elements.artistName) {
            elements.artistName.textContent = track.artist || 'Rádio Supermercado do Louro';
        }
        
        if (elements.trackCover && track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
        }
    }
    
    updateRecentTracks(track) {
        radioState.recentTracks.unshift({
            name: track.name || 'Música sem título',
            artist: track.artist || 'Artista desconhecido',
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            cover: track.coverUrl || 'https://via.placeholder.com/50x50/1a4332/ffffff?text=♪'
        });
        
        // Manter apenas as últimas 10
        if (radioState.recentTracks.length > 10) {
            radioState.recentTracks = radioState.recentTracks.slice(0, 10);
        }
        
        this.displayRecentTracks();
    }
    
    updatePlayHistory(track) {
        const trackName = track.name || 'Música sem título';
        radioState.playHistory[trackName] = (radioState.playHistory[trackName] || 0) + 1;
        saveData();
    }
    
    updateTimeDisplay() {
        if (!elements.audioPlayer || !elements.currentTime || !elements.duration) return;
        
        const current = elements.audioPlayer.currentTime || 0;
        const duration = elements.audioPlayer.duration || 0;
        
        elements.currentTime.textContent = this.formatTime(current);
        elements.duration.textContent = this.formatTime(duration);
        
        // Atualizar barra de progresso
        if (elements.progressFill && duration > 0) {
            const progress = (current / duration) * 100;
            elements.progressFill.style.width = `${progress}%`;
        }
    }
    
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    startScheduleCheck() {
        this.scheduleCheckInterval = setInterval(() => {
            this.checkSchedule();
        }, 60000); // Verificar a cada minuto
        
        this.checkSchedule(); // Verificar imediatamente
    }
    
    startTimeUpdate() {
        this.timeUpdateInterval = setInterval(() => {
            this.updateCurrentTime();
        }, 1000);
        
        this.updateCurrentTime();
    }
    
    checkSchedule() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const currentProgram = radioState.schedule.find(item => item.time === currentTime);
        
        if (currentProgram && currentProgram !== radioState.currentProgram) {
            console.log(`📅 Programa agendado: ${currentProgram.title}`);
            radioState.currentProgram = currentProgram;
            this.updateProgramDisplay();
        }
    }
    
    updateCurrentTime() {
        if (elements.currentHour) {
            const now = new Date();
            elements.currentHour.textContent = now.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }
    
    updateProgramDisplay() {
        if (!radioState.currentProgram) return;
        
        if (elements.currentProgram) {
            elements.currentProgram.textContent = radioState.currentProgram.title;
        }
        
        if (elements.programDescription) {
            elements.programDescription.textContent = radioState.currentProgram.description;
        }
        
        if (elements.currentDjInfo) {
            elements.currentDjInfo.textContent = radioState.currentProgram.title;
        }
    }
    
    startListenersSimulation() {
        // Simular número de ouvintes (entre 50-200)
        const updateListeners = () => {
            const baseListeners = 75;
            const variation = Math.floor(Math.random() * 125);
            radioState.listeners = baseListeners + variation;
            
            if (elements.listenersCount) {
                elements.listenersCount.textContent = radioState.listeners.toString();
            }
        };
        
        updateListeners();
        setInterval(updateListeners, 30000); // Atualizar a cada 30 segundos
    }
    
    displayRecentTracks() {
        if (!elements.recentTracks) return;
        
        const html = radioState.recentTracks.map(track => `
            <div class="recent-track">
                <img src="${track.cover}" alt="Capa" class="recent-track-cover">
                <div class="recent-track-info">
                    <div class="recent-track-title">${track.name}</div>
                    <div class="recent-track-artist">${track.artist}</div>
                </div>
                <div class="recent-track-time">${track.time}</div>
            </div>
        `).join('');
        
        elements.recentTracks.innerHTML = html || '<p style="color: var(--medium-gray); text-align: center;">Nenhuma música tocada ainda</p>';
    }
    
    updatePlayButton() {
        if (!elements.playPauseBtn) return;
        
        const icon = elements.playPauseBtn.querySelector('i');
        if (radioState.isPlaying) {
            icon.className = 'fas fa-pause';
        } else {
            icon.className = 'fas fa-play';
        }
    }
    
    updateBroadcastStatus() {
        if (!elements.broadcastStatus || !elements.toggleBroadcast) return;
        
        const statusEl = elements.broadcastStatus;
        const toggleBtn = elements.toggleBroadcast;
        
        if (radioState.isLive) {
            statusEl.className = 'status-indicator live';
            statusEl.innerHTML = '<div class="status-dot"></div><span>AO VIVO</span>';
            toggleBtn.innerHTML = '<i class="fas fa-pause"></i> Pausar Transmissão';
        } else {
            statusEl.className = 'status-indicator offline';
            statusEl.innerHTML = '<div class="status-dot"></div><span>OFFLINE</span>';
            toggleBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar Transmissão';
        }
    }
    
    updateLiveIndicator() {
        if (elements.liveIndicator) {
            elements.liveIndicator.style.animation = radioState.isLive ? 'pulse 2s infinite' : 'none';
        }
    }
}

// ===== GERENCIADOR DE UPLOAD =====
class UploadManager {
    async uploadFiles(category, files) {
        if (!files || files.length === 0) {
            showError('Selecione pelo menos um arquivo');
            return;
        }
        
        showLoading(true);
        
        try {
            const uploadPromises = Array.from(files).map(file => this.uploadFile(file, category));
            const results = await Promise.all(uploadPromises);
            
            results.forEach(result => {
                if (result) {
                    radioState.content[category].push(result);
                }
            });
            
            saveData();
            updateContentLists();
            showSuccess(`${files.length} arquivo(s) enviado(s) com sucesso!`);
            
            // Se a rádio estiver ao vivo e não tiver música atual, começar a tocar
            if (radioState.isLive && !radioState.currentTrack && category === 'music') {
                setTimeout(() => radioManager.playNext(), 1000);
            }
            
        } catch (error) {
            console.error('Erro no upload:', error);
            showError('Erro no upload: ' + error.message);
        } finally {
            showLoading(false);
        }
    }
    
    async uploadFile(file, category) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${category}`);
        
        // Adicionar tags baseadas na categoria
        const tags = {
            music: 'music,radio',
            time: 'time-announcement,radio',
            ads: 'advertisement,radio',
            jingles: 'jingle,radio'
        };
        
        if (tags[category]) {
            formData.append('tags', tags[category]);
        }
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
            url: data.secure_url,
            publicId: data.public_id,
            category: category,
            uploadedAt: new Date().toISOString(),
            duration: data.duration || null,
            size: file.size,
            coverUrl: null // Pode ser adicionado depois
        };
    }
    
    deleteFile(category, index) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
        
        radioState.content[category].splice(index, 1);
        saveData();
        updateContentLists();
        showSuccess('Arquivo excluído com sucesso!');
    }
}

// ===== SETUP E EVENT LISTENERS =====
function initializeRadioManager() {
    radioManager = new RadioManager();
}

function setupEventListeners() {
    // Player controls
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', togglePlayPause);
    }
    
    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', updateVolume);
    }
    
    if (elements.volumeBtn) {
        elements.volumeBtn.addEventListener('click', toggleMute);
    }
    
    // Admin access
    if (elements.adminAccessBtn) {
        elements.adminAccessBtn.addEventListener('click', showPasswordModal);
    }
    
    if (elements.closeAdminBtn) {
        elements.closeAdminBtn.addEventListener('click', hideAdminPanel);
    }
    
    // Password modal
    if (elements.confirmPasswordBtn) {
        elements.confirmPasswordBtn.addEventListener('click', checkPassword);
    }
    
    if (elements.cancelPasswordBtn) {
        elements.cancelPasswordBtn.addEventListener('click', hidePasswordModal);
    }
    
    if (elements.adminPassword) {
        elements.adminPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
    
    // Admin tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Broadcast controls
    if (elements.toggleBroadcast) {
        elements.toggleBroadcast.addEventListener('click', toggleBroadcast);
    }
    
    if (elements.playNextBtn) {
        elements.playNextBtn.addEventListener('click', () => radioManager.playNext());
    }
    
    if (elements.playTimeBtn) {
        elements.playTimeBtn.addEventListener('click', playTimeAnnouncement);
    }
    
    if (elements.playAdBtn) {
        elements.playAdBtn.addEventListener('click', playAdvertisement);
    }
    
    // Schedule management
    if (elements.addScheduleBtn) {
        elements.addScheduleBtn.addEventListener('click', addScheduleItem);
    }
    
    // Reports
    if (elements.refreshReportsBtn) {
        elements.refreshReportsBtn.addEventListener('click', refreshReports);
    }
    
    console.log('🔗 Event listeners configurados');
}

function startLiveBroadcast() {
    // Iniciar transmissão automaticamente após 2 segundos
    setTimeout(() => {
        if (radioManager) {
            radioManager.startBroadcast();
        }
    }, 2000);
}

// ===== FUNÇÕES DE CONTROLE =====
function togglePlayPause() {
    if (!elements.audioPlayer || !radioState.isLive) return;
    
    if (radioState.isPlaying) {
        elements.audioPlayer.pause();
    } else {
        elements.audioPlayer.play().catch(e => {
            console.log('Erro ao reproduzir:', e.message);
            showError('Erro ao iniciar reprodução. Clique novamente.');
        });
    }
}

function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer) return;
    
    const volume = parseInt(elements.volumeSlider.value);
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    
    if (elements.volumeDisplay) {
        elements.volumeDisplay.textContent = `${volume}%`;
    }
    
    // Atualizar ícone do volume
    updateVolumeIcon(volume);
    
    saveData();
}

function updateVolumeIcon(volume) {
    if (!elements.volumeBtn) return;
    
    const icon = elements.volumeBtn.querySelector('i');
    if (volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volume < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

function toggleMute() {
    if (!elements.volumeSlider || !elements.audioPlayer) return;
    
    if (radioState.volume === 0) {
        // Desmutear - voltar ao volume anterior ou 70%
        const previousVolume = radioState.previousVolume || 70;
        radioState.volume = previousVolume;
        elements.volumeSlider.value = previousVolume;
        elements.audioPlayer.volume = previousVolume / 100;
    } else {
        // Mutar
        radioState.previousVolume = radioState.volume;
        radioState.volume = 0;
        elements.volumeSlider.value = 0;
        elements.audioPlayer.volume = 0;
    }
    
    updateVolumeIcon(radioState.volume);
    if (elements.volumeDisplay) {
        elements.volumeDisplay.textContent = `${radioState.volume}%`;
    }
    
    saveData();
}

// ===== FUNÇÕES ADMIN =====
function showPasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.classList.add('show');
        if (elements.adminPassword) {
            elements.adminPassword.focus();
        }
    }
}

function hidePasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.classList.remove('show');
        if (elements.adminPassword) {
            elements.adminPassword.value = '';
        }
    }
}

function checkPassword() {
    if (!elements.adminPassword) return;
    
    const password = elements.adminPassword.value;
    if (password === 'admin123') {
        hidePasswordModal();
        showAdminPanel();
    } else {
        showError('Senha incorreta!');
        elements.adminPassword.value = '';
        elements.adminPassword.focus();
    }
}

function showAdminPanel() {
    if (elements.adminPanel) {
        elements.adminPanel.classList.add('open');
        updateContentLists();
        updateScheduleDisplay();
        refreshReports();
    }
}

function hideAdminPanel() {
    if (elements.adminPanel) {
        elements.adminPanel.classList.remove('open');
    }
}

function switchTab(tabName) {
    // Remove active de todos os botões e conteúdos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Adiciona active nos elementos selecionados
    const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`${tabName}-tab`);
    
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    
    // Ações específicas por aba
    if (tabName === 'content') {
        updateContentLists();
    } else if (tabName === 'schedule') {
        updateScheduleDisplay();
    } else if (tabName === 'reports') {
        refreshReports();
    }
}

function toggleBroadcast() {
    if (radioState.isLive) {
        radioManager.stopBroadcast();
    } else {
        radioManager.startBroadcast();
    }
}

function playTimeAnnouncement() {
    if (radioState.content.time.length === 0) {
        showError('Nenhuma hora certa cadastrada');
        return;
    }
    
    const timeTrack = radioManager.getRandomFromCategory('time');
    if (timeTrack) {
        radioManager.loadTrack(timeTrack);
        showSuccess('Tocando hora certa');
    }
}

function playAdvertisement() {
    if (radioState.content.ads.length === 0) {
        showError('Nenhum aviso cadastrado');
        return;
    }
    
    const adTrack = radioManager.getRandomFromCategory('ads');
    if (adTrack) {
        radioManager.loadTrack(adTrack);
        showSuccess('Tocando aviso');
    }
}

// ===== UPLOAD DE CONTEÚDO =====
const uploadManager = new UploadManager();

function uploadContent(category) {
    const inputMap = {
        music: elements.musicUpload,
        time: elements.timeUpload,
        ads: elements.adsUpload,
        jingles: elements.jinglesUpload
    };
    
    const input = inputMap[category];
    if (!input || !input.files.length) {
        showError('Selecione pelo menos um arquivo');
        return;
    }
    
    uploadManager.uploadFiles(category, input.files).then(() => {
        input.value = ''; // Limpar input
    });
}

function deleteContent(category, index) {
    uploadManager.deleteFile(category, index);
}

function updateContentLists() {
    const categories = ['music', 'time', 'ads', 'jingles'];
    
    categories.forEach(category => {
        const container = elements[`${category}List`];
        if (!container) return;
        
        const items = radioState.content[category] || [];
        
        if (items.length === 0) {
            container.innerHTML = '<p style="color: var(--medium-gray);">Nenhum arquivo encontrado</p>';
            return;
        }
        
        const html = items.map((item, index) => `
            <div class="content-item">
                <span class="content-name">${item.name}</span>
                <button onclick="deleteContent('${category}', ${index})" class="btn-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        container.innerHTML = html;
    });
}

// ===== GERENCIAMENTO DE PROGRAMAÇÃO =====
function addScheduleItem() {
    const time = elements.scheduleTime?.value;
    const type = elements.scheduleType?.value;
    const title = elements.scheduleTitle?.value;
    
    if (!time || !title) {
        showError('Preencha todos os campos obrigatórios');
        return;
    }
    
    const newItem = {
        time: time,
        title: title,
        description: `Programação especial - ${title}`,
        type: type || 'program'
    };
    
    // Verificar se já existe um item neste horário
    const existingIndex = radioState.schedule.findIndex(item => item.time === time);
    if (existingIndex !== -1) {
        if (!confirm('Já existe uma programação neste horário. Substituir?')) return;
        radioState.schedule[existingIndex] = newItem;
    } else {
        radioState.schedule.push(newItem);
    }
    
    // Ordenar por horário
    radioState.schedule.sort((a, b) => a.time.localeCompare(b.time));
    
    saveData();
    updateScheduleDisplay();
    
    // Limpar formulário
    if (elements.scheduleTime) elements.scheduleTime.value = '';
    if (elements.scheduleTitle) elements.scheduleTitle.value = '';
    
    showSuccess('Item de programação adicionado!');
}

function removeScheduleItem(index) {
    if (confirm('Remover este item da programação?')) {
        radioState.schedule.splice(index, 1);
        saveData();
        updateScheduleDisplay();
        showSuccess('Item removido da programação');
    }
}

function updateScheduleDisplay() {
    // Atualizar programação principal
    if (elements.scheduleContainer) {
        const html = radioState.schedule.map((item, index) => {
            const now = new Date();
            const itemTime = item.time.split(':');
            const itemDate = new Date();
            itemDate.setHours(parseInt(itemTime[0]), parseInt(itemTime[1]), 0, 0);
            
            const isActive = Math.abs(now - itemDate) < 1800000; // 30 minutos de tolerância
            
            return `
                <div class="schedule-item ${isActive ? 'active' : ''}">
                    <div class="schedule-time">${item.time}</div>
                    <div class="schedule-title">${item.title}</div>
                    <div class="schedule-description">${item.description}</div>
                </div>
            `;
        }).join('');
        
        elements.scheduleContainer.innerHTML = html || '<p style="color: var(--medium-gray);">Nenhuma programação cadastrada</p>';
    }
    
    // Atualizar lista de administração
    if (elements.scheduleList) {
        const adminHtml = radioState.schedule.map((item, index) => `
            <div class="content-item">
                <div>
                    <strong>${item.time}</strong> - ${item.title}
                    <br><small style="color: var(--medium-gray);">${item.description}</small>
                </div>
                <button onclick="removeScheduleItem(${index})" class="btn-danger">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        elements.scheduleList.innerHTML = adminHtml || '<p style="color: var(--medium-gray);">Nenhuma programação cadastrada</p>';
    }
}

// ===== RELATÓRIOS =====
function refreshReports() {
    if (!elements.reportsList) return;
    
    const history = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20); // Top 20
    
    if (history.length === 0) {
        elements.reportsList.innerHTML = '<p style="color: var(--medium-gray);">Nenhuma música reproduzida ainda</p>';
        return;
    }
    
    const html = history.map(([track, count]) => `
        <div class="report-item">
            <span class="report-track">${track}</span>
            <span class="report-count">${count}x</span>
        </div>
    `).join('');
    
    elements.reportsList.innerHTML = html;
}

// ===== UTILITÁRIOS =====
function updateUI() {
    if (elements.volumeSlider && elements.volumeDisplay) {
        elements.volumeSlider.value = radioState.volume;
        elements.volumeDisplay.textContent = `${radioState.volume}%`;
        updateVolumeIcon(radioState.volume);
    }
    
    updateScheduleDisplay();
    
    if (radioManager) {
        radioManager.displayRecentTracks();
        radioManager.updateCurrentTime();
    }
}

function showLoading(show) {
    if (elements.loadingOverlay) {
        if (show) {
            elements.loadingOverlay.classList.add('show');
        } else {
            elements.loadingOverlay.classList.remove('show');
        }
    }
}

function showError(message) {
    console.error('Erro:', message);
    
    // Criar toast de erro
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b6b, #ff4757);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(255, 107, 107, 0.4);
        animation: slideInRight 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showSuccess(message) {
    console.log('Sucesso:', message);
    
    // Criar toast de sucesso
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, var(--accent-green), var(--light-green));
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 20px var(--glow-color);
        animation: slideInRight 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===== TRATAMENTO DE ERROS =====
window.addEventListener('error', (e) => {
    console.error('Erro global capturado:', e.error);
    
    // Tentar recuperar a transmissão se houver erro crítico
    if (radioState.isLive && radioManager && !radioState.isPlaying) {
        setTimeout(() => {
            console.log('Tentando recuperar transmissão...');
            radioManager.playNext();
        }, 5000);
    }
});

// Manter transmissão ativa mesmo quando a página perde foco
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive && elements.audioPlayer) {
        // Verificar se o áudio parou e tentar reativar
        setTimeout(() => {
            if (elements.audioPlayer.paused && radioState.isLive) {
                elements.audioPlayer.play().catch(() => {
                    console.log('Erro ao retomar reprodução');
                });
            }
        }, 1000);
    }
});

// Salvar dados antes de sair da página
window.addEventListener('beforeunload', () => {
    saveData();
});

// ===== ANIMAÇÕES CSS DINÂMICAS =====
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .toast-enter {
        animation: slideInRight 0.3s ease;
    }
    
    .toast-exit {
        animation: slideOutRight 0.3s ease;
    }
`;
document.head.appendChild(style);

// ===== INICIALIZAÇÃO FINAL =====
console.log('🚀 Sistema de Rádio 24h carregado com sucesso!');
console.log('📻 Aguardando inicialização do DOM...');
