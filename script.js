// Configuração da Cloudinary (Atualizadas)
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado global da aplicação
const RadioState = {
    // Estado da transmissão
    isLive: false,
    isPlaying: false,
    currentTrack: null,
    volume: 70,
    
    // Programação
    currentProgram: null,
    schedule: [],
    
    // Conteúdo
    playlists: {
        music: [],
        announcements: [],
        time: [],
        jingles: []
    },
    
    // Estatísticas
    stats: {
        tracksPlayed: 0,
        requestsReceived: 0,
        uptime: 0,
        listenersCount: 127
    },
    
    // Histórico
    recentTracks: [],
    playHistory: {},
    
    // Pedidos musicais
    requests: [],
    
    // Configurações
    autoMode: true,
    tracksSinceAnnouncement: 0,
    tracksSinceTime: 0,
    lastTimeAnnouncement: 0
};

// Elementos DOM (cache)
let Elements = {};

// Classes principais do sistema
class RadioManager {
    constructor() {
        this.intervalIds = [];
        this.audioContext = null;
        this.setupEventListeners();
    }

    // Inicialização
    init() {
        console.log('🎵 Iniciando Rádio Supermercado do Louro...');
        
        this.loadStoredData();
        this.initializeAudio();
        this.setupSchedule();
        this.startLiveBroadcast();
        this.startTimers();
        
        console.log('✅ Rádio inicializada com sucesso!');
    }

    // Configurar event listeners
    setupEventListeners() {
        // Player controls
        document.addEventListener('DOMContentLoaded', () => {
            Elements.playPauseBtn?.addEventListener('click', () => this.togglePlayback());
            Elements.skipBtn?.addEventListener('click', () => this.skipTrack());
            Elements.requestBtn?.addEventListener('click', () => this.showRequestModal());
            Elements.volumeSlider?.addEventListener('input', (e) => this.setVolume(e.target.value));
            
            // Audio events
            Elements.audioPlayer?.addEventListener('ended', () => this.playNext());
            Elements.audioPlayer?.addEventListener('timeupdate', () => this.updateTimeDisplay());
            Elements.audioPlayer?.addEventListener('error', (e) => this.handleAudioError(e));
            Elements.audioPlayer?.addEventListener('loadstart', () => this.showLoading());
            Elements.audioPlayer?.addEventListener('canplay', () => this.hideLoading());
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'a') {
                e.preventDefault();
                this.showAdminAccess();
            }
        });
    }

    // Inicializar áudio
    initializeAudio() {
        if (!Elements.audioPlayer) return;

        Elements.audioPlayer.volume = RadioState.volume / 100;
        Elements.audioPlayer.preload = 'metadata';
        Elements.audioPlayer.crossOrigin = 'anonymous';

        // Configurar Web Audio API se disponível
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Web Audio API inicializada');
        } catch (error) {
            console.warn('Web Audio API não disponível:', error);
        }
    }

    // Iniciar transmissão ao vivo
    startLiveBroadcast() {
        RadioState.isLive = true;
        RadioState.isPlaying = true;
        
        this.updateLiveStatus();
        this.playNext();
        
        console.log('🔴 Transmissão AO VIVO iniciada!');
    }

    // Reproduzir próxima faixa
    async playNext() {
        try {
            const nextTrack = this.getNextTrack();
            
            if (!nextTrack) {
                console.warn('⚠️ Nenhuma faixa disponível');
                setTimeout(() => this.playNext(), 30000); // Retry em 30s
                return;
            }

            // Atualizar estado atual
            RadioState.currentTrack = nextTrack;
            
            // Carregar e tocar
            await this.loadAndPlayTrack(nextTrack);
            
            // Atualizar interface
            this.updateTrackInfo(nextTrack);
            this.updateRecentTracks(nextTrack);
            this.updateStats();

        } catch (error) {
            console.error('❌ Erro ao reproduzir próxima faixa:', error);
            setTimeout(() => this.playNext(), 5000); // Retry em 5s
        }
    }

    // Obter próxima faixa baseada na programação
    getNextTrack() {
        const currentHour = new Date().getHours();
        const currentMinutes = new Date().getMinutes();
        
        // Verificar se é hora de tocar hora certa (a cada hora)
        if (currentMinutes === 0 && RadioState.tracksSinceTime > 0) {
            if (RadioState.playlists.time.length > 0) {
                RadioState.tracksSinceTime = 0;
                return this.getRandomTrack(RadioState.playlists.time, 'time');
            }
        }

        // Verificar se é hora de aviso/propaganda (a cada 5-7 músicas)
        const announcementInterval = 5 + Math.floor(Math.random() * 3);
        if (RadioState.tracksSinceAnnouncement >= announcementInterval) {
            if (RadioState.playlists.announcements.length > 0) {
                RadioState.tracksSinceAnnouncement = 0;
                RadioState.tracksSinceTime++;
                return this.getRandomTrack(RadioState.playlists.announcements, 'announcement');
            }
        }

        // Tocar música normal
        RadioState.tracksSinceAnnouncement++;
        RadioState.tracksSinceTime++;
        
        return this.getRandomTrack(RadioState.playlists.music, 'music');
    }

    // Obter faixa aleatória
    getRandomTrack(playlist, type = 'music') {
        if (!playlist || playlist.length === 0) return null;

        // Evitar repetir a faixa atual
        let availableTracks = playlist;
        if (RadioState.currentTrack && playlist.length > 1) {
            availableTracks = playlist.filter(track => 
                track.name !== RadioState.currentTrack.name
            );
        }

        const randomTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
        
        return {
            ...randomTrack,
            type: type,
            playTime: new Date().toISOString()
        };
    }

    // Carregar e reproduzir faixa
    async loadAndPlayTrack(track) {
        if (!Elements.audioPlayer) return;

        try {
            Elements.audioPlayer.src = track.url;
            
            if (RadioState.isPlaying && RadioState.isLive) {
                await Elements.audioPlayer.play();
            }

        } catch (error) {
            console.error('Erro ao carregar faixa:', error);
            throw error;
        }
    }

    // Atualizar informações da faixa
    updateTrackInfo(track) {
        if (Elements.currentTrack) {
            Elements.currentTrack.textContent = track.name || 'Faixa desconhecida';
        }
        
        if (Elements.trackArtist) {
            Elements.trackArtist.textContent = track.artist || 'Artista desconhecido';
        }
        
        if (Elements.trackType) {
            const typeLabels = {
                music: 'Música',
                announcement: 'Aviso',
                time: 'Hora Certa',
                jingle: 'Vinheta'
            };
            Elements.trackType.textContent = typeLabels[track.type] || 'Música';
        }

        // Atualizar capa se disponível
        if (Elements.albumCover && track.coverUrl) {
            Elements.albumCover.src = track.coverUrl;
        }
    }

    // Atualizar faixas recentes
    updateRecentTracks(track) {
        RadioState.recentTracks.unshift({
            ...track,
            timestamp: new Date()
        });

        // Manter apenas as últimas 10
        if (RadioState.recentTracks.length > 10) {
            RadioState.recentTracks = RadioState.recentTracks.slice(0, 10);
        }

        this.refreshRecentTracksList();
    }

    // Atualizar estatísticas
    updateStats() {
        RadioState.stats.tracksPlayed++;
        
        // Atualizar histórico de reprodução
        const trackName = RadioState.currentTrack?.name;
        if (trackName) {
            RadioState.playHistory[trackName] = (RadioState.playHistory[trackName] || 0) + 1;
        }

        this.refreshStatsDisplay();
        this.saveData();
    }

    // Toggle play/pause
    togglePlayback() {
        if (!Elements.audioPlayer) return;

        try {
            if (RadioState.isPlaying) {
                Elements.audioPlayer.pause();
                RadioState.isPlaying = false;
                RadioState.isLive = false;
                Elements.playPauseBtn.innerHTML = '<span class="play-icon">▶️</span>';
            } else {
                Elements.audioPlayer.play();
                RadioState.isPlaying = true;
                RadioState.isLive = true;
                Elements.playPauseBtn.innerHTML = '<span class="pause-icon">⏸️</span>';
            }

            this.updateLiveStatus();
        } catch (error) {
            console.error('Erro no toggle playback:', error);
        }
    }

    // Pular faixa
    skipTrack() {
        if (RadioState.isLive) {
            console.log('⏭️ Pulando faixa...');
            this.playNext();
        }
    }

    // Definir volume
    setVolume(value) {
        RadioState.volume = parseInt(value);
        
        if (Elements.audioPlayer) {
            Elements.audioPlayer.volume = RadioState.volume / 100;
        }
        
        if (Elements.volumeValue) {
            Elements.volumeValue.textContent = `${RadioState.volume}%`;
        }

        this.saveData();
    }

    // Atualizar status ao vivo
    updateLiveStatus() {
        const indicators = [Elements.liveIndicator, Elements.adminLiveStatus];
        const statusText = RadioState.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';

        indicators.forEach(element => {
            if (element) {
                element.textContent = statusText;
                element.style.color = RadioState.isLive ? '#dc2626' : '#666';
            }
        });

        // Atualizar equalizer
        const equalizer = Elements.equalizer;
        if (equalizer) {
            equalizer.style.display = RadioState.isPlaying ? 'flex' : 'none';
        }
    }

    // Atualizar display de tempo
    updateTimeDisplay() {
        if (!Elements.audioPlayer || !Elements.trackTime) return;

        try {
            const current = Elements.audioPlayer.currentTime || 0;
            const duration = Elements.audioPlayer.duration || 0;

            const currentStr = this.formatTime(current);
            const durationStr = this.formatTime(duration);

            Elements.trackTime.textContent = `${currentStr} / ${durationStr}`;
        } catch (error) {
            console.error('Erro ao atualizar tempo:', error);
        }
    }

    // Formatar tempo
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Lidar com erros de áudio
    handleAudioError(error) {
        console.error('❌ Erro no áudio:', error);
        
        // Tentar próxima faixa após 3 segundos
        setTimeout(() => {
            if (RadioState.isLive) {
                this.playNext();
            }
        }, 3000);
    }

    // Iniciar timers
    startTimers() {
        // Atualizar hora atual a cada minuto
        this.intervalIds.push(
            setInterval(() => {
                this.updateCurrentTime();
                this.checkSchedule();
            }, 60000)
        );

        // Atualizar estatísticas de uptime
        this.intervalIds.push(
            setInterval(() => {
                if (RadioState.isLive) {
                    RadioState.stats.uptime++;
                }
                this.refreshStatsDisplay();
            }, 3600000) // A cada hora
        );

        // Simular contagem de ouvintes
        this.intervalIds.push(
            setInterval(() => {
                this.updateListenerCount();
            }, 30000)
        );
    }

    // Atualizar hora atual
    updateCurrentTime() {
        if (Elements.currentTime) {
            const now = new Date();
            Elements.currentTime.textContent = now.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // Verificar programação
    checkSchedule() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const currentProgram = RadioState.schedule.find(program => {
            const startTime = new Date();
            const [hour, minute] = program.time.split(':');
            startTime.setHours(parseInt(hour), parseInt(minute), 0, 0);

            const endTime = new Date(startTime);
            endTime.setHours(endTime.getHours() + program.duration);

            return now >= startTime && now < endTime;
        });

        if (currentProgram && currentProgram !== RadioState.currentProgram) {
            RadioState.currentProgram = currentProgram;
            this.updateProgramDisplay();
        }
    }

    // Atualizar display do programa
    updateProgramDisplay() {
        const program = RadioState.currentProgram || {
            name: 'Programação Musical',
            description: 'A melhor seleção musical 24 horas por dia'
        };

        if (Elements.currentProgram) {
            Elements.currentProgram.textContent = program.name;
        }

        if (Elements.programDescription) {
            Elements.programDescription.textContent = program.description;
        }
    }

    // Simular contagem de ouvintes
    updateListenerCount() {
        const baseCount = 120;
        const variation = Math.floor(Math.random() * 20) - 10;
        RadioState.stats.listenersCount = Math.max(baseCount + variation, 50);

        if (Elements.listenerCount) {
            Elements.listenerCount.textContent = RadioState.stats.listenersCount;
        }
    }

    // Mostrar/ocultar loading
    showLoading() {
        Elements.loadingOverlay?.classList.add('show');
    }

    hideLoading() {
        Elements.loadingOverlay?.classList.remove('show');
    }

    // Destruir instância
    destroy() {
        this.intervalIds.forEach(id => clearInterval(id));
        this.intervalIds = [];
    }
}

// Gerenciador de Conteúdo
class ContentManager {
    constructor() {
        this.uploadQueue = [];
    }

    // Upload de arquivo
    async uploadFile(file, category, options = {}) {
        try {
            const formData = new FormData();
            
            // Determinar tipo de recurso
            const resourceType = file.type.startsWith('image/') ? 'image' : 'auto';
            const folder = `radio-louro/${category}`;

            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            formData.append('folder', folder);
            formData.append('resource_type', resourceType);

            if (options.tags) {
                formData.append('tags', options.tags.join(','));
            }

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            return {
                name: file.name,
                url: data.secure_url,
                publicId: data.public_id,
                category: category,
                uploadedAt: new Date().toISOString(),
                size: file.size,
                duration: data.duration,
                ...options
            };

        } catch (error) {
            console.error('Erro no upload:', error);
            throw error;
        }
    }

    // Upload múltiplo
    async uploadMultiple(files, category, options = {}) {
        const results = [];
        const errors = [];

        for (const file of files) {
            try {
                const result = await this.uploadFile(file, category, options);
                results.push(result);
                console.log(`✅ Upload concluído: ${file.name}`);
            } catch (error) {
                console.error(`❌ Erro no upload de ${file.name}:`, error);
                errors.push({ file: file.name, error: error.message });
            }
        }

        return { results, errors };
    }

    // Adicionar à playlist
    addToPlaylist(tracks, category) {
        if (!Array.isArray(tracks)) tracks = [tracks];

        tracks.forEach(track => {
            RadioState.playlists[category].push(track);
        });

        // Salvar dados
        radioManager.saveData();
        
        console.log(`➕ ${tracks.length} faixa(s) adicionada(s) à ${category}`);
    }

    // Remover da playlist
    removeFromPlaylist(trackId, category) {
        const playlist = RadioState.playlists[category];
        const index = playlist.findIndex(track => track.publicId === trackId);
        
        if (index !== -1) {
            playlist.splice(index, 1);
            radioManager.saveData();
            console.log(`➖ Faixa removida de ${category}`);
            return true;
        }
        
        return false;
    }

    // Obter estatísticas do conteúdo
    getContentStats() {
        return {
            music: RadioState.playlists.music.length,
            announcements: RadioState.playlists.announcements.length,
            time: RadioState.playlists.time.length,
            jingles: RadioState.playlists.jingles.length,
            total: Object.values(RadioState.playlists).reduce((sum, playlist) => sum + playlist.length, 0)
        };
    }
}

// Gerenciador de Programação
class ScheduleManager {
    constructor() {
        this.setupDefaultSchedule();
    }

    // Configurar programação padrão
    setupDefaultSchedule() {
        RadioState.schedule = [
            {
                time: '06:00',
                name: 'Bom Dia Louro',
                description: 'Começando o dia com energia!',
                duration: 4
            },
            {
                time: '10:00',
                name: 'Manhã Musical',
                description: 'Os melhores sucessos para sua manhã',
                duration: 4
            },
            {
                time: '14:00',
                name: 'Tarde Animada',
                description: 'Música boa para animar sua tarde',
                duration: 4
            },
            {
                time: '18:00',
                name: 'Fim de Tarde',
                description: 'Sucessos para o final do dia',
                duration: 4
            },
            {
                time: '22:00',
                name: 'Noite Romântica',
                description: 'As mais belas canções para sua noite',
                duration: 8
            }
        ];
    }

    // Adicionar programa
    addProgram(time, name, description, duration) {
        RadioState.schedule.push({
            time,
            name,
            description,
            duration
        });

        // Ordenar por horário
        RadioState.schedule.sort((a, b) => a.time.localeCompare(b.time));
        
        radioManager.saveData();
        this.refreshScheduleDisplay();
    }

    // Remover programa
    removeProgram(index) {
        RadioState.schedule.splice(index, 1);
        radioManager.saveData();
        this.refreshScheduleDisplay();
    }

    // Atualizar display da programação
    refreshScheduleDisplay() {
        const container = Elements.scheduleGrid;
        if (!container) return;

        container.innerHTML = RadioState.schedule.map((program, index) => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const [programHour, programMinute] = program.time.split(':').map(Number);
            
            const isCurrentProgram = 
                currentHour >= programHour && 
                currentHour < (programHour + program.duration);

            return `
                <div class="schedule-item ${isCurrentProgram ? 'current' : ''}">
                    <div class="schedule-time">${program.time}</div>
                    <div class="schedule-program">
                        <h4>${program.name}</h4>
                        <p>${program.description}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Gerenciador de Pedidos
class RequestManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Form de pedido
        document.addEventListener('DOMContentLoaded', () => {
            const form = Elements.requestForm;
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.submitRequest();
                });
            }
        });
    }

    // Mostrar modal de pedido
    showRequestModal() {
        const modal = document.getElementById('requestModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    // Submeter pedido
    async submitRequest() {
        try {
            const formData = {
                requesterName: document.getElementById('requesterName')?.value,
                songRequest: document.getElementById('songRequest')?.value,
                dedicateTo: document.getElementById('dedicateTo')?.value,
                message: document.getElementById('message')?.value,
                timestamp: new Date().toISOString()
            };

            // Validar dados
            if (!formData.requesterName || !formData.songRequest) {
                alert('Por favor, preencha seu nome e o pedido musical.');
                return;
            }

            // Adicionar à lista de pedidos
            RadioState.requests.unshift(formData);
            RadioState.stats.requestsReceived++;

            // Limitar a 50 pedidos
            if (RadioState.requests.length > 50) {
                RadioState.requests = RadioState.requests.slice(0, 50);
            }

            // Salvar e atualizar interface
            radioManager.saveData();
            this.refreshRequestsList();

            // Fechar modal
            this.closeRequestModal();

            // Mostrar confirmação
            alert('Pedido enviado com sucesso! Obrigado pela participação!');

        } catch (error) {
            console.error('Erro ao enviar pedido:', error);
            alert('Erro ao enviar pedido. Tente novamente.');
        }
    }

    // Fechar modal de pedido
    closeRequestModal() {
        const modal = document.getElementById('requestModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // Limpar form
        const form = Elements.requestForm;
        if (form) {
            form.reset();
        }
    }

    // Atualizar lista de pedidos (admin)
    refreshRequestsList() {
        const container = Elements.requestsList;
        if (!container) return;

        if (RadioState.requests.length === 0) {
            container.innerHTML = '<p>Nenhum pedido recebido ainda.</p>';
            return;
        }

        container.innerHTML = RadioState.requests.map((request, index) => `
            <div class="request-item">
                <div class="request-header">
                    <span class="request-name">${request.requesterName}</span>
                    <span class="request-time">${new Date(request.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div class="request-song">${request.songRequest}</div>
                ${request.dedicateTo ? `<div class="request-dedicate">Dedicar para: ${request.dedicateTo}</div>` : ''}
                ${request.message ? `<div class="request-message">"${request.message}"</div>` : ''}
                <div class="request-actions">
                    <button class="btn primary btn-small" onclick="requestManager.approveRequest(${index})">
                        ✅ Aprovar
                    </button>
                    <button class="btn secondary btn-small" onclick="requestManager.removeRequest(${index})">
                        🗑️ Remover
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Aprovar pedido
    approveRequest(index) {
        const request = RadioState.requests[index];
        if (!request) return;

        // Aqui você poderia implementar lógica para adicionar à fila de reprodução
        alert(`Pedido de ${request.requesterName} aprovado: ${request.songRequest}`);
        
        this.removeRequest(index);
    }

    // Remover pedido
    removeRequest(index) {
        RadioState.requests.splice(index, 1);
        radioManager.saveData();
        this.refreshRequestsList();
    }
}

// Interface Principal
class UIManager {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    // Inicializar elementos DOM
    initializeElements() {
        const elementIds = [
            'audioPlayer', 'playPauseBtn', 'skipBtn', 'requestBtn',
            'volumeSlider', 'volumeValue', 'currentTrack', 'trackArtist',
            'trackTime', 'trackType', 'albumCover', 'currentProgram',
            'programDescription', 'currentTime', 'listenerCount',
            'liveIndicator', 'equalizer', 'scheduleGrid', 'recentTracks',
            'announcementsList', 'adminPanel', 'passwordModal',
            'requestModal', 'requestForm', 'requestsList',
            'loadingOverlay', 'totalPlayed', 'statsTracksToday',
            'statsRequestsToday', 'statsUptime', 'statsTotalTracks',
            'adminLiveStatus'
        ];

        Elements = {};
        elementIds.forEach(id => {
            Elements[id] = document.getElementById(id);
        });
    }

    // Configurar event listeners da UI
    setupEventListeners() {
        // Botão admin
        document.getElementById('adminAccessBtn')?.addEventListener('click', () => {
            this.showAdminAccess();
        });

        // Admin tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchAdminTab(btn.dataset.tab);
            });
        });

        // Fechar modais ao clicar fora
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });
    }

    // Mostrar acesso admin
    showAdminAccess() {
        const modal = Elements.passwordModal;
        if (modal) {
            modal.classList.add('show');
        }
    }

    // Trocar aba admin
    switchAdminTab(tabName) {
        // Remover active de todas as abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Ativar aba selecionada
        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`${tabName}-tab`)?.classList.add('active');

        // Atualizar conteúdo específico da aba
        if (tabName === 'requests') {
            requestManager.refreshRequestsList();
        } else if (tabName === 'stats') {
            this.refreshStatsDisplay();
        }
    }

    // Atualizar lista de faixas recentes
    refreshRecentTracksList() {
        const container = Elements.recentTracks;
        if (!container) return;

        if (RadioState.recentTracks.length === 0) {
            container.innerHTML = '<p>Nenhuma faixa tocada ainda.</p>';
            return;
        }

        container.innerHTML = RadioState.recentTracks.map(track => {
            const time = new Date(track.timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="track-item">
                    <div class="track-time">${time}</div>
                    <div class="track-name">${track.name}</div>
                </div>
            `;
        }).join('');
    }

    // Atualizar display de estatísticas
    refreshStatsDisplay() {
        // Estatísticas principais
        if (Elements.totalPlayed) {
            Elements.totalPlayed.textContent = RadioState.stats.tracksPlayed;
        }
        if (Elements.statsTracksToday) {
            Elements.statsTracksToday.textContent = RadioState.stats.tracksPlayed;
        }
        if (Elements.statsRequestsToday) {
            Elements.statsRequestsToday.textContent = RadioState.stats.requestsReceived;
        }
        if (Elements.statsUptime) {
            Elements.statsUptime.textContent = '24h';
        }

        // Total de faixas na biblioteca
        const totalTracks = Object.values(RadioState.playlists)
            .reduce((sum, playlist) => sum + playlist.length, 0);
        
        if (Elements.statsTotalTracks) {
            Elements.statsTotalTracks.textContent = totalTracks;
        }

        // Top tracks
        this.refreshTopTracks();
    }

    // Atualizar top tracks
    refreshTopTracks() {
        const container = document.getElementById('topTracks');
        if (!container) return;

        const sortedTracks = Object.entries(RadioState.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (sortedTracks.length === 0) {
            container.innerHTML = '<p>Nenhuma estatística disponível ainda.</p>';
            return;
        }

        container.innerHTML = sortedTracks.map(([track, count], index) => `
            <div class="track-item">
                <div class="track-position">#${index + 1}</div>
                <div class="track-name">${track}</div>
                <div class="track-count">${count}x</div>
            </div>
        `).join('');
    }
}

// Instâncias globais
let radioManager;
let contentManager;
let scheduleManager;
let requestManager;
let uiManager;

// Funções globais (para uso no HTML)
window.radioFunctions = {
    // Admin
    checkAdminPassword() {
        const password = document.getElementById('adminPassword')?.value;
        if (password === 'admin123') {
            closeModal('passwordModal');
            showAdminPanel();
        } else {
            alert('Senha incorreta!');
        }
    },

    // Upload de conteúdo
    async uploadContent(category) {
        const fileInputs = {
            music: 'musicUpload',
            announcements: 'announcementUpload',
            time: 'timeUpload',
            jingles: 'jingleUpload'
        };

        const inputId = fileInputs[category];
        const input = document.getElementById(inputId);
        
        if (!input || input.files.length === 0) {
            alert('Selecione pelo menos um arquivo!');
            return;
        }

        try {
            radioManager.showLoading();
            
            const options = {};
            
            // Opções específicas por categoria
            if (category === 'announcements') {
                const priorityCheck = document.getElementById('priorityAnnouncement');
                if (priorityCheck?.checked) {
                    options.priority = true;
                    options.tags = ['priority'];
                }
            } else if (category === 'music') {
                const categorySelect = document.getElementById('musicCategory');
                if (categorySelect?.value) {
                    options.genre = categorySelect.value;
                    options.tags = [categorySelect.value];
                }
            }

            const { results, errors } = await contentManager.uploadMultiple(
                Array.from(input.files),
                category,
                options
            );

            // Adicionar à playlist
            if (results.length > 0) {
                contentManager.addToPlaylist(results, category);
            }

            // Mostrar resultado
            const successCount = results.length;
            const errorCount = errors.length;
            
            let message = `Upload concluído!\n✅ ${successCount} arquivo(s) enviado(s)`;
            if (errorCount > 0) {
                message += `\n❌ ${errorCount} erro(s)`;
            }
            
            alert(message);
            
            // Limpar input
            input.value = '';
            
            // Atualizar estatísticas
            uiManager.refreshStatsDisplay();

        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro no upload. Tente novamente.');
        } finally {
            radioManager.hideLoading();
        }
    },

    // Programação
    addProgram() {
        const time = document.getElementById('programTime')?.value;
        const name = document.getElementById('programName')?.value;
        const duration = parseInt(document.getElementById('programDuration')?.value || 1);

        if (!time || !name) {
            alert('Preencha todos os campos obrigatórios!');
            return;
        }

        scheduleManager.addProgram(time, name, `Programa: ${name}`, duration);
        
        // Limpar form
        document.getElementById('programTime').value = '';
        document.getElementById('programName').value = '';
        document.getElementById('programDuration').value = '1';

        alert('Programa adicionado à programação!');
    },

    // Controles de transmissão
    toggleBroadcast() {
        radioManager.togglePlayback();
        
        const btn = document.getElementById('toggleBroadcast');
        if (btn) {
            btn.textContent = RadioState.isLive ? '⏸️ Pausar Transmissão' : '▶️ Iniciar Transmissão';
        }
    },

    skipTrack() {
        radioManager.skipTrack();
    },

    emergencyStop() {
        if (confirm('Tem certeza que deseja fazer uma parada de emergência?')) {
            RadioState.isPlaying = false;
            RadioState.isLive = false;
            
            if (Elements.audioPlayer) {
                Elements.audioPlayer.pause();
            }
            
            radioManager.updateLiveStatus();
            alert('Transmissão interrompida!');
        }
    }
};

// Funções utilitárias globais
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

function showAdminPanel() {
    if (Elements.adminPanel) {
        Elements.adminPanel.classList.remove('hidden');
    }
}

function closeAdminPanel() {
    if (Elements.adminPanel) {
        Elements.adminPanel.classList.add('hidden');
    }
}

// Extensões para RadioManager
RadioManager.prototype.saveData = function() {
    try {
        const dataToSave = {
            playlists: RadioState.playlists,
            stats: RadioState.stats,
            playHistory: RadioState.playHistory,
            requests: RadioState.requests,
            schedule: RadioState.schedule,
            volume: RadioState.volume
        };
        
        localStorage.setItem('radioLouroData', JSON.stringify(dataToSave));
        console.log('💾 Dados salvos com sucesso');
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error);
    }
};

RadioManager.prototype.loadStoredData = function() {
    try {
        const saved = localStorage.getItem('radioLouroData');
        if (saved) {
            const data = JSON.parse(saved);
            
            // Mesclar dados salvos com estado atual
            RadioState.playlists = { ...RadioState.playlists, ...data.playlists };
            RadioState.stats = { ...RadioState.stats, ...data.stats };
            RadioState.playHistory = data.playHistory || {};
            RadioState.requests = data.requests || [];
            RadioState.schedule = data.schedule || RadioState.schedule;
            RadioState.volume = data.volume || 70;
            
            console.log('📥 Dados carregados com sucesso');
                  }
