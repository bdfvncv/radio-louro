// 🎵 APLICAÇÃO PRINCIPAL DA RÁDIO
// =================================

class RadioApp {
    constructor() {
        this.streamManager = null;
        this.adminManager = null;
        this.isInitialized = false;
        this.notificationPermission = 'default';
        
        console.log('🚀 Inicializando Rádio Supermercado do Louro...');
        this.init();
    }
    
    async init() {
        try {
            // Verificar compatibilidade do navegador
            if (!this.checkBrowserCompatibility()) {
                this.showBrowserError();
                return;
            }
            
            // Configurar PWA
            this.setupPWA();
            
            // Solicitar permissões
            await this.requestPermissions();
            
            // Inicializar sistemas
            await this.initializeSystems();
            
            // Configurar eventos globais
            this.setupGlobalEvents();
            
            // Aplicar tema
            this.applyTheme();
            
            // Marcar como inicializado
            this.isInitialized = true;
            
            console.log('✅ Rádio inicializada com sucesso!');
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.showInitializationError(error);
        }
    }
    
    checkBrowserCompatibility() {
        const features = {
            audioContext: typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined',
            fetch: typeof fetch !== 'undefined',
            localStorage: typeof Storage !== 'undefined',
            promises: typeof Promise !== 'undefined',
            es6: typeof Symbol !== 'undefined'
        };
        
        const unsupported = Object.entries(features)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);
        
        if (unsupported.length > 0) {
            console.error('❌ Recursos não suportados:', unsupported);
            return false;
        }
        
        console.log('✅ Navegador compatível');
        return true;
    }
    
    async initializeSystems() {
        // Inicializar gerenciador de stream
        this.streamManager = new LiveStreamManager();
        window.streamManager = this.streamManager;
        
        // Inicializar gerenciador admin
        this.adminManager = new RadioAdminManager();
        window.adminManager = this.adminManager;
        
        // Aguardar inicialização dos sistemas
        await this.waitForSystemsReady();
        
        console.log('🎯 Sistemas inicializados');
    }
    
    async waitForSystemsReady() {
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            if (this.streamManager && this.adminManager) {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            throw new Error('Timeout na inicialização dos sistemas');
        }
    }
    
    setupGlobalEvents() {
        // Eventos de janela
        window.addEventListener('beforeunload', () => this.onBeforeUnload());
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Eventos de rede
        window.addEventListener('online', () => this.onNetworkStatusChange(true));
        window.addEventListener('offline', () => this.onNetworkStatusChange(false));
        
        // Eventos de visibilidade
        document.addEventListener('visibilitychange', () => this.onVisibilityChange());
        
        // Eventos de touch (mobile)
        if (MOBILE_CONFIG.touchOptimized) {
            this.setupMobileEvents();
        }
        
        // Atalhos de teclado
        this.setupKeyboardShortcuts();
        
        // Eventos personalizados
        this.setupCustomEvents();
        
        console.log('🎯 Eventos globais configurados');
    }
    
    setupMobileEvents() {
        let touchStartY = 0;
        let touchEndY = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            touchEndY = e.changedTouches[0].clientY;
            this.handleSwipeGesture(touchStartY, touchEndY);
        }, { passive: true });
        
        // Prevenir zoom duplo-toque
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (event) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }
    
    handleSwipeGesture(startY, endY) {
        const threshold = 50;
        const diff = startY - endY;
        
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                // Swipe up
                this.onSwipeUp();
            } else {
                // Swipe down
                this.onSwipeDown();
            }
        }
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Apenas se não estiver digitando
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    this.adjustVolume(0.1);
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    this.adjustVolume(-0.1);
                    break;
                    
                case 'KeyM':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.toggleMute();
                    }
                    break;
                    
                case 'KeyA':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.adminManager?.showLoginModal();
                    }
                    break;
            }
        });
    }
    
    setupCustomEvents() {
        // Evento personalizado para mudança de música
        document.addEventListener('trackChanged', (e) => {
            this.onTrackChanged(e.detail);
        });
        
        // Evento para mudança de status de stream
        document.addEventListener('streamStatusChanged', (e) => {
            this.onStreamStatusChanged(e.detail);
        });
        
        // Evento para erro de stream
        document.addEventListener('streamError', (e) => {
            this.onStreamError(e.detail);
        });
    }
    
    // === PWA (Progressive Web App) ===
    
    setupPWA() {
        if (!RADIO_CONFIG.pwa.enabled) return;
        
        // Prompt de instalação
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.installPrompt = e;
            
            if (RADIO_CONFIG.pwa.installPrompt) {
                this.showInstallPrompt();
            }
        });
        
        // Detectar quando foi instalado
        window.addEventListener('appinstalled', () => {
            console.log('📱 PWA instalado');
            this.onPWAInstalled();
        });
        
        // Service Worker
        if ('serviceWorker' in navigator) {
            this.registerServiceWorker();
        }
        
        // Media Session API (controles de mídia do sistema)
        this.setupMediaSession();
    }
    
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('🔧 Service Worker registrado:', registration);
            
            // Escutar atualizações
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateAvailable();
                        }
                    });
                }
            });
            
        } catch (error) {
            console.warn('⚠️ Falha ao registrar Service Worker:', error);
        }
    }
    
    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        
        navigator.mediaSession.setActionHandler('play', () => {
            this.streamManager?.play();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
            this.streamManager?.stop();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            this.adminManager?.skipCurrentTrack();
        });
        
        // Atualizar metadata quando trocar de música
        this.updateMediaSessionMetadata();
    }
    
    updateMediaSessionMetadata(track = null) {
        if (!('mediaSession' in navigator)) return;
        
        const defaultMetadata = {
            title: track?.title || 'Transmissão ao Vivo',
            artist: track?.artist || RADIO_CONFIG.radio.name,
            album: 'Rádio Online',
            artwork: [
                {
                    src: 'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png',
                    sizes: '512x512',
                    type: 'image/png'
                }
            ]
        };
        
        navigator.mediaSession.metadata = new MediaMetadata(defaultMetadata);
    }
    
    // === PERMISSÕES ===
    
    async requestPermissions() {
        // Notificações
        if (MOBILE_CONFIG.notifications.enabled && 'Notification' in window) {
            if (Notification.permission === 'default') {
                const permission = await Notification.requestPermission();
                this.notificationPermission = permission;
                
                if (permission === 'granted') {
                    console.log('🔔 Permissão de notificação concedida');
                } else {
                    console.log('🔕 Permissão de notificação negada');
                }
            }
        }
        
        // Localização (opcional, para estatísticas)
        if (RADIO_CONFIG.analytics.trackListeners) {
            try {
                await this.requestLocationPermission();
            } catch (error) {
                console.log('📍 Localização não disponível');
            }
        }
    }
    
    async requestLocationPermission() {
        if (!navigator.geolocation) return;
        
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('📍 Localização obtida');
                    resolve(position);
                },
                (error) => reject(error),
                { timeout: 5000, enableHighAccuracy: false }
            );
        });
    }
    
    // === CONTROLES DE ÁUDIO ===
    
    togglePlay() {
        if (this.streamManager) {
            this.streamManager.togglePlay();
        }
    }
    
    adjustVolume(delta) {
        if (this.streamManager) {
            const currentVolume = this.streamManager.volume;
            const newVolume = Math.max(0, Math.min(1, currentVolume + delta));
            this.streamManager.setVolume(newVolume);
            
            // Mostrar feedback visual
            this.showVolumeIndicator(newVolume);
        }
    }
    
    toggleMute() {
        if (this.streamManager) {
            const currentVolume = this.streamManager.volume;
            
            if (currentVolume > 0) {
                this.previousVolume = currentVolume;
                this.streamManager.setVolume(0);
            } else {
                this.streamManager.setVolume(this.previousVolume || 0.8);
            }
        }
    }
    
    showVolumeIndicator(volume) {
        const indicator = document.createElement('div');
        indicator.className = 'volume-indicator';
        indicator.innerHTML = `
            <div class="volume-icon">${volume === 0 ? '🔇' : '🔊'}</div>
            <div class="volume-bar">
                <div class="volume-fill" style="width: ${volume * 100}%"></div>
            </div>
            <div class="volume-text">${Math.round(volume * 100)}%</div>
        `;
        
        document.body.appendChild(indicator);
        
        setTimeout(() => indicator.classList.add('show'), 50);
        setTimeout(() => {
            indicator.classList.remove('show');
            setTimeout(() => indicator.remove(), 300);
        }, 2000);
    }
    
    // === EVENTOS DE REDE E SISTEMA ===
    
    onNetworkStatusChange(isOnline) {
        console.log(`🌐 Rede: ${isOnline ? 'Online' : 'Offline'}`);
        
        if (isOnline) {
            this.showNotification('Conexão restaurada', 'success');
            
            // Tentar reconectar o stream
            if (this.streamManager && !this.streamManager.streamState.isLive) {
                setTimeout(() => {
                    this.streamManager.forceReconnect();
                }, 2000);
            }
        } else {
            this.showNotification('Conexão perdida', 'warning');
        }
    }
    
    onVisibilityChange() {
        if (document.hidden) {
            console.log('👁️ Página oculta');
            this.onPageHidden();
        } else {
            console.log('👁️ Página visível');
            this.onPageVisible();
        }
    }
    
    onPageHidden() {
        // Reduzir atividade quando página estiver oculta
        if (RADIO_CONFIG.performance.enableGPUAcceleration) {
            // Pausar animações CSS
            document.body.classList.add('page-hidden');
        }
    }
    
    onPageVisible() {
        // Reativar funcionalidades quando página ficar visível
        document.body.classList.remove('page-hidden');
        
        // Verificar estado do stream
        if (this.streamManager) {
            this.streamManager.checkStreamStatus();
        }
    }
    
    onWindowResize() {
        // Atualizar layout responsivo se necessário
        this.updateResponsiveLayout();
    }
    
    onBeforeUnload() {
        // Limpar recursos antes de sair
        if (this.streamManager) {
            this.streamManager.cleanup();
        }
        
        // Salvar estado
        this.saveApplicationState();
        
        console.log('👋 Limpeza realizada');
    }
    
    // === EVENTOS DE STREAM ===
    
    onTrackChanged(trackData) {
        console.log('🎵 Música alterada:', trackData);
        
        // Atualizar Media Session
        this.updateMediaSessionMetadata(trackData);
        
        // Mostrar notificação se habilitado
        if (this.notificationPermission === 'granted' && 
            MOBILE_CONFIG.notifications.showNowPlaying) {
            this.showTrackNotification(trackData);
        }
        
        // Atualizar título da página
        this.updatePageTitle(trackData);
        
        // Salvar no histórico
        this.saveTrackHistory(trackData);
    }
    
    onStreamStatusChanged(status) {
        console.log('📡 Status do stream alterado:', status);
        
        // Atualizar indicadores visuais
        this.updateStreamIndicators(status);
        
        // Mostrar notificação se necessário
        if (status.isLive && !status.wasLive) {
            this.showNotification('Transmissão iniciada!', 'success');
        } else if (!status.isLive && status.wasLive) {
            this.showNotification('Transmissão interrompida', 'warning');
        }
    }
    
    onStreamError(error) {
        console.error('❌ Erro no stream:', error);
        
        // Mostrar mensagem de erro amigável
        this.showStreamError(error);
        
        // Tentar recuperação automática
        this.attemptStreamRecovery(error);
    }
    
    // === GESTOS MÓVEIS ===
    
    onSwipeUp() {
        // Mostrar controles ou informações
        if (MOBILE_CONFIG.swipeGestures) {
            this.showControlsPanel();
        }
    }
    
    onSwipeDown() {
        // Ocultar controles
        if (MOBILE_CONFIG.swipeGestures) {
            this.hideControlsPanel();
        }
    }
    
    // === INTERFACE E FEEDBACK ===
    
    showWelcomeMessage() {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
            <div class="welcome-content glass">
                <h2>🎵 Bem-vindo!</h2>
                <p>Rádio Supermercado do Louro está no ar!</p>
                <div class="welcome-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove(); streamManager.play();" class="btn-primary">
                        🎧 Começar a Ouvir
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" class="btn-secondary">
                        Depois
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(welcome);
        
        setTimeout(() => welcome.classList.add('show'), 100);
        setTimeout(() => {
            if (welcome.parentElement) {
                welcome.remove();
            }
        }, 10000);
    }
    
    showBrowserError() {
        const error = document.createElement('div');
        error.className = 'browser-error';
        error.innerHTML = `
            <div class="error-content">
                <h2>❌ Navegador Incompatível</h2>
                <p>Seu navegador não suporta todos os recursos necessários.</p>
                <p>Por favor, atualize para uma versão mais recente ou use:</p>
                <ul>
                    <li>Chrome 80+</li>
                    <li>Firefox 75+</li>
                    <li>Safari 13+</li>
                    <li>Edge 80+</li>
                </ul>
            </div>
        `;
        
        document.body.appendChild(error);
    }
    
    showInitializationError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'init-error';
        errorDiv.innerHTML = `
            <div class="error-content glass">
                <h2>⚠️ Erro na Inicialização</h2>
                <p>Ocorreu um problema ao inicializar a rádio.</p>
                <details>
                    <summary>Detalhes técnicos</summary>
                    <pre>${error.message || error}</pre>
                </details>
                <button onclick="location.reload()" class="btn-primary">
                    🔄 Tentar Novamente
                </button>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
    }
    
    showInstallPrompt() {
        if (!this.installPrompt) return;
        
        const prompt = document.createElement('div');
        prompt.className = 'install-prompt';
        prompt.innerHTML = `
            <div class="prompt-content glass">
                <h3>📱 Instalar App</h3>
                <p>Adicione a rádio na sua tela inicial!</p>
                <div class="prompt-actions">
                    <button id="installApp" class="btn-primary">📥 Instalar</button>
                    <button id="dismissInstall" class="btn-secondary">Agora não</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(prompt);
        
        document.getElementById('installApp').addEventListener('click', async () => {
            if (this.installPrompt) {
                this.installPrompt.prompt();
                const { outcome } = await this.installPrompt.userChoice;
                console.log('📱 Resultado da instalação:', outcome);
                this.installPrompt = null;
            }
            prompt.remove();
        });
        
        document.getElementById('dismissInstall').addEventListener('click', () => {
            prompt.remove();
        });
        
        setTimeout(() => prompt.remove(), 15000);
    }
    
    showUpdateAvailable() {
        const update = document.createElement('div');
        update.className = 'update-available';
        update.innerHTML = `
            <div class="update-content glass">
                <h3>🔄 Atualização Disponível</h3>
                <p>Uma nova versão da rádio está disponível!</p>
                <button onclick="location.reload()" class="btn-primary">
                    ⬇️ Atualizar
                </button>
                <button onclick="this.parentElement.parentElement.remove()" class="btn-secondary">
                    Depois
                </button>
            </div>
        `;
        
        document.body.appendChild(update);
    }
    
    showNotification(message, type = 'info', duration = 5000) {
        // Notificação no navegador
        if (this.notificationPermission === 'granted' && document.hidden) {
            new Notification(`📻 ${RADIO_CONFIG.radio.name}`, {
                body: message,
                icon: '/icon-192.png',
                tag: 'radio-notification'
            });
        }
        
        // Toast na página
        this.showToast(message, type, duration);
    }
    
    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getToastIcon(type)}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
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
    
    // === TEMAS E LAYOUT ===
    
    applyTheme() {
        const theme = RADIO_CONFIG.ui.theme;
        document.body.className = `theme-${theme}`;
        
        // Configurar meta theme-color
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            themeColor.content = theme === 'dark' ? '#0a0a0a' : '#ffffff';
        }
    }
    
    updateResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('mobile', isMobile);
        
        // Atualizar controles de volume em mobile
        if (isMobile && this.streamManager) {
            this.optimizeForMobile();
        }
    }
    
    optimizeForMobile() {
        // Otimizações específicas para mobile
        if (MOBILE_CONFIG.touchOptimized) {
            document.body.classList.add('touch-optimized');
        }
    }
    
    // === UTILIDADES ===
    
    updatePageTitle(track = null) {
        const baseTitle = RADIO_CONFIG.radio.name;
        
        if (track) {
            document.title = `🎵 ${track.title} - ${baseTitle}`;
        } else {
            document.title = `📻 ${baseTitle} - AO VIVO`;
        }
    }
    
    saveApplicationState() {
        try {
            const state = {
                volume: this.streamManager?.volume || 0.8,
                lastUsed: Date.now(),
                version: '1.0.0'
            };
            
            localStorage.setItem('radioAppState', JSON.stringify(state));
        } catch (error) {
            console.warn('Não foi possível salvar estado da aplicação');
        }
    }
    
    loadApplicationState() {
        try {
            const state = JSON.parse(localStorage.getItem('radioAppState') || '{}');
            
            if (state.volume && this.streamManager) {
                this.streamManager.setVolume(state.volume);
            }
            
            return state;
        } catch (error) {
            console.warn('Não foi possível carregar estado da aplicação');
            return {};
        }
    }
    
    saveTrackHistory(track) {
        try {
            const history = JSON.parse(localStorage.getItem('trackHistory') || '[]');
            
            history.unshift({
                ...track,
                playedAt: Date.now()
            });
            
            // Manter apenas os últimos 100
            if (history.length > 100) {
                history.splice(100);
            }
            
            localStorage.setItem('trackHistory', JSON.stringify(history));
        } catch (error) {
            console.warn('Erro ao salvar histórico de músicas');
        }
    }
    
    // === API PÚBLICA ===
    
    getApplicationState() {
        return {
            isInitialized: this.isInitialized,
            streamManager: this.streamManager?.getStreamState(),
            theme: RADIO_CONFIG.ui.theme,
            version: '1.0.0'
        };
    }
    
    restart() {
        console.log('🔄 Reiniciando aplicação...');
        
        // Limpar
        if (this.streamManager) {
            this.streamManager.cleanup();
        }
        
        // Reinicializar
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
}

// === INICIALIZAÇÃO ===

// Aguardar DOM estar pronto
function initializeApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.radioApp = new RadioApp();
        });
    } else {
        window.radioApp = new RadioApp();
    }
}

// Verificar se já foi inicializado
if (!window.radioApp) {
    initializeApp();
}

// Exportar para uso global
window.RadioApp = RadioApp;

console.log('🎵 Sistema principal da rádio carregado!');