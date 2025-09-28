class ContentUploader {
    constructor(radioSystem) {
        this.radio = radioSystem;
    }
    
    async uploadContent(type) {
        const fileInputs = {
            music: 'musicUpload',
            jingles: 'jingleUpload',
            time: 'timeUpload',
            programs: 'programUpload'
        };
        
        const fileInput = document.getElementById(fileInputs[type]);
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        const files = Array.from(fileInput.files);
        this.showUploadModal();
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateUploadProgress(i, files.length, `Enviando: ${file.name}`);
                
                const uploadedFile = await this.uploadToCloudinary(file, type);
                this.addToLibrary(uploadedFile, type);
            }
            
            this.hideUploadModal();
            fileInput.value = '';
            
            // Salvar e sincronizar dados
            this.radio.saveData();
            this.radio.updateContentLibrary();
            
            // Forçar sincronização imediata
            if (this.radio.syncManager) {
                await this.radio.syncManager.publishUpdate();
                this.showSyncSuccess();
            }
            
            alert(`${files.length} arquivo(s) enviado(s) e sincronizado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro no upload: ' + error.message);
            this.hideUploadModal();
        }
    }
    
    showSyncSuccess() {
        const notification = document.createElement('div');
        notification.className = 'sync-success-notification';
        notification.innerHTML = `
            <div class="sync-success-content">
                <span class="sync-icon">✅</span>
                <span>Conteúdo sincronizado em todos os dispositivos!</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 4000);
    }
    
    async uploadToCloudinary(file, type) {
        const formData = new FormData();
        
        // Determinar pasta baseado no tipo
        let folder = 'general';
        if (type === 'programs') {
            const programSelect = document.getElementById('programSelect');
            folder = `programs/${programSelect ? programSelect.value : 'general'}`;
        } else {
            folder = type;
        }
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0,
            format: data.format,
            uploadedAt: new Date().toISOString(),
            syncId: Date.now() + Math.random() // ID único para sincronização
        };
    }
    
    addToLibrary(file, type) {
        if (type === 'programs') {
            const programSelect = document.getElementById('programSelect');
            const period = programSelect ? programSelect.value : 'morning';
            radioState.content.programs[period].push(file);
        } else {
            radioState.content[type].push(file);
        }
        
        // Marcar timestamp de atualização
        radioState.lastContentUpdate = new Date().toISOString();
    }
    
    showUploadModal() {
        this.radio.showModal('uploadModal');
    }
    
    hideUploadModal() {
        this.radio.closeModal('uploadModal');
    }
    
    updateUploadProgress(current, total, status) {
        const progress = Math.round((current / total) * 100);
        
        const progressElement = document.getElementById('uploadProgress');
        if (progressElement) {
            progressElement.style.width = progress + '%';
        }
        
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
}

// Funções globais modificadas para sincronização
let radioSystem;
let uploader;

// Função principal de upload com sincronização
async function uploadContent(type) {
    if (uploader) {
        await uploader.uploadContent(type);
        
        // Verificar se outros dispositivos precisam atualizar
        setTimeout(() => {
            if (radioSystem && radioSystem.syncManager) {
                radioSystem.syncManager.forceSync();
            }
        }, 2000);
    }
}

// Função para verificar senha admin
function checkAdminPassword() {
    if (radioSystem) {
        radioSystem.checkAdminPassword();
    }
}

// Função para fechar modais
function closeModal(modalId) {
    if (radioSystem) {
        radioSystem.closeModal(modalId);
    }
}

// Funções de configuração de programação (modificadas)
async function saveScheduleConfig() {
    const periods = ['morning', 'afternoon', 'evening', 'late'];
    
    periods.forEach(period => {
        const contentSelect = document.querySelector(`[data-period="${period}"]`);
        const freqInput = document.querySelector(`.jingle-frequency[data-period="${period}"]`);
        
        if (contentSelect && freqInput) {
            radioState.schedule[period] = {
                type: contentSelect.value,
                jingleFreq: parseInt(freqInput.value)
            };
        }
    });
    
    if (radioSystem) {
        radioSystem.saveData();
        
        // Sincronizar configurações
        if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
            await radioSystem.syncManager.publishUpdate();
            showConfigSyncNotification();
        }
    }
    
    alert('Configurações de programação salvas e sincronizadas!');
}

function showConfigSyncNotification() {
    const notification = document.createElement('div');
    notification.className = 'config-sync-notification';
    notification.innerHTML = `
        <div class="config-sync-content">
            <span class="sync-icon">⚙️</span>
            <span>Programação sincronizada em todos os dispositivos!</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
}

async function resetSchedule() {
    if (!confirm('Tem certeza que deseja resetar a programação?')) return;
    
    radioState.schedule = {
        morning: { type: 'mixed', jingleFreq: 15 },
        afternoon: { type: 'mixed', jingleFreq: 10 },
        evening: { type: 'mixed', jingleFreq: 20 },
        late: { type: 'music', jingleFreq: 30 }
    };
    
    if (radioSystem) {
        radioSystem.saveData();
        
        // Sincronizar reset
        if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
            await radioSystem.syncManager.publishUpdate();
        }
    }
    
    // Atualizar interface
    document.querySelectorAll('.content-type-select').forEach(select => {
        const period = select.dataset.period;
        select.value = radioState.schedule[period].type;
    });
    
    document.querySelectorAll('.jingle-frequency').forEach(input => {
        /**
 * SISTEMA DE RÁDIO AO VIVO 24 HORAS COM SINCRONIZAÇÃO
 * Rádio Supermercado do Louro
 * ================================
 */

// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Configuração de sincronização
const SYNC_CONFIG = {
    enabled: true,
    interval: 10000, // 10 segundos
    storageKey: 'radioSyncData',
    lastUpdateKey: 'radioLastUpdate'
};

// Estado global da rádio
let radioState = {
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    volume: 70,
    crossfade: false,
    playHistory: [],
    recentTracks: [],
    listeners: 0,
    uptime: 0,
    playCount: 0,
    lastSync: null,
    
    // Bibliotecas de conteúdo
    content: {
        music: [],
        jingles: [],
        time: [],
        programs: {
            morning: [],
            afternoon: [],
            evening: [],
            late: []
        }
    },
    
    // Configurações de programação
    schedule: {
        morning: { type: 'mixed', jingleFreq: 15 },
        afternoon: { type: 'mixed', jingleFreq: 10 },
        evening: { type: 'mixed', jingleFreq: 20 },
        late: { type: 'music', jingleFreq: 30 }
    },
    
    // Automação
    automation: {
        hourlyTime: true,
        autoJingles: true,
        avoidRepeat: true,
        repeatInterval: 50,
        crossfade: false,
        crossfadeDuration: 3
    },
    
    // Estatísticas
    stats: {
        totalPlayed: 0,
        dailyStats: {},
        popularTracks: {},
        requests: []
    }
};

// Cache de elementos DOM
let elements = {};

// Sistema de Sincronização
class RadioSyncManager {
    constructor() {
        this.syncInterval = null;
        this.isAdmin = false;
        this.lastKnownUpdate = null;
        this.init();
    }
    
    init() {
        if (SYNC_CONFIG.enabled) {
            this.startSyncLoop();
            window.addEventListener('focus', () => this.forceSync());
            window.addEventListener('storage', (e) => this.handleStorageChange(e));
        }
    }
    
    startSyncLoop() {
        this.syncInterval = setInterval(() => {
            this.checkForUpdates();
        }, SYNC_CONFIG.interval);
    }
    
    async checkForUpdates() {
        try {
            // Verificar se houve atualizações usando Cloudinary como fonte central
            const centralData = await this.fetchCentralData();
            
            if (centralData && this.hasUpdates(centralData)) {
                console.log('🔄 Atualizações detectadas, sincronizando...');
                await this.syncData(centralData);
                this.notifyUpdate();
            }
        } catch (error) {
            console.warn('Erro na sincronização:', error);
            // Fallback para localStorage
            this.syncWithLocalStorage();
        }
    }
    
    async fetchCentralData() {
        // Buscar dados centralizados na Cloudinary usando um arquivo JSON
        try {
            const response = await fetch(
                `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/raw/upload/radio-louro/sync/radio-state.json`
            );
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Sync via Cloudinary indisponível:', error);
        }
        
        return null;
    }
    
    hasUpdates(centralData) {
        if (!centralData || !centralData.lastSync) return false;
        
        const centralUpdate = new Date(centralData.lastSync);
        const localUpdate = radioState.lastSync ? new Date(radioState.lastSync) : new Date(0);
        
        return centralUpdate > localUpdate;
    }
    
    async syncData(centralData) {
        // Sincronizar apenas bibliotecas de conteúdo e configurações
        if (centralData.content) {
            radioState.content = { ...radioState.content, ...centralData.content };
        }
        
        if (centralData.schedule) {
            radioState.schedule = { ...radioState.schedule, ...centralData.schedule };
        }
        
        if (centralData.automation) {
            radioState.automation = { ...radioState.automation, ...centralData.automation };
        }
        
        radioState.lastSync = centralData.lastSync;
        
        // Salvar localmente
        this.saveLocalData();
        
        // Atualizar interface se necessário
        if (typeof radioSystem !== 'undefined' && radioSystem) {
            radioSystem.updateContentLibrary();
            radioSystem.updateReports();
        }
    }
    
    syncWithLocalStorage() {
        // Fallback: sincronizar via localStorage para dispositivos na mesma rede local
        try {
            const storedSync = localStorage.getItem(SYNC_CONFIG.lastUpdateKey);
            const storedData = localStorage.getItem(SYNC_CONFIG.storageKey);
            
            if (storedSync && storedData) {
                const syncTime = new Date(storedSync);
                const localSyncTime = radioState.lastSync ? new Date(radioState.lastSync) : new Date(0);
                
                if (syncTime > localSyncTime) {
                    const data = JSON.parse(storedData);
                    this.syncData(data);
                }
            }
        } catch (error) {
            console.warn('Erro no sync localStorage:', error);
        }
    }
    
    handleStorageChange(event) {
        if (event.key === SYNC_CONFIG.storageKey && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                this.syncData(data);
            } catch (error) {
                console.warn('Erro ao processar mudança de storage:', error);
            }
        }
    }
    
    async publishUpdate() {
        if (!this.isAdmin) return;
        
        const updateData = {
            content: radioState.content,
            schedule: radioState.schedule,
            automation: radioState.automation,
            lastSync: new Date().toISOString()
        };
        
        try {
            // Tentar publicar na Cloudinary
            await this.publishToCentral(updateData);
            console.log('✅ Dados publicados centralmente');
        } catch (error) {
            console.warn('Erro ao publicar centralmente:', error);
        }
        
        // Sempre salvar localmente
        localStorage.setItem(SYNC_CONFIG.storageKey, JSON.stringify(updateData));
        localStorage.setItem(SYNC_CONFIG.lastUpdateKey, updateData.lastSync);
        
        radioState.lastSync = updateData.lastSync;
    }
    
    async publishToCentral(data) {
        // Criar arquivo JSON e fazer upload para Cloudinary
        const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const formData = new FormData();
        
        formData.append('file', jsonBlob, 'radio-state.json');
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', 'radio-louro/sync');
        formData.append('resource_type', 'raw');
        formData.append('public_id', 'radio-state');
        formData.append('overwrite', 'true');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/raw/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        return await response.json();
    }
    
    saveLocalData() {
        try {
            localStorage.setItem('radioLive24State', JSON.stringify(radioState));
        } catch (error) {
            console.warn('Erro ao salvar dados locais:', error);
        }
    }
    
    notifyUpdate() {
        // Mostrar notificação visual para o usuário
        this.showSyncNotification();
        
        // Disparar evento customizado
        window.dispatchEvent(new CustomEvent('radioContentUpdated', {
            detail: { timestamp: radioState.lastSync }
        }));
    }
    
    showSyncNotification() {
        const notification = document.createElement('div');
        notification.className = 'sync-notification';
        notification.innerHTML = `
            <div class="sync-content">
                <span class="sync-icon">🔄</span>
                <span>Conteúdo atualizado!</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
    
    setAdminMode(isAdmin) {
        this.isAdmin = isAdmin;
        if (isAdmin) {
            console.log('📡 Modo administrador ativado - publicações habilitadas');
        }
    }
    
    forceSync() {
        console.log('🔍 Verificação forçada de sincronização...');
        this.checkForUpdates();
    }
    
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}

// Classe principal da rádio (modificada para incluir sincronização)
class RadioLive24 {
    constructor() {
        this.currentPeriod = 'morning';
        this.lastJingleTime = 0;
        this.lastTimeAnnouncement = 0;
        this.programTimer = null;
        this.uptimeTimer = null;
        this.playbackQueue = [];
        this.fadeInterval = null;
        this.syncManager = null;
        
        this.init();
    }
    
    async init() {
        try {
            this.initElements();
            this.loadStoredData();
            this.setupEventListeners();
            
            // Inicializar sincronização
            this.syncManager = new RadioSyncManager();
            
            // Aguardar primeira sincronização antes de iniciar broadcast
            await this.waitForInitialSync();
            
            this.startBroadcast();
            this.startUptime();
            
            console.log('🎙️ Rádio 24h inicializada com sincronização!');
        } catch (error) {
            console.error('Erro na inicialização:', error);
            this.showError('Erro na inicialização da rádio');
        }
    }
    
    async waitForInitialSync() {
        try {
            // Aguardar até 5 segundos pela sincronização inicial
            await new Promise((resolve) => {
                const timeout = setTimeout(resolve, 5000);
                
                const checkSync = () => {
                    if (radioState.lastSync) {
                        clearTimeout(timeout);
                        resolve();
                    } else {
                        setTimeout(checkSync, 500);
                    }
                };
                
                checkSync();
            });
        } catch (error) {
            console.warn('Timeout na sincronização inicial, continuando...');
        }
    }
    
    initElements() {
        const elementIds = [
            'audioPlayer', 'playPauseBtn', 'skipBtn', 'favoriteBtn',
            'volumeSlider', 'volumeValue', 'albumCover', 'trackCover',
            'albumTitle', 'currentTrack', 'trackTime', 'trackGenre',
            'currentProgram', 'nextProgram', 'listenerCount',
            'broadcastStatus', 'playCount', 'scheduleList',
            'recentTracks', 'requestsList', 'adminBtn',
            'playerMode', 'adminMode', 'passwordModal',
            'adminPassword', 'uploadModal', 'requestModal',
            'loadingOverlay'
        ];
        
        elements = {};
        elementIds.forEach(id => {
            elements[id] = document.getElementById(id);
        });
        
        // Verificar elementos críticos
        if (!elements.audioPlayer) {
            throw new Error('Player de áudio não encontrado');
        }
    }
    
    loadStoredData() {
        try {
            const stored = localStorage.getItem('radioLive24State');
            if (stored) {
                const data = JSON.parse(stored);
                radioState = { ...radioState, ...data };
            }
        } catch (error) {
            console.warn('Erro ao carregar dados:', error);
        }
    }
    
    saveData() {
        try {
            // Não salvar elementos que podem ser grandes
            const dataToSave = {
                ...radioState,
                playHistory: radioState.playHistory.slice(-100) // Manter apenas últimas 100
            };
            localStorage.setItem('radioLive24State', JSON.stringify(dataToSave));
            
            // Se for admin, publicar atualizações
            if (this.syncManager && this.syncManager.isAdmin) {
                this.syncManager.publishUpdate();
            }
            
        } catch (error) {
            console.warn('Erro ao salvar dados:', error);
        }
    }
    
    setupEventListeners() {
        // Player controls
        if (elements.playPauseBtn) {
            elements.playPauseBtn.onclick = () => this.togglePlayback();
        }
        if (elements.skipBtn) {
            elements.skipBtn.onclick = () => this.skipTrack();
        }
        if (elements.favoriteBtn) {
            elements.favoriteBtn.onclick = () => this.favoriteTrack();
        }
        if (elements.volumeSlider) {
            elements.volumeSlider.oninput = (e) => this.setVolume(e.target.value);
        }
        
        // Audio events
        if (elements.audioPlayer) {
            elements.audioPlayer.onended = () => this.playNext();
            elements.audioPlayer.ontimeupdate = () => this.updateTime();
            elements.audioPlayer.onerror = (e) => this.handleAudioError(e);
            elements.audioPlayer.oncanplay = () => this.onTrackReady();
        }
        
        // Admin button
        if (elements.adminBtn) {
            elements.adminBtn.onclick = () => this.openAdminModal();
        }
        
        // Info tabs
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.onclick = (e) => this.switchInfoTab(e.target.dataset.tab);
        });
        
        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = (e) => this.switchAdminTab(e.target.dataset.tab);
        });
        
        // Request form
        const sendRequestBtn = document.getElementById('sendRequest');
        if (sendRequestBtn) {
            sendRequestBtn.onclick = () => this.sendRequest();
        }
        
        // Admin controls
        const toggleBroadcast = document.getElementById('toggleBroadcast');
        if (toggleBroadcast) {
            toggleBroadcast.onclick = () => this.toggleBroadcast();
        }
        
        const emergencyStop = document.getElementById('emergencyStop');
        if (emergencyStop) {
            emergencyStop.onclick = () => this.emergencyStop();
        }
        
        const backToPlayer = document.getElementById('backToPlayerBtn');
        if (backToPlayer) {
            backToPlayer.onclick = () => this.showPlayer();
        }
    }
    
    startBroadcast() {
        if (radioState.isLive) return;
        
        radioState.isLive = true;
        this.updateBroadcastStatus('🔴 AO VIVO');
        
        // Determinar período atual
        this.updateCurrentPeriod();
        
        // Iniciar programação
        this.scheduleNextTrack();
        
        // Timer para verificações periódicas
        this.programTimer = setInterval(() => {
            this.updateCurrentPeriod();
            this.checkTimeAnnouncement();
            this.checkJingleTime();
            this.updateListenerCount();
        }, 30000); // A cada 30 segundos
        
        console.log('📡 Transmissão ao vivo iniciada');
    }
    
    stopBroadcast() {
        radioState.isLive = false;
        if (this.programTimer) {
            clearInterval(this.programTimer);
        }
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
        }
        radioState.isPlaying = false;
        this.updateBroadcastStatus('⚫ OFFLINE');
        this.updatePlayPauseButton();
    }
    
    updateCurrentPeriod() {
        const hour = new Date().getHours();
        let newPeriod;
        
        if (hour >= 6 && hour < 12) newPeriod = 'morning';
        else if (hour >= 12 && hour < 18) newPeriod = 'afternoon';
        else if (hour >= 18 && hour < 24) newPeriod = 'evening';
        else newPeriod = 'late';
        
        if (newPeriod !== this.currentPeriod) {
            this.currentPeriod = newPeriod;
            this.updateProgramInfo();
            console.log(`🕐 Período alterado para: ${newPeriod}`);
        }
    }
    
    updateProgramInfo() {
        const programs = {
            morning: '🌅 Manhã Musical',
            afternoon: '☀️ Tarde Animada',
            evening: '🌆 Noite Especial',
            late: '🌙 Madrugada Suave'
        };
        
        const nextPeriods = {
            morning: 'afternoon',
            afternoon: 'evening',
            evening: 'late',
            late: 'morning'
        };
        
        if (elements.currentProgram) {
            elements.currentProgram.textContent = programs[this.currentPeriod];
        }
        if (elements.nextProgram) {
            elements.nextProgram.textContent = programs[nextPeriods[this.currentPeriod]];
        }
    }
    
    checkTimeAnnouncement() {
        if (!radioState.automation.hourlyTime) return;
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Tocar hora certa no minuto 0 de cada hora
        if (currentMinute === 0) {
            const hourKey = `${now.getDate()}-${currentHour}`;
            if (this.lastTimeAnnouncement !== hourKey) {
                this.lastTimeAnnouncement = hourKey;
                this.queueTimeAnnouncement();
            }
        }
    }
    
    checkJingleTime() {
        if (!radioState.automation.autoJingles) return;
        
        const schedule = radioState.schedule[this.currentPeriod];
        if (schedule.type !== 'mixed') return;
        
        const now = Date.now();
        const jingleInterval = schedule.jingleFreq * 60 * 1000; // Converter para ms
        
        if (now - this.lastJingleTime > jingleInterval) {
            this.lastJingleTime = now;
            this.queueJingle();
        }
    }
    
    scheduleNextTrack() {
        if (!radioState.isLive) return;
        
        // Se há algo na fila, tocar próximo da fila
        if (this.playbackQueue.length > 0) {
            const nextTrack = this.playbackQueue.shift();
            this.playTrack(nextTrack);
            return;
        }
        
        // Caso contrário, escolher baseado na programação
        const schedule = radioState.schedule[this.currentPeriod];
        let nextTrack = null;
        
        switch (schedule.type) {
            case 'music':
                nextTrack = this.getRandomMusic();
                break;
            case 'program':
                nextTrack = this.getRandomProgram(this.currentPeriod);
                break;
            case 'mixed':
                nextTrack = this.getRandomMusic();
                break;
        }
        
        if (nextTrack) {
            this.playTrack(nextTrack);
        } else {
            // Se não há conteúdo, tentar novamente em 30 segundos
            setTimeout(() => this.scheduleNextTrack(), 30000);
        }
    }
    
    getRandomMusic() {
        const music = radioState.content.music;
        if (music.length === 0) return null;
        
        let availableMusic = music;
        
        // Evitar repetições se configurado
        if (radioState.automation.avoidRepeat && radioState.playHistory.length > 0) {
            const recentLimit = Math.min(radioState.automation.repeatInterval, music.length - 1);
            const recentTracks = radioState.playHistory.slice(-recentLimit);
            
            availableMusic = music.filter(track => 
                !recentTracks.some(recent => recent.publicId === track.publicId)
            );
            
            if (availableMusic.length === 0) {
                availableMusic = music; // Se todos foram tocados recentemente, usar todos
            }
        }
        
        return availableMusic[Math.floor(Math.random() * availableMusic.length)];
    }
    
    getRandomProgram(period) {
        const programs = radioState.content.programs[period];
        if (programs.length === 0) return null;
        
        return programs[Math.floor(Math.random() * programs.length)];
    }
    
    getRandomJingle() {
        const jingles = radioState.content.jingles;
        if (jingles.length === 0) return null;
        
        return jingles[Math.floor(Math.random() * jingles.length)];
    }
    
    getRandomTimeAnnouncement() {
        const timeAnnouncements = radioState.content.time;
        if (timeAnnouncements.length === 0) return null;
        
        return timeAnnouncements[Math.floor(Math.random() * timeAnnouncements.length)];
    }
    
    queueTimeAnnouncement() {
        const timeTrack = this.getRandomTimeAnnouncement();
        if (timeTrack) {
            this.playbackQueue.unshift(timeTrack); // Adicionar no início da fila
            console.log('🕐 Hora certa agendada');
        }
    }
    
    queueJingle() {
        const jingle = this.getRandomJingle();
        if (jingle) {
            this.playbackQueue.push(jingle);
            console.log('📢 Vinheta agendada');
        }
    }
    
    async playTrack(track) {
        if (!track || !elements.audioPlayer) return;
        
        try {
            radioState.currentTrack = track;
            
            // Crossfade se configurado
            if (radioState.automation.crossfade && radioState.isPlaying) {
                await this.crossfadeToTrack(track);
            } else {
                this.loadAndPlayTrack(track);
            }
            
            this.updateTrackInfo(track);
            this.addToHistory(track);
            this.updateRecentTracks();
            
        } catch (error) {
            console.error('Erro ao reproduzir faixa:', error);
            setTimeout(() => this.scheduleNextTrack(), 5000);
        }
    }
    
    async crossfadeToTrack(newTrack) {
        const duration = radioState.automation.crossfadeDuration * 1000;
        const steps = 20;
        const stepDuration = duration / steps;
        const volumeStep = elements.audioPlayer.volume / steps;
        
        // Fade out da faixa atual
        for (let i = steps; i > 0; i--) {
            elements.audioPlayer.volume = volumeStep * i;
            await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
        
        // Carregar nova faixa
        this.loadAndPlayTrack(newTrack);
        
        // Fade in da nova faixa
        elements.audioPlayer.volume = 0;
        for (let i = 0; i <= steps; i++) {
            elements.audioPlayer.volume = (radioState.volume / 100) * (i / steps);
            await new Promise(resolve => setTimeout(resolve, stepDuration));
        }
    }
    
    loadAndPlayTrack(track) {
        elements.audioPlayer.src = track.url;
        elements.audioPlayer.volume = radioState.volume / 100;
        
        if (radioState.isLive) {
            elements.audioPlayer.play().catch(e => {
                console.warn('Autoplay bloqueado:', e);
                this.showAutoplayPrompt();
            });
        }
    }
    
    updateTrackInfo(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = this.formatTrackName(track.name);
        }
        if (elements.albumTitle) {
            elements.albumTitle.textContent = this.getTrackCategory(track);
        }
        if (elements.trackGenre) {
            elements.trackGenre.textContent = this.getTrackGenre(track);
        }
        
        this.updateTrackCover(track);
    }
    
    formatTrackName(filename) {
        return filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ');
    }
    
    getTrackCategory(track) {
        if (track.category) return track.category;
        
        // Determinar categoria baseado no tipo
        if (radioState.content.jingles.includes(track)) return '📢 Vinheta';
        if (radioState.content.time.includes(track)) return '🕐 Hora Certa';
        
        // Verificar programas
        for (const [period, tracks] of Object.entries(radioState.content.programs)) {
            if (tracks.includes(track)) {
                const periods = {
                    morning: '🌅 Programa Matinal',
                    afternoon: '☀️ Programa Vespertino',
                    evening: '🌆 Programa Noturno',
                    late: '🌙 Programa Madrugada'
                };
                return periods[period];
            }
        }
        
        return '🎵 Música';
    }
    
    getTrackGenre(track) {
        // Análise básica do nome do arquivo para determinar gênero
        const name = track.name.toLowerCase();
        
        if (name.includes('rock')) return 'Rock';
        if (name.includes('pop')) return 'Pop';
        if (name.includes('jazz')) return 'Jazz';
        if (name.includes('classical')) return 'Clássica';
        if (name.includes('electronic')) return 'Eletrônica';
        if (name.includes('country')) return 'Country';
        if (name.includes('blues')) return 'Blues';
        if (name.includes('folk')) return 'Folk';
        
        return 'Variada';
    }
    
    updateTrackCover(track) {
        // Implementar sistema de capas se disponível
        if (track.coverUrl && elements.trackCover) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            if (elements.albumCover) {
                elements.albumCover.style.display = 'none';
            }
        } else {
            if (elements.trackCover) {
                elements.trackCover.style.display = 'none';
            }
            if (elements.albumCover) {
                elements.albumCover.style.display = 'block';
            }
        }
    }
    
    addToHistory(track) {
        const historyEntry = {
            ...track,
            playedAt: new Date().toISOString(),
            period: this.currentPeriod
        };
        
        radioState.playHistory.push(historyEntry);
        radioState.stats.totalPlayed++;
        
        // Manter apenas últimas 100 entradas
        if (radioState.playHistory.length > 100) {
            radioState.playHistory = radioState.playHistory.slice(-100);
        }
        
        // Atualizar estatísticas populares
        const trackKey = track.name;
        radioState.stats.popularTracks[trackKey] = 
            (radioState.stats.popularTracks[trackKey] || 0) + 1;
        
        this.saveData();
    }
    
    updateRecentTracks() {
        if (!elements.recentTracks) return;
        
        const recent = radioState.playHistory.slice(-5).reverse();
        
        if (recent.length === 0) {
            elements.recentTracks.innerHTML = '<p>Nenhuma música tocada ainda.</p>';
            return;
        }
        
        elements.recentTracks.innerHTML = recent.map(track => `
            <div class="recent-track">
                <span class="track-name">${this.formatTrackName(track.name)}</span>
                <span class="track-time">${new Date(track.playedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}</span>
            </div>
        `).join('');
    }
    
    playNext() {
        if (radioState.isLive) {
            this.scheduleNextTrack();
        }
    }
    
    skipTrack() {
        if (radioState.isLive && elements.audioPlayer) {
            elements.audioPlayer.pause();
            this.playNext();
        }
    }
    
    togglePlayback() {
        if (!radioState.isLive) {
            this.startBroadcast();
            if (radioState.currentTrack) {
                elements.audioPlayer.play().catch(e => {
                    console.warn('Erro no play:', e);
                    this.showAutoplayPrompt();
                });
            } else {
                this.scheduleNextTrack();
            }
        } else {
            if (radioState.isPlaying) {
                elements.audioPlayer.pause();
                radioState.isPlaying = false;
            } else {
                elements.audioPlayer.play().catch(e => {
                    console.warn('Erro no play:', e);
                    this.showAutoplayPrompt();
                });
                radioState.isPlaying = true;
            }
        }
        
        this.updatePlayPauseButton();
    }
    
    updatePlayPauseButton() {
        if (!elements.playPauseBtn) return;
        
        const playIcon = elements.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = elements.playPauseBtn.querySelector('.pause-icon');
        
        if (radioState.isPlaying && radioState.isLive) {
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
        } else {
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
        }
    }
    
    favoriteTrack() {
        if (!radioState.currentTrack) return;
        
        // Implementar sistema de favoritos
        console.log('❤️ Música favoritada:', radioState.currentTrack.name);
        
        // Mostrar feedback visual
        if (elements.favoriteBtn) {
            elements.favoriteBtn.style.color = '#ff4757';
            setTimeout(() => {
                elements.favoriteBtn.style.color = '';
            }, 2000);
        }
    }
    
    setVolume(value) {
        radioState.volume = parseInt(value);
        
        if (elements.audioPlayer) {
            elements.audioPlayer.volume = radioState.volume / 100;
        }
        if (elements.volumeValue) {
            elements.volumeValue.textContent = radioState.volume + '%';
        }
        
        this.saveData();
    }
    
    updateTime() {
        if (!elements.trackTime || !elements.audioPlayer) return;
        
        const current = elements.audioPlayer.currentTime || 0;
        const duration = elements.audioPlayer.duration || 0;
        
        elements.trackTime.textContent = 
            `${this.formatTime(current)} / ${this.formatTime(duration)}`;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    onTrackReady() {
        radioState.isPlaying = true;
        this.updatePlayPauseButton();
        this.updatePlayCount();
    }
    
    updatePlayCount() {
        if (elements.playCount) {
            elements.playCount.textContent = `Faixas: ${radioState.stats.totalPlayed}`;
        }
    }
    
    handleAudioError(error) {
        console.error('Erro no áudio:', error);
        
        // Tentar próxima faixa após erro
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 3000);
    }
    
    showAutoplayPrompt() {
        const prompt = document.createElement('div');
        prompt.className = 'autoplay-prompt';
        prompt.innerHTML = `
            <div class="prompt-content">
                <span>🔊 Clique para ativar o áudio</span>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        prompt.onclick = () => {
            if (elements.audioPlayer && radioState.isLive) {
                elements.audioPlayer.play().catch(() => {});
            }
            prompt.remove();
        };
        
        setTimeout(() => prompt.remove(), 10000);
    }
    
    updateBroadcastStatus(status) {
        if (elements.broadcastStatus) {
            elements.broadcastStatus.textContent = status;
        }
    }
    
    updateListenerCount() {
        // Simular contagem de ouvintes (em uma implementação real, viria do servidor)
        radioState.listeners = Math.floor(Math.random() * 50) + 10;
        
        if (elements.listenerCount) {
            elements.listenerCount.textContent = `${radioState.listeners} ouvintes`;
        }
    }
    
    startUptime() {
        const startTime = Date.now();
        
        this.uptimeTimer = setInterval(() => {
            const now = Date.now();
            const uptime = Math.floor((now - startTime) / 1000);
            
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            const uptimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const uptimeElement = document.getElementById('uptime');
            if (uptimeElement) {
                uptimeElement.textContent = uptimeStr;
            }
        }, 1000);
    }
    
    // Métodos para interface
    switchInfoTab(tabName) {
        // Remove active de todas as abas
        document.querySelectorAll('.info-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.info-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Ativa aba selecionada
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-section`).classList.add('active');
        
        // Atualizar conteúdo se necessário
        if (tabName === 'recent') {
            this.updateRecentTracks();
        } else if (tabName === 'schedule') {
            this.updateScheduleDisplay();
        } else if (tabName === 'requests') {
            this.updateRequestsList();
        }
    }
    
    switchAdminTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        if (tabName === 'content') {
            this.updateContentLibrary();
        } else if (tabName === 'reports') {
            this.updateReports();
        }
    }
    
    sendRequest() {
        const requestInput = document.getElementById('requestSong');
        if (!requestInput || !requestInput.value.trim()) return;
        
        const request = {
            song: requestInput.value.trim(),
            timestamp: new Date().toISOString(),
            id: Date.now()
        };
        
        radioState.stats.requests.push(request);
        this.saveData();
        
        requestInput.value = '';
        this.updateRequestsList();
        this.showModal('requestModal');
    }
    
    updateRequestsList() {
        const requestsList = document.getElementById('requestsList');
        if (!requestsList) return;
        
        if (radioState.stats.requests.length === 0) {
            requestsList.innerHTML = '<p>Nenhum pedido ainda hoje.</p>';
            return;
        }
        
        const recent = radioState.stats.requests.slice(-10).reverse();
        requestsList.innerHTML = recent.map(request => `
            <div class="request-item">
                <span class="request-song">${request.song}</span>
                <span class="request-time">${new Date(request.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                })}</span>
            </div>
        `).join('');
    }
    
    updateScheduleDisplay() {
        if (!elements.scheduleList) return;
        
        const now = new Date();
        const scheduleItems = [
            { time: '06:00 - 12:00', program: '🌅 Manhã Musical', current: this.currentPeriod === 'morning' },
            { time: '12:00 - 18:00', program: '☀️ Tarde Animada', current: this.currentPeriod === 'afternoon' },
            { time: '18:00 - 00:00', program: '🌆 Noite Especial', current: this.currentPeriod === 'evening' },
            { time: '00:00 - 06:00', program: '🌙 Madrugada Suave', current: this.currentPeriod === 'late' }
        ];
        
        elements.scheduleList.innerHTML = scheduleItems.map(item => `
            <div class="schedule-item ${item.current ? 'current' : ''}">
                <span class="schedule-time">${item.time}</span>
                <span class="schedule-program">${item.program}</span>
            </div>
        `).join('');
    }
    
    // Métodos administrativos (modificados para sincronização)
    openAdminModal() {
        this.showModal('passwordModal');
    }
    
    checkAdminPassword() {
        const password = elements.adminPassword?.value;
        if (password === 'admin123') {
            this.closeModal('passwordModal');
            this.showAdmin();
            
            // Ativar modo admin na sincronização
            if (this.syncManager) {
                this.syncManager.setAdminMode(true);
            }
        } else {
            alert('Senha incorreta!');
            if (elements.adminPassword) {
                elements.adminPassword.value = '';
            }
        }
    }
    
    showAdmin() {
        if (elements.playerMode) elements.playerMode.style.display = 'none';
        if (elements.adminMode) elements.adminMode.style.display = 'block';
        
        this.updateContentLibrary();
        this.updateReports();
        
        // Mostrar indicador de administrador
        this.showAdminIndicator();
    }
    
    showPlayer() {
        if (elements.playerMode) elements.playerMode.style.display = 'flex';
        if (elements.adminMode) elements.adminMode.style.display = 'none';
        
        // Desativar modo admin
        if (this.syncManager) {
            this.syncManager.setAdminMode(false);
        }
        
        // Remover indicador de admin
        this.hideAdminIndicator();
    }
    
    showAdminIndicator() {
        let indicator = document.getElementById('adminIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'adminIndicator';
            indicator.className = 'admin-indicator';
            indicator.innerHTML = `
                <div class="admin-indicator-content">
                    <span class="admin-icon">🔧</span>
                    <span>Modo Admin Ativo</span>
                    <small>Suas alterações serão sincronizadas</small>
                </div>
            `;
            document.body.appendChild(indicator);
        }
    }
    
    hideAdminIndicator() {
        const indicator = document.getElementById('adminIndicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    toggleBroadcast() {
        if (radioState.isLive) {
            this.stopBroadcast();
        } else {
            this.startBroadcast();
        }
    }
    
    emergencyStop() {
        if (confirm('Tem certeza que deseja parar a transmissão?')) {
            this.stopBroadcast();
            radioState.isPlaying = false;
            if (elements.audioPlayer) {
                elements.audioPlayer.pause();
            }
            this.updatePlayPauseButton();
        }
    }
    
    updateContentLibrary() {
        this.updateLibraryCount('music', radioState.content.music);
        this.updateLibraryCount('jingle', radioState.content.jingles);
        this.updateLibraryCount('time', radioState.content.time);
        
        // Contar programas
        const totalPrograms = Object.values(radioState.content.programs)
            .reduce((total, programs) => total + programs.length, 0);
        this.updateLibraryCount('program', { length: totalPrograms });
        
        this.updateLibraryList('musicList', radioState.content.music);
        this.updateLibraryList('jingleList', radioState.content.jingles);
        this.updateLibraryList('timeList', radioState.content.time);
        this.updateProgramsList();
    }
    
    updateLibraryCount(type, content) {
        const countElement = document.getElementById(`${type}Count`);
        if (countElement) {
            countElement.textContent = content.length || 0;
        }
    }
    
    updateLibraryList(listId, content) {
        const listElement = document.getElementById(listId);
        if (!listElement) return;
        
        if (content.length === 0) {
            listElement.innerHTML = '<p>Nenhum arquivo encontrado.</p>';
            return;
        }
        
        listElement.innerHTML = content.map((item, index) => `
            <div class="file-item">
                <span class="file-name">${this.formatTrackName(item.name)}</span>
                <button onclick="radioSystem.deleteContent('${listId.replace('List', '')}', ${index})" class="btn-danger btn-small">🗑️</button>
            </div>
        `).join('');
    }
    
    updateProgramsList() {
        const programList = document.getElementById('programList');
        if (!programList) return;
        
        let html = '';
        Object.entries(radioState.content.programs).forEach(([period, programs]) => {
            const periodNames = {
                morning: '🌅 Manhã',
                afternoon: '☀️ Tarde',
                evening: '🌆 Noite',
                late: '🌙 Madrugada'
            };
            
            html += `<h5>${periodNames[period]} (${programs.length})</h5>`;
            programs.forEach((program, index) => {
                html += `
                    <div class="file-item">
                        <span class="file-name">${this.formatTrackName(program.name)}</span>
                        <button onclick="radioSystem.deleteProgramContent('${period}', ${index})" class="btn-danger btn-small">🗑️</button>
                    </div>
                `;
            });
        });
        
        programList.innerHTML = html || '<p>Nenhum programa encontrado.</p>';
    }
    
    updateReports() {
        this.updateTopTracks();
        this.updateRequestsReport();
        this.updateSystemLogs();
        this.updateStats();
    }
    
    updateTopTracks() {
        const topTracksElement = document.getElementById('topTracks');
        if (!topTracksElement) return;
        
        const sorted = Object.entries(radioState.stats.popularTracks)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        if (sorted.length === 0) {
            topTracksElement.innerHTML = '<p>Nenhuma estatística ainda.</p>';
            return;
        }
        
        topTracksElement.innerHTML = sorted.map(([track, count]) => `
            <div class="report-item">
                <span class="track-name">${this.formatTrackName(track)}</span>
                <span class="play-count">${count}x</span>
            </div>
        `).join('');
    }
    
    updateRequestsReport() {
        const requestsReport = document.getElementById('requestsReport');
        if (!requestsReport) return;
        
        if (radioState.stats.requests.length === 0) {
            requestsReport.innerHTML = '<p>Nenhum pedido recebido.</p>';
            return;
        }
        
        const recent = radioState.stats.requests.slice(-5).reverse();
        requestsReport.innerHTML = recent.map(request => `
            <div class="report-item">
                <span class="track-name">${request.song}</span>
                <span class="track-time">${new Date(request.timestamp).toLocaleString('pt-BR')}</span>
            </div>
        `).join('');
    }
    
    updateSystemLogs() {
        const systemLogs = document.getElementById('systemLogs');
        if (!systemLogs) return;
        
        const logs = [
            { time: new Date(), message: 'Sistema iniciado', type: 'info' },
            { time: new Date(Date.now() - 30000), message: 'Transmissão ao vivo ativa', type: 'success' },
            { time: new Date(Date.now() - 60000), message: 'Conteúdo carregado', type: 'info' }
        ];
        
        systemLogs.innerHTML = logs.map(log => `
            <div class="log-item ${log.type}">
                <span class="log-time">${log.time.toLocaleTimeString('pt-BR')}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
    }
    
    updateStats() {
        const totalPlayedElement = document.getElementById('totalPlayed');
        if (totalPlayedElement) {
            totalPlayedElement.textContent = radioState.stats.totalPlayed;
        }
        
        const serverStatusElement = document.getElementById('serverStatus');
        if (serverStatusElement) {
            serverStatusElement.textContent = radioState.isLive ? '🟢 Online' : '🔴 Offline';
        }
    }
    
    // Métodos utilitários
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    showError(message) {
        console.error(message);
        alert(message);
    }
    
    // Métodos de upload
    deleteContent(type, index) {
        if (!confirm('Tem certeza que deseja excluir este item?')) return;
        
        radioState.content[type].splice(index, 1);
        this.saveData();
        this.updateContentLibrary();
    }
    
    deleteProgramContent(period, index) {
        if (!confirm('Tem certeza que deseja excluir este programa?')) return;
        
        radioState.content.programs[period].splice(index, 1);
        this.saveData();
        this.updateContentLibrary();
    }
}

// Classe para gerenciar uploads
class ContentUploader {
    constructor(radioSystem) {
        this.radio = radioSystem;
    }
    
    async uploadContent(type) {
        const fileInputs = {
            music: 'musicUpload',
            jingles: 'jingleUpload',
            time: 'timeUpload',
            programs: 'programUpload'
        };
        
        const fileInput = document.getElementById(fileInputs[type]);
        if (!fileInput || fileInput.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }
        
        const files = Array.from(fileInput.files);
        this.showUploadModal();
        
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateUploadProgress(i, files.length, `Enviando: ${file.name}`);
                
                const uploadedFile = await this.uploadToCloudinary(file, type);
                this.addToLibrary(uploadedFile, type);
            }
            
            this.hideUploadModal();
            fileInput.value = '';
            this.radio.updateContentLibrary();
            alert(`${files.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro no upload: ' + error.message);
            this.hideUploadModal();
        }
    }
    
    async uploadToCloudinary(file, type) {
        const formData = new FormData();
        
        // Determinar pasta baseado no tipo
        let folder = 'general';
        if (type === 'programs') {
            const programSelect = document.getElementById('programSelect');
            folder = `programs/${programSelect ? programSelect.value : 'general'}`;
        } else {
            folder = type;
        }
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0,
            format: data.format,
            uploadedAt: new Date().toISOString()
        };
    }
    
    addToLibrary(file, type) {
        if (type === 'programs') {
            const programSelect = document.getElementById('programSelect');
            const period = programSelect ? programSelect.value : 'morning';
            radioState.content.programs[period].push(file);
        } else {
            radioState.content[type].push(file);
        }
        
        this.radio.saveData();
    }
    
    showUploadModal() {
        this.radio.showModal('uploadModal');
    }
    
    hideUploadModal() {
        this.radio.closeModal('uploadModal');
    }
    
    updateUploadProgress(current, total, status) {
        const progress = Math.round((current / total) * 100);
        
        const progressElement = document.getElementById('uploadProgress');
        if (progressElement) {
            progressElement.style.width = progress + '%';
        }
        
        const statusElement = document.getElementById('uploadStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
}

// Funções globais para os botões HTML
let radioSystem;
let uploader;

// Função principal de upload chamada pelos botões
function uploadContent(type) {
    if (uploader) {
        uploader.uploadContent(type);
    }
}

// Função para verificar senha admin
function checkAdminPassword() {
    if (radioSystem) {
        radioSystem.checkAdminPassword();
    }
}

// Função para fechar modais
function closeModal(modalId) {
    if (radioSystem) {
        radioSystem.closeModal(modalId);
    }
}

// Funções de configuração de programação
function saveScheduleConfig() {
    const periods = ['morning', 'afternoon', 'evening', 'late'];
    
    periods.forEach(period => {
        const contentSelect = document.querySelector(`[data-period="${period}"]`);
        const freqInput = document.querySelector(`.jingle-frequency[data-period="${period}"]`);
        
        if (contentSelect && freqInput) {
            radioState.schedule[period] = {
                type: contentSelect.value,
                jingleFreq: parseInt(freqInput.value)
            };
        }
    });
    
    if (radioSystem) {
        radioSystem.saveData();
    }
    
    alert('Configurações de programação salvas!');
}

function resetSchedule() {
    if (!confirm('Tem certeza que deseja resetar a programação?')) return;
    
    radioState.schedule = {
        morning: { type: 'mixed', jingleFreq: 15 },
        afternoon: { type: 'mixed', jingleFreq: 10 },
        evening: { type: 'mixed', jingleFreq: 20 },
        late: { type: 'music', jingleFreq: 30 }
    };
    
    if (radioSystem) {
        radioSystem.saveData();
    }
    
    // Atualizar interface
    document.querySelectorAll('.content-type-select').forEach(select => {
        const period = select.dataset.period;
        select.value = radioState.schedule[period].type;
    });
    
    document.querySelectorAll('.jingle-frequency').forEach(input => {
    document.querySelectorAll('.jingle-frequency').forEach(input => {
        const period = input.dataset.period;
        input.value = radioState.schedule[period].jingleFreq;
    });
    
    alert('Programação resetada e sincronizada!');
}

// Funções de relatórios
function refreshReports() {
    if (radioSystem) {
        radioSystem.updateReports();
    }
}

function exportReport() {
    const reportData = {
        stats: radioState.stats,
        playHistory: radioState.playHistory,
        generatedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `relatorio-radio-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

async function clearReports() {
    if (!confirm('Tem certeza que deseja limpar todos os relatórios?')) return;
    
    radioState.stats = {
        totalPlayed: 0,
        dailyStats: {},
        popularTracks: {},
        requests: []
    };
    radioState.playHistory = [];
    
    if (radioSystem) {
        radioSystem.saveData();
        radioSystem.updateReports();
        
        // Sincronizar limpeza de relatórios
        if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
            await radioSystem.syncManager.publishUpdate();
        }
    }
    
    alert('Relatórios limpos e sincronizados!');
}

// Configurações de automação (modificadas para sincronização)
function setupAutomationControls() {
    const controls = [
        'hourlyTime', 'autoJingles', 'avoidRepeat', 'crossfade'
    ];
    
    controls.forEach(control => {
        const checkbox = document.getElementById(control);
        if (checkbox) {
            checkbox.addEventListener('change', async (e) => {
                radioState.automation[control] = e.target.checked;
                if (radioSystem) {
                    radioSystem.saveData();
                    
                    // Sincronizar configurações de automação
                    if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
                        await radioSystem.syncManager.publishUpdate();
                        showAutomationSyncNotification();
                    }
                }
            });
        }
    });
    
    // Controles numéricos
    const repeatInterval = document.getElementById('repeatInterval');
    if (repeatInterval) {
        repeatInterval.addEventListener('change', async (e) => {
            radioState.automation.repeatInterval = parseInt(e.target.value);
            if (radioSystem) {
                radioSystem.saveData();
                
                if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
                    await radioSystem.syncManager.publishUpdate();
                }
            }
        });
    }
    
    const crossfadeDuration = document.getElementById('crossfadeDuration');
    const crossfadeValue = document.getElementById('crossfadeValue');
    if (crossfadeDuration && crossfadeValue) {
        crossfadeDuration.addEventListener('input', async (e) => {
            const value = parseInt(e.target.value);
            radioState.automation.crossfadeDuration = value;
            crossfadeValue.textContent = value + 's';
            if (radioSystem) {
                radioSystem.saveData();
                
                if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
                    await radioSystem.syncManager.publishUpdate();
                }
            }
        });
    }
}

function showAutomationSyncNotification() {
    const notification = document.createElement('div');
    notification.className = 'automation-sync-notification';
    notification.innerHTML = `
        <div class="automation-sync-content">
            <span class="sync-icon">🤖</span>
            <span>Configurações de automação sincronizadas!</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Função modificada para deletar conteúdo com sincronização
async function deleteContent(type, index) {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    radioState.content[type].splice(index, 1);
    
    if (radioSystem) {
        radioSystem.saveData();
        radioSystem.updateContentLibrary();
        
        // Sincronizar exclusão
        if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
            await radioSystem.syncManager.publishUpdate();
            showDeleteSyncNotification();
        }
    }
}

async function deleteProgramContent(period, index) {
    if (!confirm('Tem certeza que deseja excluir este programa?')) return;
    
    radioState.content.programs[period].splice(index, 1);
    
    if (radioSystem) {
        radioSystem.saveData();
        radioSystem.updateContentLibrary();
        
        // Sincronizar exclusão
        if (radioSystem.syncManager && radioSystem.syncManager.isAdmin) {
            await radioSystem.syncManager.publishUpdate();
            showDeleteSyncNotification();
        }
    }
}

function showDeleteSyncNotification() {
    const notification = document.createElement('div');
    notification.className = 'delete-sync-notification';
    notification.innerHTML = `
        <div class="delete-sync-content">
            <span class="sync-icon">🗑️</span>
            <span>Exclusão sincronizada em todos os dispositivos!</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 3000);
}

// Inicialização do sistema com sincronização
function initRadioSystem() {
    try {
        radioSystem = new RadioLive24();
        uploader = new ContentUploader(radioSystem);
        
        // Configurar controles de automação
        setTimeout(setupAutomationControls, 1000);
        
        // Configurar listener para atualizações de conteúdo
        window.addEventListener('radioContentUpdated', (event) => {
            console.log('📻 Conteúdo atualizado por sincronização:', event.detail.timestamp);
            
            // Atualizar interface se necessário
            if (radioSystem) {
                radioSystem.updateContentLibrary();
                radioSystem.updateReports();
                
                // Se estava tocando, pode precisar atualizar a programação
                if (radioState.isLive) {
                    radioSystem.checkPlaylistStatus();
                }
            }
        });
        
        // Adicionar estilo das notificações de sincronização
        addSyncNotificationStyles();
        
        console.log('🎙️ Sistema de rádio 24h com sincronização inicializado!');
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        
        // Tentar novamente em 2 segundos
        setTimeout(initRadioSystem, 2000);
    }
}

// Função para adicionar estilos das notificações
function addSyncNotificationStyles() {
    if (document.getElementById('syncNotificationStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'syncNotificationStyles';
    style.textContent = `
        .sync-notification,
        .sync-success-notification,
        .config-sync-notification,
        .automation-sync-notification,
        .delete-sync-notification {
            position: fixed;
            top: 30px;
            right: 30px;
            background: linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%);
            color: white;
            padding: 15px 25px;
            border-radius: 12px;
            z-index: 10000;
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.4);
            animation: slideInRight 0.5s ease-out;
        }
        
        .sync-success-notification {
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            box-shadow: 0 8px 25px rgba(76, 175, 80, 0.4);
        }
        
        .config-sync-notification {
            background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%);
            box-shadow: 0 8px 25px rgba(255, 152, 0, 0.4);
        }
        
        .automation-sync-notification {
            background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%);
            box-shadow: 0 8px 25px rgba(156, 39, 176, 0.4);
        }
        
        .delete-sync-notification {
            background: linear-gradient(135deg, #F44336 0%, #D32F2F 100%);
            box-shadow: 0 8px 25px rgba(244, 67, 54, 0.4);
        }
        
        .sync-content,
        .sync-success-content,
        .config-sync-content,
        .automation-sync-content,
        .delete-sync-content {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            font-size: 0.95rem;
        }
        
        .sync-icon {
            font-size: 1.2rem;
        }
        
        .admin-indicator {
            position: fixed;
            top: 90px;
            right: 30px;
            background: linear-gradient(135deg, #7877C6 0%, #FF77C6 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 12px;
            z-index: 9999;
            box-shadow: 0 8px 25px rgba(120, 119, 198, 0.4);
            animation: slideInRight 0.5s ease-out;
            text-align: center;
        }
        
        .admin-indicator-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }
        
        .admin-icon {
            font-size: 1.5rem;
        }
        
        .admin-indicator-content small {
            opacity: 0.8;
            font-size: 0.75rem;
        }
        
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        
        @media (max-width: 768px) {
            .sync-notification,
            .sync-success-notification,
            .config-sync-notification,
            .automation-sync-notification,
            .delete-sync-notification,
            .admin-indicator {
                top: 20px;
                right: 20px;
                left: 20px;
                padding: 12px 15px;
                font-size: 0.85rem;
            }
            
            .admin-indicator {
                top: 70px;
            }
        }
    `;
    
    document.head.appendChild(style);
}

// Verificar status de conectividade
function checkConnectivity() {
    const isOnline = navigator.onLine;
    
    if (!isOnline) {
        console.warn('🔴 Sem conexão - funcionalidade limitada');
        showOfflineNotification();
    }
    
    return isOnline;
}

function showOfflineNotification() {
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.innerHTML = `
        <div class="offline-content">
            <span class="offline-icon">📡</span>
            <span>Modo Offline - Sincronização pausada</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover quando voltar online
    window.addEventListener('online', () => {
        notification.remove();
        
        // Forçar sincronização quando voltar online
        if (radioSystem && radioSystem.syncManager) {
            radioSystem.syncManager.forceSync();
        }
    });
}

// Listeners de conectividade
window.addEventListener('online', () => {
    console.log('🟢 Conexão restaurada');
    if (radioSystem && radioSystem.syncManager) {
        radioSystem.syncManager.forceSync();
    }
});

window.addEventListener('offline', () => {
    console.log('🔴 Conexão perdida');
    showOfflineNotification();
});

// Inicialização quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRadioSystem);
} else {
    initRadioSystem();
}

// Tratamento de erros globais
window.addEventListener('error', (e) => {
    console.error('Erro global:', e.error);
});

// Salvar estado antes de fechar página
window.addEventListener('beforeunload', () => {
    if (radioSystem) {
        radioSystem.saveData();
    }
});

// Manter transmissão ativa quando página volta ao foco
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive && radioSystem) {
        setTimeout(() => {
            if (elements.audioPlayer && elements.audioPlayer.paused && radioState.isPlaying) {
                elements.audioPlayer.play().catch(() => {});
            }
            
            // Verificar sincronização ao voltar ao foco
            if (radioSystem.syncManager) {
                radioSystem.syncManager.forceSync();
            }
        }, 1000);
    }
});

console.log('📡 Script da rádio 24h com sincronização carregado!');
        input.value = radioState.schedule[period].jingleFreq;
    });
    
    alert('Programação resetada!');
}

// Funções de relatórios
function refreshReports() {
    if (radioSystem) {
        radioSystem.updateReports();
    }
}

function exportReport() {
    const reportData = {
        stats: radioState.stats,
        playHistory: radioState.playHistory,
        generatedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `relatorio-radio-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function clearReports() {
    if (!confirm('Tem certeza que deseja limpar todos os relatórios?')) return;
    
    radioState.stats = {
        totalPlayed: 0,
        dailyStats: {},
        popularTracks: {},
        requests: []
    };
    radioState.playHistory = [];
    
    if (radioSystem) {
        radioSystem.saveData();
        radioSystem.updateReports();
    }
    
    alert('Relatórios limpos!');
}

// Configurações de automação
function setupAutomationControls() {
    const controls = [
        'hourlyTime', 'autoJingles', 'avoidRepeat', 'crossfade'
    ];
    
    controls.forEach(control => {
        const checkbox = document.getElementById(control);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                radioState.automation[control] = e.target.checked;
                if (radioSystem) {
                    radioSystem.saveData();
                }
            });
        }
    });
    
    // Controles numéricos
    const repeatInterval = document.getElementById('repeatInterval');
    if (repeatInterval) {
        repeatInterval.addEventListener('change', (e) => {
            radioState.automation.repeatInterval = parseInt(e.target.value);
            if (radioSystem) {
                radioSystem.saveData();
            }
        });
    }
    
    const crossfadeDuration = document.getElementById('crossfadeDuration');
    const crossfadeValue = document.getElementById('crossfadeValue');
    if (crossfadeDuration && crossfadeValue) {
        crossfadeDuration.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            radioState.automation.crossfadeDuration = value;
            crossfadeValue.textContent = value + 's';
            if (radioSystem) {
                radioSystem.saveData();
            }
        });
    }
}

// Inicialização do sistema
function initRadioSystem() {
    try {
        radioSystem = new RadioLive24();
        uploader = new ContentUploader(radioSystem);
        
        // Configurar controles de automação
        setTimeout(setupAutomationControls, 1000);
        
        console.log('Sistema de rádio 24h inicializado!');
        
    } catch (error) {
        console.error('Erro na inicialização:', error);
        
        // Tentar novamente em 2 segundos
        setTimeout(initRadioSystem, 2000);
    }
}

// Inicialização quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRadioSystem);
} else {
    initRadioSystem();
}

// Tratamento de erros globais
window.addEventListener('error', (e) => {
    console.error('Erro global:', e.error);
});

// Salvar estado antes de fechar página
window.addEventListener('beforeunload', () => {
    if (radioSystem) {
        radioSystem.saveData();
    }
});

// Manter transmissão ativa quando página volta ao foco
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && radioState.isLive && radioSystem) {
        setTimeout(() => {
            if (elements.audioPlayer && elements.audioPlayer.paused && radioState.isPlaying) {
                elements.audioPlayer.play().catch(() => {});
            }
        }, 1000);
    }
});

console.log('Script da rádio 24h carregado!');
