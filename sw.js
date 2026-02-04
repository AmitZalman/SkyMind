/**
 * SkyMind Service Worker v3.0.0
 * Features:
 * - Network-first for HTML/JSON, cache-first for assets
 * - DEV MODE bypass (localhost or ?nocache=1)
 * - Versioned cache with auto-cleanup
 */

const CACHE_VERSION = 'v3.2.1-hebrew-subtopics';
const STATIC_CACHE = 'skymind-static-' + CACHE_VERSION;
const DYNAMIC_CACHE = 'skymind-dynamic-' + CACHE_VERSION;

const STATIC_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './js/state.js',
    './js/storage.js',
    './js/router.js',
    './js/ui.js',
    './js/sr.js',
    './js/gamification.js',
    './js/quiz.js',
    './js/cms.js',
    './js/importer.js',
    './manifest.webmanifest',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Check if in dev mode
function isDevMode(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname === 'localhost' || 
               parsedUrl.hostname === '127.0.0.1' ||
               parsedUrl.searchParams.has('nocache');
    } catch (e) {
        return false;
    }
}

// Install
self.addEventListener('install', event => {
    console.log('[SW ' + CACHE_VERSION + '] Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW ' + CACHE_VERSION + '] Pre-caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW ' + CACHE_VERSION + '] Skip waiting');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW ' + CACHE_VERSION + '] Install failed:', err);
            })
    );
});

// Activate
self.addEventListener('activate', event => {
    console.log('[SW ' + CACHE_VERSION + '] Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => {
                            return name.startsWith('skymind-') && 
                                   name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE;
                        })
                        .map(name => {
                            console.log('[SW ' + CACHE_VERSION + '] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW ' + CACHE_VERSION + '] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch
self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip cross-origin
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.origin !== location.origin) return;
    } catch (e) {
        return;
    }
    
    // DEV MODE: Always fetch from network
    if (isDevMode(url)) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }
    
    // Determine strategy
    const isHTML = event.request.mode === 'navigate' || 
                   url.endsWith('.html') || 
                   url.endsWith('/');
    const isJSON = url.includes('.json');
    const isJS = url.endsWith('.js');
    
    if (isHTML) {
        event.respondWith(networkFirst(event.request));
    } else if (isJSON) {
        event.respondWith(networkFirstWithFallback(event.request));
    } else {
        event.respondWith(cacheFirst(event.request));
    }
});

// Network-first (for HTML)
function networkFirst(request) {
    return fetch(request)
        .then(response => {
            if (response.ok) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, responseClone);
                });
            }
            return response;
        })
        .catch(() => {
            return caches.match(request).then(cached => {
                if (cached) return cached;
                if (request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            });
        });
}

// Network-first with fallback (for JSON)
function networkFirstWithFallback(request) {
    return fetch(request)
        .then(response => {
            if (response.ok) {
                const responseClone = response.clone();
                caches.open(DYNAMIC_CACHE).then(cache => {
                    cache.put(request, responseClone);
                });
            }
            return response;
        })
        .catch(() => {
            return caches.match(request).then(cached => {
                if (cached) {
                    return cached;
                }
                // For questions.json, return empty array
                if (request.url.includes('questions.json')) {
                    return new Response('[]', { 
                        status: 200, 
                        headers: { 'Content-Type': 'application/json' } 
                    });
                }
                return new Response('Offline', { status: 503 });
            });
        });
}

// Cache-first (for static assets)
function cacheFirst(request) {
    return caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
            if (response.ok) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, responseClone);
                });
            }
            return response;
        }).catch(() => {
            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
    });
}

// Message handler
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW ' + CACHE_VERSION + '] Received SKIP_WAITING');
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }
});

console.log('[SW ' + CACHE_VERSION + '] Script loaded');
