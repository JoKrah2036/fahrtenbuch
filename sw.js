// Service Worker für Fahrtenbuch PWA
const CACHE_NAME = 'fahrtenbuch-v8';  // ← v8 wegen URL-Fix!

// Nur essentielle Dateien cachen
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
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Cache geöffnet');
                // Lade Dateien einzeln statt addAll() um Fehler zu vermeiden
                return Promise.all(
                    urlsToCache.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn(`Fehler beim Cachen von ${url}:`, err);
                        });
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Alle Dateien gecacht');
                return self.skipWaiting();
            })
    );
});

// Activation
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Lösche alten Cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated');
            return self.clients.claim();
        })
    );
});

// Fetch - Network First Strategie (für Sync-URLs), Cache First für Assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Ignoriere Google Apps Script URLs
    if (url.hostname.includes('script.google.com') || 
        url.hostname.includes('googleapis.com')) {
        return;
    }

    event.respondWith(
        // Versuche zuerst das Netzwerk
        fetch(event.request)
            .then((response) => {
                // Clone die Response da sie nur einmal verwendet werden kann
                const responseToCache = response.clone();
                
                // Update den Cache mit der neuen Response
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                
                return response;
            })
            .catch(() => {
                // Falls Netzwerk fehlschlägt, versuche Cache
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    
                    // Falls auch Cache fehlschlägt und es eine Navigation ist
                    if (event.request.mode === 'navigate') {
                        return caches.match('/fahrtenbuch/index.html');
                    }
                    
                    return new Response('Offline - Ressource nicht verfügbar', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({
                            'Content-Type': 'text/plain'
                        })
                    });
                });
            })
    );
});