// 📱 SERVICE WORKER DA RÁDIO SUPERMERCADO DO LOURO
// ==================================================

const CACHE_NAME = 'radio-louro-v1.0.0';
const STATIC_CACHE = 'radio-static-v1';
const DYNAMIC_CACHE = 'radio-dynamic-v1';

// Arquivos para cache offline
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/config.js',
    '/streaming.js',
    '/admin.js',
    '/app.js',
    '/manifest.json',
    'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png'
];

// URLs que não devem ser cacheadas
const CACHE_BLACKLIST = [
    '/admin',
    '/upload',
    'cloudinary.com',
    'analytics'
];

// Configurações de cache por tipo
const CACHE_STRATEGIES = {
    // Imagens - Cache First
    images: {
        strategy: 'cacheFirst',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        maxItems: 50
    },
    
    // Áudio - Network First (para stream ao vivo)
    audio: {
        strategy: 'networkFirst',
        maxAge: 60 * 60 * 1000, // 1 hora
        maxItems: 10
    },
    
    // API - Network First com fallback
    api: {
        strategy: 'networkFirst',
        maxAge: 5 * 60 * 1000, // 5 minutos
        maxItems: 100
    },
    
    // Assets estáticos - Cache First
    static: {
        strategy: 'cacheFirst',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
        maxItems: 200
    }
};

// === INSTALAÇÃO ===
self.addEventListener('install', (event) => {
    console.log('📱 Service Worker: Instalando...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Service Worker: Cache estático criado');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('✅ Service Worker: Instalado com sucesso');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Erro na instalação do Service Worker:', error);
            })
    );
});

// === ATIVAÇÃO ===
self.addEventListener('activate', (event) => {
    console.log('🔄 Service Worker: Ativando...');
    
    event.waitUntil(
        Promise.all([
            // Limpar caches antigos
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== CACHE_NAME) {
                            console.log('🗑️ Service Worker: Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            
            // Tomar controle de todas as abas
            self.clients.claim()
        ]).then(() => {
            console.log('✅ Service Worker: Ativado e controlando todas as abas');
        })
    );
});

// === INTERCEPTAÇÃO DE REQUISIÇÕES ===
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Ignorar requisições não-HTTP/HTTPS
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Ignorar URLs blacklistadas
    if (CACHE_BLACKLIST.some(item => request.url.includes(item))) {
        return;
    }
    
    // Estratégia baseada no tipo de arquivo
    if (isImageRequest(request)) {
        event.respondWith(handleImageRequest(request));
    } else if (isAudioRequest(request)) {
        event.respondWith(handleAudioRequest(request));
    } else if (isAPIRequest(request)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isStaticAsset(request)) {
        event.respondWith(handleStaticRequest(request));
    } else {
        event.respondWith(handleGenericRequest(request));
    }
});

// === ESTRATÉGIAS DE CACHE ===

// Cache First - para assets estáticos
async function cacheFirst(request, cacheName, maxAge) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
        // Verificar se ainda está válido
        const dateHeader = cachedResponse.headers.get('date');
        const cachedDate = dateHeader ? new Date(dateHeader) : new Date(0);
        const isExpired = Date.now() - cachedDate.getTime() > maxAge;
        
        if (!isExpired) {
            return cachedResponse;
        }
    }
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            // Clonar antes de cachear
            const responseClone = response.clone();
            await cache.put(request, responseClone);
        }
        return response;
    } catch (error) {
        // Se falhar, retornar cache mesmo se expirado
        return cachedResponse || createOfflineResponse();
    }
}

// Network First - para conteúdo dinâmico
async function networkFirst(request, cacheName, maxAge) {
    const cache = await caches.open(cacheName);
    
    try {
        const response = await fetch(request);
        if (response.ok) {
            const responseClone = response.clone();
            await cache.put(request, responseClone);
        }
        return response;
    } catch (error) {
        const cachedResponse = await cache.match(request);
        return cachedResponse || createOfflineResponse();
    }
}

// Stale While Revalidate - para APIs
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => cachedResponse);
    
    return cachedResponse || fetchPromise;
}

// === HANDLERS POR TIPO DE RECURSO ===

function handleImageRequest(request) {
    return cacheFirst(request, `${CACHE_NAME}-images`, CACHE_STRATEGIES.images.maxAge);
}

function handleAudioRequest(request) {
    // Para streams ao vivo, sempre buscar na rede
    if (request.url.includes('stream') || request.url.includes('live')) {
        return fetch(request);
    }
    
    return networkFirst(request, `${CACHE_NAME}-audio`, CACHE_STRATEGIES.audio.maxAge);
}

function handleAPIRequest(request) {
    return staleWhileRevalidate(request, `${CACHE_NAME}-api`);
}

function handleStaticRequest(request) {
    return cacheFirst(request, STATIC_CACHE, CACHE_STRATEGIES.static.maxAge);
}

function handleGenericRequest(request) {
    return networkFirst(request, DYNAMIC_CACHE, 24 * 60 * 60 * 1000); // 24h
}

// === UTILITÁRIOS DE DETECÇÃO ===

function isImageRequest(request) {
    return request.destination === 'image' || 
           /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(request.url);
}

function isAudioRequest(request) {
    return request.destination === 'audio' || 
           /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(request.url) ||
           request.url.includes('stream') ||
           request.url.includes('radio') ||
           request.url.includes(':8000');
}

function isAPIRequest(request) {
    return request.url.includes('/api/') ||
           request.url.includes('cloudinary.com') ||
           request.url.includes('status') ||
           request.url.includes('.json');
}

function isStaticAsset(request) {
    return request.destination === 'script' ||
           request.destination === 'style' ||
           /\.(js|css|html)(\?.*)?$/i.test(request.url);
}

// === RESPOSTAS OFFLINE ===

function createOfflineResponse() {
    return new Response(
        JSON.stringify({
            message: 'Você está offline',
            timestamp: new Date().toISOString(),
            cached: true
        }),
        {
            status: 200,
            statusText: 'OK (Offline)',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
}

function createOfflinePage() {
    const offlineHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>📻 Rádio Offline</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .offline-content {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(20px);
                    padding: 40px;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                h1 { font-size: 3rem; margin-bottom: 20px; }
                p { font-size: 1.2rem; opacity: 0.9; margin-bottom: 30px; }
                button {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 10px;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                button:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            </style>
        </head>
        <body>
            <div class="offline-content">
                <h1>📻</h1>
                <h2>Rádio Supermercado do Louro</h2>
                <p>Você está offline. Conecte-se à internet para ouvir a rádio ao vivo.</p>
                <button onclick="window.location.reload()">🔄 Tentar Novamente</button>
            </div>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        status: 200,
        headers: {
            'Content-Type': 'text/html'
        }
    });
}

// === MENSAGENS DA APLICAÇÃO ===
self.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    
    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'CACHE_CLEAR':
            clearAllCaches().then(() => {
                event.ports[0].postMessage({ success: true });
            });
            break;
            
        case 'CACHE_STATUS':
            getCacheStatus().then((status) => {
                event.ports[0].postMessage({ status });
            });
            break;
            
        case 'PRELOAD_AUDIO':
            preloadAudio(payload.urls);
            break;
            
        default:
            console.log('📱 Service Worker: Mensagem desconhecida:', type);
    }
});

// === NOTIFICAÇÕES PUSH ===
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'Nova música tocando!',
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            tag: 'radio-notification',
            renotify: true,
            requireInteraction: false,
            actions: [
                {
                    action: 'listen',
                    title: '🎧 Ouvir',
                    icon: '/icon-72.png'
                },
                {
                    action: 'close',
                    title: '✕ Fechar'
                }
            ],
            data: {
                url: data.url || '/',
                track: data.track
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(
                data.title || '📻 Rádio Supermercado do Louro',
                options
            )
        );
    } catch (error) {
        console.error('❌ Erro ao processar notificação push:', error);
    }
});

// === CLIQUES EM NOTIFICAÇÕES ===
self.addEventListener('notificationclick', (event) => {
    const { action, data } = event.notification;
    
    event.notification.close();
    
    if (action === 'listen') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // Verificar se já há uma aba aberta
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Abrir nova aba
                if (clients.openWindow) {
                    return clients.openWindow(data.url || '/');
                }
            })
        );
    }
    
    // Enviar evento para a aplicação
    event.waitUntil(
        clients.matchAll().then((clientList) => {
            clientList.forEach((client) => {
                client.postMessage({
                    type: 'NOTIFICATION_CLICK',
                    action: action,
                    data: data
                });
            });
        })
    );
});

// === SINCRONIZAÇÃO EM BACKGROUND ===
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

async function doBackgroundSync() {
    try {
        // Sincronizar dados quando voltar online
        const clients = await self.clients.matchAll();
        
        clients.forEach((client) => {
            client.postMessage({
                type: 'BACKGROUND_SYNC',
                timestamp: Date.now()
            });
        });
        
        console.log('🔄 Sincronização em background realizada');
    } catch (error) {
        console.error('❌ Erro na sincronização em background:', error);
    }
}

// === UTILITÁRIOS DE CACHE ===

async function clearAllCaches() {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames.map(cacheName => caches.delete(cacheName));
    await Promise.all(deletePromises);
    console.log('🗑️ Todos os caches limpos');
}

async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = keys.length;
    }
    
    return status;
}

async function preloadAudio(urls) {
    if (!Array.isArray(urls)) return;
    
    const cache = await caches.open(`${CACHE_NAME}-audio`);
    
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response);
                console.log('🎵 Áudio pré-carregado:', url);
            }
        } catch (error) {
            console.warn('⚠️ Falha ao pré-carregar áudio:', url);
        }
    }
}

// === LIMPEZA PERIÓDICA DE CACHE ===
async function cleanupExpiredCache() {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            const dateHeader = response.headers.get('date');
            
            if (dateHeader) {
                const cachedDate = new Date(dateHeader);
                const isExpired = Date.now() - cachedDate.getTime() > (7 * 24 * 60 * 60 * 1000); // 7 dias
                
                if (isExpired) {
                    await cache.delete(request);
                    console.log('🗑️ Cache expirado removido:', request.url);
                }
            }
        }
    }
}

// Executar limpeza a cada 6 horas
setInterval(cleanupExpiredCache, 6 * 60 * 60 * 1000);

// === ANALYTICS OFFLINE ===
let offlineActions = [];

function trackOfflineAction(action) {
    offlineActions.push({
        action,
        timestamp: Date.now(),
        url: self.location.href
    });
    
    // Limitar a 100 ações
    if (offlineActions.length > 100) {
        offlineActions = offlineActions.slice(-100);
    }
}

// Enviar ações quando voltar online
self.addEventListener('online', () => {
    if (offlineActions.length > 0) {
        // Enviar dados para analytics
        fetch('/api/analytics/offline', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ actions: offlineActions })
        }).then(() => {
            offlineActions = [];
            console.log('📊 Dados offline enviados para analytics');
        }).catch(error => {
            console.warn('⚠️ Falha ao enviar dados offline:', error);
        });
    }
});

// === DEBUG E LOGS ===
const DEBUG = false;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[SW Debug] ${message}`, data);
    }
}

// === ESTRATÉGIA DE CACHE ADAPTATIVA ===
class AdaptiveCacheStrategy {
    constructor() {
        this.networkSpeed = 'unknown';
        this.cacheHitRate = new Map();
        this.requestFrequency = new Map();
    }
    
    // Detectar velocidade da rede
    async detectNetworkSpeed() {
        if (!navigator.connection) return 'unknown';
        
        const connection = navigator.connection;
        const effectiveType = connection.effectiveType;
        
        switch (effectiveType) {
            case 'slow-2g':
            case '2g':
                return 'slow';
            case '3g':
                return 'medium';
            case '4g':
                return 'fast';
            default:
                return 'unknown';
        }
    }
    
    // Escolher estratégia baseada no contexto
    async chooseStrategy(request) {
        const url = request.url;
        const networkSpeed = await this.detectNetworkSpeed();
        
        // Contar frequência de requisições
        this.requestFrequency.set(url, (this.requestFrequency.get(url) || 0) + 1);
        
        // Para conexões lentas, priorizar cache
        if (networkSpeed === 'slow') {
            return 'cacheFirst';
        }
        
        // Para recursos muito acessados, usar stale-while-revalidate
        if (this.requestFrequency.get(url) > 10) {
            return 'staleWhileRevalidate';
        }
        
        // Para streams ao vivo, sempre network first
        if (url.includes('stream') || url.includes('live')) {
            return 'networkOnly';
        }
        
        // Padrão baseado no tipo
        if (isStaticAsset({ url })) {
            return 'cacheFirst';
        }
        
        return 'networkFirst';
    }
    
    // Atualizar taxa de acerto do cache
    updateCacheHitRate(url, hit) {
        const current = this.cacheHitRate.get(url) || { hits: 0, misses: 0 };
        
        if (hit) {
            current.hits++;
        } else {
            current.misses++;
        }
        
        this.cacheHitRate.set(url, current);
    }
}

const adaptiveStrategy = new AdaptiveCacheStrategy();

// === CACHE INTELIGENTE ===
class IntelligentCache {
    constructor() {
        this.maxCacheSize = 50 * 1024 * 1024; // 50MB
        this.currentCacheSize = 0;
        this.accessTimes = new Map();
        this.priorities = new Map();
    }
    
    async put(request, response, priority = 1) {
        const cache = await caches.open(DYNAMIC_CACHE);
        const url = request.url;
        
        // Verificar tamanho do response
        const responseSize = await this.getResponseSize(response.clone());
        
        // Se exceder limite, fazer limpeza
        if (this.currentCacheSize + responseSize > this.maxCacheSize) {
            await this.cleanup();
        }
        
        // Cachear com metadados
        this.accessTimes.set(url, Date.now());
        this.priorities.set(url, priority);
        this.currentCacheSize += responseSize;
        
        return cache.put(request, response);
    }
    
    async cleanup() {
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        // Ordenar por prioridade e tempo de acesso
        const sortedRequests = requests.sort((a, b) => {
            const priorityA = this.priorities.get(a.url) || 1;
            const priorityB = this.priorities.get(b.url) || 1;
            const timeA = this.accessTimes.get(a.url) || 0;
            const timeB = this.accessTimes.get(b.url) || 0;
            
            // Prioridade menor = menos importante
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            
            // Tempo mais antigo = menos importante
            return timeA - timeB;
        });
        
        // Remover 30% dos itens menos importantes
        const itemsToRemove = Math.floor(sortedRequests.length * 0.3);
        
        for (let i = 0; i < itemsToRemove; i++) {
            const request = sortedRequests[i];
            await cache.delete(request);
            
            this.accessTimes.delete(request.url);
            this.priorities.delete(request.url);
        }
        
        // Recalcular tamanho do cache
        await this.recalculateCacheSize();
        
        console.log(`🧹 Cache limpo: ${itemsToRemove} itens removidos`);
    }
    
    async getResponseSize(response) {
        if (response.headers.get('content-length')) {
            return parseInt(response.headers.get('content-length'));
        }
        
        // Estimar baseado no corpo da resposta
        try {
            const text = await response.text();
            return new Blob([text]).size;
        } catch {
            return 1024; // 1KB default
        }
    }
    
    async recalculateCacheSize() {
        this.currentCacheSize = 0;
        
        const cache = await caches.open(DYNAMIC_CACHE);
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await cache.match(request);
                if (response) {
                    this.currentCacheSize += await this.getResponseSize(response.clone());
                }
            } catch (error) {
                // Ignorar erros individuais
            }
        }
    }
}

const intelligentCache = new IntelligentCache();

// === PREFETCH INTELIGENTE ===
class SmartPrefetch {
    constructor() {
        this.prefetchQueue = [];
        this.prefetching = false;
        this.networkConditions = 'unknown';
    }
    
    async addToPrefetch(urls, priority = 1) {
        if (!Array.isArray(urls)) {
            urls = [urls];
        }
        
        urls.forEach(url => {
            if (!this.prefetchQueue.some(item => item.url === url)) {
                this.prefetchQueue.push({
                    url,
                    priority,
                    added: Date.now()
                });
            }
        });
        
        // Ordenar por prioridade
        this.prefetchQueue.sort((a, b) => b.priority - a.priority);
        
        // Iniciar prefetch se não estiver em andamento
        if (!this.prefetching) {
            this.startPrefetch();
        }
    }
    
    async startPrefetch() {
        if (this.prefetching || this.prefetchQueue.length === 0) {
            return;
        }
        
        this.prefetching = true;
        
        // Verificar condições da rede
        const networkSpeed = await adaptiveStrategy.detectNetworkSpeed();
        
        // Não fazer prefetch em conexões lentas
        if (networkSpeed === 'slow') {
            this.prefetching = false;
            return;
        }
        
        while (this.prefetchQueue.length > 0) {
            const item = this.prefetchQueue.shift();
            
            try {
                await this.prefetchSingle(item.url);
                
                // Pequeno delay para não sobrecarregar
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.warn('⚠️ Falha no prefetch:', item.url, error);
            }
        }
        
        this.prefetching = false;
    }
    
    async prefetchSingle(url) {
        const cache = await caches.open(`${CACHE_NAME}-prefetch`);
        
        // Verificar se já está em cache
        const cachedResponse = await cache.match(url);
        if (cachedResponse) {
            return;
        }
        
        // Fazer request com baixa prioridade
        const response = await fetch(url, {
            mode: 'no-cors',
            cache: 'default'
        });
        
        if (response.ok) {
            await cache.put(url, response);
            console.log('📥 Prefetch concluído:', url);
        }
    }
}

const smartPrefetch = new SmartPrefetch();

// === MONITORAMENTO DE PERFORMANCE ===
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            cacheHits: 0,
            cacheMisses: 0,
            networkRequests: 0,
            totalResponseTime: 0,
            averageResponseTime: 0
        };
    }
    
    recordCacheHit() {
        this.metrics.cacheHits++;
    }
    
    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }
    
    recordNetworkRequest(responseTime) {
        this.metrics.networkRequests++;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.averageResponseTime = 
            this.metrics.totalResponseTime / this.metrics.networkRequests;
    }
    
    getCacheHitRatio() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
    }
    
    getMetrics() {
        return {
            ...this.metrics,
            cacheHitRatio: this.getCacheHitRatio()
        };
    }
    
    // Enviar métricas periodicamente
    async sendMetrics() {
        try {
            const metrics = this.getMetrics();
            
            // Enviar para analytics se disponível
            await fetch('/api/analytics/sw-metrics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...metrics,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent
                })
            });
            
            // Reset metrics após envio
            this.metrics = {
                cacheHits: 0,
                cacheMisses: 0,
                networkRequests: 0,
                totalResponseTime: 0,
                averageResponseTime: 0
            };
            
        } catch (error) {
            console.warn('⚠️ Falha ao enviar métricas:', error);
        }
    }
}

const performanceMonitor = new PerformanceMonitor();

// Enviar métricas a cada 15 minutos
setInterval(() => {
    performanceMonitor.sendMetrics();
}, 15 * 60 * 1000);

// === HANDLERS APRIMORADOS ===

// Handler aprimorado para requests genéricos
async function enhancedGenericHandler(request) {
    const startTime = Date.now();
    
    try {
        const strategy = await adaptiveStrategy.chooseStrategy(request);
        let response;
        
        switch (strategy) {
            case 'cacheFirst':
                response = await cacheFirst(request, DYNAMIC_CACHE, 24 * 60 * 60 * 1000);
                break;
            case 'networkFirst':
                response = await networkFirst(request, DYNAMIC_CACHE, 60 * 60 * 1000);
                break;
            case 'staleWhileRevalidate':
                response = await staleWhileRevalidate(request, DYNAMIC_CACHE);
                break;
            case 'networkOnly':
                response = await fetch(request);
                break;
            default:
                response = await networkFirst(request, DYNAMIC_CACHE, 60 * 60 * 1000);
        }
        
        // Registrar métricas
        const responseTime = Date.now() - startTime;
        performanceMonitor.recordNetworkRequest(responseTime);
        
        if (response.headers.get('x-cache') === 'HIT') {
            performanceMonitor.recordCacheHit();
        } else {
            performanceMonitor.recordCacheMiss();
        }
        
        return response;
        
    } catch (error) {
        console.error('❌ Erro no handler aprimorado:', error);
        return createOfflineResponse();
    }
}

// === OTIMIZAÇÕES DE BATERIA ===
class BatteryOptimizer {
    constructor() {
        this.isLowBattery = false;
        this.batteryLevel = 1;
        this.isCharging = true;
        
        this.initBatteryAPI();
    }
    
    async initBatteryAPI() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                
                this.batteryLevel = battery.level;
                this.isCharging = battery.charging;
                this.isLowBattery = battery.level < 0.2 && !battery.charging;
                
                // Escutar mudanças
                battery.addEventListener('levelchange', () => {
                    this.batteryLevel = battery.level;
                    this.isLowBattery = battery.level < 0.2 && !battery.charging;
                    this.adjustBehavior();
                });
                
                battery.addEventListener('chargingchange', () => {
                    this.isCharging = battery.charging;
                    this.isLowBattery = battery.level < 0.2 && !battery.charging;
                    this.adjustBehavior();
                });
                
            } catch (error) {
                console.warn('⚠️ Battery API não disponível');
            }
        }
    }
    
    adjustBehavior() {
        if (this.isLowBattery) {
            // Reduzir atividade em bateria baixa
            console.log('🔋 Modo economia de bateria ativado');
            
            // Pausar prefetching
            smartPrefetch.prefetching = false;
            smartPrefetch.prefetchQueue = [];
            
            // Reduzir intervalos de limpeza
            // (implementar conforme necessário)
            
        } else {
            console.log('🔋 Modo normal de bateria');
        }
    }
    
    shouldSkipOperation() {
        return this.isLowBattery;
    }
}

const batteryOptimizer = new BatteryOptimizer();

// === INSTALAÇÃO APRIMORADA ===
self.addEventListener('install', (event) => {
    console.log('📱 Service Worker: Instalando versão aprimorada...');
    
    event.waitUntil(
        Promise.all([
            // Cache estático
            caches.open(STATIC_CACHE).then(cache => {
                return cache.addAll(STATIC_ASSETS);
            }),
            
            // Inicializar sistemas
            intelligentCache.recalculateCacheSize(),
            
            // Configurar prefetch inicial
            smartPrefetch.addToPrefetch([
                'https://s10.aconvert.com/convert/p3r68-cdx67/a9p73-3tban.png'
            ], 10)
            
        ]).then(() => {
            console.log('✅ Service Worker instalado com sistemas aprimorados');
            return self.skipWaiting();
        })
    );
});

// === INTERCEPTAÇÃO APRIMORADA ===
self.addEventListener('fetch', (event) => {
    const request = event.request;
    
    // Skip em modo economia de bateria para requests não críticos
    if (batteryOptimizer.shouldSkipOperation() && !isCriticalRequest(request)) {
        return;
    }
    
    // Usar handler aprimorado para todos os requests
    if (request.url.startsWith('http')) {
        event.respondWith(enhancedGenericHandler(request));
    }
});

function isCriticalRequest(request) {
    return request.url.includes('stream') || 
           request.url.includes('api') || 
           request.destination === 'document';
}

// === LOG E DEBUG FINAL ===
console.log('📱 Service Worker da Rádio Supermercado do Louro carregado!');
console.log('🎵 Versão:', CACHE_NAME);
console.log('🚀 Recursos:', {
    'Cache Inteligente': true,
    'Prefetch Adaptativo': true,
    'Otimização de Bateria': true,
    'Monitoramento de Performance': true,
    'Estratégias Adaptativas': true
});

// === EXPORTS PARA DEBUGGING ===
if (DEBUG) {
    self.radioSWDebug = {
        adaptiveStrategy,
        intelligentCache,
        smartPrefetch,
        performanceMonitor,
        batteryOptimizer,
        metrics: () => performanceMonitor.getMetrics(),
        cacheStatus: getCacheStatus,
        clearCache: clearAllCaches
    };
}
