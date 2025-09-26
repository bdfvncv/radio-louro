// Configurações da aplicação
const RADIO_CONFIG = {
    // Informações da rádio
    station: {
        name: 'Rádio Supermercado do Louro',
        tagline: 'Transmissão AO VIVO 24 Horas',
        description: 'Sua rádio favorita, 24 horas no ar!',
        contact: {
            email: 'contato@radiosupermercadodolouro.com.br',
            whatsapp: '(11) 99999-9999',
            website: 'https://radiosupermercadodolouro.com.br'
        },
        social: {
            facebook: 'https://facebook.com/radiosupermercadodolouro',
            instagram: 'https://instagram.com/radiosupermercadodolouro',
            twitter: 'https://twitter.com/radiolouro'
        }
    },

    // Configurações de áudio
    audio: {
        defaultVolume: 70,
        fadeInDuration: 2000,
        fadeOutDuration: 1500,
        crossfadeDuration: 3000,
        bufferSize: 4096,
        sampleRate: 44100,
        bitrate: 128
    },

    // Configurações de programação
    programming: {
        // Intervalos para diferentes tipos de conteúdo
        intervals: {
            announcements: {
                min: 5, // Mínimo de músicas entre avisos
                max: 8, // Máximo de músicas entre avisos
                priority: true
            },
            time: {
                onTheHour: true, // Tocar hora certa na hora exata
                minutes: [0], // Minutos para tocar (0 = na hora exata)
                skipIfRecent: 30000 // Pular se tocou nos últimos 30min
            },
            jingles: {
                frequency: 0.1, // 10% de chance após cada música
                maxConsecutive: 1 // Máximo de vinhetas consecutivas
            }
        },

        // Pesos para seleção de música por horário
        timeWeights: {
            morning: { // 06:00 - 12:00
                energetic: 0.4,
                popular: 0.3,
                classic: 0.2,
                calm: 0.1
            },
            afternoon: { // 12:00 - 18:00
                popular: 0.4,
                energetic: 0.3,
                classic: 0.2,
                calm: 0.1
            },
            evening: { // 18:00 - 22:00
                calm: 0.4,
                classic: 0.3,
                popular: 0.2,
                energetic: 0.1
            },
            night: { // 22:00 - 06:00
                calm: 0.5,
                classic: 0.3,
                popular: 0.15,
                energetic: 0.05
            }
        }
    },

    // Configurações de upload
    upload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedTypes: {
            audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac'],
            image: ['jpg', 'jpeg', 'png', 'gif', 'webp']
        },
        compression: {
            audio: {
                bitrate: 128,
                sampleRate: 44100,
                channels: 2
            },
            image: {
                maxWidth: 1200,
                maxHeight: 1200,
                quality: 0.85
            }
        }
    },

    // Configurações da interface
    ui: {
        theme: {
            primaryColor: '#0d5016',
            secondaryColor: '#1a5f1a',
            accentColor: '#4caf50',
            backgroundColor: '#0a0f0a',
            textColor: '#ffffff'
        },
        animations: {
            duration: 300,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
        },
        equalizer: {
            bars: 6,
            animationSpeed: 1000,
            heightRange: [10, 40]
        },
        notifications: {
            duration: 5000,
            position: 'top-right'
        }
    },

    // Configurações de armazenamento
    storage: {
        localStorageKey: 'radioLouroData',
        sessionStorageKey: 'radioLouroSession',
        cacheExpiry: 24 * 60 * 60 * 1000, // 24 horas
        maxHistoryItems: 100,
        maxRequestsStored: 50
    },

    // Configurações de API
    api: {
        endpoints: {
            upload: 'https://api.cloudinary.com/v1_1/dygbrcrr6/auto/upload',
            metadata: 'https://api.cloudinary.com/v1_1/dygbrcrr6/resources',
            delete: 'https://api.cloudinary.com/v1_1/dygbrcrr6/destroy'
        },
        timeout: 30000, // 30 segundos
        retries: 3,
        retryDelay: 1000
    },

    // Configurações de segurança
    security: {
        adminPassword: 'admin123',
        sessionTimeout: 30 * 60 * 1000, // 30 minutos
        maxLoginAttempts: 3,
        lockoutDuration: 15 * 60 * 1000 // 15 minutos
    },

    // Configurações de estatísticas
    statistics: {
        trackHistory: true,
        trackRequests: true,
        trackErrors: true,
        maxHistoryEntries: 1000,
        analyticsEnabled: false
    },

    // Configurações de desenvolvimento
    development: {
        debugMode: false,
        verboseLogging: false,
        mockData: true,
        bypassAuth: false
    }
};

// Configurações específicas por ambiente
const ENVIRONMENT_CONFIG = {
    development: {
        debugMode: true,
        verboseLogging: true,
        mockData: true,
        bypassAuth: true,
        api: {
            timeout: 60000,
            retries: 1
        }
    },
    
    production: {
        debugMode: false,
        verboseLogging: false,
        mockData: false,
        bypassAuth: false,
        api: {
            timeout: 30000,
            retries: 3
        }
    }
};

// Detectar ambiente
const currentEnvironment = (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('test')
) ? 'development' : 'production';

// Aplicar configurações do ambiente
const envConfig = ENVIRONMENT_CONFIG[currentEnvironment];
Object.assign(RADIO_CONFIG.development, envConfig);

// Mensagens do sistema
const SYSTEM_MESSAGES = {
    welcome: 'Bem-vindo à Rádio Supermercado do Louro!',
    connecting: 'Conectando à transmissão...',
    connected: 'Conectado com sucesso!',
    disconnected: 'Conexão perdida. Tentando reconectar...',
    error: 'Ocorreu um erro. Tente novamente.',
    loading: 'Carregando...',
    noContent: 'Nenhum conteúdo disponível no momento.',
    uploadSuccess: 'Upload realizado com sucesso!',
    uploadError: 'Erro no upload. Tente novamente.',
    requestSent: 'Pedido enviado com sucesso!',
    adminAccess: 'Acesso administrativo autorizado.',
    adminDenied: 'Senha incorreta.',
    broadcastStarted: 'Transmissão iniciada!',
    broadcastStopped: 'Transmissão pausada.',
    emergencyStop: 'Parada de emergência ativada!'
};

// Templates HTML para elementos dinâmicos
const HTML_TEMPLATES = {
    trackItem: `
        <div class="track-item">
            <div class="track-time">{{time}}</div>
            <div class="track-info">
                <div class="track-name">{{name}}</div>
                <div class="track-artist">{{artist}}</div>
            </div>
        </div>
    `,
    
    scheduleItem: `
        <div class="schedule-item {{class}}">
            <div class="schedule-time">{{time}}</div>
            <div class="schedule-program">
                <h4>{{name}}</h4>
                <p>{{description}}</p>
            </div>
        </div>
    `,
    
    requestItem: `
        <div class="request-item">
            <div class="request-header">
                <span class="request-name">{{requesterName}}</span>
                <span class="request-time">{{timestamp}}</span>
            </div>
            <div class="request-song">{{songRequest}}</div>
            {{#dedicateTo}}
            <div class="request-dedicate">Dedicar para: {{dedicateTo}}</div>
            {{/dedicateTo}}
            {{#message}}
            <div class="request-message">"{{message}}"</div>
            {{/message}}
            <div class="request-actions">
                <button class="btn primary btn-small" onclick="approveRequest({{index}})">
                    ✅ Aprovar
                </button>
                <button class="btn secondary btn-small" onclick="removeRequest({{index}})">
                    🗑️ Remover
                </button>
            </div>
        </div>
    `,
    
    announcementItem: `
        <div class="announcement-item {{#priority}}priority{{/priority}}">
            <div class="announcement-time">{{time}}</div>
            <div class="announcement-text">{{text}}</div>
        </div>
    `,
    
    statCard: `
        <div class="stat-card">
            <h4>{{title}}</h4>
            <div class="stat-number">{{value}}</div>
            <span class="stat-period">{{period}}</span>
        </div>
    `,
    
    notification: `
        <div class="notification notification-{{type}}">
            <div class="notification-icon">{{icon}}</div>
            <div class="notification-content">
                <div class="notification-title">{{title}}</div>
                <div class="notification-message">{{message}}</div>
            </div>
            <button class="notification-close" onclick="closeNotification(this)">×</button>
        </div>
    `
};

// Utilitários de configuração
const ConfigUtils = {
    // Obter configuração por caminho (ex: 'audio.defaultVolume')
    get(path, defaultValue = null) {
        return path.split('.').reduce((obj, key) => 
            obj && obj[key] !== undefined ? obj[key] : defaultValue, RADIO_CONFIG
        );
    },

    // Definir configuração por caminho
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, RADIO_CONFIG);
        target[lastKey] = value;
    },

    // Verificar se está em modo de desenvolvimento
    isDevelopment() {
        return currentEnvironment === 'development';
    },

    // Obter configuração do ambiente atual
    getEnvironment() {
        return currentEnvironment;
    },

    // Renderizar template com dados
    renderTemplate(templateName, data) {
        let template = HTML_TEMPLATES[templateName];
        if (!template) return '';

        // Substituição simples de variáveis
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || '';
        }).replace(/\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, key, content) => {
            return data[key] ? content : '';
        });
    },

    // Validar arquivo de upload
    validateFile(file, type) {
        const config = RADIO_CONFIG.upload;
        
        // Verificar tamanho
        if (file.size > config.maxFileSize) {
            throw new Error(`Arquivo muito grande. Máximo: ${config.maxFileSize / (1024 * 1024)}MB`);
        }

        // Verificar tipo
        const extension = file.name.split('.').pop().toLowerCase();
        const allowedTypes = config.allowedTypes[type] || [];
        
        if (!allowedTypes.includes(extension)) {
            throw new Error(`Tipo de arquivo não permitido. Permitidos: ${allowedTypes.join(', ')}`);
        }

        return true;
    },

    // Obter configuração de tema
    getTheme() {
        return RADIO_CONFIG.ui.theme;
    },

    // Aplicar tema à página
    applyTheme() {
        const theme = this.getTheme();
        const root = document.documentElement;
        
        Object.entries(theme).forEach(([key, value]) => {
            const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVar, value);
        });
    }
};

// Exportar para uso global
window.RADIO_CONFIG = RADIO_CONFIG;
window.SYSTEM_MESSAGES = SYSTEM_MESSAGES;
window.HTML_TEMPLATES = HTML_TEMPLATES;
window.ConfigUtils = ConfigUtils;

// Log de inicialização
console.log(`🔧 Configurações carregadas para ambiente: ${currentEnvironment}`);

// Aplicar tema automaticamente
document.addEventListener('DOMContentLoaded', () => {
    ConfigUtils.applyTheme();
});
