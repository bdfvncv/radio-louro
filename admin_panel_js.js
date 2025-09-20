// 🛠️ PAINEL ADMINISTRATIVO DA RÁDIO
// ===================================

class AdminPanel {
    constructor() {
        this.isAuthenticated = false;
        this.currentTab = 'upload';
        this.uploadProgress = new Map();
        
        console.log('🛠️ AdminPanel inicializado');
    }
    
    // Autenticação
    async authenticate(password) {
        const correctPassword = CONFIG.admin.defaultPassword;
        
        if (password === correctPassword) {
            this.isAuthenticated = true;
            this.showPanel();
            this.startAdminUpdater();
            UTILS.log('info', '🔓 Admin autenticado com sucesso');
            return true;
        } else {
            UTILS.log('warn', '🔒 Tentativa de login falhada');
            return false;
        }
    }
    
    logout() {
        this.isAuthenticated = false;
        this.hidePanel();
        UTILS.log('info', '🔒 Admin deslogado');
    }
    
    showPanel() {
        const radioPlayer = document.getElementById('radioPlayer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (radioPlayer) radioPlayer.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        
        STATE.ui.currentView = 'admin';
        this.updateAdminStatus();
        this.refreshCurrentTab();
    }
    
    hidePanel() {
        const radioPlayer = document.getElementById('radioPlayer');
        const adminPanel = document.getElementById('adminPanel');
        
        if (radioPlayer) radioPlayer.style.display = 'block';
        if (adminPanel) adminPanel.style.display = 'none';
        
        STATE.ui.currentView = 'radio';
    }
    
    // Gerenciamento de abas
    switchTab(tabName) {
        // Remover classe ativa de todas as abas
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Ativar aba selecionada
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        this.currentTab = tabName;
        STATE.ui.activeTab = tabName;
        
        // Executar ações específicas da aba
        this.refreshTabContent(tabName);
        
        UTILS.log('debug', `Aba alterada para: ${tabName}`);
    }
    
    refreshTabContent(tabName) {
        switch (tabName) {
            case 'upload':
                this.refreshUploadTab();
                break;
            case 'playlist':
                this.refreshPlaylistTab();
                break;
            case 'schedule':
                this.refreshScheduleTab();
                break;
            case 'reports':
                this.refreshReportsTab();
                break;
            case 'settings':
                this.refreshSettingsTab();
                break;
        }
    }
    
    refreshCurrentTab() {
        this.refreshTabContent(this.currentTab);
    }
    
    // Upload de arquivos
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            this.showNotification('Selecione pelo menos um arquivo!', 'warning');
            return;
        }
        
        const files = Array.from(fileInput.files);
        
        // Validar arquivos
        const validationResult = this.validateFiles(files);
        if (!validationResult.valid) {
            this.showNotification(validationResult.message, 'error');
            return;
        }
        
        this.showLoading(true, `Enviando ${files.length} arquivo(s)...`);
        
        try {
            const uploadedFiles = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateProgress(`Enviando ${file.name}... (${i + 1}/${files.length})`);
                
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
                
                // Adicionar à biblioteca correspondente
                this.addToLibrary(uploadedFile, category, albumType);
            }
            
            // Salvar estado
            UTILS.save();
            
            // Limpar input
            fileInput.value = '';
            
            // Atualizar UI
            this.refreshCurrentTab();
            
            // Se a transmissão está ativa mas sem música, iniciar
            if (STATE.transmission.isLive && !STATE.transmission.currentTrack) {
                setTimeout(() => {
                    if (window.RadioCore) {
                        RadioCore.playNextTrack();
                    }
                }, 1000);
            }
            
            this.showNotification(
                `${files.length} arquivo(s) enviado(s) com sucesso!`, 
                'success'
            );
            
            UTILS.log('info', `📤 ${files.length} arquivos enviados para ${category}`);
            
        } catch (error) {
            UTILS.log('error', 'Erro no upload', error);
            this.showNotification('Erro no upload. Tente novamente.', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    validateFiles(files) {
        const maxSize = CONFIG.admin.maxFileSize;
        const allowedFormats = CONFIG.admin.allowedFormats;
        
        for (const file of files) {
            // Verificar tamanho
            if (file.size > maxSize) {
                return {
                    valid: false,
                    message: `Arquivo "${file.name}" é muito grande. Máximo: ${this.formatFileSize(maxSize)}`
                };
            }
            
            // Verificar formato
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            if (!allowedFormats.includes(extension)) {
                return {
                    valid: false,
                    message: `Formato "${extension}" não suportado. Use: ${allowedFormats.join(', ')}`
                };
            }
        }
        
        return { valid: true };
    }
    
    async uploadToCloudinary(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.cloudinary.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        formData.append('resource_type', 'auto');
        
        const response = await fetch(UTILS.getCloudinaryURL(), {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload falhou: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove extensão
            originalName: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            duration: data.duration || 0,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            category: category,
            album: albumType || null
        };
    }
    
    addToLibrary(file, category, albumType = '') {
        if (category === 'album') {
            if (!STATE.library.albums[albumType]) {
                STATE.library.albums[albumType] = [];
            }
            STATE.library.albums[albumType].push(file);
        } else {
            if (!STATE.library[category]) {
                STATE.library[category] = [];
            }
            STATE.library[category].push(file);
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
    
    // Gerenciamento de playlist
    refreshPlaylistTab() {
        const content = document.getElementById('playlistContent');
        if (!content) return;
        
        let html = '';
        
        // Música atual
        if (STATE.transmission.currentTrack) {
            html += `
                <div class="current-track-section">
                    <h4>🎵 Tocando Agora</h4>
                    <div class="current-track-item">
                        <div class="track-info">
                            <div class="track-name">${STATE.transmission.currentTrack.name}</div>
                            <div class="track-category">${this.getCategoryName(STATE.transmission.currentTrack.category)}</div>
                        </div>
                        <div class="track-controls">
                            <button onclick="adminPanel.skipTrack()" class="btn-primary btn-small">⏭️ Pular</button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Estatísticas da biblioteca
        const totalMusic = STATE.library.music.length;
        const totalTime = STATE.library.time.length;
        const totalAds = STATE.library.ads.length;
        const totalAlbums = Object.values(STATE.library.albums).reduce((sum, album) => sum + album.length, 0);
        
        html += `
            <div class="library-stats">
                <h4>📊 Biblioteca de Áudio</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-number">${totalMusic}</div>
                        <div class="stat-label">Músicas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${totalTime}</div>
                        <div class="stat-label">Hora Certa</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${totalAds}</div>
                        <div class="stat-label">Avisos</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${totalAlbums}</div>
                        <div class="stat-label">Álbuns</div>
                    </div>
                </div>
            </div>
        `;
        
        // Lista de arquivos por categoria
        html += this.generateFileList('music', '🎵 Músicas Gerais');
        html += this.generateFileList('time', '🕐 Hora Certa');
        html += this.generateFileList('ads', '📢 Avisos');
        
        // Álbuns
        Object.keys(STATE.library.albums).forEach(albumKey => {
            const albumData = CONFIG.albums[albumKey];
            if (albumData && STATE.library.albums[albumKey].length > 0) {
                html += this.generateFileList(`albums.${albumKey}`, albumData.title);
            }
        });
        
        content.innerHTML = html;
    }
    
    generateFileList(category, title) {
        const isAlbum = category.startsWith('albums.');
        const files = isAlbum ? 
            STATE.library.albums[category.split('.')[1]] || [] :
            STATE.library[category] || [];
        
        if (files.length === 0) return '';
        
        let html = `
            <div class="file-category-section">
                <h4>${title} (${files.length})</h4>
                <div class="file-list">
        `;
        
        files.forEach((file, index) => {
            const duration = file.duration ? this.formatDuration(file.duration) : 'N/A';
            const size = this.formatFileSize(file.size);
            const uploadDate = new Date(file.uploadedAt).toLocaleDateString('pt-BR');
            
            html += `
                <div class="file-item">
                    <div class="file-info">
                        <div class="file-name">${file.name}</div>
                        <div class="file-details">${duration} • ${size} • ${uploadDate}</div>
                    </div>
                    <div class="file-actions">
                        <button onclick="adminPanel.playFile('${category}', ${index})" class="btn-secondary btn-small">▶️ Tocar</button>
                        <button onclick="adminPanel.deleteFile('${category}', ${index})" class="btn-danger btn-small">🗑️ Excluir</button>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    // Programação e configurações
    refreshScheduleTab() {
        const activeAlbumSelect = document.getElementById('activeAlbumSelect');
        const timeInterval = document.getElementById('timeInterval');
        const adInterval = document.getElementById('adInterval');
        
        if (activeAlbumSelect) {
            activeAlbumSelect.value = STATE.schedule.activeAlbum || '';
        }
        
        if (timeInterval) {
            timeInterval.value = CONFIG.radio.schedule.timeAnnouncementInterval;
        }
        
        if (adInterval) {
            adInterval.value = CONFIG.radio.schedule.adInterval;
        }
    }
    
    setActiveAlbum() {
        const select = document.getElementById('activeAlbumSelect');
        if (!select) return;
        
        const selectedAlbum = select.value || null;
        STATE.schedule.activeAlbum = selectedAlbum;
        
        UTILS.save();
        
        const albumName = selectedAlbum ? CONFIG.albums[selectedAlbum].title : 'Playlist Geral';
        this.showNotification(`Álbum ativo: ${albumName}`, 'success');
        
        UTILS.log('info', `📻 Álbum ativo alterado para: ${albumName}`);
    }
    
    updateSchedule() {
        const timeInterval = document.getElementById('timeInterval');
        const adInterval = document.getElementById('adInterval');
        
        if (timeInterval) {
            CONFIG.radio.schedule.timeAnnouncementInterval = parseInt(timeInterval.value);
        }
        
        if (adInterval) {
            CONFIG.radio.schedule.adInterval = parseInt(adInterval.value);
        }
        
        UTILS.save();
        this.showNotification('Configurações de programação salvas!', 'success');
        
        UTILS.log('info', '⚙️ Configurações de programação atualizadas');
    }
    
    // Relatórios
    refreshReportsTab() {
        const content = document.getElementById('reportsContent');
        if (!content) return;
        
        if (Object.keys(STATE.stats.playHistory).length === 0) {
            content.innerHTML = `
                <div class="no-data">
                    <p>📊 Nenhuma estatística disponível ainda.</p>
                    <p>As estatísticas aparecerão após algumas músicas serem tocadas.</p>
                </div>
            `;
            return;
        }
        
        // Estatísticas gerais
        const totalPlayed = STATE.stats.totalPlayed;
        const uniqueTracks = Object.keys(STATE.stats.playHistory).length;
        const sessionTime = Date.now() - STATE.stats.sessionStart;
        const avgPerHour = Math.round((totalPlayed / (sessionTime / 3600000)) * 100) / 100;
        
        let html = `
            <div class="reports-overview">
                <div class="overview-stats">
                    <div class="overview-stat">
                        <div class="stat-number">${totalPlayed}</div>
                        <div class="stat-label">Total Tocadas</div>
                    </div>
                    <div class="overview-stat">
                        <div class="stat-number">${uniqueTracks}</div>
                        <div class="stat-label">Músicas Únicas</div>
                    </div>
                    <div class="overview-stat">
                        <div class="stat-number">${avgPerHour}</div>
                        <div class="stat-label">Por Hora</div>
                    </div>
                </div>
            </div>
        `;
        
        // Top músicas
        const sortedTracks = Object.entries(STATE.stats.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 20);
        
        html += `
            <div class="top-tracks-section">
                <h4>🏆 Músicas Mais Tocadas</h4>
                <div class="tracks-list">
        `;
        
        sortedTracks.forEach(([trackName, count], index) => {
            const percentage = Math.round((count / totalPlayed) * 100);
            html += `
                <div class="track-stat-item">
                    <div class="track-position">#${index + 1}</div>
                    <div class="track-info">
                        <div class="track-name">${trackName}</div>
                        <div class="track-stats">${count} vezes • ${percentage}%</div>
                    </div>
                    <div class="track-chart">
                        <div class="chart-bar" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
        
        content.innerHTML = html;
    }
    
    // Configurações
    refreshSettingsTab() {
        const fadeTransitions = document.getElementById('fadeTransitions');
        const autoNormalize = document.getElementById('autoNormalize');
        const autoRestart = document.getElementById('autoRestart');
        const continuousPlay = document.getElementById('continuousPlay');
        
        if (fadeTransitions) fadeTransitions.checked = STATE.settings.fadeTransitions;
        if (autoNormalize) autoNormalize.checked = STATE.settings.autoNormalize;
        if (autoRestart) autoRestart.checked = STATE.settings.autoRestart;
        if (continuousPlay) continuousPlay.checked = STATE.settings.continuousPlay;
    }
    
    saveSettings() {
        const settings = {
            fadeTransitions: document.getElementById('fadeTransitions')?.checked || false,
            autoNormalize: document.getElementById('autoNormalize')?.checked || false,
            autoRestart: document.getElementById('autoRestart')?.checked || false,
            continuousPlay: document.getElementById('continuousPlay')?.checked || false
        };
        
        // Atualizar configurações
        Object.assign(STATE.settings, settings);
        Object.assign(CONFIG.radio.audio, {
            fadeTransitions: settings.fadeTransitions,
            autoNormalize: settings.autoNormalize
        });
        Object.assign(CONFIG.radio.transmission, {
            autoRestart: settings.autoRestart,
            continuousPlay: settings.continuousPlay
        });
        
        UTILS.save();
        this.showNotification('Configurações salvas com sucesso!', 'success');
        
        UTILS.log('info', '⚙️ Configurações do sistema atualizadas');
    }
    
    // Ações de arquivo
    async playFile(category, index) {
        try {
            const isAlbum = category.startsWith('albums.');
            const files = isAlbum ? 
                STATE.library.albums[category.split('.')[1]] :
                STATE.library[category];
            
            const file = files[index];
            if (!file) return;
            
            // Se a rádio está ao vivo, definir como próxima música
            if (STATE.transmission.isLive && window.RadioCore) {
                STATE.transmission.currentTrack = file;
                await RadioCore.loadAndPlayTrack(file);
                this.showNotification(`Reproduzindo: ${file.name}`, 'info');
            }
            
            UTILS.log('info', `▶️ Reprodução manual: ${file.name}`);
            
        } catch (error) {
            UTILS.log('error', 'Erro ao reproduzir arquivo', error);
            this.showNotification('Erro ao reproduzir arquivo', 'error');
        }
    }
    
    async deleteFile(category, index) {
        if (!confirm('Tem certeza que deseja excluir este arquivo?')) return;
        
        try {
            const isAlbum = category.startsWith('albums.');
            const files = isAlbum ? 
                STATE.library.albums[category.split('.')[1]] :
                STATE.library[category];
            
            const file = files[index];
            if (!file) return;
            
            // Remover do array
            files.splice(index, 1);
            
            // Salvar estado
            UTILS.save();
            
            // Atualizar UI
            this.refreshCurrentTab();
            
            this.showNotification(`Arquivo "${file.name}" excluído com sucesso!`, 'success');
            UTILS.log('info', `🗑️ Arquivo excluído: ${file.name}`);
            
        } catch (error) {
            UTILS.log('error', 'Erro ao excluir arquivo', error);
            this.showNotification('Erro ao excluir arquivo', 'error');
        }
    }
    
    // Controles de transmissão
    toggleTransmission() {
        if (window.RadioCore) {
            RadioCore.toggleTransmission();
            this.updateAdminStatus();
            
            const status = STATE.transmission.isLive ? 'iniciada' : 'pausada';
            this.showNotification(`Transmissão ${status}!`, 'info');
        }
    }
    
    skipTrack() {
        if (window.RadioCore && STATE.transmission.isLive) {
            RadioCore.skipToNext();
            this.showNotification('Pulando para próxima música...', 'info');
        }
    }
    
    shufflePlaylist() {
        // Embaralhar todas as playlists
        Object.keys(STATE.library).forEach(category => {
            if (Array.isArray(STATE.library[category])) {
                STATE.library[category] = this.shuffleArray(STATE.library[category]);
            } else if (typeof STATE.library[category] === 'object') {
                Object.keys(STATE.library[category]).forEach(subCategory => {
                    STATE.library[category][subCategory] = this.shuffleArray(
                        STATE.library[category][subCategory]
                    );
                });
            }
        });
        
        UTILS.save();
        this.refreshCurrentTab();
        this.showNotification('Playlist embaralhada!', 'success');
        
        UTILS.log('info', '🔀 Playlist embaralhada');
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    // Backup e restore
    backupData() {
        UTILS.export();
        this.showNotification('Backup criado com sucesso!', 'success');
    }
    
    async restoreData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                this.showLoading(true, 'Restaurando backup...');
                await UTILS.import(file);
                this.refreshCurrentTab();
                this.showNotification('Backup restaurado com sucesso!', 'success');
            } catch (error) {
                UTILS.log('error', 'Erro ao restaurar backup', error);
                this.showNotification('Erro ao restaurar backup', 'error');
            } finally {
                this.showLoading(false);
            }
        };
        
        input.click();
    }
    
    resetStats() {
        if (!confirm('Tem certeza que deseja resetar todas as estatísticas?')) return;
        
        STATE.stats = {
            totalPlayed: 0,
            playHistory: {},
            sessionStart: Date.now(),
            errors: [],
            listeners: 1
        };
        
        STATE.schedule.playHistory = [];
        
        UTILS.save();
        this.refreshReportsTab();
        this.showNotification('Estatísticas resetadas!', 'success');
        
        UTILS.log('info', '🔄 Estatísticas resetadas');
    }
    
    exportReports() {
        const reportData = {
            stats: STATE.stats,
            playHistory: STATE.schedule.playHistory,
            generatedAt: new Date().toISOString(),
            period: {
                start: new Date(STATE.stats.sessionStart).toISOString(),
                end: new Date().toISOString()
            }
        };
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `radio-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Relatório exportado!', 'success');
    }
    
    changeAdminPassword() {
        const newPassword = prompt('Digite a nova senha de administrador:');
        if (!newPassword) return;
        
        if (newPassword.length < 6) {
            this.showNotification('Senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        
        CONFIG.admin.defaultPassword = newPassword;
        UTILS.save();
        
        this.showNotification('Senha alterada com sucesso!', 'success');
        UTILS.log('info', '🔑 Senha de admin alterada');
    }
    
    // Atualizador do status admin
    startAdminUpdater() {
        setInterval(() => {
            if (this.isAuthenticated && STATE.ui.currentView === 'admin') {
                this.updateAdminStatus();
            }
        }, 5000);
    }
    
    updateAdminStatus() {
        // Status da transmissão no painel admin
        const onlineStatus = document.getElementById('onlineStatus');
        const currentTrackAdmin = document.getElementById('currentTrackAdmin');
        const totalTracks = document.getElementById('totalTracks');
        const uptime = document.getElementById('uptime');
        const transmissionBtn = document.getElementById('toggleTransmissionBtn');
        const transmissionBtnText = document.getElementById('transmissionBtnText');
        
        if (onlineStatus) {
            onlineStatus.textContent = STATE.transmission.isLive ? '🔴 AO VIVO' : '⚫ OFFLINE';
            onlineStatus.className = STATE.transmission.isLive ? 'status-live' : 'status-offline';
        }
        
        if (currentTrackAdmin) {
            currentTrackAdmin.textContent = STATE.transmission.currentTrack?.name || 'Nenhuma';
        }
        
        if (totalTracks) {
            const total = Object.values(STATE.library).reduce((sum, category) => {
                if (Array.isArray(category)) {
                    return sum + category.length;
                } else if (typeof category === 'object') {
                    return sum + Object.values(category).reduce((subSum, subCat) => 
                        subSum + (Array.isArray(subCat) ? subCat.length : 0), 0
                    );
                }
                return sum;
            }, 0);
            totalTracks.textContent = total.toString();
        }
        
        if (uptime) {
            const uptimeMs = STATE.transmission.uptime || 0;
            uptime.textContent = this.formatDuration(uptimeMs / 1000);
        }
        
        if (transmissionBtnText) {
            transmissionBtnText.textContent = STATE.transmission.isLive ? 
                '⏸️ PAUSAR TRANSMISSÃO' : '▶️ INICIAR TRANSMISSÃO';
        }
    }
    
    // Utilitários
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    getCategoryName(category) {
        const names = {
            music: 'Música Geral',
            time: 'Hora Certa',
            ads: 'Aviso/Comercial',
            album: 'Álbum Temático'
        };
        return names[category] || category;
    }
    
    updateProgress(message) {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
    
    showLoading(show, message = 'Carregando...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            if (show && message) {
                this.updateProgress(message);
            }
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        
        // Cores por tipo
        const colors = {
            info: '#3498db',
            success: '#2ecc71',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        
        notification.style.background = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    refreshUploadTab() {
        // Tab de upload não precisa de refresh especial
        // Os elementos já estão no HTML estático
    }
}

// Instância global do painel admin
window.AdminPanel = new AdminPanel();

// Funções globais para uso no HTML
window.uploadFiles = (category) => {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    AdminPanel.uploadFiles(category, albumType);
};

window.setActiveAlbum = () => AdminPanel.setActiveAlbum();
window.updateSchedule = () => AdminPanel.updateSchedule();
window.shufflePlaylist = () => AdminPanel.shufflePlaylist();
window.skipCurrent = () => AdminPanel.skipTrack();
window.refreshReports = () => AdminPanel.refreshReportsTab();
window.resetStats = () => AdminPanel.resetStats();
window.exportReports = () => AdminPanel.exportReports();
window.saveSettings = () => AdminPanel.saveSettings();
window.changeAdminPassword = () => AdminPanel.changeAdminPassword();
window.backupData = () => AdminPanel.backupData();

window.adminPanel = AdminPanel; // Para compatibilidade