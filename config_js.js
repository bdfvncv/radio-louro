// 📻 CONFIGURAÇÕES DA RÁDIO SUPERMERCADO DO LOURO
// ================================================

// Configuração da Cloudinary
window.RADIO_CONFIG = {
    // Cloudinary para hospedagem de arquivos
    cloudinary: {
        cloudName: 'dygbrcrr6',
        apiKey: '853591251513134',
        apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
        uploadPreset: 'radio_preset'
    },
    
    // Configurações da rádio
    radio: {
        name: 'Rádio Supermercado do Louro',
        slogan: 'Sua música, sua experiência - AO VIVO 24h',
        defaultCover: 'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png',
        
        // Intervalos de programação (em minutos/músicas)
        schedule: {
            timeAnnouncementInterval: 60, // Hora certa a cada 60 minutos
            adInterval: 7,                // Avisos a cada 7 músicas
            minTracksBetweenAds: 3,       // Mínimo de 3 músicas entre avisos
            maxTracksBetweenAds: 10       // Máximo de 10 músicas entre avisos
        },
        
        // Configurações de áudio
        audio: {
            defaultVolume: 0.7,
            fadeTransitions: true,
            autoNormalize: true,
            crossfadeDuration: 2000, // 2 segundos
            bufferSize: 8192
        },
        
        // Configurações de transmissão
        transmission: {
            continuousPlay: true,
            autoRestart: true,
            heartbeatInterval: 30000,    // Verificar status a cada 30s
            maxRetries: 5,
            retryDelay: 3000,
            
            // Configurações de fallback
            fallback: {
                enabled: true,
                silenceThreshold: 10000,  // 10s de silêncio antes do fallback
                emergencyTracks: []       // Músicas de emergência
            }
        }
    },
    
    // Álbuns temáticos disponíveis
    albums: {
        natal: {
            title: '🎄 Especial de Natal',
            description: 'Músicas natalinas para toda família',
            color: '#ff6b6b',
            season: 'winter',
            months: [12, 1] // Dezembro e Janeiro
        },
        pascoa: {
            title: '🐰 Celebração da Páscoa', 
            description: 'Músicas de esperança e renovação',
            color: '#4ecdc4',
            season: 'spring',
            months: [3, 4] // Março e Abril
        },
        saojoao: {
            title: '🎪 Festa de São João',
            description: 'Forró e músicas juninas',
            color: '#45b7d1',
            season: 'winter',
            months: [6, 7] // Junho e Julho
        },
        carnaval: {
            title: '🎭 Carnaval',
            description: 'Marchinhas e alegria',
            color: '#f39c12',
            season: 'summer', 
            months: [2, 3] // Fevereiro e Março
        }
    },
    
    // Configurações de administração
    admin: {
        defaultPassword: 'admin123',
        sessionTimeout: 3600000, // 1 hora
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFormats: ['.mp3', '.wav', '.ogg', '.m4a'],
        
        // Permissões
        permissions: {
            upload: true,
            delete: true,
            schedule: true,
            reports: true,
            settings: true,
            transmission: true
        }
    },
    
    // Configurações de interface
    ui: {
        theme: 'dark',
        animations: true,
        showEqualizer: true,
        showRecentTracks: true,
        maxRecentTracks: 10,
        
        // Cores do tema
        colors: {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#4facfe',
            success: '#2ecc71',
            warning: '#f39c12',
            danger: '#e74c3c',
            dark: '#0a0a0a',
            light: '#ffffff'
        }
    },
    
    // URLs e endpoints
    api: {
        cloudinaryUpload: 'https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload',
        cloudinaryImage: 'https://api.cloudinary.com/v1_1/{cloud_name}/image/upload'
    },
    
    // Configurações de debug
    debug: {
        enabled: true,
        level: 'info', // 'debug', 'info', 'warn', 'error'
        console: true,
        storage: true
    }
};

// Estado global da rádio
window.RADIO_STATE = {
    // Estado da transmissão
    transmission: {
        isLive: false,
        isPlaying: false,
        currentTrack: null,
        volume: 0.7,
        startTime: null,
        uptime: 0,
        lastHeartbeat: null
    },
    
    // Programação
    schedule: {
        activeAlbum: null,
        tracksSinceTime: 0,
        tracksSinceAd: 0,
        lastTimeAnnouncement: 0,
        nextTimeAnnouncement: 0,
        playQueue: [],
        playHistory: []
    },
    
    // Bibliotecas de áudio
    library: {
        music: [],
        time: [],
        ads: [],
        albums: {
            natal: [],
            pascoa: [],
            saojoao: [],
            carnaval: []
        }
    },
    
    // Estatísticas
    stats: {
        totalPlayed: 0,
        playHistory: {},
        sessionStart: Date.now(),
        errors: [],
        listeners: 1 // Simulado - pode integrar com analytics real
    },
    
    // Interface
    ui: {
        currentView: 'radio', // 'radio' ou 'admin'
        activeTab: 'upload',
        isLoading: false,
        lastUpdate: Date.now()
    },
    
    // Configurações personalizadas
    settings: {
        fadeTransitions: true,
        autoNormalize: true,
        continuousPlay: true,
        autoRestart: true,
        notifications: true
    }
};

// Utilitários de configuração
window.CONFIG_UTILS = {
    // Salvar configurações no localStorage
    save() {
        try {
            localStorage.setItem('radio_state', JSON.stringify(RADIO_STATE));
            localStorage.setItem('radio_settings', JSON.stringify(RADIO_CONFIG));
            console.log('✅ Configurações salvas');
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar configurações:', error);
            return false;
        }
    },
    
    // Carregar configurações do localStorage
    load() {
        try {
            const savedState = localStorage.getItem('radio_state');
            const savedSettings = localStorage.getItem('radio_settings');
            
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                // Mesclar com o estado padrão mantendo a estrutura
                RADIO_STATE = { ...RADIO_STATE, ...parsedState };
            }
            
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                // Mesclar configurações personalizadas
                RADIO_CONFIG = { ...RADIO_CONFIG, ...parsedSettings };
            }
            
            console.log('✅ Configurações carregadas');
            return true;
        } catch (error) {
            console.error('❌ Erro ao carregar configurações:', error);
            return false;
        }
    },
    
    // Resetar para configurações padrão
    reset() {
        try {
            localStorage.removeItem('radio_state');
            localStorage.removeItem('radio_settings');
            console.log('✅ Configurações resetadas');
            return true;
        } catch (error) {
            console.error('❌ Erro ao resetar configurações:', error);
            return false;
        }
    },
    
    // Exportar configurações
    export() {
        const exportData = {
            state: RADIO_STATE,
            config: RADIO_CONFIG,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `radio-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ Configurações exportadas');
    },
    
    // Importar configurações
    import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (importData.state) {
                        RADIO_STATE = { ...RADIO_STATE, ...importData.state };
                    }
                    if (importData.config) {
                        RADIO_CONFIG = { ...RADIO_CONFIG, ...importData.config };
                    }
                    
                    this.save();
                    console.log('✅ Configurações importadas');
                    resolve(importData);
                } catch (error) {
                    console.error('❌ Erro ao importar configurações:', error);
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    // Validar configurações
    validate() {
        const errors = [];
        
        // Validar Cloudinary
        if (!RADIO_CONFIG.cloudinary.cloudName) {
            errors.push('Cloudinary cloudName não configurado');
        }
        if (!RADIO_CONFIG.cloudinary.uploadPreset) {
            errors.push('Cloudinary uploadPreset não configurado');
        }
        
        // Validar intervalos de programação
        if (RADIO_CONFIG.radio.schedule.timeAnnouncementInterval < 30) {
            errors.push('Intervalo de hora certa deve ser >= 30 minutos');
        }
        if (RADIO_CONFIG.radio.schedule.adInterval < 1) {
            errors.push('Intervalo de avisos deve ser >= 1 música');
        }
        
        // Validar volume
        if (RADIO_CONFIG.radio.audio.defaultVolume > 1 || RADIO_CONFIG.radio.audio.defaultVolume < 0) {
            errors.push('Volume padrão deve estar entre 0 e 1');
        }
        
        if (errors.length > 0) {
            console.warn('⚠️ Problemas de configuração encontrados:', errors);
            return { valid: false, errors };
        }
        
        console.log('✅ Configurações válidas');
        return { valid: true, errors: [] };
    },
    
    // Obter URL da API Cloudinary
    getCloudinaryURL(type = 'auto') {
        return RADIO_CONFIG.api.cloudinaryUpload.replace(
            '{cloud_name}', 
            RADIO_CONFIG.cloudinary.cloudName
        );
    },
    
    // Obter configuração específica
    get(path, defaultValue = null) {
        try {
            const keys = path.split('.');
            let value = RADIO_CONFIG;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }
            
            return value;
        } catch (error) {
            console.error('❌ Erro ao obter configuração:', error);
            return defaultValue;
        }
    },
    
    // Definir configuração específica
    set(path, value) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = RADIO_CONFIG;
            
            for (const key of keys) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }
            
            target[lastKey] = value;
            this.save();
            return true;
        } catch (error) {
            console.error('❌ Erro ao definir configuração:', error);
            return false;
        }
    },
    
    // Verificar se está em modo debug
    isDebug() {
        return RADIO_CONFIG.debug.enabled;
    },
    
    // Log de debug
    log(level, message, data = null) {
        if (!this.isDebug()) return;
        
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        switch (level) {
            case 'debug':
                console.debug(logMessage, data);
                break;
            case 'info':
                console.info(logMessage, data);
                break;
            case 'warn':
                console.warn(logMessage, data);
                break;
            case 'error':
                console.error(logMessage, data);
                break;
            default:
                console.log(logMessage, data);
        }
        
        // Salvar no histórico se habilitado
        if (RADIO_CONFIG.debug.storage) {
            RADIO_STATE.stats.errors.push({
                timestamp,
                level,
                message,
                data
            });
            
            // Manter apenas os últimos 100 logs
            if (RADIO_STATE.stats.errors.length > 100) {
                RADIO_STATE.stats.errors = RADIO_STATE.stats.errors.slice(-100);
            }
        }
    }
};

// Inicializar configurações ao carregar
document.addEventListener('DOMContentLoaded', () => {
    CONFIG_UTILS.load();
    const validation = CONFIG_UTILS.validate();
    
    if (!validation.valid) {
        console.warn('⚠️ Configurações inválidas detectadas:', validation.errors);
    }
    
    CONFIG_UTILS.log('info', '🚀 Sistema de configuração inicializado');
});

// Exportar para uso global
window.CONFIG = RADIO_CONFIG;
window.STATE = RADIO_STATE;
window.UTILS = CONFIG_UTILS;