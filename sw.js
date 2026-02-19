// Service Worker für Fahrtenbuch PWA - Version 3.0
const CACHE_VERSION = 'v10'; // VERSION ERHÖHT für v3.0
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
                console.log('✓ Cache geöffnet:', CACHE_VERSION);
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✓ Alle Dateien gecacht');
                return self.skipWaiting();
            })
    );
});

// Aktivierung
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_VERSION) {
                        console.log('🗑️ Lösche alten Cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✓ Service Worker aktiviert');
            return self.clients.claim();
        })
    );
});

// Fetch - CACHE FIRST für sofortiges Laden
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Nie Google Apps Script URL cachen
    if (url.hostname.includes('script.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // CACHE-FIRST Strategie
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Im Hintergrund Update holen
                    fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_VERSION).then((cache) => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                        })
                        .catch(() => {});
                    
                    return cachedResponse;
                }

                // Nicht im Cache → Netzwerk
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_VERSION).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        console.log('❌ Netzwerkfehler für:', event.request.url);
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});
