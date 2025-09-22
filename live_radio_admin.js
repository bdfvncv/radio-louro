// 🛠️ SISTEMA ADMINISTRATIVO DA RÁDIO
// ====================================

class RadioAdminManager {
    constructor() {
        this.isAuthenticated = false;
        this.sessionTimeout = null;
        this.uploadQueue = [];
        this.playlistManager = null;
        
        // Estado das playlists
        this.playlists = {
            music: [],
            time: [],
            ads: [],
            albums: {
                natal: [],
                pascoa: [],
                saojoao: [],
                carnaval: []
            }
        };
        
        // Configurações do servidor de streaming
        this.serverConfig = {
            status: 'unknown',
            uptime: 0,
            bitrate: RADIO_CONFIG.stream.bitrate,
            format: RADIO_CONFIG.stream.format
        };
        
        this.init();
    }
    
    init() {
        console.log('🛠️ Inicializando sistema administrativo...');
        
        this.loadStoredData();
        this.setupEventListeners();
        this.checkAuthenticationState();
        this.initializePlaylistManager();
        
        console.log('✅ Sistema administrativo carregado');
    }
    
    setupEventListeners() {
        // Botões principais
        const adminBtn = document.getElementById('adminBtn');
        const backToPlayer = document.getElementById('backToPlayer');
        
        if (adminBtn) {
            adminBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        if (backToPlayer) {
            backToPlayer.addEventListener('click', () => this.showPlayerMode());
        }
        
        // Controles do stream
        this.setupStreamControls();
        
        // Sistema de tabs
        this.setupTabs();
        
        // Controles de playlist
        this.setupPlaylistControls();
        
        // Upload de arquivos
        this.setupFileUpload();
    }
    
    setupStreamControls() {
        const restartStream = document.getElementById('restartStream');
        const skipTrack = document.getElementById('skipTrack');
        const forceTimeCheck = document.getElementById('forceTimeCheck');
        const streamStatusBtn = document.getElementById('streamStatusBtn');
        
        if (restartStream) {
            restartStream.addEventListener('click', () => this.restartStream());
        }
        
        if (skipTrack) {
            skipTrack.addEventListener('click', () => this.skipCurrentTrack());
        }
        
        if (forceTimeCheck) {
            forceTimeCheck.addEventListener('click', () => this.forceTimeAnnouncement());
        }
        
        if (streamStatusBtn) {
            streamStatusBtn.addEventListener('click', () => this.checkServerStatus());
        }
    }
    
    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    setupPlaylistControls() {
        const updatePlaylist = document.getElementById('updatePlaylist');
        const activePlaylist = document.getElementById('activePlaylist');
        
        if (updatePlaylist) {
            updatePlaylist.addEventListener('click', () => this.updateActivePlaylist());
        }
        
        if (activePlaylist) {
            activePlaylist.addEventListener('change', () => this.onPlaylistChange());
        }
    }
    
    setupFileUpload() {
        // Configurar drag & drop para upload
        const uploadCards = document.querySelectorAll('.upload-card');
        
        uploadCards.forEach(card => {
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            });
            
            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });
            
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                const category = this.getCategoryFromCard(card);
                
                if (files.length > 0) {
                    this.handleFileUpload(files, category);
                }
            });
        });
    }
    
    // === AUTENTICAÇÃO ===
    
    showLoginModal() {
        const modal = document.getElementById('adminModal');
        if (modal) {
            modal.style.display = 'flex';
            
            const passwordInput = document.getElementById('adminPassword');
            if (passwordInput) {
                passwordInput.focus();
            }
        }
    }
    
    checkAdminPassword() {
        const passwordInput = document.getElementById('adminPassword');
        const password = passwordInput?.value;
        
        if (password === RADIO_CONFIG.admin.password) {
            this.authenticateAdmin();
            this.closeModal('adminModal');
            passwordInput.value = '';
        } else {
            this.showError('Senha incorreta!');
            passwordInput.value = '';
            passwordInput.focus();
        }
    }
    
    authenticateAdmin() {
        this.isAuthenticated = true;
        console.log('🔐 Admin autenticado');
        
        // Configurar timeout de sessão
        this.setSessionTimeout();
        
        // Mostrar painel admin
        this.showAdminMode();
        
        // Carregar dados do servidor
        this.loadAdminData();
    }
    
    setSessionTimeout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }
        
        this.sessionTimeout = setTimeout(() => {
            this.logout();
        }, RADIO_CONFIG.admin.sessionTimeout);
    }
    
    logout() {
        this.isAuthenticated = false;
        console.log('🚪 Admin deslogado');
        
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }
        
        this.showPlayerMode();
        this.showInfo('Sessão expirada');
    }
    
    checkAuthenticationState() {
        // Verificar se há sessão ativa (opcional - implementar JWT/cookies)
        const savedSession = localStorage.getItem('adminSession');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                const now = Date.now();
                
                if (now < session.expires) {
                    this.isAuthenticated = true;
                    this.setSessionTimeout();
                }
            } catch (e) {
                localStorage.removeItem('adminSession');
            }
        }
    }
    
    // === INTERFACE ===
    
    showAdminMode() {
        const playerMode = document.getElementById('playerMode');
        const adminMode = document.getElementById('adminMode');
        
        if (playerMode) playerMode.style.display = 'none';
        if (adminMode) adminMode.style.display = 'block';
        
        // Atualizar dados
        this.refreshAllData();
    }
    
    showPlayerMode() {
        const playerMode = document.getElementById('playerMode');
        const adminMode = document.getElementById('adminMode');
        
        if (playerMode) playerMode.style.display = 'flex';
        if (adminMode) adminMode.style.display = 'none';
    }
    
    switchTab(tabName) {
        // Remover classe active de todos os botões e conteúdos
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Adicionar classe active aos elementos selecionados
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        // Executar ações específicas da aba
        this.onTabSwitch(tabName);
    }
    
    onTabSwitch(tabName) {
        switch (tabName) {
            case 'playlist':
                this.refreshPlaylistData();
                break;
            case 'upload':
                this.refreshUploadStatus();
                break;
            case 'schedule':
                this.refreshScheduleInfo();
                break;
            case 'stats':
                this.refreshStatistics();
                break;
            case 'settings':
                this.refreshSettings();
                break;
        }
    }
    
    // === CONTROLES DO SERVIDOR ===
    
    async restartStream() {
        if (!confirm('Tem certeza que deseja reiniciar o stream? Isso pode interromper a transmissão.')) {
            return;
        }
        
        console.log('🔄 Reiniciando stream...');
        this.showLoading(true);
        
        try {
            // Parar o stream atual
            if (window.streamManager) {
                await window.streamManager.stop();
            }
            
            // Aguardar um momento
            await this.delay(2000);
            
            // Reiniciar o stream
            if (window.streamManager) {
                await window.streamManager.forceReconnect();
            }
            
            this.showSuccess('Stream reiniciado com sucesso!');
            this.checkServerStatus();
            
        } catch (error) {
            console.error('❌ Erro ao reiniciar stream:', error);
            this.showError('Erro ao reiniciar stream');
        } finally {
            this.showLoading(false);
        }
    }
    
    async skipCurrentTrack() {
        console.log('⏭️ Pulando música atual...');
        
        try {
            // Implementar lógica para pular música no servidor de streaming
            // Isso dependeria do seu setup (Icecast/Shoutcast)
            
            this.showInfo('Próxima música solicitada');
            
            // Se usando sistema local, forçar próxima música
            if (this.playlistManager) {
                this.playlistManager.playNext();
            }
            
        } catch (error) {
            console.error('❌ Erro ao pular música:', error);
            this.showError('Erro ao pular música');
        }
    }
    
    async forceTimeAnnouncement() {
        console.log('🕐 Forçando hora certa...');
        
        try {
            if (this.playlistManager) {
                this.playlistManager.forceTimeAnnouncement();
                this.showInfo('Hora certa ativada');
            } else {
                this.showWarning('Sistema de playlist não disponível');
            }
            
        } catch (error) {
            console.error('❌ Erro ao forçar hora certa:', error);
            this.showError('Erro ao ativar hora certa');
        }
    }
    
    async checkServerStatus() {
        console.log('📡 Verificando status do servidor...');
        
        try {
            const statsUrl = STREAMING_URLS.icecast?.stats;
            
            if (statsUrl) {
                const response = await fetch(statsUrl, {
                    method: 'GET',
                    timeout: 5000
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.updateServerStatus(data);
                    this.showSuccess('Status atualizado');
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } else {
                // Status local/simulado
                this.updateServerStatus({
                    status: 'running',
                    uptime: Math.floor(Date.now() / 1000),
                    listeners: window.streamManager?.streamState.listeners || 0
                });
            }
            
        } catch (error) {
            console.error('❌ Erro ao verificar status:', error);
            this.serverConfig.status = 'error';
            this.updateServerStatusUI();
            this.showError('Erro ao verificar status do servidor');
        }
    }
    
    updateServerStatus(data) {
        if (data.icestats) {
            // Icecast response
            this.serverConfig.status = 'online';
            this.serverConfig.uptime = data.icestats.server_start_iso8601 
                ? Date.now() - new Date(data.icestats.server_start_iso8601).getTime()
                : 0;
        } else {
            // Formato customizado
            this.serverConfig.status = data.status === 'running' ? 'online' : 'offline';
            this.serverConfig.uptime = data.uptime || 0;
        }
        
        this.updateServerStatusUI();
    }
    
    updateServerStatusUI() {
        const serverStatus = document.getElementById('serverStatus');
        const uptimeDisplay = document.getElementById('uptimeDisplay');
        
        if (serverStatus) {
            const statusMap = {
                'online': '🟢 Online',
                'offline': '🔴 Offline',
                'error': '🟡 Erro',
                'unknown': '⚫ Desconhecido'
            };
            
            serverStatus.textContent = statusMap[this.serverConfig.status] || '⚫ Desconhecido';
            serverStatus.className = `status-value ${this.serverConfig.status}`;
        }
        
        if (uptimeDisplay) {
            uptimeDisplay.textContent = this.formatUptime(this.serverConfig.uptime);
        }
    }
    
    // === GERENCIAMENTO DE PLAYLISTS ===
    
    initializePlaylistManager() {
        this.playlistManager = new PlaylistManager(this.playlists);
    }
    
    refreshPlaylistData() {
        const playlistTracks = document.getElementById('playlistTracks');
        if (!playlistTracks) return;
        
        const activePlaylist = document.getElementById('activePlaylist');
        const selectedPlaylist = activePlaylist?.value || '';
        
        let tracks = [];
        
        if (selectedPlaylist === '') {
            // Todas as músicas
            tracks = this.playlists.music;
        } else if (this.playlists.albums[selectedPlaylist]) {
            // Álbum específico
            tracks = this.playlists.albums[selectedPlaylist];
        }
        
        if (tracks.length === 0) {
            playlistTracks.innerHTML = '<div class="no-tracks">Nenhuma música encontrada</div>';
            return;
        }
        
        const html = tracks.map((track, index) => `
            <div class="track-item">
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-meta">
                        ${track.duration ? `${this.formatDuration(track.duration)} • ` : ''}
                        ${track.uploadedAt ? new Date(track.uploadedAt).toLocaleDateString('pt-BR') : ''}
                    </div>
                </div>
                <div class="track-actions">
                    <button onclick="adminManager.playTrack(${index})" class="btn-secondary btn-small">▶️</button>
                    <button onclick="adminManager.deleteTrack('${selectedPlaylist}', ${index})" class="btn-danger btn-small">🗑️</button>
                </div>
            </div>
        `).join('');
        
        playlistTracks.innerHTML = html;
        
        // Atualizar contador
        const totalTracks = document.getElementById('totalTracks');
        if (totalTracks) {
            const total = Object.values(this.playlists.albums)
                .reduce((sum, album) => sum + album.length, this.playlists.music.length);
            totalTracks.textContent = total;
        }
    }
    
    updateActivePlaylist() {
        const activePlaylist = document.getElementById('activePlaylist');
        const selectedPlaylist = activePlaylist?.value || '';
        
        if (this.playlistManager) {
            this.playlistManager.setActivePlaylist(selectedPlaylist);
            this.showSuccess(`Playlist "${selectedPlaylist || 'Geral'}" ativada`);
            
            // Atualizar UI do player público
            this.updatePublicPlayerInfo(selectedPlaylist);
        }
        
        this.refreshPlaylistData();
    }
    
    onPlaylistChange() {
        this.refreshPlaylistData();
    }
    
    updatePublicPlayerInfo(playlistName) {
        const currentAlbum = document.getElementById('currentAlbum');
        if (currentAlbum) {
            if (playlistName && ALBUM_CONFIG[playlistName]) {
                currentAlbum.textContent = ALBUM_CONFIG[playlistName].title;
            } else {
                currentAlbum.textContent = 'Geral';
            }
        }
    }
    
    // === UPLOAD DE ARQUIVOS ===
    
    async handleFileUpload(files, category) {
        console.log(`📤 Iniciando upload de ${files.length} arquivo(s) para ${category}`);
        
        const albumType = category === 'album' 
            ? document.getElementById('albumSelect')?.value || 'natal'
            : '';
        
        this.showLoading(true);
        
        try {
            const uploadPromises = Array.from(files).map(file => 
                this.uploadSingleFile(file, category, albumType)
            );
            
            const results = await Promise.allSettled(uploadPromises);
            
            const successful = results.filter(r => r.status === 'fulfilled');
            const failed = results.filter(r => r.status === 'rejected');
            
            if (successful.length > 0) {
                // Adicionar arquivos às playlists
                successful.forEach(result => {
                    const fileData = result.value;
                    
                    if (category === 'album') {
                        this.playlists.albums[albumType].push(fileData);
                    } else {
                        this.playlists[category].push(fileData);
                    }
                });
                
                this.savePlaylistData();
                this.refreshPlaylistData();
                
                this.showSuccess(`${successful.length} arquivo(s) enviado(s) com sucesso!`);
            }
            
            if (failed.length > 0) {
                console.error('Falhas no upload:', failed);
                this.showError(`${failed.length} arquivo(s) falharam no upload`);
            }
            
        } catch (error) {
            console.error('❌ Erro no upload:', error);
            this.showError('Erro durante o upload dos arquivos');
        } finally {
            this.showLoading(false);
            this.clearFileInputs();
        }
    }
    
    async uploadSingleFile(file, category, albumType) {
        // Validar arquivo
        if (!this.validateFile(file)) {
            throw new Error(`Arquivo inválido: ${file.name}`);
        }
        
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', RADIO_CONFIG.cloudinary.uploadPreset);
        formData.append('folder', `${RADIO_CONFIG.cloudinary.folder}/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${RADIO_CONFIG.cloudinary.cloudName}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error(`Upload falhou para ${file.name}: HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || null,
            format: data.format,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            category: category,
            album: albumType || null
        };
    }
    
    validateFile(file) {
        // Verificar extensão
        const extension = file.name.split('.').pop().toLowerCase();
        if (!RADIO_CONFIG.admin.allowedFormats.includes(extension)) {
            this.showError(`Formato não suportado: ${extension}`);
            return false;
        }
        
        // Verificar tamanho
        if (file.size > RADIO_CONFIG.admin.maxUploadSize) {
            this.showError(`Arquivo muito grande: ${file.name} (máximo ${RADIO_CONFIG.admin.maxUploadSize / 1024 / 1024}MB)`);
            return false;
        }
        
        return true;
    }
    
    getCategoryFromCard(card) {
        if (card.querySelector('#musicUpload')) return 'music';
        if (card.querySelector('#timeUpload')) return 'time';
        if (card.querySelector('#adUpload')) return 'ads';
        if (card.querySelector('#albumUpload')) return 'album';
        return 'music';
    }
    
    clearFileInputs() {
        const inputs = ['musicUpload', 'timeUpload', 'adUpload', 'albumUpload'];
        inputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
    }
    
    // === AÇÕES NAS MÚSICAS ===
    
    playTrack(index) {
        const activePlaylist = document.getElementById('activePlaylist');
        const selectedPlaylist = activePlaylist?.value || '';
        
        let tracks = selectedPlaylist === '' 
            ? this.playlists.music 
            : this.playlists.albums[selectedPlaylist];
        
        if (tracks && tracks[index]) {
            const track = tracks[index];
            console.log('▶️ Reproduzindo:', track.name);
            
            // Implementar reprodução da música específica
            if (this.playlistManager) {
                this.playlistManager.playSpecificTrack(track);
            }
            
            this.showInfo(`Reproduzindo: ${track.name}`);
        }
    }
    
    deleteTrack(playlist, index) {
        let tracks, trackName;
        
        if (playlist === '') {
            tracks = this.playlists.music;
            trackName = tracks[index]?.name;
        } else {
            tracks = this.playlists.albums[playlist];
            trackName = tracks[index]?.name;
        }
        
        if (!trackName || !confirm(`Excluir "${trackName}"?`)) {
            return;
        }
        
        // Remover da playlist
        tracks.splice(index, 1);
        
        // Salvar dados
        this.savePlaylistData();
        
        // Atualizar UI
        this.refreshPlaylistData();
        
        this.showSuccess(`"${trackName}" foi excluída`);
    }
    
    // === ESTATÍSTICAS ===
    
    refreshStatistics() {
        const statsContent = document.getElementById('statsContent');
        if (!statsContent) return;
        
        const stats = this.calculateStatistics();
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>📊 Biblioteca</h4>
                    <div class="stat-row">
                        <span>Músicas Gerais:</span>
                        <span>${stats.music}</span>
                    </div>
                    <div class="stat-row">
                        <span>Hora Certa:</span>
                        <span>${stats.time}</span>
                    </div>
                    <div class="stat-row">
                        <span>Vinhetas:</span>
                        <span>${stats.ads}</span>
                    </div>
                    <div class="stat-row">
                        <span>Total:</span>
                        <span><strong>${stats.total}</strong></span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <h4>🎭 Álbuns</h4>
                    ${Object.keys(ALBUM_CONFIG).map(key => `
                        <div class="stat-row">
                            <span>${ALBUM_CONFIG[key].icon} ${ALBUM_CONFIG[key].title}:</span>
                            <span>${stats.albums[key] || 0}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="stat-card">
                    <h4>🎵 Reprodução</h4>
                    <div class="stat-row">
                        <span>Músicas tocadas hoje:</span>
                        <span>${stats.todayPlays}</span>
                    </div>
                    <div class="stat-row">
                        <span>Total de reproduções:</span>
                        <span>${stats.totalPlays}</span>
                    </div>
                    <div class="stat-row">
                        <span>Música mais tocada:</span>
                        <span>${stats.mostPlayed || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="stat-card">
                    <h4>📡 Stream</h4>
                    <div class="stat-row">
                        <span>Status:</span>
                        <span class="status-${this.serverConfig.status}">${this.serverConfig.status}</span>
                    </div>
                    <div class="stat-row">
                        <span>Uptime:</span>
                        <span>${this.formatUptime(this.serverConfig.uptime)}</span>
                    </div>
                    <div class="stat-row">
                        <span>Bitrate:</span>
                        <span>${this.serverConfig.bitrate} kbps</span>
                    </div>
                </div>
            </div>
        `;
        
        statsContent.innerHTML = html;
    }
    
    calculateStatistics() {
        const stats = {
            music: this.playlists.music.length,
            time: this.playlists.time.length,
            ads: this.playlists.ads.length,
            albums: {},
            total: 0,
            todayPlays: 0,
            totalPlays: 0,
            mostPlayed: null
        };
        
        // Contar álbuns
        Object.keys(this.playlists.albums).forEach(album => {
            stats.albums[album] = this.playlists.albums[album].length;
        });
        
        // Total
        stats.total = stats.music + stats.time + stats.ads + 
            Object.values(stats.albums).reduce((sum, count) => sum + count, 0);
        
        // Estatísticas de reprodução (se disponível)
        const playHistory = this.loadPlayHistory();
        if (playHistory) {
            stats.totalPlays = Object.values(playHistory).reduce((sum, count) => sum + count, 0);
            
            // Música mais tocada
            const mostPlayedEntry = Object.entries(playHistory)
                .sort(([,a], [,b]) => b - a)[0];
            
            if (mostPlayedEntry) {
                stats.mostPlayed = mostPlayedEntry[0];
            }
        }
        
        return stats;
    }
    
    // === CONFIGURAÇÕES ===
    
    refreshSettings() {
        const bitrateSelect = document.getElementById('bitrateSelect');
        const radioName = document.getElementById('radioName');
        const streamUrl = document.getElementById('streamUrl');
        
        if (bitrateSelect) {
            bitrateSelect.value = this.serverConfig.bitrate;
        }
        
        if (radioName) {
            radioName.value = RADIO_CONFIG.radio.name;
        }
        
        if (streamUrl) {
            streamUrl.value = RADIO_CONFIG.stream.url;
        }
    }
    
    saveSettings() {
        const bitrateSelect = document.getElementById('bitrateSelect');
        const radioName = document.getElementById('radioName');
        
        if (bitrateSelect) {
            this.serverConfig.bitrate = parseInt(bitrateSelect.value);
        }
        
        if (radioName) {
            RADIO_CONFIG.radio.name = radioName.value;
        }
        
        // Salvar configurações (implementar persistência)
        this.saveConfig();
        
        this.showSuccess('Configurações salvas!');
    }
    
    // === PERSISTÊNCIA DE DADOS ===
    
    loadStoredData() {
        try {
            const stored = localStorage.getItem('radioPlaylists');
            if (stored) {
                const data = JSON.parse(stored);
                this.playlists = { ...this.playlists, ...data };
            }
        } catch (error) {
            console.error('Erro ao carregar playlists:', error);
        }
    }
    
    savePlaylistData() {
        try {
            localStorage.setItem('radioPlaylists', JSON.stringify(this.playlists));
        } catch (error) {
            console.error('Erro ao salvar playlists:', error);
        }
    }
    
    loadPlayHistory() {
        try {
            const stored = localStorage.getItem('radioPlayHistory');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            return {};
        }
    }
    
    saveConfig() {
        try {
            localStorage.setItem('radioConfig', JSON.stringify({
                bitrate: this.serverConfig.bitrate,
                radioName: RADIO_CONFIG.radio.name
            }));
        } catch (error) {
            console.error('Erro ao salvar config:', error);
        }
    }
    
    // === UTILIDADES ===
    
    loadAdminData() {
        this.checkServerStatus();
        this.refreshAllData();
    }
    
    refreshAllData() {
        this.refreshPlaylistData();
        this.refreshStatistics();
        this.refreshSettings();
    }
    
    refreshUploadStatus() {
        // Implementar status de uploads em progresso
    }
    
    refreshScheduleInfo() {
        const albumScheduleInfo = document.getElementById('albumScheduleInfo');
        if (albumScheduleInfo) {
            const activePlaylist = document.getElementById('activePlaylist');
            const selected = activePlaylist?.value || '';
            
            if (selected && ALBUM_CONFIG[selected]) {
                albumScheduleInfo.textContent = `Ativo: ${ALBUM_CONFIG[selected].title}`;
            } else {
                albumScheduleInfo.textContent = 'Modo automático';
            }
        }
    }
    
    formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // === MENSAGENS ===
    
    showSuccess(message) {
        this.showToast(message, 'success');
    }
    
    showError(message) {
        this.showToast(message, 'error');
    }
    
    showWarning(message) {
        this.showToast(message, 'warning');
    }
    
    showInfo(message) {
        this.showToast(message, 'info');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getToastIcon(type)}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remover após 5 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }
    
    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    
    showLoading(show) {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

// === GERENCIADOR DE PLAYLIST ===

class PlaylistManager {
    constructor(playlists) {
        this.playlists = playlists;
        this.currentPlaylist = '';
        this.tracksSinceTime = 0;
        this.tracksSinceAd = 0;
        this.playHistory = new Map();
        this.antiRepeatBuffer = [];
    }
    
    setActivePlaylist(playlistName) {
        this.currentPlaylist = playlistName;
        console.log(`🎵 Playlist ativa: ${playlistName || 'Geral'}`);
    }
    
    playNext() {
        // Implementar lógica de próxima música
        console.log('⏭️ Próxima música solicitada');
    }
    
    playSpecificTrack(track) {
        console.log('▶️ Tocando música específica:', track.name);
        // Implementar reprodução de música específica
    }
    
    forceTimeAnnouncement() {
        this.tracksSinceTime = 999; // Força hora certa
        console.log('🕐 Hora certa forçada');
    }
}

// Funções globais para uso no HTML
function uploadFiles(category) {
    if (window.adminManager) {
        const fileInput = document.getElementById(category === 'album' ? 'albumUpload' : `${category}Upload`);
        if (fileInput && fileInput.files.length > 0) {
            window.adminManager.handleFileUpload(fileInput.files, category);
        } else {
            window.adminManager.showError('Selecione pelo menos um arquivo');
        }
    }
}

function checkAdminPassword() {
    if (window.adminManager) {
        window.adminManager.checkAdminPassword();
    }
}

function closeModal(modalId) {
    if (window.adminManager) {
        window.adminManager.closeModal(modalId);
    }
}

// Inicialização global
window.RadioAdminManager = RadioAdminManager;
window.PlaylistManager = PlaylistManager;
console.log('🛠️ Sistema administrativo carregado');