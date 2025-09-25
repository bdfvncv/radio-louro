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
        console.log('🔊 RadioManager inicializado');
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
        // Primeira música
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
            console.log('⚠️ Nenhuma música na playlist, aguardando...');
            return;
        }

        console.log(`🎵 Tocando: ${nextTrack.name}`);
        radioState.currentTrack = nextTrack;
        this.updateTrackInfo(nextTrack);
        
        const audio = elements.audioPlayer;
        if (audio) {
            audio.src = nextTrack.url;
            audio.play().catch(e => {
                console.error('Autoplay bloqueado:', e);
                // Exibir botão de play para o usuário
                this.updatePlayButton();
            });
        }
        
        // Atualizar histórico
        radioState.playHistory[nextTrack.name] = (radioState.playHistory[nextTrack.name] || 0) + 1;
        radioState.recentTracks.unshift(nextTrack);
        if (radioState.recentTracks.length > 5) {
            radioState.recentTracks.pop();
        }
        this.displayRecentTracks();
        
        saveData();
    }
    
    getNextTrack() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // Checar programação especial
        const currentScheduleItem = radioState.schedule.find(item => {
            const [itemHour, itemMinute] = item.time.split(':').map(Number);
            return hour === itemHour && minute === itemMinute;
        });

        if (currentScheduleItem) {
            switch (currentScheduleItem.type) {
                case 'time':
                    return this.getRandomContent('time');
                case 'ads':
                    return this.getRandomContent('ads');
                case 'jingles':
                    return this.getRandomContent('jingles');
                default:
                    return this.getRandomContent('music');
            }
        }
        
        // Lógica de rotação
        if (radioState.tracksPlayed % 5 === 0 && radioState.content.ads.length > 0) {
            radioState.tracksPlayed = 0;
            return this.getRandomContent('ads');
        }
        
        if (radioState.tracksPlayed % 3 === 0 && radioState.content.jingles.length > 0) {
            return this.getRandomContent('jingles');
        }
        
        return this.getRandomContent('music');
    }
    
    getRandomContent(category) {
        const playlist = radioState.content[category] || [];
        if (playlist.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * playlist.length);
        return playlist[randomIndex];
    }
    
    updateTrackInfo(track) {
        if (!elements.currentTrack || !elements.artistName || !elements.trackCover || !elements.nextTrackInfo) return;
        
        elements.currentTrack.textContent = track.name || 'Música Desconhecida';
        elements.artistName.textContent = track.artist || 'Artista Desconhecido';
        elements.trackCover.src = track.cover || 'https://via.placeholder.com/200x200/1a4332/ffffff?text=RADIO';
        
        const nextTrack = this.getNextTrack();
        if (nextTrack) {
            elements.nextTrackInfo.textContent = nextTrack.name || 'Próxima música';
        } else {
            elements.nextTrackInfo.textContent = 'Preparando...';
        }
        
        const currentProgram = radioState.schedule.find(item => {
            const [itemHour, itemMinute] = item.time.split(':').map(Number);
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            return hour === itemHour && minute === itemMinute;
        });
        
        if (elements.currentProgram) {
            elements.currentProgram.textContent = currentProgram?.title || 'Programação Automática';
        }
        if (elements.programDescription) {
            elements.programDescription.textContent = currentProgram?.description || 'O melhor da música 24h por dia';
        }
    }
    
    updatePlayButton() {
        if (!elements.playPauseBtn) return;
        const icon = elements.playPauseBtn.querySelector('i');
        if (radioState.isPlaying) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    }

    updateTimeDisplay() {
        if (!elements.audioPlayer || !elements.currentTime || !elements.duration || !elements.progressFill) return;
        
        const audio = elements.audioPlayer;
        const current = audio.currentTime;
        const total = audio.duration;
        
        if (!isNaN(total)) {
            const currentMinutes = Math.floor(current / 60);
            const currentSeconds = Math.floor(current % 60).toString().padStart(2, '0');
            const totalMinutes = Math.floor(total / 60);
            const totalSeconds = Math.floor(total % 60).toString().padStart(2, '0');
            
            elements.currentTime.textContent = `${currentMinutes}:${currentSeconds}`;
            elements.duration.textContent = `${totalMinutes}:${totalSeconds}`;
            
            const progress = (current / total) * 100;
            elements.progressFill.style.width = `${progress}%`;
        }
    }

    updateBroadcastStatus() {
        if (!elements.broadcastStatus || !elements.toggleBroadcast) return;
        if (radioState.isLive) {
            elements.broadcastStatus.textContent = 'AO VIVO';
            elements.broadcastStatus.classList.add('live');
            elements.toggleBroadcast.innerHTML = '<i class="fas fa-stop-circle"></i> Parar';
        } else {
            elements.broadcastStatus.textContent = 'OFFLINE';
            elements.broadcastStatus.classList.remove('live');
            elements.toggleBroadcast.innerHTML = '<i class="fas fa-play-circle"></i> Iniciar';
        }
    }

    updateLiveIndicator() {
        if (!elements.liveIndicator) return;
        if (radioState.isLive) {
            elements.liveIndicator.classList.add('live-dot');
        } else {
            elements.liveIndicator.classList.remove('live-dot');
        }
    }
    
    displayRecentTracks() {
        if (!elements.recentTracks) return;
        const html = radioState.recentTracks.map(track => `
            <div class="recent-item">
                <img src="${track.cover}" alt="Capa" class="recent-cover">
                <div class="recent-info">
                    <strong>${track.name}</strong>
                    <small>${track.artist}</small>
                </div>
            </div>
        `).join('');
        elements.recentTracks.innerHTML = html || '<p style="color: var(--medium-gray);">Nenhuma música tocada recentemente</p>';
    }

    // Intervalos de atualização
    startScheduleCheck() {
        this.scheduleCheckInterval = setInterval(() => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            const activeProgram = radioState.schedule.find(p => {
                const [pHour, pMinute] = p.time.split(':').map(Number);
                return pHour === currentHour && pMinute === currentMinute;
            });

            if (activeProgram && activeProgram.title !== radioState.currentProgram?.title) {
                console.log(`✅ Nova programação: ${activeProgram.title}`);
                radioState.currentProgram = activeProgram;
                updateUI();
                
                // Inserir música de programa
                if (activeProgram.type === 'program') {
                    this.playNext();
                } else {
                    this.playNext();
                }
            }
            
            if (elements.currentHour) {
                const hourString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                elements.currentHour.textContent = hourString;
            }
            
        }, 10000); // Checa a cada 10 segundos
    }
    
    startTimeUpdate() {
        this.timeUpdateInterval = setInterval(() => {
            if (elements.audioPlayer && radioState.isPlaying) {
                this.updateTimeDisplay();
            }
        }, 1000);
    }
    
    startListenersSimulation() {
        setInterval(() => {
            if (radioState.isLive) {
                const baseListeners = 100;
                const fluctuation = Math.floor(Math.random() * 21) - 10; // -10 a +10
                radioState.listeners = baseListeners + fluctuation;
                if (elements.listenersCount) {
                    elements.listenersCount.textContent = radioState.listeners;
                }
            }
        }, 15000);
    }
}

// ===== GERENCIAMENTO DE UPLOAD (Simulado) =====
class UploadManager {
    constructor() {
        this.cloudinaryConfig = CLOUDINARY_CONFIG;
        console.log('☁️ UploadManager inicializado');
    }
    
    async uploadFiles(category, files) {
        showLoading(true);
        console.log(`⏳ Uploading ${files.length} files to ${category}...`);
        
        for (const file of files) {
            // Simulação de upload
            const fileUrl = `https://res.cloudinary.com/${this.cloudinaryConfig.cloudName}/audio/upload/v1234567890/radio-louro/${category}/${file.name}`;
            const newItem = {
                name: file.name,
                url: fileUrl,
                artist: 'Artista Desconhecido', // Simulado
                cover: 'https://via.placeholder.com/200x200/1a4332/ffffff?text=RADIO' // Simulado
            };
            radioState.content[category].push(newItem);
        }
        
        showLoading(false);
        showSuccess(`${files.length} arquivos enviados para ${category}`);
        updateContentLists();
        saveData();
    }
    
    deleteFile(category, index) {
        radioState.content[category].splice(index, 1);
        saveData();
        updateContentLists();
        showSuccess('Arquivo removido com sucesso!');
    }
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    if (elements.playPauseBtn) {
        elements.playPauseBtn.addEventListener('click', () => {
            if (elements.audioPlayer?.paused) {
                elements.audioPlayer.play().catch(e => console.log('Autoplay bloqueado:', e.message));
            } else {
                elements.audioPlayer?.pause();
            }
            radioManager.updatePlayButton();
        });
    }

    if (elements.volumeSlider) {
        elements.volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value;
            radioState.volume = volume;
            if (elements.audioPlayer) {
                elements.audioPlayer.volume = volume / 100;
            }
            if (elements.volumeDisplay) {
                elements.volumeDisplay.textContent = `${volume}%`;
            }
            updateVolumeIcon(volume);
            saveData();
        });
    }

    if (elements.volumeBtn) {
        elements.volumeBtn.addEventListener('click', () => {
            if (elements.audioPlayer) {
                if (elements.audioPlayer.volume > 0) {
                    elements.audioPlayer.muted = true;
                    updateVolumeIcon(0);
                } else {
                    elements.audioPlayer.muted = false;
                    updateVolumeIcon(radioState.volume);
                }
            }
        });
    }
    
    // Admin access
    if (elements.adminAccessBtn) {
        elements.adminAccessBtn.addEventListener('click', () => {
            elements.passwordModal?.classList.add('show');
        });
    }
    
    if (elements.cancelPasswordBtn) {
        elements.cancelPasswordBtn.addEventListener('click', () => {
            elements.passwordModal?.classList.remove('show');
            if (elements.adminPassword) elements.adminPassword.value = '';
        });
    }

    if (elements.confirmPasswordBtn) {
        elements.confirmPasswordBtn.addEventListener('click', () => {
            const password = elements.adminPassword?.value;
            if (password === 'radio-louro-2024') {
                elements.adminPanel?.classList.add('show');
                elements.passwordModal?.classList.remove('show');
                showSuccess('Acesso administrativo concedido!');
            } else {
                showError('Senha incorreta!');
            }
            if (elements.adminPassword) elements.adminPassword.value = '';
        });
    }

    if (elements.closeAdminBtn) {
        elements.closeAdminBtn.addEventListener('click', () => {
            elements.adminPanel?.classList.remove('show');
        });
    }
    
    // Admin tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('show'));
            const tabId = e.target.getAttribute('data-tab');
            document.getElementById(tabId)?.classList.add('show');
        });
    });

    // Admin controls
    if (elements.toggleBroadcast) {
        elements.toggleBroadcast.addEventListener('click', () => {
            if (radioState.isLive) {
                radioManager.stopBroadcast();
            } else {
                radioManager.startBroadcast();
            }
        });
    }
    if (elements.playNextBtn) {
        elements.playNextBtn.addEventListener('click', () => radioManager.playNext());
    }
    
    // Schedule controls
    if (elements.addScheduleBtn) {
        elements.addScheduleBtn.addEventListener('click', addScheduleItem);
    }
    if (elements.scheduleTitle) {
        elements.scheduleTitle.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addScheduleItem();
        });
    }
    
    // Reports
    if (elements.refreshReportsBtn) {
        elements.refreshReportsBtn.addEventListener('click', refreshReports);
    }

    // Initial content lists update
    updateContentLists();
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

function updateVolumeIcon(volume) {
    if (!elements.volumeBtn) return;
    const icon = elements.volumeBtn.querySelector('i');
    if (volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (volume <= 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
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
    }, 4000);
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
