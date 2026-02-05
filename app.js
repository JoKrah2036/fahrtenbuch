// Konfiguration - HIER DEINE GOOGLE APPS SCRIPT URL EINTRAGEN!
const CONFIG = {
    // Ersetze dies mit deiner Google Apps Script Web-App URL
    // Anleitung siehe README.md
    SYNC_URL: 'https://script.google.com/macros/s/AKfycbwN29HLdYc4XS9so7AsiyfoAFCs1BzscvdDSildHdb8RQ6GXrkwgYZLBbWnw-Cmn8Jd/exec'
};

// Datenbank initialisieren
const DB_NAME = 'FahrtenbuchDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let db;

// IndexedDB initialisieren
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('synced', 'synced', { unique: false });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Eintrag speichern
async function saveEntry(entry) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const entryWithMeta = {
            ...entry,
            timestamp: new Date().toISOString(),
            synced: false
        };
        
        const request = store.add(entryWithMeta);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Nicht synchronisierte Einträge abrufen
async function getPendingEntries() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('synced');
        const request = index.getAll(false);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Eintrag als synchronisiert markieren
async function markAsSynced(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => {
            const entry = request.result;
            entry.synced = true;
            entry.syncedAt = new Date().toISOString();
            
            const updateRequest = store.put(entry);
            updateRequest.onsuccess = () => resolve();
            updateRequest.onerror = () => reject(updateRequest.error);
        };
        request.onerror = () => reject(request.error);
    });
}

// Mit Google Sheets synchronisieren
async function syncWithGoogleSheets() {
    if (!navigator.onLine) {
        console.log('Offline - Synchronisation übersprungen');
        return;
    }

    if (CONFIG.SYNC_URL === 'https://script.google.com/macros/s/AKfycbwN29HLdYc4XS9so7AsiyfoAFCs1BzscvdDSildHdb8RQ6GXrkwgYZLBbWnw-Cmn8Jd/exec') {
        console.log('Synchronisation übersprungen - URL noch nicht konfiguriert');
        return;
    }

    const pendingEntries = await getPendingEntries();
    
    if (pendingEntries.length === 0) {
        return;
    }

    console.log(`Synchronisiere ${pendingEntries.length} Einträge...`);

    for (const entry of pendingEntries) {
        try {
            const response = await fetch(CONFIG.SYNC_URL, {
                method: 'POST',
                mode: 'no-cors', // Wichtig für Google Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    datum: entry.datum,
                    km: entry.km,
                    liter: entry.liter || '',
                    kosten: entry.kosten || '',
                    zweck: entry.zweck,
                    timestamp: entry.timestamp
                })
            });

            // no-cors gibt keine echte Response zurück, also gehen wir davon aus, dass es funktioniert hat
            await markAsSynced(entry.id);
            console.log(`Eintrag ${entry.id} synchronisiert`);
            
        } catch (error) {
            console.error(`Fehler beim Synchronisieren von Eintrag ${entry.id}:`, error);
            // Bei Fehler stoppen wir, um nicht alle Anfragen zu versuchen
            break;
        }
    }

    updatePendingCount();
    
    const remaining = await getPendingEntries();
    if (remaining.length === 0) {
        showNotification('Alle Einträge erfolgreich synchronisiert! ✓', 'success');
    }
}

// Online/Offline Status überwachen
function updateOnlineStatus() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    if (navigator.onLine) {
        indicator.classList.remove('offline');
        text.textContent = 'Online';
        syncWithGoogleSheets(); // Automatisch synchronisieren, wenn online
    } else {
        indicator.classList.add('offline');
        text.textContent = 'Offline';
    }
}

// Anzahl wartender Einträge aktualisieren
async function updatePendingCount() {
    const pendingEntries = await getPendingEntries();
    const countElement = document.getElementById('pendingCount');
    const textElement = document.getElementById('pendingText');
    
    countElement.textContent = pendingEntries.length;
    
    if (pendingEntries.length === 1) {
        textElement.textContent = 'Eintrag wartet auf Synchronisation';
    } else {
        textElement.textContent = 'Einträge warten auf Synchronisation';
    }
}

// Benachrichtigung anzeigen
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Formular-Handler
document.getElementById('fahrtenbuchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const entry = {
        datum: formData.get('datum'),
        km: parseFloat(formData.get('km')),
        liter: formData.get('liter') ? parseFloat(formData.get('liter')) : null,
        kosten: formData.get('kosten') ? parseFloat(formData.get('kosten')) : null,
        zweck: formData.get('zweck')
    };
    
    try {
        await saveEntry(entry);
        showNotification('Eintrag gespeichert! 📝', 'success');
        e.target.reset();
        
        // Datum auf heute setzen
        document.getElementById('datum').valueAsDate = new Date();
        
        await updatePendingCount();
        
        // Versuche direkt zu synchronisieren, wenn online
        if (navigator.onLine) {
            setTimeout(() => syncWithGoogleSheets(), 500);
        } else {
            showNotification('Wird synchronisiert, sobald du online bist', 'info');
        }
        
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showNotification('Fehler beim Speichern! ❌', 'error');
    }
});

// Reset Button
document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('fahrtenbuchForm').reset();
    document.getElementById('datum').valueAsDate = new Date();
});

// PWA Installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installPrompt').style.display = 'block';
});

document.getElementById('installButton').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        showNotification('App wurde installiert! 🎉', 'success');
    }
    
    deferredPrompt = null;
    document.getElementById('installPrompt').style.display = 'none';
});

// Online/Offline Events
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Periodische Synchronisation (alle 30 Sekunden, wenn online)
setInterval(() => {
    if (navigator.onLine) {
        syncWithGoogleSheets();
    }
}, 30000);

// App initialisieren
async function initApp() {
    try {
        await initDB();
        updateOnlineStatus();
        await updatePendingCount();
        
        // Datum auf heute setzen
        document.getElementById('datum').valueAsDate = new Date();
        
        console.log('Fahrtenbuch-App initialisiert');
    } catch (error) {
        console.error('Fehler beim Initialisieren:', error);
        showNotification('Fehler beim Starten der App', 'error');
    }
}

// App starten
initApp();
