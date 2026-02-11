/**
 * SkyMind Service Worker
 * - Network-first for app shell (HTML/JS/CSS) and data JSON
 * - Cache-first for static assets (images/icons/manifest)
 * - Offline fallback from cache
 */

const SW_BUILD = '3.3.3';
console.log(`[SW] build ${SW_BUILD} loaded`);

const STATIC_CACHE = `skymind-static-${SW_BUILD}`;
const DYNAMIC_CACHE = `skymind-dynamic-${SW_BUILD}`;

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
    console.log(`[SW ${SW_BUILD}] Installing...`);
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log(`[SW ${SW_BUILD}] Pre-caching static assets`);
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log(`[SW ${SW_BUILD}] Skip waiting`);
                return self.skipWaiting();
            })
            .catch(err => {
                console.error(`[SW ${SW_BUILD}] Install failed:`, err);
            })
    );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
    console.log(`[SW ${SW_BUILD}] Activating...`);
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('skymind-') &&
                                        name !== STATIC_CACHE &&
                                        name !== DYNAMIC_CACHE)
                        .map(name => {
                            console.log(`[SW ${SW_BUILD}] Deleting old cache:`, name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log(`[SW ${SW_BUILD}] Claiming clients`);
                return self.clients.claim();
            })
    );
});

// Fetch
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Skip non-GET
    if (event.request.method !== 'GET') return;

    // Skip cross-origin
    try {
        if (new URL(url).origin !== location.origin) return;
    } catch (e) { return; }

    // DEV MODE: bypass SW
    if (isDevMode(url)) {
        event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
        return;
    }

    // --- Data files (version.json / questions.json): no-store + offline fallback ---
    try {
        const pathname = new URL(url).pathname;
        if (pathname.endsWith('/version.json') || pathname.endsWith('/questions.json')) {
            const cacheKey = new Request(new URL(url).origin + pathname);
            event.respondWith(
                fetch(event.request, { cache: 'no-store' })
                    .then(res => {
                        if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(DYNAMIC_CACHE).then(c => c.put(cacheKey, copy))); }
                        return res;
                    })
                    .catch(() => caches.match(cacheKey).then(c => {
                        if (c) return c;
                        if (pathname.endsWith('/questions.json'))
                            return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
                        return new Response('Offline', { status: 503 });
                    }))
            );
            return;
        }
    } catch (e) {}

    // --- Navigation / HTML: network-first ---
    const dest = event.request.destination;
    const isNav = event.request.mode === 'navigate' ||
                  dest === 'document' ||
                  (event.request.headers.get('Accept') || '').includes('text/html');
    if (isNav) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(res => {
                    if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(STATIC_CACHE).then(c => c.put(event.request, copy))); }
                    return res;
                })
                .catch(() =>
                    caches.match(event.request)
                        .then(c => c || caches.match('/SkyMind/'))
                        .then(c => c || caches.match('/SkyMind/index.html'))
                        .then(c => c || caches.match('./index.html'))
                        .then(c => c || new Response('Offline', { status: 503 }))
                )
        );
        return;
    }

    // --- App shell JS/CSS: network-first ---
    if (dest === 'script' || dest === 'style' || url.endsWith('.js') || url.endsWith('.css')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(res => {
                    if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(STATIC_CACHE).then(c => c.put(event.request, copy))); }
                    return res;
                })
                .catch(() => caches.match(event.request)
                    .then(c => c || new Response('Offline', { status: 503 })))
        );
        return;
    }

    // --- Everything else (images, icons, manifest): cache-first ---
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(res => {
                if (res.ok) { const copy = res.clone(); event.waitUntil(caches.open(STATIC_CACHE).then(c => c.put(event.request, copy))); }
                return res;
            }).catch(() => new Response('Offline', { status: 503 }));
        })
    );
});

// Message handler
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log(`[SW ${SW_BUILD}] Received SKIP_WAITING`);
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: SW_BUILD });
    }
});
