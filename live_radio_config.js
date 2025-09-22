// 📻 CONFIGURAÇÕES DA RÁDIO SUPERMERCADO DO LOURO
// ================================================

// Configuração do Stream AO VIVO
const RADIO_CONFIG = {
    // 🎵 STREAM PRINCIPAL (Configure com seu servidor)
    stream: {
        url: 'http://seu-servidor.com:8000/live.mp3', // URL do seu stream Icecast/Shoutcast
        fallbackUrl: 'http://backup-servidor.com:8000/live.mp3', // URL de backup
        format: 'mp3',
        bitrate: 128,
        sampleRate: 44100,
        crossOrigin: true
    },
    
    // 📡 INFORMAÇÕES DA RÁDIO
    radio: {
        name: 'Rádio Supermercado do Louro',
        description: 'Sua rádio online 24 horas',
        website: 'https://radiosupermercadodolouro.com',
        email: 'contato@radiosupermercadodolouro.com',
        phone: '+55 11 99999-9999',
        location: 'Boquira, Bahia, Brasil'
    },
    
    // 🔐 CONFIGURAÇÕES ADMIN
    admin: {
        password: 'admin123', // MUDE ESTA SENHA!
        sessionTimeout: 30 * 60 * 1000, // 30 minutos
        allowRemoteAccess: false, // true para acesso remoto
        maxUploadSize: 50 * 1024 * 1024, // 50MB por arquivo
        allowedFormats: ['mp3', 'wav', 'ogg', 'm4a', 'aac']
    },
    
    // ☁️ CLOUDINARY (Para upload de arquivos)
    cloudinary: {
        cloudName: 'dygbrcrr6',
        apiKey: '853591251513134',
        apiSecret: 'yVz8MbGa_undTqNHbOqzo-hKc-U',
        uploadPreset: 'radio_preset',
        folder: 'radio-louro',
        transformations: {
            audio: 'f_mp3,q_auto,br_128',
            image: 'f_jpg,q_auto,w_500,h_500,c_fill'
        }
    },
    
    // 🎯 PROGRAMAÇÃO AUTOMÁTICA
    schedule: {
        // Intervalo para hora certa (em minutos)
        timeAnnouncementInterval: 60, // A cada hora
        
        // Intervalo para vinhetas/avisos (número de músicas)
        adInterval: {
            min: 5, // Mínimo 5 músicas
            max: 8  // Máximo 8 músicas
        },
        
        // Configurações de crossfade
        crossfade: {
            enabled: true,
            duration: 3000 // 3 segundos
        },
        
        // Repetição de músicas (evitar repetir recentes)
        antiRepeat: {
            enabled: true,
            trackMemory: 50 // Não repetir últimas 50 músicas
        }
    },
    
    // 📊 ESTATÍSTICAS E LOGS
    analytics: {
        enabled: true,
        trackListeners: true,
        trackPlays: true,
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        maxHistoryEntries: 1000,
        saveInterval: 60000 // Salvar a cada minuto
    },
    
    // 🔄 AUTO-REFRESH E RECONEXÃO
    connection: {
        autoReconnect: true,
        reconnectInterval: 10000, // 10 segundos
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000, // 30 segundos
        timeout: 15000 // 15 segundos timeout
    },
    
    // 🎨 INTERFACE
    ui: {
        theme: 'dark', // 'dark' ou 'light'
        showVisualizer: true,
        showRecentTracks: true,
        maxRecentTracks: 10,
        updateInterval: 1000, // Atualizar UI a cada segundo
        animations: true
    },
    
    // 📱 PWA (Progressive Web App)
    pwa: {
        enabled: true,
        cacheName: 'radio-louro-v1',
        offlineMessage: 'Rádio offline - Reconnectando...',
        installPrompt: true
    },
    
    // 🌐 SERVIÇOS EXTERNOS
    external: {
        // Last.fm para metadados de música
        lastfm: {
            enabled: false, // Desabilitado por padrão
            apiKey: '', // Sua API key do Last.fm
            secret: ''
        },
        
        // Spotify para metadados
        spotify: {
            enabled: false,
            clientId: '',
            clientSecret: ''
        },
        
        // Google Analytics
        analytics: {
            enabled: false,
            trackingId: ''
        }
    },
    
    // 🚀 PERFORMANCE
    performance: {
        preloadDuration: 30, // Preload 30 segundos
        bufferSize: 4096,
        enableGPUAcceleration: true,
        compressionLevel: 6
    }
};

// 🎵 CONFIGURAÇÃO DAS PLAYLISTS TEMÁTICAS
const ALBUM_CONFIG = {
    natal: {
        title: '🎄 Natal',
        description: 'Músicas natalinas e de fim de ano',
        color: '#c41e3a',
        icon: '🎄',
        season: 'winter',
        months: [11, 0], // Dezembro e Janeiro
        priority: 'high'
    },
    
    pascoa: {
        title: '🐰 Páscoa',
        description: 'Celebrando a ressurreição',
        color: '#ffd700',
        icon: '🐰',
        season: 'spring',
        months: [2, 3, 4], // Março, Abril, Maio
        priority: 'medium'
    },
    
    saojoao: {
        title: '🎪 São João',
        description: 'Forró e festa junina',
        color: '#ff8c00',
        icon: '🎪',
        season: 'winter', // Inverno no Brasil
        months: [5, 6, 7], // Junho, Julho, Agosto
        priority: 'high'
    },
    
    carnaval: {
        title: '🎊 Carnaval',
        description: 'Marchinha e alegria',
        color: '#ff1493',
        icon: '🎊',
        season: 'summer',
        months: [1, 2], // Fevereiro, Março
        priority: 'high'
    }
};

// 📡 URLs DE STREAMING (Configure com seus serviços)
const STREAMING_URLS = {
    // Icecast (Recomendado)
    icecast: {
        main: 'http://seu-servidor.com:8000/live',
        backup: 'http://backup.com:8000/live',
        admin: 'http://seu-servidor.com:8000/admin/',
        stats: 'http://seu-servidor.com:8000/status-json.xsl'
    },
    
    // Shoutcast (Alternativo)
    shoutcast: {
        main: 'http://seu-servidor.com:8080/stream',
        backup: 'http://backup.com:8080/stream',
        admin: 'http://seu-servidor.com:8080/admin.cgi',
        stats: 'http://seu-servidor.com:8080/7.html'
    },
    
    // Serviços de Hosting (Exemplos)
    hosting: {
        // Radio.co
        radioCo: 'https://streaming.radio.co/s123456/listen',
        
        // Streamerr
        streamerr: 'https://streamerr.co:8080/radio.mp3',
        
        // AzuraCast
        azuracast: 'https://radio.exemplo.com/listen/radio/radio.mp3'
    }
};

// 🔒 CONFIGURAÇÕES DE SEGURANÇA
const SECURITY_CONFIG = {
    // CORS Headers
    cors: {
        enabled: true,
        allowedOrigins: [
            'https://radiosupermercadodolouro.com',
            'https://www.radiosupermercadodolouro.com',
            'http://localhost:3000' // Para desenvolvimento
        ]
    },
    
    // Rate Limiting
    rateLimit: {
        enabled: true,
        windowMs: 15 * 60 * 1000, // 15 minutos
        max: 100 // máximo 100 requests por IP
    },
    
    // Content Security Policy
    csp: {
        enabled: true,
        directives: {
            'default-src': ["'self'"],
            'media-src': ["'self'", 'https://res.cloudinary.com', 'http://seu-servidor.com:8000'],
            'img-src': ["'self'", 'https://res.cloudinary.com', 'data:'],
            'script-src': ["'self'", "'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'"]
        }
    }
};

// 🌍 CONFIGURAÇÕES DE LOCALIZAÇÃO
const LOCALE_CONFIG = {
    default: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    
    // Textos da interface
    strings: {
        'pt-BR': {
            loading: 'Carregando...',
            connecting: 'Conectando...',
            playing: 'Tocando',
            paused: 'Pausado',
            offline: 'Offline',
            error: 'Erro na transmissão',
            listeners: 'Ouvintes',
            volume: 'Volume',
            muted: 'Mudo',
            live: 'AO VIVO'
        }
    }
};

// 📱 CONFIGURAÇÃO MOBILE/PWA
const MOBILE_CONFIG = {
    // Otimizações para mobile
    touchOptimized: true,
    swipeGestures: true,
    vibrateFeedback: true,
    
    // Background audio (PWA)
    backgroundAudio: true,
    lockScreenControls: true,
    
    // Notificações
    notifications: {
        enabled: true,
        showNowPlaying: true,
        showOffline: true
    }
};

// Exportar configurações para uso global
window.RADIO_CONFIG = RADIO_CONFIG;
window.ALBUM_CONFIG = ALBUM_CONFIG;
window.STREAMING_URLS = STREAMING_URLS;
window.SECURITY_CONFIG = SECURITY_CONFIG;
window.LOCALE_CONFIG = LOCALE_CONFIG;
window.MOBILE_CONFIG = MOBILE_CONFIG;

console.log('📻 Configurações da rádio carregadas:', RADIO_CONFIG.radio.name);