// Service Worker für Fahrtenbuch PWA - Optimiert für Offline-First
const CACHE_VERSION = 'v8'; // VERSION ERHÖHT: Performance-Optimierungen
const urlsToCache = [
    '/fahrtenbuch/',
    '/fahrtenbuch/index.html',
    '/fahrtenbuch/app.js',
    '/fahrtenbuch/manifest.json',
    '/fahrtenbuch/icon-192.png',
    '/fahrtenbuch/icon-512.png'
];

// Installation - Aggressive Caching
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => {
                console.log('✓ Cache geöffnet:', CACHE_VERSION);
                // Alle Dateien sofort cachen
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✓ Alle Dateien gecacht');
                return self.skipWaiting(); // Sofort aktivieren
            })
    );
});

// Aktivierung - Alte Caches aggressiv löschen
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
            return self.clients.claim(); // Kontrolle übernehmen
        })
    );
});

// Fetch - CACHE FIRST für sofortiges Laden (Offline-First)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Nie Google Apps Script URL cachen
    if (url.hostname.includes('script.google.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // CACHE-FIRST Strategie: Sofort aus Cache laden
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Wenn im Cache gefunden → SOFORT zurückgeben
                if (cachedResponse) {
                    // Parallel: Im Hintergrund Network-Request für Update
                    fetch(event.request)
                        .then((networkResponse) => {
                            // Erfolgreiche Network-Response → Cache aktualisieren
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_VERSION).then((cache) => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                        })
                        .catch(() => {
                            // Network-Fehler ignorieren, Cache ist bereits ausgeliefert
                        });
                    
                    return cachedResponse; // SOFORT aus Cache
                }

                // Nicht im Cache → Netzwerk-Request
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Erfolgreiche Response → In Cache speichern
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_VERSION).then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Netzwerkfehler → Fallback (z.B. Offline-Seite)
                        console.log('❌ Netzwerkfehler für:', event.request.url);
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});
