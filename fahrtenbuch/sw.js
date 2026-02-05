const CACHE_NAME = 'fahrtenbuch-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

// Installation - Cache vorbereiten
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache geöffnet');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktivierung - Alte Caches entfernen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Alter Cache entfernt:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch - Cache-First-Strategie
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache-Treffer - gebe gecachte Version zurück
        if (response) {
          return response;
        }

        // Keine Cache-Treffer - versuche vom Netzwerk zu laden
        return fetch(event.request).then(
          response => {
            // Prüfe ob gültige Response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone Response für Cache
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
      .catch(() => {
        // Offline und nicht im Cache - zeige Offline-Seite
        return caches.match('/index.html');
      })
  );
});

// Hintergrund-Synchronisation
self.addEventListener('sync', event => {
  if (event.tag === 'sync-fahrtenbuch') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Wird von der Haupt-App getriggert
  console.log('Hintergrund-Sync gestartet');
}
