                // Restaurar dados salvos
                radioState.playlists = data.playlists || radioState.playlists;
                radioState.playHistory = data.playHistory || {};
                radioState.albumCovers = data.albumCovers || { general: null };
                radioState.activeAlbum = data.activeAlbum || null;
                radioState.volume = data.volume || 70;
                radioState.enableTimeAnnouncements = data.enableTimeAnnouncements ?? true;
                radioState.enableAds = data.enableAds ?? true;
                
                console.log('✅ Dados carregados do localStorage');
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        }
    }
}

// ================================
// GERENCIADOR DE ÁLBUNS
// ================================
class RadioAlbumManager {
    setupCoversGrid() {
        if (!elements.coversGrid) return;
        
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
        
        elements.coversGrid.innerHTML = html;
    }
    
    setActiveAlbum() {
        if (!elements.activeAlbumSelect) return;
        
        const selectedAlbum = elements.activeAlbumSelect.value;
        const previousAlbum = radioState.activeAlbum;
        
        radioState.activeAlbum = selectedAlbum || null;
        
        // Salvar configuração
        if (fileManager) {
            fileManager.saveData();
        }
        
        // Atualizar interface
        this.updateAlbumDisplay();
        
        // Notificar mudança
        const message = selectedAlbum ? 
            `🎵 Álbum "${albumData[selectedAlbum].title}" ativado! A rádio tocará apenas este álbum.` : 
            '📻 Álbum desativado. A rádio voltou para a playlist geral.';
        
        notificationManager.success(message);
        
        // Log
        console.log(selectedAlbum ? 
            `📻 Álbum ativo: ${albumData[selectedAlbum].title}` : 
            '📻 Playlist geral ativa'
        );
        
        // Se mudou o álbum e há música tocando, pode trocar a próxima
        if (previousAlbum !== selectedAlbum && radioState.currentTrack) {
            console.log('🔄 Álbum mudou, próxima música será do novo álbum');
        }
    }
    
    updateAlbumDisplay() {
        if (!elements.albumCover || !elements.albumTitle) return;
        
        try {
            if (radioState.activeAlbum && albumData[radioState.activeAlbum]) {
                const album = albumData[radioState.activeAlbum];
                const coverUrl = radioState.albumCovers[radioState.activeAlbum] || 
                    `https://via.placeholder.com/300x300/333/fff?text=${encodeURIComponent(album.title)}`;
                
                elements.albumCover.src = coverUrl;
                elements.albumTitle.textContent = album.title;
            } else {
                const coverUrl = radioState.albumCovers.general || 
                    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
                
                elements.albumCover.src = coverUrl;
                elements.albumTitle.textContent = albumData.general.title;
            }
            
            if (elements.activeAlbumSelect) {
                elements.activeAlbumSelect.value = radioState.activeAlbum || '';
            }
        } catch (error) {
            console.error('Erro ao atualizar display do álbum:', error);
        }
    }
}

// ================================
// INICIALIZAÇÃO E SETUP
// ================================
function initElements() {
    try {
        const elementIds = [
            // Player principal
            'audioPlayer', 'muteBtn', 'skipBtn', 'reloadBtn', 'volumeSlider', 'volumeValue',
            'albumCover', 'trackCover', 'albumTitle', 'currentTrack', 'trackTime',
            'liveStatus', 'playStatus', 'trackCount', 'uptime', 'listenersCount',
            'recentList',
            
            // Modos
            'playerMode', 'adminMode',
            
            // Admin
            'adminBtn', 'backToPlayerBtn', 'toggleBroadcast', 'broadcastIcon', 'broadcastText',
            'adminBroadcastStatus', 'playlistStatus', 'nextAction', 'dailyStats',
            'activeAlbumSelect', 'enableTimeAnnouncements', 'enableAds',
            'coversGrid', 'reportList',
            
            // Modais
            'passwordModal', 'adminPassword', 'coverModal', 'coverAlbumName', 'coverUpload',
            'loadingOverlay', 'loadingText'
        ];
        
        elements = {};
        let missing = [];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                elements[id] = element;
            } else {
                missing.push(id);
            }
        });
        
        if (missing.length > 0) {
            console.warn('⚠️ Elementos não encontrados:', missing);
        }
        
        // Verificar elementos críticos
        const critical = ['audioPlayer', 'muteBtn', 'currentTrack'];
        const missingCritical = critical.filter(id => !elements[id]);
        
        if (missingCritical.length > 0) {
            console.error('❌ Elementos críticos não encontrados:', missingCritical);
            return false;
        }
        
        console.log('✅ Elementos inicializados:', Object.keys(elements).length);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao inicializar elementos:', error);
        return false;
    }
}

function setupEventListeners() {
    try {
        // Controles principais
        if (elements.muteBtn) {
            elements.muteBtn.addEventListener('click', () => {
                if (liveRadio) liveRadio.toggleMute();
            });
        }
        
        if (elements.skipBtn) {
            elements.skipBtn.addEventListener('click', () => {
                if (liveRadio) liveRadio.forceNext();
            });
        }
        
        if (elements.reloadBtn) {
            elements.reloadBtn.addEventListener('click', () => {
                if (liveRadio) {
                    liveRadio.restartTransmission();
                }
            });
        }
        
        if (elements.volumeSlider) {
            elements.volumeSlider.addEventListener('input', updateVolume);
        }
        
        // Admin
        if (elements.adminBtn) {
            elements.adminBtn.addEventListener('click', openPasswordModal);
        }
        
        if (elements.backToPlayerBtn) {
            elements.backToPlayerBtn.addEventListener('click', showPlayerMode);
        }
        
        if (elements.toggleBroadcast) {
            elements.toggleBroadcast.addEventListener('click', toggleBroadcast);
        }
        
        if (elements.adminPassword) {
            elements.adminPassword.addEventListener('keypress', e => {
                if (e.key === 'Enter') checkPassword();
            });
        }
        
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => switchTab(e.target.dataset.tab));
        });
        
        // Checkboxes de configuração
        if (elements.enableTimeAnnouncements) {
            elements.enableTimeAnnouncements.addEventListener('change', (e) => {
                radioState.enableTimeAnnouncements = e.target.checked;
                fileManager.saveData();
                notificationManager.info(e.target.checked ? 
                    '🕐 Anúncios de hora ativados' : 
                    '🕐 Anúncios de hora desativados'
                );
            });
        }
        
        if (elements.enableAds) {
            elements.enableAds.addEventListener('change', (e) => {
                radioState.enableAds = e.target.checked;
                fileManager.saveData();
                notificationManager.info(e.target.checked ? 
                    '📢 Avisos comerciais ativados' : 
                    '📢 Avisos comerciais desativados'
                );
            });
        }
        
        console.log('✅ Event listeners configurados');
        
    } catch (error) {
        console.error('❌ Erro ao configurar listeners:', error);
    }
}

function initializeRadio() {
    if (isInitialized) {
        console.warn('⚠️ Rádio já inicializada');
        return;
    }
    
    console.log('🚀 Iniciando Sistema de Rádio AO VIVO 24h...');
    
    if (!initElements()) {
        console.error('❌ Falha na inicialização dos elementos');
        setTimeout(initializeRadio, 2000); // Tentar novamente
        return;
    }
    
    isInitialized = true;
    
    // Inicializar gerenciadores
    notificationManager = new NotificationManager();
    fileManager = new RadioFileManager();
    albumManager = new RadioAlbumManager();
    
    // Carregar dados salvos
    fileManager.loadData();
    
    // Configurar volume inicial
    if (elements.audioPlayer && elements.volumeSlider && elements.volumeValue) {
        elements.audioPlayer.volume = radioState.volume / 100;
        elements.volumeSlider.value = radioState.volume;
        elements.volumeValue.textContent = radioState.volume + '%';
    }
    
    // Configurar checkboxes
    if (elements.enableTimeAnnouncements) {
        elements.enableTimeAnnouncements.checked = radioState.enableTimeAnnouncements;
    }
    if (elements.enableAds) {
        elements.enableAds.checked = radioState.enableAds;
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Inicializar rádio AO VIVO (principal)
    liveRadio = new LiveRadio24h();
    
    // Atualizar interfaces
    albumManager.updateAlbumDisplay();
    fileManager.refreshFilesList();
    
    console.log('✅ Sistema de Rádio AO VIVO 24h inicializado!');
    notificationManager.success('🔴 Sistema de Rádio AO VIVO inicializado!');
}

// ================================
// FUNÇÕES DE CONTROLE DA INTERFACE
// ================================
function updateVolume() {
    if (!elements.volumeSlider || !elements.audioPlayer || !elements.volumeValue) return;
    
    const volume = parseInt(elements.volumeSlider.value);
    radioState.volume = volume;
    elements.audioPlayer.volume = volume / 100;
    elements.volumeValue.textContent = volume + '%';
    
    if (fileManager) {
        fileManager.saveData();
    }
}

function toggleBroadcast() {
    if (!liveRadio) return;
    
    if (radioState.isLive) {
        liveRadio.stopTransmission();
        elements.broadcastIcon.textContent = '▶️';
        elements.broadcastText.textContent = 'INICIAR TRANSMISSÃO';
    } else {
        liveRadio.startTransmission();
        elements.broadcastIcon.textContent = '🔴';
        elements.broadcastText.textContent = 'PAUSAR TRANSMISSÃO';
    }
}

// Admin Panel
function openPasswordModal() {
    if (elements.passwordModal) {
        elements.passwordModal.style.display = 'flex';
        if (elements.adminPassword) {
            elements.adminPassword.focus();
        }
    }
}

function checkPassword() {
    if (!elements.adminPassword) return;
    
    const password = elements.adminPassword.value.trim();
    
    if (password === 'admin123') {
        closeModal('passwordModal');
        showAdminMode();
        notificationManager.success('🔑 Acesso administrativo autorizado');
    } else {
        notificationManager.error('❌ Senha incorreta!');
        elements.adminPassword.value = '';
        elements.adminPassword.focus();
    }
}

function showAdminMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'none';
    if (elements.adminMode) elements.adminMode.style.display = 'block';
    
    // Atualizar dados administrativos
    if (fileManager) fileManager.refreshFilesList();
    refreshReports();
    if (albumManager) albumManager.setupCoversGrid();
    updateScheduleInfo();
}

function showPlayerMode() {
    if (elements.playerMode) elements.playerMode.style.display = 'flex';
    if (elements.adminMode) elements.adminMode.style.display = 'none';
}

function switchTab(tabName) {
    // Remove active de todos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
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
}

function updateScheduleInfo() {
    // Próximo anúncio de hora
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    if (elements.nextTimeCheck) {
        elements.nextTimeCheck.textContent = radioState.enableTimeAnnouncements ? 
            `Próxima: ${nextHour.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` :
            'Desabilitado';
    }
    
    // Próximo aviso
    if (elements.nextAd) {
        const nextAdTracks = Math.max(0, liveRadio ? liveRadio.getAdInterval() - radioState.tracksSinceAd : 0);
        elements.nextAd.textContent = radioState.enableAds ? 
            `Próximo em: ${nextAdTracks} músicas` :
            'Desabilitado';
    }
    
    // Próxima ação
    if (elements.nextAction) {
        let nextAction = 'Música aleatória';
        
        if (radioState.tracksSinceTime >= 999 && radioState.playlists.time.length > 0) {
            nextAction = '🕐 Hora certa';
        } else if (radioState.enableAds && radioState.tracksSinceAd >= (liveRadio ? liveRadio.getAdInterval() : 5) && radioState.playlists.ads.length > 0) {
            nextAction = '📢 Aviso comercial';
        } else if (radioState.activeAlbum) {
            nextAction = `🎵 Música do álbum ${albumData[radioState.activeAlbum].title}`;
        }
        
        elements.nextAction.textContent = nextAction;
    }
}

// ================================
// FUNÇÕES DE UPLOAD E GERENCIAMENTO
// ================================
function uploadFiles(category) {
    const albumType = category === 'album' ? document.getElementById('albumSelect')?.value : '';
    if (fileManager) {
        fileManager.uploadFiles(category, albumType);
    }
}

function setActiveAlbum() {
    if (albumManager) {
        albumManager.setActiveAlbum();
    }
}

function deleteFile(category, index) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este arquivo?\n\nEsta ação não pode ser desfeita.')) return;
    
    const fileName = radioState.playlists[category][index]?.name || 'arquivo';
    
    radioState.playlists[category].splice(index, 1);
    
    if (fileManager) {
        fileManager.saveData();
        fileManager.refreshFilesList();
    }
    
    notificationManager.success(`🗑️ Arquivo "${fileName}" excluído com sucesso!`);
}

function deleteAlbumFile(albumKey, index) {
    if (!confirm('⚠️ Tem certeza que deseja excluir este arquivo?\n\nEsta ação não pode ser desfeita.')) return;
    
    const fileName = radioState.playlists.albums[albumKey][index]?.name || 'arquivo';
    
    radioState.playlists.albums[albumKey].splice(index, 1);
    
    if (fileManager) {
        fileManager.saveData();
        fileManager.refreshFilesList();
    }
    
    notificationManager.success(`🗑️ Arquivo "${fileName}" excluído do álbum!`);
}

function previewFile(url) {
    const audio = new Audio(url);
    audio.volume = 0.3; // Volume baixo para prévia
    audio.play().then(() => {
        notificationManager.info('🎵 Prévia do arquivo (3 segundos)');
        setTimeout(() => {
            audio.pause();
            audio.currentTime = 0;
        }, 3000);
    }).catch((error) => {
        notificationManager.error('❌ Erro ao reproduzir prévia');
        console.error('Erro na prévia:', error);
    });
}

// Gerenciamento de capas
function openCoverModal(albumKey) {
    if (elements.coverAlbumName) {
        elements.coverAlbumName.textContent = albumData[albumKey].title;
    }
    if (elements.coverModal) {
        elements.coverModal.dataset.albumKey = albumKey;
        elements.coverModal.style.display = 'flex';
    }
}

async function uploadCover() {
    const albumKey = elements.coverModal.dataset.albumKey;
    const file = elements.coverUpload.files[0];
    
    if (!file) {
        notificationManager.error('❌ Selecione uma imagem!');
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
        notificationManager.success('🖼️ Capa alterada com sucesso!');
        
    } catch (error) {
        console.error('Erro no upload da capa:', error);
        notificationManager.error('❌ Erro ao alterar a capa. Tente novamente.');
    } finally {
        showLoading(false);
    }
}

function removeCover() {
    const albumKey = elements.coverModal.dataset.albumKey;
    
    if (!radioState.albumCovers[albumKey]) {
        notificationManager.error('❌ Não há capa para remover!');
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
    notificationManager.success('🗑️ Capa removida com sucesso!');
}

// ================================
// RELATÓRIOS E ESTATÍSTICAS
// ================================
function refreshReports() {
    if (!elements.reportList) return;
    
    if (Object.keys(radioState.playHistory).length === 0) {
        elements.reportList.innerHTML = `
            <div style="text-align: center; color: #a0a0a0; padding: 40px;">
                <h4>📊 Nenhuma estatística ainda</h4>
                <p>As músicas reproduzidas aparecerão aqui automaticamente</p>
            </div>
        `;
        return;
    }
    
    const sortedHistory = Object.entries(radioState.playHistory)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 50); // Top 50
    
    elements.reportList.innerHTML = `
        <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px;">
            <h4 style="color: #4facfe; margin-bottom: 10px;">📈 Estatísticas Gerais</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; font-size: 0.9rem;">
                <div><strong style="color: #ff6b7a;">Total de reproduções:</strong> ${radioState.playCount}</div>
                <div><strong style="color: #ff6b7a;">Hoje:</strong> ${radioState.dailyPlayCount}</div>
                <div><strong style="color: #ff6b7a;">Músicas únicas:</strong> ${Object.keys(radioState.playHistory).length}</div>
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
            recentTracks: radioState.recentTracks,
            configuration: {
                activeAlbum: radioState.activeAlbum,
                enableTimeAnnouncements: radioState.enableTimeAnnouncements,
                enableAds: radioState.enableAds
            }
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
        
        notificationManager.success('📥 Relatório exportado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao exportar relatórios:', error);
        notificationManager.error('❌ Erro ao exportar relatório');
    }
}

function resetPlayCount() {
    if (!confirm('⚠️ ATENÇÃO!\n\nIsto irá resetar TODAS as estatísticas:\n• Histórico de reprodução\n• Contadores de música\n• Dados de relatórios\n\nTem certeza que deseja continuar?')) return;
    
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
    
    notificationManager.success('🗑️ Todas as estatísticas foram resetadas!');
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
    if (!confirm('🔄 Tem certeza que deseja reiniciar a transmissão?\n\nIsto irá interromper temporariamente o áudio.')) return;
    
    if (liveRadio) {
        liveRadio.restartTransmission();
    }
}

// ================================
// FUNÇÕES UTILITÁRIAS
// ================================
function showLoading(show, text = 'Carregando...') {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
    if (show && elements.loadingText) {
        elements.loadingText.textContent = text;
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Limpar campos específicos
    if (modalId === 'passwordModal' && elements.adminPassword) {
        elements.adminPassword.value = '';
    }
    if (modalId === 'coverModal' && elements.coverUpload) {
        elements.coverUpload.value = '';
    }
}

// ================================
// TRATAMENTO DE ERROS E CLEANUP
// ================================
window.addEventListener('error', (e) => {
    console.error('❌ Erro global capturado:', e.error);
    
    // Notificar erro crítico
    if (notificationManager) {
        notificationManager.error('⚠️ Erro detectado - Sistema tentando recuperar...');
    }
    
    // Tentar recuperar transmissão se necessário
    if (radioState.isLive && liveRadio && !liveRadio.isTransmitting) {
        setTimeout(() => {
            console.log('🔄 Tentando recuperar transmissão após erro...');
            liveRadio.restartTransmission();
        }, 5000);
    }
});

window.addEventListener('beforeunload', () => {
    if (fileManager) {
        fileManager.saveData();
    }
    console.log('📻 Salvando estado da rádio...');
});

// Cleanup ao sair
window.addEventListener('unload', () => {
    if (liveRadio && liveRadio.intervals) {
        Object.values(liveRadio.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
    }
});

// ================================
// INICIALIZAÇÃO PRINCIPAL
// ================================
function safeInitialization() {
    try {
        // Verificar estado do DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeRadio);
            return;
        }
        
        // Verificar elementos críticos antes de inicializar
        const criticalElements = ['audioPlayer', 'muteBtn', 'currentTrack'];
        const missing = criticalElements.filter(id => !document.getElementById(id));
        
        if (missing.length > 0) {
            console.warn('⚠️ Elementos críticos não encontrados:', missing);
            // Tentar novamente após 2 segundos
            setTimeout(safeInitialization, 2000);
            return;
        }
        
        // Inicializar após pequeno delay para garantir que DOM esteja pronto
        setTimeout(initializeRadio, 500);
        
    // 🔴 RÁDIO SUPERMERCADO DO LOURO - TRANSMISSÃO AO VIVO 24h
// ============================================================

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
// SISTEMA DE NOTIFICAÇÕES
// ================================
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notifications');
    }
    
    show(message, type = 'info', duration = 5000) {
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
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }
    
    success(message) { this.show(message, 'success'); }
    error(message) { this.show(message, 'error'); }
    info(message) { this.show(message, 'info'); }
}

// ================================
// RÁDIO AO VIVO 24h - CLASSE PRINCIPAL
// ================================
class LiveRadio24h {
    constructor() {
        this.intervals = {
            transmission: null,
            timeCheck: null,
            uptime: null,
            heartbeat: null
        };
        
        this.isTransmitting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }
    
    init() {
        console.log('🔴 Iniciando Sistema de Rádio AO VIVO 24h...');
        
        this.setupAudioEvents();
        this.startTransmission();
        this.startUptimeCounter();
        this.startHeartbeat();
        
        // Reconexão automática se necessário
        this.setupAutoReconnect();
        
        console.log('✅ Rádio AO VIVO 24h inicializada!');
    }
    
    setupAudioEvents() {
        if (!elements.audioPlayer) return;
        
        elements.audioPlayer.addEventListener('ended', () => {
            console.log('🎵 Música terminou, tocando próxima...');
            this.playNext();
        });
        
        elements.audioPlayer.addEventListener('error', (e) => {
            console.error('❌ Erro no áudio:', e);
            this.handleAudioError();
        });
        
        elements.audioPlayer.addEventListener('canplay', () => {
            if (radioState.isLive && !radioState.isMuted) {
                this.attemptAutoplay();
            }
        });
        
        elements.audioPlayer.addEventListener('play', () => {
            this.updateTransmissionStatus(true);
        });
        
        elements.audioPlayer.addEventListener('pause', () => {
            if (!radioState.isMuted) {
                this.updateTransmissionStatus(false);
            }
        });
    }
    
    async attemptAutoplay() {
        try {
            await elements.audioPlayer.play();
            console.log('✅ Autoplay bem-sucedido');
            this.reconnectAttempts = 0;
        } catch (error) {
            console.warn('⚠️ Autoplay bloqueado:', error.message);
            this.showAutoplayPrompt();
        }
    }
    
    showAutoplayPrompt() {
        notificationManager.info(`
            <div style="text-align: center;">
                <strong>🔊 Rádio AO VIVO Aguardando</strong><br>
                <small>Clique em qualquer lugar para ativar o áudio</small>
            </div>
        `, 'info', 10000);
        
        const enableAudio = async () => {
            if (radioState.isLive && elements.audioPlayer) {
                try {
                    await elements.audioPlayer.play();
                    notificationManager.success('🎵 Rádio AO VIVO ativada!');
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
            this.checkTimeAnnouncement();
        }, 60000);
        
        // Iniciar primeira música
        setTimeout(() => {
            this.playNext();
        }, 2000);
        
        // Atualizar interface
        this.updateAllStatus();
        
        notificationManager.success('🔴 Transmissão AO VIVO iniciada!');
    }
    
    stopTransmission() {
        console.log('⚫ Parando transmissão...');
        
        radioState.isLive = false;
        this.isTransmitting = false;
        
        // Parar áudio
        if (elements.audioPlayer) {
            elements.audioPlayer.pause();
        }
        
        // Limpar intervalos
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        this.updateAllStatus();
        notificationManager.info('⚫ Transmissão pausada');
    }
    
    restartTransmission() {
        console.log('🔄 Reiniciando transmissão...');
        this.stopTransmission();
        
        setTimeout(() => {
            this.startTransmission();
        }, 2000);
        
        notificationManager.info('🔄 Reiniciando transmissão...');
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
        // Heartbeat para manter a rádio viva
        this.intervals.heartbeat = setInterval(() => {
            if (radioState.isLive && this.isTransmitting) {
                this.checkTransmissionHealth();
            }
        }, 30000); // A cada 30 segundos
    }
    
    checkTransmissionHealth() {
        if (!elements.audioPlayer) return;
        
        const audio = elements.audioPlayer;
        
        // Se não há música tocando há muito tempo, tocar próxima
        if (audio.paused && radioState.isLive && !radioState.isMuted) {
            console.log('💗 Heartbeat: Retomando transmissão...');
            this.playNext();
        }
        
        // Se áudio travou, tentar próxima música
        if (audio.currentTime === 0 && radioState.currentTrack) {
            console.log('💗 Heartbeat: Áudio travado, próxima música...');
            this.playNext();
        }
    }
    
    setupAutoReconnect() {
        // Reconectar se página voltar do background
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && radioState.isLive) {
                console.log('👁️ Página visível, verificando transmissão...');
                
                setTimeout(() => {
                    if (elements.audioPlayer && elements.audioPlayer.paused && !radioState.isMuted) {
                        console.log('🔄 Reconectando transmissão...');
                        this.playNext();
                    }
                }, 1000);
            }
        });
        
        // Reconectar se conexão voltar
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada, verificando transmissão...');
            if (radioState.isLive && !this.isTransmitting) {
                this.restartTransmission();
            }
        });
    }
    
    checkTimeAnnouncement() {
        if (!radioState.enableTimeAnnouncements) return;
        
        const now = new Date();
        const minutes = now.getMinutes();
        
        // Hora certa a cada hora cheia
        if (minutes === 0 && radioState.playlists.time.length > 0) {
            const timeSinceLastTime = Date.now() - (radioState.lastTimeCheck || 0);
            
            // Só toca se passou mais de 55 minutos (evitar repetição)
            if (timeSinceLastTime > 55 * 60 * 1000) {
                console.log('🕐 Hora certa programada!');
                radioState.lastTimeCheck = Date.now();
                radioState.tracksSinceTime = 999; // Força hora certa na próxima
                
                // Tocar após a música atual terminar
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
            elements.audioPlayer.src = nextTrack.url;
            
            // Atualizar interface
            this.updateNowPlaying(nextTrack);
            this.updatePlayHistory(nextTrack);
            this.addToRecentTracks(nextTrack);
            
            // Reproduzir se não estiver mutado
            if (radioState.isLive && !radioState.isMuted) {
                await this.attemptAutoplay();
            }
            
            console.log(`🎵 Tocando: ${nextTrack.name}`);
            
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
        // Intervalo aleatório entre 5-8 músicas para avisos
        return 5 + Math.floor(Math.random() * 4);
    }
    
    scheduleRetry() {
        // Tentar novamente em 30 segundos se não há músicas
        setTimeout(() => {
            if (radioState.isLive) {
                this.playNext();
            }
        }, 30000);
        
        if (elements.currentTrack) {
            elements.currentTrack.textContent = 'Aguardando músicas... Será retomada automaticamente.';
        }
    }
    
    handleAudioError() {
        console.error('🚨 Erro no áudio, tentando recuperar...');
        
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Tentar próxima música após erro
            setTimeout(() => {
                if (radioState.isLive) {
                    this.playNext();
                }
            }, 5000);
            
            notificationManager.error(`⚠️ Erro de áudio - Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        } else {
            // Reiniciar transmissão após muitos erros
            console.log('🔄 Muitos erros, reiniciando transmissão...');
            this.reconnectAttempts = 0;
            this.restartTransmission();
        }
    }
    
    updateNowPlaying(track) {
        if (elements.currentTrack) {
            elements.currentTrack.textContent = track.name;
        }
        
        if (elements.albumTitle) {
            const albumInfo = radioState.activeAlbum && albumData[radioState.activeAlbum] 
                ? albumData[radioState.activeAlbum] 
                : albumData.general;
            elements.albumTitle.textContent = albumInfo.title;
        }
        
        // Atualizar capa se disponível
        this.updateTrackCover(track);
    }
    
    updateTrackCover(track) {
        if (!elements.trackCover || !elements.albumCover) return;
        
        if (track.coverUrl) {
            elements.trackCover.src = track.coverUrl;
            elements.trackCover.style.display = 'block';
            elements.albumCover.style.display = 'none';
        } else {
            elements.trackCover.style.display = 'none';
            elements.albumCover.style.display = 'block';
            
            // Usar capa do álbum ativo ou geral
            const coverUrl = radioState.activeAlbum && radioState.albumCovers[radioState.activeAlbum]
                ? radioState.albumCovers[radioState.activeAlbum]
                : radioState.albumCovers.general || 'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png';
            
            elements.albumCover.src = coverUrl;
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
        
        // Manter apenas últimas 10
        if (radioState.recentTracks.length > 10) {
            radioState.recentTracks = radioState.recentTracks.slice(0, 10);
        }
        
        this.updateRecentTracksDisplay();
    }
    
    updateRecentTracksDisplay() {
        const recentList = document.getElementById('recentList');
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
        
        // Status principal
        if (elements.liveStatus) {
            elements.liveStatus.textContent = status;
            elements.liveStatus.className = radioState.isLive && isPlaying ? 'live' : 'offline';
        }
        
        if (elements.playStatus) {
            elements.playStatus.textContent = status;
        }
        
        // Status admin
        if (elements.adminBroadcastStatus) {
            elements.adminBroadcastStatus.innerHTML = radioState.isLive ? 
                '<div class="live-dot"></div><span>AO VIVO</span>' : 
                '<div class="live-dot" style="background: #666;"></div><span>OFFLINE</span>';
            elements.adminBroadcastStatus.className = `status-indicator ${radioState.isLive ? 'live' : 'offline'}`;
        }
    }
    
    updateStatsDisplay() {
        if (elements.trackCount) {
            elements.trackCount.textContent = radioState.dailyPlayCount.toString();
        }
        
        if (elements.dailyStats) {
            elements.dailyStats.textContent = `${radioState.dailyPlayCount} músicas hoje`;
        }
    }
    
    updateUptimeDisplay() {
        const uptime = this.formatUptime(radioState.totalUptime);
        if (elements.uptime) {
            elements.uptime.textContent = uptime;
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
        this.updateTransmissionStatus(radioState.isLive && !elements.audioPlayer?.paused);
        this.updateStatsDisplay();
        this.updateUptimeDisplay();
        this.updateRecentTracksDisplay();
    }
    
    // Métodos de controle público
    toggleMute() {
        radioState.isMuted = !radioState.isMuted;
        
        if (radioState.isMuted) {
            elements.audioPlayer.pause();
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
        if (elements.muteBtn) {
            const icon = elements.muteBtn.querySelector('.volume-icon');
            if (icon) {
                icon.textContent = radioState.isMuted ? '🔇' : '🔊';
            }
            elements.muteBtn.className = radioState.isMuted ? 'btn-control muted' : 'btn-control';
            elements.muteBtn.title = radioState.isMuted ? 'Ativar áudio' : 'Silenciar áudio';
        }
    }
    
    forceNext() {
        console.log('⏭️ Próxima música forçada pelo usuário');
        this.playNext();
        notificationManager.info('⏭️ Próxima música');
    }
    
    forceTimeAnnouncement() {
        if (radioState.playlists.time.length === 0) {
            notificationManager.error('❌ Nenhum arquivo de hora certa disponível');
            return;
        }
        
        console.log('🕐 Hora certa forçada pelo admin');
        radioState.tracksSinceTime = 999;
        this.playNext();
        notificationManager.info('🕐 Hora certa será tocada');
    }
    
    forceAd() {
        if (radioState.playlists.ads.length === 0) {
            notificationManager.error('❌ Nenhum aviso disponível');
            return;
        }
        
        console.log('📢 Aviso forçado pelo admin');
        radioState.tracksSinceAd = 999;
        this.playNext();
        notificationManager.info('📢 Aviso será tocado');
    }
}

// ================================
// GERENCIADOR DE ARQUIVOS
// ================================
class RadioFileManager {
    async uploadFiles(category, albumType = '') {
        const fileInput = this.getFileInput(category);
        if (!fileInput || fileInput.files.length === 0) {
            notificationManager.error('❌ Selecione pelo menos um arquivo!');
            return;
        }
        
        showLoading(true, 'Enviando arquivos...');
        
        try {
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
            if (radioState.isLive && !radioState.currentTrack) {
                setTimeout(() => liveRadio.playNext(), 1000);
            }
            
            notificationManager.success(`✅ ${files.length} arquivo(s) enviado(s) com sucesso!`);
            
        } catch (error) {
            console.error('Erro no upload:', error);
            notificationManager.error('❌ Erro no upload. Tente novamente.');
        } finally {
            showLoading(false);
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
        const container = document.getElementById(`${category}Files`);
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
        const container = document.getElementById('albumFiles');
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
        if (elements.playlistStatus) {
            const totalMusic = radioState.playlists.music.length;
            const totalAlbumMusic = Object.values(radioState.playlists.albums)
                .reduce((sum, album) => sum + album.length, 0);
            const totalTime = radioState.playlists.time.length;
            const totalAds = radioState.playlists.ads.length;
            
            elements.playlistStatus.innerHTML = `
                <div style="font-size: 0.9rem; color: #a0a0a0;">
                    🎵 ${totalMusic} músicas gerais<br>
                    🎄 ${totalAlbumMusic} músicas de álbuns<br>
                    🕐 ${totalTime} arquivos de hora<br>
                    📢 ${totalAds} avisos
                </div>
            `;
        }
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
            notificationManager.error('⚠️ Erro ao salvar configurações');
        }
    }
    
    loadData() {
        try {
            const stored = localStorage.getItem('radioState');
            if (stored) {
                const data = JSON.parse(stored);
                
                // Restaurar dados salvos
                radioState.playlists = data.playlists || radioState.playlists;
                radio