// 📻 CONFIGURAÇÕES DA RÁDIO SUPERMERCADO DO LOURO
console.log('📋 Carregando configurações...');

// Configuração da Cloudinary
window.RADIO_CONFIG = {
    cloudinary: {
        cloudName: 'dygbrcrr6',
        uploadPreset: 'radio_preset'
    },
    
    radio: {
        name: 'Rádio Supermercado do Louro',
        defaultCover: 'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png',
        
        schedule: {
            timeInterval: 10,     // Hora certa a cada 10 músicas (para teste mais rápido)
            adInterval: 5,        // Avisos a cada 5 músicas
            tracksBetweenTime: 0,
            tracksBetweenAd: 0
        },
        
        audio: {
            defaultVolume: 0.7,
            fadeEnabled: true
        }
    },
    
    albums: {
        natal: { title: '🎄 Natal', color: '#ff6b6b' },
        pascoa: { title: '🐰 Páscoa', color: '#4ecdc4' },
        saojoao: { title: '🎪 São João', color: '#45b7d1' },
        carnaval: { title: '🎭 Carnaval', color: '#f39c12' }
    },
    
    admin: {
        defaultPassword: 'admin123'
    }
};

// Estado global da rádio
window.RADIO_STATE = {
    transmission: {
        isLive: false,
        isPlaying: false,
        currentTrack: null,
        volume: 0.7,
        startTime: null
    },
    
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
    
    schedule: {
        activeAlbum: null,
        tracksSinceTime: 0,
        tracksSinceAd: 0,
        lastTimeCheck: 0
    },
    
    stats: {
        totalPlayed: 0,
        playHistory: {},
        sessionStart: Date.now()
    }
};

// Funções utilitárias
window.RADIO_UTILS = {
    save() {
        try {
            localStorage.setItem('radioState', JSON.stringify(window.RADIO_STATE));
            return true;
        } catch (error) {
            console.warn('Erro ao salvar:', error);
            return false;
        }
    },
    
    load() {
        try {
            const saved = localStorage.getItem('radioState');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Mesclar dados salvos mantendo estrutura atual
                window.RADIO_STATE.library = parsed.library || window.RADIO_STATE.library;
                window.RADIO_STATE.stats = parsed.stats || window.RADIO_STATE.stats;
                window.RADIO_STATE.schedule.activeAlbum = parsed.schedule?.activeAlbum || null;
                
                // Reset transmission state
                window.RADIO_STATE.transmission.isLive = false;
                window.RADIO_STATE.transmission.isPlaying = false;
                console.log('📦 Estado carregado do localStorage');
            }
            return true;
        } catch (error) {
            console.warn('Erro ao carregar:', error);
            return false;
        }
    },
    
    log(message, data = null) {
        console.log(`[RÁDIO] ${message}`, data || '');
    },
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    getCloudinaryURL() {
        return `https://api.cloudinary.com/v1_1/${window.RADIO_CONFIG.cloudinary.cloudName}/auto/upload`;
    }
};

console.log('✅ Configurações carregadas com sucesso!');
