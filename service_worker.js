/**
 * SERVICE WORKER - RÁDIO SUPERMERCADO DO LOURO
 * =============================================
 * Mantém a rádio funcionando em background e offline
 */

const CACHE_NAME = 'radio-louro-v1';
const CACHE_URLS = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Ativação do Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptação de requisições
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Retorna do cache se disponível
                if (response) {
                    return response;
                }
                
                // Senão, busca na rede
                return fetch(event.request).catch(() => {
                    // Em caso de erro, retorna página offline se for HTML
                    if (event.request.destination === 'document') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});

// Background Sync para manter a rádio ativa
self.addEventListener('sync', event => {
    if (event.tag === 'radio-heartbeat') {
        event.waitUntil(sendHeartbeat());
    }
});

// Mensagens do cliente
self.addEventListener('message', event => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'RADIO_STATUS':
            // Armazenar status da rádio
            self.radioStatus = data;
            break;
            
        case 'START_BACKGROUND_SYNC':
            // Registrar background sync
            self.registration.sync.register('radio-heartbeat');
            break;
            
        case 'PING':
            // Responder ping para manter conexão
            event.ports[0].postMessage({ type: 'PONG' });
            break;
    }
});

// Notificações push (se necessário)
self.addEventListener('push', event => {
    const options = {
        body: 'Rádio Supermercado do Louro está tocando',
        icon: './icon-192.png',
        badge: './icon-72.png',
        tag: 'radio-notification'
    };
    
    event.waitUntil(
        self.registration.showNotification('🎵 Rádio AO VIVO', options)
    );
});

// Função para enviar heartbeat
async function sendHeartbeat() {
    try {
        // Notificar cliente que está ativo
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SERVICE_WORKER_HEARTBEAT',
                timestamp: Date.now()
            });
        });
    } catch (error) {
        console.error('Erro no heartbeat:', error);
    }
}

// Manter Service Worker ativo
setInterval(() => {
    sendHeartbeat();
}, 30000); // A cada 30 segundos