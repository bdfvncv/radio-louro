await audioPlayer.play();
                    if (notificationManager) {
                        notificationManager.success('🎵 Rádio AO VIVO ativada!');
                    }
                } catch (e) {
                    console.error('Erro ao ativar áudio:', e);
                }
            }
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
        };
        
        document.addEventListener('click', enableAudio);
        document.addEventListener('touchstart', enableAudio);
    }
    
    startTransmission() {
        console.log('📡 Iniciando transmissão AO VIVO...');
        
        radioState.isLive = true;
        this.isTransmitting = true;
        
        // Verificar hora certa a cada minuto
        this.intervals.timeCheck = setInterval(() => {
            try {
                this.checkTimeAnnouncement();
            } catch (error) {
                console.error('Erro na verificação de hora:', error);
            }
        }, 60000);
        
        // Iniciar primeira música
        setTimeout(() => {
            this.playNext();
        }, 2000);
        
        // Atualizar interface
        this.updateAllStatus();
    }
    
    startUptimeCounter() {
        this.intervals.uptime = setInterval(() => {
            if (radioState.isLive) {
                radioState.totalUptime = Date.now() - radioState.sessionStartTime;
                this.updateUptimeDisplay();
            }
        }, 1000);
    }
    
    startHeartbeat() {
        this.intervals.heartbeat = setInterval(() => {
            if (radioState.isLive && this.isTransmitting) {
                this.checkTransmissionHealth();
            }
        }, 30000);
    }
    
    checkTransmissionHealth() {
        const audioPlayer = safeGetElement('audioPlayer');
        if (!audioPlayer) return;
        
        // Se não há música tocando há muito tempo, tocar próxima
        if (audioPlayer.paused && radioState.isLive && !radioState.isMuted) {
            console.log('💗 Heartbeat: Retomando transmissão...');
            this.playNext();
        }
    }
    
    setupAutoReconnect() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && radioState.isLive) {
                console.log('👁️ Página visível, verificando transmissão...');
                
                setTimeout(() => {
                    const audioPlayer = safeGetElement('audioPlayer');
                    if (audioPlayer && audioPlayer.paused && !radioState.isMuted) {
                        console.log('🔄 Reconectando transmissão...');
                        this.playNext();
                    }
                }, 1000);
            }
        });
        
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            if (radioState.isLive && !this.isTransmitting) {
                this.restartTransmission();
            }
        });
    }
    
    checkTimeAnnouncement() {
        if (!radioState.enableTimeAnnouncements) return;
        
        const now = new Date();
        const minutes = now.getMinutes();
        
        if (minutes === 0 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            if (timeSinceLastTime > 55 * 60 * 1000) {
                console.log('🕐 Hora certa programada!');
                radioState.lastTimeCheck = Date.now();
                radioState.tracksSinceTime = 999;
                setTimeout(() => this.playNext(), 5000);
            }
        }
    }
    
    async playNext() {
        try {
            const nextTrack = this.selectNextTrack();
            
            if (!nextTrack) {
                console.log('⚠️ Nenhuma música disponível, aguardando...');
                this.scheduleRetry();
                return;
            }
            
            // Atualizar estado
            radioState.currentTrack = nextTrack;
            
            // Configurar áudio
            const audioPlayer = safeGetElement('audioPlayer');
            if (audioPlayer) {
                audioPlayer.src = nextTrack.url;
                
                // Atualizar interface
                this.updateNowPlaying(nextTrack);
                this.updatePlayHistory(nextTrack);
                this.addToRecentTracks(nextTrack);
                
                // Reproduzir se não estiver mutado
                if (radioState.isLive && !radioState.isMuted) {
                    await this.attemptAutoplay();
                }
                
                console.log(`🎵 Tocando: ${nextTrack.name}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao reproduzir próxima música:', error);
            this.handleAudioError();
        }
    }
    
    selectNextTrack() {
        // 1. Verificar se deve tocar hora certa
        if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
            radioState.tracksSinceTime = 0;
            radioState.tracksSinceAd++;
            return this.getRandomTrack(radioState.playlists.time);
        }
        
        // 2. Verificar se deve tocar aviso/comercial
        if (radioState.enableAds && radioState.tracksSinceAd >= this.getAdInterval() && radioState.playlists.ads.length > 0) {
            radioState.tracksSinceAd = 0;
            radioState.tracksSinceTime++;
            return this.getRandomTrack(radioState.playlists.ads);
        }
        
        // 3. Tocar música normal
        let playlist = radioState.playlists.music;
        
        // Usar álbum ativo se selecionado
        if (radioState.activeAlbum && radioState.playlists.albums[radioState.activeAlbum].length > 0) {
            playlist = radioState.playlists.albums[radioState.activeAlbum];
        }
        
        radioState.tracksSinceTime++;
        radioState.tracksSinceAd++;
        
        return playlist.length > 0 ? this.getRandomTrack(playlist) : null;
    }
    
    getRandomTrack(playlist) {
        if (playlist.length === 0) return null;
        
        // Evitar repetir música imediatamente anterior
        if (playlist.length > 1 && radioState.currentTrack) {
            const filteredPlaylist = playlist.filter(track => 
                track.name !== radioState.currentTrack.name
            );
            if (filteredPlaylist.length > 0) {
                playlist = filteredPlaylist;
            }
        }
        
        return playlist[Math.floor(Math.random() * playlist.length)];
    }
    
    getAdInterval() {
        return 5 + Math.floor(Math.random() * 4); // 5-8 músicas
    }
    
    scheduleRetry() {
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 30000);
        
        const currentTrack = safeGetElement('currentTrack');
        if (currentTrack) {
            currentTrack.textContent = 'Aguardando músicas... Será retomada automaticamente.';
        }
    }
    
    handleAudioError() {
        console.error('🚨 Erro no áudio, tentando recuperar...');
        
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                if (radioState.isLive) {
                    this.playNext();
                }
            }, 5000);
            
            if (notificationManager) {
                notificationManager.error(`⚠️ Erro de áudio - Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            }
        } else {
            console.log('🔄 Muitos erros, reiniciando...');
            this.reconnectAttempts = 0;
            this.restartTransmission();
        }
    }
    
    updateNowPlaying(track) {
        const currentTrack = safeGetElement('currentTrack');
        const albumTitle = safeGetElement('albumTitle');
        
        if (currentTrack) {
            currentTrack.textContent = track.name;
        }
        
        if (albumTitle) {
            const albumInfo = radioState.activeAlbum && albumData[radioState.activeAlbum] 
                ? albumData[radioState.activeAlbum] 
                : albumData.general;
            albumTitle.textContent = albumInfo.title;
        }
        
        this.updateTrackCover(track);
    }
    
    updateTrackCover(track) {
        const trackCover = safeGetElement('trackCover');
        const albumCover = safeGetElement('albumCover');
        
        if (!trackCover || !albumCover) return;
        
        if (track.coverUrl) {
            trackCover.src = track.coverUrl;
            trackCover.style.display = 'block';
            albumCover.style.display = 'none';
        } else {
            trackCover.style.display = 'none';
            albumCover.style.display = 'block';
            
            const coverUrl = radioState.activeAlbum && radioState.albumCovers[radioState.activeAlbum]
                ? radioState.albumCovers[radioState.activeAlbum]
                : radioState.albumCovers.general || 'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
            
            albumCover.src = coverUrl;
        }
    }
    
    updatePlayHistory(track) {
        radioState.playHistory[track.name] = (radioState.playHistory[track.name] || 0) + 1;
        radioState.playCount++;
        radioState.dailyPlayCount++;
        
        this.updateStatsDisplay();
    }
    
    addToRecentTracks(track) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        radioState.recentTracks.unshift({
            name: track.name,
            time: timeStr,
            timestamp: now.getTime()
        });
        
        if (radioState.recentTracks.length > 10) {
            radioState.recentTracks = radioState.recentTracks.slice(0, 10);
        }
        
        this.updateRecentTracksDisplay();
    }
    
    updateRecentTracksDisplay() {
        const recentList = safeGetElement('recentList');
        if (!recentList) return;
        
        if (radioState.recentTracks.length === 0) {
            recentList.innerHTML = '<p style="color: #a0a0a0;">Aguardando transmissão...</p>';
            return;
        }
        
        recentList.innerHTML = radioState.recentTracks.map(track => `
            <div class="recent-item">
                <span class="recent-track">${track.name}</span>
                <span class="recent-time">${track.time}</span>
            </div>
        `).join('');
    }
    
    updateTransmissionStatus(isPlaying) {
        const status = radioState.isLive && isPlaying && !radioState.isMuted ? 'AO VIVO' : 
                     radioState.isMuted ? 'SILENCIADO' : 
                     radioState.isLive ? 'CONECTANDO...' : 'OFFLINE';
        
        const liveStatus = safeGetElement('liveStatus');
        const playStatus = safeGetElement('playStatus');
        const adminStatus = safeGetElement('adminBroadcastStatus');
        
        if (liveStatus) {
            liveStatus.textContent = status;
        }
        
        if (playStatus) {
            playStatus.textContent = status;
        }
        
        if (adminStatus) {
            adminStatus.innerHTML = radioState.isLive ? 
                '<div class="live-dot"></div><span>AO VIVO</span>' : 
                '<div class="live-dot" style="background: #666;"></div><span>OFFLINE</span>';
        }
    }
    
    updateStatsDisplay() {
        const trackCount = safeGetElement('trackCount');
        const dailyStats = safeGetElement('dailyStats');
        
        if (trackCount) {
            trackCount.textContent = radioState.dailyPlayCount.toString();
        }
        
        if (dailyStats) {
            dailyStats.textContent = `${radioState.dailyPlayCount} músicas hoje`;
        }
    }
    
    updateUptimeDisplay() {
        const uptime = this.formatUptime(radioState.totalUptime);
        const uptimeElement = safeGetElement('uptime');
        
        if (uptimeElement) {
            uptimeElement.textContent = uptime;
        }
    }
    
    formatUptime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateAllStatus() {
        const audioPlayer = safeGetElement('audioPlayer');
        this.updateTransmissionStatus(radioState.isLive && audioPlayer && !audioPlayer.paused);
        this.updateStatsDisplay();
        this.updateUptimeDisplay();
        this.updateRecentTracksDisplay();
    }
    
    // Métodos de controle público
    toggleMute() {
        radioState.isMuted = !radioState.isMuted;
        const audioPlayer = safeGetElement('audioPlayer');
        
        if (!audioPlayer) return;
        
        if (radioState.isMuted) {
            audioPlayer.pause();
            console.log('🔇 Áudio silenciado');
        } else {
            if (radioState.currentTrack) {
                this.attemptAutoplay();
            } else {
                this.playNext();
            }
            console.log('🔊 Áudio ativado');
        }
        
        this.updateMuteButton();
        this.updateAllStatus();
    }
    
    updateMuteButton() {
        const muteBtn = safeGetElement('muteBtn');
        if (!muteBtn) return;
        
        const icon = muteBtn.querySelector('.volume-icon');
        if (icon) {
            icon.textContent = radioState.isMuted ? '🔇' : '🔊';
        }
        muteBtn.className = radioState.isMuted ? 'btn-control muted' : 'btn-control';
        muteBtn.title = radioState.isMuted ? 'Ativar áudio' : 'Silenciar áudio';
    }
    
    forceNext() {
        console.log('⏭️ Próxima música forçada');
        this.playNext();
        if (notificationManager) {
            notificationManager.info('⏭️ Próxima música');
        }
    }
    
    forceTimeAnnouncement() {
        if (radioState.playlists.time.length === 0) {
            if (notificationManager) {
                notificationManager.error('❌ Nenhum arquivo de hora certa disponível');
            }
            return;
        }
        
        console.log('🕐 Hora certa forçada');
        radioState.tracksSinceTime = 999;
        this.playNext();
        
        if (notificationManager) {
            notificationManager.info('🕐 Hora certa será tocada');
        }
    }
    
    forceAd() {
        if (radioState.playlists.ads.length === 0) {
            if (notificationManager) {
                notificationManager.error('❌ Nenhum aviso disponível');
            }
            return;
        }
        
        console.log('📢 Aviso forçado');
        radioState.tracksSinceAd = 999;
        this.playNext();
        
        if (notificationManager) {
            notificationManager.info('📢 Aviso será tocado');
        }
    }
    
    restartTransmission() {
        console.log('🔄 Reiniciando transmissão...');
        
        // Parar tudo
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        radioState.isLive = false;
        this.isTransmitting = false;
        
        const audioPlayer = safeGetElement('audioPlayer');
        if (audioPlayer) {
            audioPlayer.pause();
        }
        
        // Reiniciar após 2 segundos
        setTimeout(() => {
            this.safeInit();
        }, 2000);
        
        if (notificationManager) {
            notificationManager.info('🔄 Reiniciando transmissão...');
        }
    }
}

// ================================
// GERENCIADOR DE ARQUIVOS SEGURO
// ================================
class SafeFileManager {
    async uploadFiles(category, albumType = '') {
        try {
            const fileInput = this.getFileInput(category);
            if (!fileInput || fileInput.files.length === 0) {
                if (notificationManager) {
                    notificationManager.error('❌ Selecione pelo menos um arquivo!');
                }
                return;
            }
            
            showLoading(true, 'Enviando arquivos...');
            
            const files = Array.from(fileInput.files);
            const uploadedFiles = [];
            
            for (const file of files) {
                showLoading(true, `Enviando: ${file.name}`);
                const uploadedFile = await this.uploadToCloudinary(file, category, albumType);
                uploadedFiles.push(uploadedFile);
            }
            
            // Adicionar aos playlists
            uploadedFiles.forEach(file => {
                if (category === 'album') {
                    radioState.playlists.albums[albumType].push(file);
                } else {
                    radioState.playlists[category].push(file);
                }
            });
            
            this.saveData();
            fileInput.value = '';
            this.refreshFilesList();
            
            // Se não há música tocando, iniciar
            if (radioState.isLive && !radioState.currentTrack && liveRadio) {
                setTimeout(() => liveRadio.playNext(), 1000);
            }
            
            if (notificationManager) {
                notificationManager.success(`✅ ${files.length} arquivo(s) enviado(s) com sucesso!`);
            }
            
        } catch (error) {
            console.error('Erro no upload:', error);
            if (notificationManager) {
                notificationManager.error('❌ Erro no upload. Tente novamente.');
            }
        } finally {
            showLoading(false);
        }
    }
    
    getFileInput(category) {
        const inputs = {
            music: safeGetElement('musicUpload'),
            time: safeGetElement('timeUpload'),
            ads: safeGetElement('adUpload'),
            album: safeGetElement('albumUpload')
        };
        return inputs[category];
    }
    
    async uploadToCloudinary(file, category, albumType = '') {
        const formData = new FormData();
        const folder = category === 'album' ? `albums/${albumType}` : category;
        
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', `radio-louro/${folder}`);
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro no upload: ${response.status}`);
        }
        
        const data = await response.json();
        return {
            name: file.name,
            url: data.secure_url,
            publicId: data.public_id,
            uploadedAt: new Date().toISOString()
        };
    }
    
    refreshFilesList() {
        ['music', 'time', 'ads'].forEach(category => {
            this.refreshCategoryFiles(category);
        });
        this.refreshAlbumFiles();
        this.updatePlaylistStatus();
    }
    
    refreshCategoryFiles(category) {
        const container = safeGetElement(`${category}Files`);
        if (!container) return;
        
        const files = radioState.playlists[category] || [];
        
        if (files.length === 0) {
            container.innerHTML = '<p style="color: #a0a0a0; text-align: center;">Nenhum arquivo encontrado</p>';
            return;
        }
        
        container.innerHTML = files.map((file, index) => `
            <div class="file-item">
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                </div>
                <div class="file-actions">
                    <button onclick="previewFile('${file.url}')" class="btn-secondary btn-small" title="Prévia">🎵</button>
                    <button onclick="deleteFile('${category}', ${index})" class="btn-danger btn-small" title="Excluir">🗑️</button>
                </div>
            </div>
        `).join('');
    }
    
    refreshAlbumFiles() {
        const container = safeGetElement('albumFiles');
        if (!container) return;
        
        let html = '';
        
        Object.keys(radioState.playlists.albums).forEach(albumKey => {
            const album = albumData[albumKey];
            const files = radioState.playlists.albums[albumKey] || [];
            
            html += `
                <div style="margin-bottom: 20px;">
                    <h5 style="color: #4facfe; margin-bottom: 10px; font-size: 1.1rem;">${album.title}</h5>
                    ${files.length === 0 ? 
                        '<p style="color: #a0a0a0; font-size: 0.9rem; margin-left: 15px;">Nenhum arquivo</p>' :
                        files.map((file, index) => `
                            <div class="file-item">
                                <div class="file-info">
                                    <span class="file-name">${file.name}</span>
                                </div>
                                <div class="file-actions">
                                    <button onclick="previewFile('${file.url}')" class="btn-secondary btn-small" title="Prévia">🎵</button>
                                    <button onclick="deleteAlbumFile('${albumKey}', ${index})" class="btn-danger btn-small" title="Excluir">🗑️</button>
                                </div>
                            </div>
                        `).join('')
                    }
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    updatePlaylistStatus() {
        const playlistStatus = safeGetElement('playlistStatus');
        if (!playlistStatus) return;
        
        const totalMusic = radioState.playlists.music.length;
        const totalAlbumMusic = Object.values(radioState.playlists.albums)
            .reduce((sum, album) => sum + album.length, 0);
        const totalTime = radioState.playlists.time.length;
        const totalAds = radioState.playlists.ads.length;
        
        playlistStatus.innerHTML = `
            <div style="font-size: 0.9rem; color: #a0a0a0;">
                🎵 ${totalMusic} músicas gerais<br>
                🎄 ${totalAlbumMusic} músicas de álbuns<br>
                🕐 ${totalTime} arquivos de hora<br>
                📢 ${totalAds} avisos
            </div>
        `;
    }
    
    saveData() {
        try {
            localStorage.setItem('radioState', JSON.stringify({
                playlists: radioState.playlists,
                playHistory: radioState.playHistory,
                albumCovers: radioState.albumCovers,
                activeAlbum: radioState.activeAlbum,
                volume: radioState.volume,
                enableTimeAnnouncements: radioState.enableTimeAnnouncements,
                enableAds: radioState.enableAds
            }));
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
        }
    }
    
    loadData() {
        try {
            const stored = localStorage.getItem('radioState');
            if (stored) {
                const data = JSON.parse(stored);
                
                radioState.playlists = data.playlists || radioState.playlists;
                radioState.playHistory = data.playHistory || {};
                radioState.albumCovers = data.albumCovers || { general: null };
                radioState.activeAlbum = data.activeAlbum || null;
                radioState.volume = data.volume || 70;
                radioState.enableTimeAnnouncements = data.enableTimeAnnouncements ?? true;
                radioState.enableAds = data.enableAds ?? true;
                
                console.log('✅ Dados carregados');
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
}

// ================================
// GERENCIADOR DE ÁLBUNS SEGURO
// ================================
class SafeAlbumManager {
    setupCoversGrid() {
        const coversGrid = safeGetElement('coversGrid');
        if (!coversGrid) return;
        
        let html = '';
        
        Object.keys(albumData).forEach(albumKey => {
            const album = albumData[albumKey];
            let coverUrl;
            
            if (albumKey === 'general') {
                coverUrl = radioState.albumCovers.general || 
                    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
            } else {
                coverUrl = radioState.albumCovers[albumKey] || 
                    `https://via.placeholder.com/200x200/333/fff?text=${encodeURIComponent(album.title)}`;
            }
            
            html += `
                <div class="cover-item">
                    <img src="${coverUrl}" alt="${album.title}" onerror="this.src='https://via.placeholder.com/200x200/333/fff?text=Erro'">
                    <h4>${album.title}</h4>
                    <p style="color: #a0a0a0; font-size: 0.9rem; margin-bottom: 15px;">${album.description}</p>
                    <button onclick="openCoverModal('${albumKey}')" class="btn-secondary btn-small">
                        🖼️ Alterar Capa
                    </button>
                </div>
            `;
        });
        
        coversGrid.innerHTML = html;
    }
    
    setActiveAlbum() {
        const activeAlbumSelect = safeGetElement('activeAlbumSelect');
        if (!activeAlbumSelect) return;
        
        const selectedAlbum = activeAlbumSelect.value;
        radioState.activeAlbum = selectedAlbum || null;
        
        if (fileManager) {
            fileManager.saveData();
        }
        
        this.updateAlbumDisplay();
        
        const message = selectedAlbum ? 
            `🎵 Álbum "${albumData[selectedAlbum].title}" ativado!` : 
            '📻 Playlist geral ativa';
        
        if (notificationManager) {
            notificationManager.success(message);
        }
        
        console.log(selectedAlbum ? 
            `📻 Álbum ativo: ${albumData[selectedAlbum].title}` : 
            '📻 Playlist geral ativa'
        );
    }
    
    updateAlbumDisplay() {
        const albumCover = safeGetElement('albumCover');
        const albumTitle = safeGetElement('albumTitle');
        const activeAlbumSelect = safeGetElement('activeAlbumSelect');
        
        if (albumCover && albumTitle) {
            try {
                if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
                    const album = albumData[radioState.activeAlbum];
                    const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
                        `https://via.placeholder.com/300x300/333/fff?text=${encodeURIComponent(album.title)}`;
                    
                    albumCover.src = coverUrl;
                    albumTitle.textContent = album.title;
                } else {
                    const coverUrl = radioState.albumCovers.general || 
                        'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
                    
                    albumCover.src = coverUrl;
                    albumTitle.textContent = albumData.general.title;
                }
            } catch (error) {
                console.error('Erro ao atualizar display do álbum:', error);
            }
        }
        
        if (activeAlbumSelect) {
            activeAlbumSelect.value = radioState.activeAlbum || '';
        }
    }
}

// ================================
// INICIALIZAÇÃO SEGURA
// ================================
function safeInitElements() {
    try {
        // Inicializar cache de elementos críticos
        elements.audioPlayer = safeGetElement('audioPlayer', true);
        elements.muteBtn = safeGetElement('muteBtn', true);
        elements.currentTrack = safeGetElement('currentTrack', true);
        
        console.log('✅ Elementos críticos verificados');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao verificar elementos:', error);
        return false;
    }
}

function safeSetupEventListeners() {
    try {
        // Controles principais
        const muteBtn = safeGetElement('muteBtn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                if (liveRadio) liveRadio.toggleMute();
            });
        }
        
        const skipBtn = safeGetElement('skipBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                if (liveRadio) liveRadio.forceNext();
            });
        }
        
        const reloadBtn = safeGetElement('reloadBtn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => {
                if (liveRadio) liveRadio.restartTransmission();
            });
        }
        
        const volumeSlider = safeGetElement('volumeSlider');
        if (volumeSlider) {
            volumeSlider.addEventListener('input', updateVolume);
        }
        
        // Admin
        const adminBtn = safeGetElement('adminBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', openPasswordModal);
        }
        
        const backToPlayerBtn = safeGetElement('backToPlayerBtn');
        if (backToPlayerBtn) {
            backToPlayerBtn.addEventListener('click', showPlayerMode);
        }
        
        const toggleBroadcast = safeGetElement('toggleBroadcast');
        if (toggleBroadcast) {
            toggleBroadcast.addEventListener('click', toggleBroadcastState);
        }
        
        const adminPassword = safeGetElement('adminPassword');
        if (adminPassword) {
            adminPassword.addEventListener('keypress', e => {
                if (e.key === 'Enter') checkPassword();
            });
        }
        
        // Tabs
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
        });
        
        // Checkboxes
        const enableTimeAnnouncements = safeGetElement('enableTimeAnnouncements');
        if (enableTimeAnnouncements) {
            enableTimeAnnouncements.addEventListener('change', (e) => {
                radioState.enableTimeAnnouncements = e.target.checked;
                if (fileManager) fileManager.saveData();
                if (notificationManager) {
                    notificationManager.info(e.target.checked ? 
                        '🕐 Anúncios de hora ativados' : 
                        '🕐 Anúncios de hora desativados'
                    );
                }
            });
        }
        
        const enableAds = safeGetElement('enableAds');
        if (enableAds) {
            enableAds.addEventListener('change', (e) => {
                radioState.enableAds = e.target.checked;
                if (fileManager) fileManager.saveData();
                if (notificationManager) {
                    notificationManager.info(e.target.checked ? 
                        '📢 Avisos comerciais ativados' : 
                        '📢 Avisos comerciais desativados'
                    );
                }
            });
        }
        
        console.log('✅ Event listeners configurados com segurança');
        
    } catch (error) {
        console.error('❌ Erro ao configurar listeners:', error);
    }
}

function safeInitializeRadio() {
    if (isInitialized) {
        console.warn('⚠️ Rádio já inicializada');
        return;
    }
    
    console.log('🚀 Inicialização segura da Rádio AO VIVO 24h...');
    
    try {
        // Verificar elementos críticos
        if (!safeInitElements()) {
            console.error('❌ Falha na verificação dos elementos');
            setTimeout(safeInitializeRadio, 3000); // Tentar novamente
            return;
        }
        
        isInitialized = true;
        
        // Inicializar gerenciadores
        notificationManager = new SafeNotificationManager();
        fileManager = new SafeFileManager();
        albumManager = new SafeAlbumManager();
        
        // Carregar dados salvos
        fileManager.loadData();
        
        // Configurar volume inicial
        const audioPlayer = safeGetElement('audioPlayer');
        const volumeSlider = safeGetElement('volumeSlider');
        const volumeValue = safeGetElement('volumeValue');
        
        if (audioPlayer && volumeSlider && volumeValue) {
            audioPlayer.volume = radioState.volume / 100;
            volumeSlider.value = radioState.volume;
            volumeValue.textContent = radioState.volume + '%';
        }
        
        // Configurar checkboxes
        const enableTimeAnnouncements = safeGetElement('enableTimeAnnouncements');
        const enableAds = safeGetElement('enableAds');
        
        if (enableTimeAnnouncements) {
            enableTimeAnnouncements.checked = radioState.enableTimeAnnouncements;
        }
        if (enableAds) {
            enableAds.checked = radioState.enableAds;
        }
        
        // Setup event listeners
        safeSetupEventListeners();
        
        // Inicializar rádio AO VIVO (após pequeno delay)
        setTimeout(() => {
            liveRadio = new SafeLiveRadio24h();
        }, 2000);
        
        // Atualizar interfaces
        setTimeout(() => {
            if (albumManager) albumManager.updateAlbumDisplay();
            if (fileManager) fileManager.refreshFilesList();
        }, 3000);
        
        console.log('✅ Sistema de Rádio AO VIVO 24h inicializado com segurança!');
        
        // Adicionar faixas de exemplo se necessário (descomente para testar)
        // setTimeout(addSampleTracks, 5000);
        
    } catch (error) {
        console.error('❌ Erro crítico na inicialização:', error);
        
        // Tentar recuperação
        setTimeout(() => {
            console.log('🔄 Tentando recuperação...');
            isInitialized = false;
            safeInitializeRadio();
        }, 5000);
    }
}

// ================================
// FUNÇÕES DE CONTROLE DA INTERFACE
// ================================
function updateVolume() {
    const volumeSlider = safeGetElement('volumeSlider');
    const audioPlayer = safeGetElement('audioPlayer');
    const volumeValue = safeGetElement('volumeValue');
    
    if (!volumeSlider || !audioPlayer || !volumeValue) return;
    
    const volume = parseInt(volumeSlider.value);
    radioState.volume = volume;
    audioPlayer.volume = volume / 100;
    volumeValue.textContent = volume + '%';
    
    if (fileManager) {
        fileManager.saveData();
    }
}

function toggleBroadcastState() {
    if (!liveRadio) return;
    
    const broadcastIcon = safeGetElement('broadcastIcon');
    const broadcastText = safeGetElement('broadcastText');
    
    if (radioState.isLive) {
        liveRadio.restartTransmission(); // Para e reinicia
        if (broadcastIcon) broadcastIcon.textContent = '▶️';
        if (broadcastText) broadcastText.textContent = 'INICIAR TRANSMISSÃO';
    } else {
        liveRadio.startTransmission();
        if (broadcastIcon) broadcastIcon.textContent = '🔴';
        if (broadcastText) broadcastText.textContent = 'PAUSAR TRANSMISSÃO';
    }
}

// Admin Panel
function openPasswordModal() {
    const passwordModal = safeGetElement('passwordModal');
    const adminPassword = safeGetElement('adminPassword');
    
    if (passwordModal) {
        passwordModal.style.display = 'flex';
        if (adminPassword) {
            adminPassword.focus();
        }
    }
}

function checkPassword() {
    const adminPassword = safeGetElement('adminPassword');
    if (!adminPassword) return;
    
    const password = adminPassword.value.trim();
    
    if (password === 'admin123') {
        closeModal('passwordModal');
        showAdminMode();
        if (notificationManager) {
            notificationManager.success('🔑 Acesso administrativo autorizado');
        }
    } else {
        if (notificationManager) {
            notificationManager.error('❌ Senha incorreta!');
        }
        adminPassword.value = '';
        adminPassword.focus();
    }
}

function showAdminMode() {
    const playerMode = safeGetElement('playerMode');
    const adminMode = safeGetElement('adminMode');
    
    if (playerMode) playerMode.style.display = 'none';
    if (adminMode) adminMode.style.display = 'block';
    
    // Atualizar dados administrativos
    if (fileManager) fileManager.refreshFilesList();
    refreshReports();
    if (albumManager) albumManager.setupCoversGrid();
    updateScheduleInfo();
}

function showPlayerMode() {
    const playerMode = safeGetElement('playerMode');
    const adminMode = safeGetElement('adminMode');
    
    if (playerMode) playerMode.style.display = 'flex';
    if (adminMode) adminMode.style.display = 'none';
}

function switchTab(tabName) {
    try {
        // Remove active de todos
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Adiciona active nos selecionados
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(`${tabName}-tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        
        // Executa ações específicas da aba
        switch (tabName) {
            case 'broadcast':
                updateScheduleInfo();
                break;
            case 'files':
                if (fileManager) fileManager.refreshFilesList();
                break;
            case 'reports':
                refreshReports();
                break;
            case 'albums':
                if (albumManager) albumManager.setupCoversGrid();
                break;
            case 'schedule':
                updateScheduleInfo();
                break;
        }
    } catch (error) {
        console.error('Erro ao trocar tab:', error);
    }
}

function updateScheduleInfo() {
    try {
        // Próximo anúncio de hora
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        
        const nextTimeCheck = safeGetElement('nextTimeCheck');
        if (nextTimeCheck) {
            nextTimeCheck.textContent = radioState.enableTimeAnnouncements ? 
                `Próxima: ${nextHour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` :
                'Desabilitado';
        }
        
        // Próximo aviso
        const nextAd = safeGetElement('nextAd');
        if (nextAd) {
            const nextAdTracks = Math.max(0, 5 - radioState.tracksSinceAd);
            nextAd.textContent = radioState.enableAds ? 
                `Próximo em: ${nextAdTracks} músicas` :
                'Desabilitado';
        }
        
        // Próxima ação
        const nextAction = safeGetElement('nextAction');
        if (nextAction) {
            let action = 'Música aleatória';
            
            if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
                action = '🕐 Hora certa';
            } else if (radioState.enableAds && radioState.tracksSinceAd >= 5 && radioState.playlists.ads.length > 0) {
                action = '📢 Aviso comercial';
            } else if (radioState.activeAlbum) {
                action = `🎵 Música do álbum ${albumData[radioState.activeAlbum].title}`;
            }
            
            nextAction.textContent = action;
        }
    } catch (error) {
        console.error('Erro ao atualizar info da programação:', error);
    }
}

// ================================
// FUNÇÕES DE UPLOAD E GERENCIAMENTO
// ================================
function uploadFiles(category) {
    try {
        const albumType = category === 'album' ? safeGetElement('albumSelect')?.value : '';
        if (fileManager) {
            fileManager.uploadFiles(category, albumType);
        }
    } catch (error) {
        console.error('Erro no upload:', error);
    }
}

function setActiveAlbum() {
    if (albumManager) {
        albumManager.setActiveAlbum();
    }
}

function deleteFile(category, index) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este arquivo?\n\nEsta ação não pode ser desfeita.')) return;
    
    try {
        const fileName = radioState.playlists[category][index]?.name || 'arquivo';
        
        radioState.playlists[category].splice(index, 1);
        
        if (fileManager) {
            fileManager.saveData();
            fileManager.refreshFilesList();
        }
        
        if (notificationManager) {
            notificationManager.success(`🗑️ Arquivo "${fileName}" excluído!`);
        }
    } catch (error) {
        console.error('Erro ao excluir arquivo:', error);
        if (notificationManager) {
            notificationManager.error('❌ Erro ao excluir arquivo');
        }
    }
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este arquivo?\n\nEsta ação não pode ser desfeita.')) return;
    
    try {
        const fileName = radioState.playlists.albums[albumKey][index]?.name || 'arquivo';
        
        radioState.playlists.albums[albumKey].splice(index, 1);
        
        if (fileManager) {
            fileManager.saveData();
            fileManager.refreshFilesList();
        }
        
        if (notificationManager) {
            notificationManager.success(`🗑️ Arquivo "${fileName}" excluído do álbum!`);
        }
    } catch (error) {
        console.error('Erro ao excluir arquivo do álbum:', error);
        if (notificationManager) {
            notificationManager.error('❌ Erro ao excluir arquivo');
        }
    }
}

function previewFile(url) {
    try {
        const audio = new Audio(url);
        audio.volume = 0.3;
        audio.play().then(() => {
            if (notificationManager) {
                notificationManager.info('🎵 Prévia do arquivo (3 segundos)');
            }
            setTimeout(() => {
                audio.pause();
                audio.currentTime = 0;
            }, 3000);
        }).catch(() => {
            if (notificationManager) {
                notificationManager.error('❌ Erro ao reproduzir prévia');
            }
        });
    } catch (error) {
        console.error('Erro na prévia:', error);
    }
}

// Gerenciamento de capas
function openCoverModal(albumKey) {
    const coverAlbumName = safeGetElement('coverAlbumName');
    const coverModal = safeGetElement('coverModal');
    
    if (coverAlbumName) {
        coverAlbumName.textContent = albumData[albumKey].title;
    }
    if (coverModal) {
        coverModal.dataset.albumKey = albumKey;
        coverModal.style.display = 'flex';
    }
}

async function uploadCover() {
    const coverModal = safeGetElement('coverModal');
    const coverUpload = safeGetElement('coverUpload');
    
    if (!coverModal || !coverUpload) return;
    
    const albumKey = coverModal.dataset.albumKey;
    const file = coverUpload.files[0];
    
    if (!file) {
        if (notificationManager) {
            notificationManager.error('❌ Selecione uma imagem!');
        }
        return;
    }
    
    showLoading(true, 'Enviando capa...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', 'radio-louro/covers');
        
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Erro no upload da imagem');
        
        const data = await response.json();
        radioState.albumCovers[albumKey] = data.secure_url;
        
        if (fileManager) fileManager.saveData();
        if (albumManager) {
            albumManager.setupCoversGrid();
            albumManager.updateAlbumDisplay();
        }
        
        closeModal('coverModal');
        if (notificationManager) {
            notificationManager.success('🖼️ Capa alterada com sucesso!');
        }
        
    } catch (error) {
        console.error('Erro no upload da capa:', error);
        if (notificationManager) {
            notificationManager.error('❌ Erro ao alterar a capa');
        }
    } finally {
        showLoading(false);
    }
}

function removeCover() {
    const coverModal = safeGetElement('coverModal');
    if (!coverModal) return;
    
    const albumKey = coverModal.dataset.albumKey;
    
    if (!radioState.albumCovers[albumKey]) {
        if (notificationManager) {
            notificationManager.error('❌ Não há capa para remover!');
        }
        return;
    }
    
    if (!confirm('⚠️ Tem certeza que deseja remover esta capa?')) return;
    
    delete radioState.albumCovers[albumKey];
    
    if (fileManager) fileManager.saveData();
    if (albumManager) {
        albumManager.setupCoversGrid();
        albumManager.updateAlbumDisplay();
    }
    
    closeModal('coverModal');
    if (notificationManager) {
        notificationManager.success('🗑️ Capa removida!');
    }
}

// ================================
// RELATÓRIOS E ESTATÍSTICAS
// ================================
function refreshReports() {
    const reportList = safeGetElement('reportList');
    if (!reportList) return;
    
    try {
        if (Object.keys(radioState.playHistory).length === 0) {
            reportList.innerHTML = `
                <div style="text-align: center; color: #a0a0a0; padding: 40px;">
                    <h4>📊 Nenhuma estatística ainda</h4>
                    <p>As músicas reproduzidas aparecerão aqui automaticamente</p>
                </div>
            `;
            return;
        }
        
        const sortedHistory = Object.entries(radioState.playHistory)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 50);
        
        reportList.innerHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                <h4 style="color: #4facfe; margin-bottom: 10px;">📈 Estatísticas Gerais</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; font-size: 0.9rem;">
                    <div><strong style="color: #ff6b7a;">Total:</strong> ${radioState.playCount}</div>
                    <div><strong style="color: #ff6b7a;">Hoje:</strong> ${radioState.dailyPlayCount}</div>
                    <div><strong style="color: #ff6b7a;">Únicas:</strong> ${Object.keys(radioState.playHistory).length}</div>
                    <div><strong style="color: #ff6b7a;">Uptime:</strong> ${liveRadio ? liveRadio.formatUptime(radioState.totalUptime) : '00:00:00'}</div>
                </div>
            </div>
            <h4 style="color: #4facfe; margin-bottom: 15px;">🎵 Top Músicas</h4>
            ${sortedHistory.map(([track, count], index) => `
                <div class="report-item">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="color: #666; font-weight: bold; min-width: 30px;">#${index + 1}</span>
                        <span class="track-name">${track}</span>
                    </div>
                    <span class="play-count">${count}x</span>
                </div>
            `).join('')}
        `;
    } catch (error) {
        console.error('Erro ao atualizar relatórios:', error);
        reportList.innerHTML = '<p style="color: #ff6b7a;">❌ Erro ao carregar relatórios</p>';
    }
}

function exportReports() {
    try {
        const data = {
            timestamp: new Date().toISOString(),
            stats: {
                totalPlays: radioState.playCount,
                dailyPlays: radioState.dailyPlayCount,
                uniqueTracks: Object.keys(radioState.playHistory).length,
                uptime: radioState.totalUptime
            },
            playHistory: radioState.playHistory,
            recentTracks: radioState.recentTracks
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `radio-relatorio-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (notificationManager) {
            notificationManager.success('📥 Relatório exportado!');
        }
        
    } catch (error) {
        console.error('Erro ao exportar:', error);
        if (notificationManager) {
            notificationManager.error('❌ Erro ao exportar');
        }
    }
}

function resetPlayCount() {
    if (!confirm('⚠️ ATENÇÃO!\n\nIsto irá resetar TODAS as estatísticas. Tem certeza?')) return;
    
    radioState.playHistory = {};
    radioState.playCount = 0;
    radioState.dailyPlayCount = 0;
    radioState.recentTracks = [];
    
    if (fileManager) fileManager.saveData();
    refreshReports();
    
    if (liveRadio) {
        liveRadio.updateStatsDisplay();
        liveRadio.updateRecentTracksDisplay();
    }
    
    if (notificationManager) {
        notificationManager.success('🗑️ Estatísticas resetadas!');
    }
}

// ================================
// FUNÇÕES DE CONTROLE MANUAL (ADMIN)
// ================================
function forceNextTrack() {
    if (liveRadio) {
        liveRadio.forceNext();
    }
}

function forceTimeAnnouncement() {
    if (liveRadio) {
        liveRadio.forceTimeAnnouncement();
    }
}

function forceAd() {
    if (liveRadio) {
        liveRadio.forceAd();
    }
}

function restartTransmission() {
    if (!confirm('🔄 Tem certeza que deseja reiniciar a transmissão?')) return;
    
    if (liveRadio) {
        liveRadio.restartTransmission();
    }
}

// ================================
// FUNÇÕES UTILITÁRIAS
// ================================
function showLoading(show, text = 'Carregando...') {
    const loadingOverlay = safeGetElement('loadingOverlay');
    const loadingText = safeGetElement('loadingText');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    if (show && loadingText) {
        loadingText.textContent = text;
    }
}

function closeModal(modalId) {
    const modal = safeGetElement(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Limpar campos específicos
    if (modalId === 'passwordModal') {
        const adminPassword = safeGetElement('adminPassword');
        if (adminPassword) adminPassword.value = '';
    }
    if (modalId === 'coverModal') {
        const coverUpload = safeGetElement('coverUpload');
        if (coverUpload) coverUpload.value = '';
    }
}

// Adicionar músicas de exemplo para teste (descomente se quiser testar)
function addSampleTracks() {
    if (radioState.playlists.music.length === 0) {
        console.log('📻 Adicionando faixas de exemplo...');
        
        const sampleTracks = [
            {
                name: '🎵 Música de Exemplo 1',
                url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                publicId: 'sample1',
                uploadedAt: new Date().toISOString()
            },
            {
                name: '🎵 Música de Exemplo 2',
                url: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav',
                publicId: 'sample2',
                uploadedAt: new Date().toISOString()
            }
        ];
        
        radioState.playlists.music = sampleTracks;
        
        if (fileManager) {
            fileManager.saveData();
        }
        
        console.log('✅ Faixas de exemplo adicionadas');
        
        if (notificationManager) {
            notificationManager.info('🎵 Músicas de exemplo adicionadas');
        }
    }
}

// Simulação de ouvintes
function simulateListenerCount() {
    const listenersCount = safeGetElement('listenersCount');
    if (listenersCount) {
        const baseCount = 12;
        const variation = Math.floor(Math.random() * 8) - 4;
        const count = Math.max(1, baseCount + variation);
        listenersCount.textContent = `🎧 ${count} ouvintes online`;
    }
}

// ================================
// TRATAMENTO DE ERROS E CLEANUP
// ================================
window.addEventListener('error', (e) => {
    console.error('❌ Erro global:', e.error);
    
    // Tentar recuperar transmissão se necessário
    if (radioState.isLive && liveRadio && !liveRadio.isTransmitting) {
        setTimeout(() => {
            console.log('🔄 Tentando recuperar...');
            if (liveRadio) liveRadio.restartTransmission();
        }, 3000);
    }
});

window.addEventListener('beforeunload', () => {
    if (fileManager) {
        fileManager.saveData();
    }
    console.log('📻 Salvando estado...');
});

// ================================
// INICIALIZAÇÃO FINAL SEGURA
// ================================
function startRadioSystem() {
    try {
        console.log('🎵 Iniciando Sistema de Rádio AO VIVO 24h...');
        console.log('📻 Versão: 2.0 SEGURA - Transmissão Contínua');
        
        // Aguardar DOM estar pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(safeInitializeRadio, 1000);
            });
        } else {
            setTimeout(safeInitializeRadio, 1000);
        }
        
        // Iniciar recursos extras após carregamento
        setTimeout(() => {
            simulateListenerCount();
            setInterval(simulateListenerCount, 45000);
        }, 10000);
        
    } catch (error) {
        console.error('❌ Erro crítico no sistema:', error);
        
        // Fallback: tentar novamente
        setTimeout(() => {
            console.log('🔄 Tentativa de recuperação do sistema...');
            startRadioSystem();
        }, 5000);
    }
}

// INICIALIZAR O SISTEMA
startRadioSystem();

console.log('✅ Sistema de Rádio AO VIVO 24h carregado com segurança!');
console.log('🔴 Aguardando inicialização completa...');// 🔴 RÁDIO SUPERMERCADO DO LOURO - TRANSMISSÃO AO VIVO 24h
// ============================================================
// VERSÃO CORRIGIDA - SEM TRAVAMENTO

console.log('🚀 Carregando Sistema de Rádio AO VIVO 24h...');

// Configuração da Cloudinary
const CLOUDINARY_CONFIG = {
    cloudName: 'dygbrcrr6',
    apiKey: '853591251513134',
    apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
    uploadPreset: 'radio_preset'
};

// Estado da Rádio AO VIVO
let radioState = {
    // Transmissão
    isLive: true,                    // SEMPRE AO VIVO
    autoPlay: true,                  // Reprodução automática
    isMuted: false,                  // Estado do mute
    
    // Música atual
    currentTrack: null,
    volume: 70,
    
    // Estatísticas
    playCount: 0,
    dailyPlayCount: 0,
    totalUptime: 0,
    sessionStartTime: Date.now(),
    
    // Controle de programação
    activeAlbum: null,
    tracksSinceTime: 0,
    tracksSinceAd: 0,
    lastTimeCheck: 0,
    
    // Configurações
    enableTimeAnnouncements: true,
    enableAds: true,
    
    // Playlists
    playlists: {
        music: [],
        time: [],
        ads: [],
        albums: { natal: [], pascoa: [], saojoao: [], carnaval: [] }
    },
    
    // Histórico e capas
    playHistory: {},
    recentTracks: [],
    albumCovers: { general: null }
};

// Dados dos álbuns
const albumData = {
    general: { title: '📻 Rádio AO VIVO 24h', description: 'Transmissão contínua' },
    natal: { title: '🎄 Natal', description: 'Músicas natalinas' },
    pascoa: { title: '🐰 Páscoa', description: 'Celebrando a ressurreição' },
    saojoao: { title: '🎪 São João', description: 'Forró e festa junina' },
    carnaval: { title: '🎭 Carnaval', description: 'Marchinha e alegria' }
};

// Cache de elementos DOM
let elements = {};
let isInitialized = false;

// Instâncias dos gerenciadores
let liveRadio, fileManager, albumManager, notificationManager;

// ================================
// VERIFICAÇÃO SEGURA DE ELEMENTOS
// ================================
function safeGetElement(id, required = false) {
    try {
        const element = document.getElementById(id);
        if (!element && required) {
            console.warn(`⚠️ Elemento obrigatório não encontrado: ${id}`);
        }
        return element;
    } catch (error) {
        console.error(`❌ Erro ao buscar elemento ${id}:`, error);
        return null;
    }
}

// ================================
// SISTEMA DE NOTIFICAÇÕES SEGURO
// ================================
class SafeNotificationManager {
    constructor() {
        this.container = safeGetElement('notifications');
        this.fallbackConsole = !this.container;
    }
    
    show(message, type = 'info', duration = 5000) {
        try {
            if (this.fallbackConsole) {
                console.log(`${type.toUpperCase()}: ${message}`);
                return;
            }
            
            if (!this.container) return;
            
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer;">×</button>
                </div>
            `;
            
            this.container.appendChild(notification);
            
            // Auto remover
            setTimeout(() => {
                if (notification && notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        } catch (error) {
            console.error('Erro na notificação:', error);
        }
    }
    
    success(message) { this.show(message, 'success'); }
    error(message) { this.show(message, 'error'); }
    info(message) { this.show(message, 'info'); }
}

// ================================
// RÁDIO AO VIVO 24h - CLASSE PRINCIPAL SEGURA
// ================================
class SafeLiveRadio24h {
    constructor() {
        this.intervals = {
            transmission: null,
            timeCheck: null,
            uptime: null,
            heartbeat: null
        };
        
        this.isTransmitting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        // Inicialização segura
        setTimeout(() => this.safeInit(), 1000);
    }
    
    safeInit() {
        try {
            console.log('🔴 Inicializando sistema de transmissão...');
            
            this.setupAudioEvents();
            this.startTransmission();
            this.startUptimeCounter();
            this.startHeartbeat();
            this.setupAutoReconnect();
            
            console.log('✅ Sistema de transmissão inicializado!');
            
            if (notificationManager) {
                notificationManager.success('🔴 Rádio AO VIVO iniciada!');
            }
        } catch (error) {
            console.error('❌ Erro na inicialização da rádio:', error);
            this.handleInitError(error);
        }
    }
    
    handleInitError(error) {
        console.log('🔄 Tentando recuperar da inicialização...');
        
        setTimeout(() => {
            try {
                this.safeInit();
            } catch (retryError) {
                console.error('❌ Erro na recuperação:', retryError);
                if (notificationManager) {
                    notificationManager.error('❌ Erro ao inicializar rádio - Verifique console');
                }
            }
        }, 5000);
    }
    
    setupAudioEvents() {
        const audioPlayer = safeGetElement('audioPlayer');
        if (!audioPlayer) {
            console.warn('⚠️ AudioPlayer não encontrado');
            return;
        }
        
        try {
            audioPlayer.addEventListener('ended', () => {
                console.log('🎵 Música terminou, próxima...');
                this.playNext();
            });
            
            audioPlayer.addEventListener('error', (e) => {
                console.error('❌ Erro no áudio:', e);
                this.handleAudioError();
            });
            
            audioPlayer.addEventListener('canplay', () => {
                if (radioState.isLive && !radioState.isMuted) {
                    this.attemptAutoplay();
                }
            });
            
            audioPlayer.addEventListener('play', () => {
                this.updateTransmissionStatus(true);
            });
            
            audioPlayer.addEventListener('pause', () => {
                if (!radioState.isMuted) {
                    this.updateTransmissionStatus(false);
                }
            });
            
            console.log('✅ Eventos de áudio configurados');
            
        } catch (error) {
            console.error('❌ Erro ao configurar eventos de áudio:', error);
        }
    }
    
    async attemptAutoplay() {
        const audioPlayer = safeGetElement('audioPlayer');
        if (!audioPlayer) return;
        
        try {
            await audioPlayer.play();
            console.log('✅ Autoplay bem-sucedido');
            this.reconnectAttempts = 0;
        } catch (error) {
            console.warn('⚠️ Autoplay bloqueado:', error.message);
            this.showAutoplayPrompt();
        }
    }
    
    showAutoplayPrompt() {
        if (notificationManager) {
            notificationManager.info('🔊 Clique em qualquer lugar para ativar o áudio da rádio', 'info', 10000);
        }
        
        const enableAudio = async () => {
            const audioPlayer = safeGetElement('audioPlayer');
            if (radioState.isLive && audioPlayer) {
                try {
                    await audioPlayer.play();
                    if (notification
