/**
 * Fahrtenbuch PWA - Hauptlogik
 * Offline-fähig mit automatischer Synchronisation
 */

// Konfiguration - HIER DEINE GOOGLE APPS SCRIPT URL EINTRAGEN!
const CONFIG = {
    SYNC_URL: 'DEINE_GOOGLE_APPS_SCRIPT_URL_HIER', // ← Hier deine URL einfügen!
    SYNC_INTERVAL: 30000, // Synchronisiert alle 30 Sekunden
    DB_NAME: 'FahrtenbuchDB',
    DB_VERSION: 1,
    STORE_NAME: 'entries'
};

// IndexedDB initialisieren
let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
                const objectStore = db.createObjectStore(CONFIG.STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                objectStore.createIndex('synced', 'synced', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Eintrag in IndexedDB speichern
function saveToIndexedDB(entry) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        const request = store.add(entry);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Alle unsynced Einträge abrufen
function getUnsyncedEntries() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        const index = store.index('synced');
        const request = index.getAll(false);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Eintrag als synchronisiert markieren
function markAsSynced(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
            const entry = request.result;
            entry.synced = true;
            const updateRequest = store.put(entry);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// Eintrag zu Google Sheets senden
async function syncEntry(entry) {
    try {
        const response = await fetch(CONFIG.SYNC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                datum: entry.datum,
                kmStand: entry.kmStand,
                kmTrip: entry.kmTrip,
                spritLiter: entry.spritLiter,
                kosten: entry.kosten,
                preisJeLiter: entry.preisJeLiter,
                tankstelle: entry.tankstelle,
                bemerkung: entry.bemerkung
            })
        });

        if (!response.ok) {
            throw new Error('Netzwerkfehler');
        }

        const result = await response.json();
        
        if (result.success) {
            await markAsSynced(entry.id);
            return true;
        } else {
            throw new Error(result.error || 'Unbekannter Fehler');
        }
    } catch (error) {
        console.error('Sync-Fehler:', error);
        return false;
    }
}

// Alle unsynced Einträge synchronisieren
async function syncAll() {
    if (!navigator.onLine) {
        return;
    }

    try {
        const entries = await getUnsyncedEntries();
        
        if (entries.length === 0) {
            updateSyncInfo('Alle Daten synchronisiert');
            return;
        }

        updateSyncInfo(`Synchronisiere ${entries.length} Eintrag/Einträge...`);

        for (const entry of entries) {
            await syncEntry(entry);
        }

        updateSyncInfo('Alle Daten synchronisiert');
        updatePendingCount();
    } catch (error) {
        console.error('Synchronisierungsfehler:', error);
    }
}

// UI-Updates
function updateOnlineStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (navigator.onLine) {
        statusDot.classList.remove('offline');
        statusText.textContent = 'Online';
        syncAll(); // Automatisch synchronisieren wenn online
    } else {
        statusDot.classList.add('offline');
        statusText.textContent = 'Offline';
    }
}

function updateSyncInfo(message) {
    const syncInfo = document.getElementById('syncInfo');
    syncInfo.textContent = message;
}

async function updatePendingCount() {
    const entries = await getUnsyncedEntries();
    if (entries.length > 0) {
        updateSyncInfo(`${entries.length} Eintrag/Einträge warten auf Synchronisation`);
    } else {
        updateSyncInfo('Alle Daten synchronisiert');
    }
}

function showMessage(type, message) {
    const successMsg = document.getElementById('successMessage');
    const errorMsg = document.getElementById('errorMessage');
    const loading = document.getElementById('loading');

    loading.style.display = 'none';

    if (type === 'success') {
        successMsg.textContent = message;
        successMsg.style.display = 'block';
        setTimeout(() => {
            successMsg.style.display = 'none';
        }, 3000);
    } else if (type === 'error') {
        errorMsg.textContent = message;
        errorMsg.style.display = 'block';
        setTimeout(() => {
            errorMsg.style.display = 'none';
        }, 3000);
    }
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

// Formular-Handler
async function handleSubmit(event) {
    event.preventDefault();
    showLoading();

    const entry = {
        datum: document.getElementById('datum').value,
        kmStand: document.getElementById('kmStand').value,
        kmTrip: document.getElementById('kmTrip').value,
        spritLiter: document.getElementById('spritLiter').value,
        kosten: document.getElementById('kosten').value || '',
        preisJeLiter: document.getElementById('preisJeLiter').value || '',
        tankstelle: document.getElementById('tankstelle').value || '',
        bemerkung: document.getElementById('bemerkung').value,
        timestamp: new Date().toISOString(),
        synced: false
    };

    try {
        // Lokal speichern
        await saveToIndexedDB(entry);
        
        // Formular zurücksetzen
        document.getElementById('fahrtenbuchForm').reset();
        
        // Datum auf heute setzen
        document.getElementById('datum').valueAsDate = new Date();
        
        showMessage('success', '✓ Eintrag gespeichert!');
        
        // Versuchen zu synchronisieren wenn online
        if (navigator.onLine) {
            await syncAll();
        } else {
            updatePendingCount();
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showMessage('error', '✗ Fehler beim Speichern');
    }
}

// PWA Installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installPrompt').style.display = 'block';
});

document.getElementById('installButton')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        document.getElementById('installPrompt').style.display = 'none';
    }
    
    deferredPrompt = null;
});

// Event Listeners
document.addEventListener('DOMContentLoaded', async () => {
    // Service Worker registrieren
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('sw.js');
            console.log('Service Worker registriert');
        } catch (error) {
            console.error('Service Worker Registrierung fehlgeschlagen:', error);
        }
    }

    // IndexedDB initialisieren
    await initDB();

    // Formular
    document.getElementById('fahrtenbuchForm').addEventListener('submit', handleSubmit);
    
    // Reset Button
    document.getElementById('resetButton').addEventListener('click', () => {
        document.getElementById('fahrtenbuchForm').reset();
        document.getElementById('datum').valueAsDate = new Date();
    });

    // Datum auf heute setzen
    document.getElementById('datum').valueAsDate = new Date();

    // Online/Offline Status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Pending count anzeigen
    updatePendingCount();

    // Periodische Synchronisation
    setInterval(syncAll, CONFIG.SYNC_INTERVAL);
});
