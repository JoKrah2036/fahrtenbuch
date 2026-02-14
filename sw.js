// Service Worker für Fahrtenbuch PWA
const CACHE_VERSION = 'v7'; // VERSION ERHÖHT von v6 auf v7 (Fix für doppelte Einträge)
const urlsToCache = [
    '/fahrtenbuch/',
    '/fahrtenbuch/index.html',
    '/fahrtenbuch/app.js',
    '/fahrtenbuch/manifest.json',
    '/fahrtenbuch/icon-192.png',
    '/fahrtenbuch/icon-512.png'
];

// Installation
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => {
                console.log('Cache geöffnet');
                return Promise.all(
                    urlsToCache.map(url => {
                        return cache.add(url).catch(err => {
                            console.error('Fehler beim Cachen von', url, err);
                        });
                    })
                );
            })
    );
    self.skipWaiting();
});

// Aktivierung - Alte Caches löschen
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_VERSION) {
                        console.log('Lösche alten Cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch - Network First für Google Script, Cache First für Assets
self.addEventListener('fetch', (event) => {
    // Nie Google Apps Script URL cachen
    if (event.request.url.includes('script.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Network First Strategie für die App
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Erfolgreiche Response → Cache aktualisieren
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Netzwerkfehler → Fallback zu Cache
                return caches.match(event.request);
            })
    );
});
