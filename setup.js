/**
 * Arquivo de configuração e setup da Rádio Supermercado do Louro
 * Execute este arquivo para configurar a aplicação
 */

// Configurações padrão da aplicação
window.RADIO_CONFIG = {
    // Informações da rádio
    station: {
        name: 'Rádio Supermercado do Louro',
        tagline: 'A trilha sonora das suas compras',
        logo: 'https://via.placeholder.com/300x300/333333/ffffff?text=Rádio+Louro'
    },
    
    // Configurações de reprodução
    playback: {
        autoStart: true,           // Iniciar automaticamente
        defaultVolume: 0.7,        // Volume padrão (0-1)
        musicInterval: 3,          // Músicas entre hora certa
        adsInterval: 6,            // Músicas entre avisos
        crossfade: false,          // Crossfade entre músicas
        shuffle: true              // Embaralhar playlist
    },
    
    // Configurações admin
    admin: {
        password: 'admin123',      // Senha padrão
        sessionTimeout: 3600,      // Timeout em segundos
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFormats: ['mp3', 'wav', 'ogg', 'flac']
    },
    
    // Configurações de álbuns temáticos
    albums: {
        natal: {
            name: 'Especial Natal',
            period: { start: '12-01', end: '12-31' },
            image: 'https://via.placeholder.com/300x300/e74c3c/ffffff?text=🎄+Natal',
            autoActivate: true
        },
        pascoa: {
            name: 'Especial Páscoa',
            period: { start: '03-15', end: '04-30' },
            image: 'https://via.placeholder.com/300x300/f39c12/ffffff?text=🐰+Páscoa',
            autoActivate: true
        },
        saojoao: {
            name: 'Especial São João',
            period: { start: '06-01', end: '06-30' },
            image: 'https://via.placeholder.com/300x300/27ae60/ffffff?text=🎪+São+João',
            autoActivate: true
        },
        carnaval: {
            name: 'Especial Carnaval',
            period: { start: '02-01', end: '02-28' },
            image: 'https://via.placeholder.com/300x300/9b59b6/ffffff?text=🎭+Carnaval',
            autoActivate: true
        }
    },
    
    // Configurações de interface
    ui: {
        theme: 'dark',             // dark, light, auto
        animations: true,          // Habilitar animações
        notifications: true,       // Mostrar notificações
        compactMode: false,        // Modo compacto
        showStats: true           // Mostrar estatísticas
    },
    
    // Configurações de armazenamento
    storage: {
        prefix: 'radio_louro_',   // Prefixo para localStorage
        compression: false,        // Comprimir dados
        encryption: false,         // Criptografar dados
        maxStorageSize: 10 * 1024 * 1024 // 10MB
    }
};

// Função para aplicar configurações personalizadas
window.applyCustomConfig = function(customConfig) {
    // Merge recursivo das configurações
    function deepMerge(target, source) {
        for (let key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }
    
    window.RADIO_CONFIG = deepMerge(window.RADIO_CONFIG, customConfig);
    console.log('🔧 Configurações personalizadas aplicadas');
};

// Função para verificar se é época de álbum temático
window.checkSeasonalAlbum = function() {
    const now = new Date();
    const currentDate = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    for (let albumKey in window.RADIO_CONFIG.albums) {
        const album = window.RADIO_CONFIG.albums[albumKey];
        if (album.autoActivate && album.period) {
            const { start, end } = album.period;
            
            // Verificação simples de período (pode ser melhorada para anos bissextos)
            if (currentDate >= start && currentDate <= end) {
                return albumKey;
            }
        }
    }
    
    return null;
};

// Função para inicializar configurações
window.initializeRadioConfig = function() {
    // Aplicar configurações de tema
    if (window.RADIO_CONFIG.ui.theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', window.RADIO_CONFIG.ui.theme);
    }
    
    // Aplicar configurações de animações
    if (!window.RADIO_CONFIG.ui.animations) {
        document.documentElement.style.setProperty('--animation-duration', '0s');
    }
    
    // Verificar álbum sazonal
    const seasonalAlbum = window.checkSeasonalAlbum();
    if (seasonalAlbum && !localStorage.getItem('activeAlbum')) {
        localStorage.setItem('activeAlbum', seasonalAlbum);
        console.log(`🎵 Álbum sazonal ativado automaticamente: ${seasonalAlbum}`);
    }
    
    // Configurar título da página
    document.title = window.RADIO_CONFIG.station.name;
    
    // Configurar meta tags
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.content = `${window.RADIO_CONFIG.station.name} - ${window.RADIO_CONFIG.station.tagline}`;
    }
    
    console.log('⚙️ Configurações da rádio inicializadas');
};

// Função para exportar configurações
window.exportConfig = function() {
    const config = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        config: window.RADIO_CONFIG,
        playlists: JSON.parse(localStorage.getItem('radioPlaylists') || '{}'),
        stats: JSON.parse(localStorage.getItem('playStats') || '{}'),
        activeAlbum: localStorage.getItem('activeAlbum')
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    console.log('📥 Configurações exportadas');
};

// Função para importar configurações
window.importConfig = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const importedConfig = JSON.parse(e.target.result);
                
                // Aplicar configurações
                if (importedConfig.config) {
                    window.applyCustomConfig(importedConfig.config);
                }
                
                // Importar playlists
                if (importedConfig.playlists) {
                    localStorage.setItem('radioPlaylists', JSON.stringify(importedConfig.playlists));
                }
                
                // Importar estatísticas
                if (importedConfig.stats) {
                    localStorage.setItem('playStats', JSON.stringify(importedConfig.stats));
                }
                
                // Importar álbum ativo
                if (importedConfig.activeAlbum) {
                    localStorage.setItem('activeAlbum', importedConfig.activeAlbum);
                }
                
                console.log('📤 Configurações importadas com sucesso');
                resolve(importedConfig);
                
            } catch (error) {
                console.error('Erro ao importar configurações:', error);
                reject(error);
            }
        };
        
        reader.onerror = function() {
            reject(new Error('Erro ao ler arquivo'));
        };
        
        reader.readAsText(file);
    });
};

// Função para resetar configurações
window.resetToDefault = function() {
    if (confirm('Tem certeza que deseja resetar todas as configurações? Esta ação não pode ser desfeita.')) {
        // Limpar localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('radio_louro_') || key.includes('radio')) {
                localStorage.removeItem(key);
            }
        });
        
        // Recarregar página
        location.reload();
    }
};

// Função para diagnosticar problemas
window.runDiagnostics = function() {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        browser: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        },
        audio: {
            supported: typeof Audio !== 'undefined',
            formats: {}
        },
        storage: {
            localStorage: typeof localStorage !== 'undefined',
            sessionStorage: typeof sessionStorage !== 'undefined',
            usage: {}
        },
        config: window.RADIO_CONFIG
    };
    
    // Testar formatos de áudio
    if (diagnostics.audio.supported) {
        const audio = new Audio();
        const formats = ['mp3', 'wav', 'ogg', 'flac'];
        
        formats.forEach(format => {
            const mimeType = `audio/${format}`;
            diagnostics.audio.formats[format] = audio.canPlayType(mimeType) !== '';
        });
    }
    
    // Verificar uso do localStorage
    if (diagnostics.storage.localStorage) {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        diagnostics.storage.usage.localStorage = `${(totalSize / 1024).toFixed(2)} KB`;
    }
    
    console.log('🔍 Diagnóstico completo:', diagnostics);
    return diagnostics;
};

// Função para mostrar informações de sistema
window.showSystemInfo = function() {
    const info = {
        version: '1.0.0',
        buildDate: '2024-01-15',
        features: [
            'Player automático',
            'Upload de arquivos',
            'Álbums temáticos',
            'Relatórios de estatísticas',
            'Interface responsiva',
            'Modo administrador'
        ],
        dependencies: [
            'HTML5 Audio API',
            'File API',
            'LocalStorage',
            'Cloudinary',
            'Font Awesome'
        ],
        browser: navigator.userAgent,
        config: window.RADIO_CONFIG
    };
    
    console.table(info);
    return info;
};

// Função para gerar relatório de desempenho
window.generatePerformanceReport = function() {
    const report = {
        timestamp: new Date().toISOString(),
        memory: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
        } : 'N/A',
        timing: performance.timing ? {
            loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart + ' ms',
            domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + ' ms',
            firstPaint: performance.getEntriesByType('paint')[0]?.startTime + ' ms' || 'N/A'
        } : 'N/A',
        resources: performance.getEntriesByType('resource').length
    };
    
    console.log('📊 Relatório de desempenho:', report);
    return report;
};

// Inicializar configurações quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    window.initializeRadioConfig();
});

console.log('🚀 Setup da Rádio Supermercado do Louro carregado!');
