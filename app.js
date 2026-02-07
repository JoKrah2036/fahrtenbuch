// 🚗 Fahrtenbuch PWA - App Logic v2.3 (FIXED FIELD NAMES)
// Offline-fähiges Fahrtenbuch mit Google Sheets Sync

// ========================================
// KONFIGURATION
// ========================================
const CONFIG = {
    APP_NAME: 'Fahrtenbuch',
    VERSION: '2.3',
    SYNC_URL: 'https://script.google.com/macros/s/AKfycbwMy2GqIaSYpkBl3ggHSfKpeAt98cxmlljrx0eFKyLI-lYxIVQkpcmF2IKxd_3arTFx/exec',
    DB_NAME: 'FahrtenbuchDB',
    DB_VERSION: 2,
    STORE_NAME: 'entries'
};

// ========================================
// HILFSFUNKTIONEN
// ========================================

/**
 * Konvertiert deutsche Zahleneingabe zu standardisiertem Format
 * WICHTIG: Entfernt ALLE Punkte (da sie Tausendertrennzeichen sind)
 * und wandelt Kommas in Dezimalpunkte um
 * 
 * Beispiele:
 * "233.300" -> "233300" (Tausenderpunkte entfernen)
 * "40,50" -> "40.50" (Komma zu Punkt)
 * "1,499" -> "1.499" (Komma zu Punkt)
 * "35000" -> "35000" (bleibt unverändert)
 */
function parseGermanNumber(value) {
    if (!value || value === '') return '';
    
    // Konvertiere zu String falls nötig
    let str = value.toString().trim();
    
    // Wenn leer nach trim
    if (str === '') return '';
    
    // WICHTIG: Entferne ALLE Punkte (Tausendertrennzeichen)
    str = str.replace(/\./g, '');
    
    // Ersetze Komma durch Punkt (Dezimaltrennzeichen)
    str = str.replace(',', '.');
    
    return str;
}

// ========================================
// INDEXEDDB SETUP
// ========================================
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (db.objectStoreNames.contains(CONFIG.STORE_NAME)) {
                db.deleteObjectStore(CONFIG.STORE_NAME);
            }

            const store = db.createObjectStore(CONFIG.STORE_NAME, { 
                keyPath: 'id', 
                autoIncrement: true 
            });
            
            store.createIndex('synced', 'synced', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            
            console.log('Datenbank erstellt/aktualisiert');
        };
    });
}

// ========================================
// DATENBANK OPERATIONEN
// ========================================
async function saveEntry(entry) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        
        const request = store.add({
            ...entry,
            synced: false,
            timestamp: new Date().toISOString()
        });

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getUnsyncedEntries() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        
        const request = store.getAll();

        request.onsuccess = () => {
            const allEntries = request.result || [];
            const unsynced = allEntries.filter(entry => !entry.synced);
            resolve(unsynced);
        };
        request.onerror = () => reject(request.error);
    });
}

async function markAsSynced(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const entry = getRequest.result;
            if (entry) {
                entry.synced = true;
                const updateRequest = store.put(entry);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
        
        getRequest.onerror = () => reject(getRequest.error);
    });
}

async function getAllEntries() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CONFIG.STORE_NAME], 'readonly');
        const store = transaction.objectStore(CONFIG.STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// ========================================
// GOOGLE SHEETS SYNCHRONISATION
// ========================================
async function syncToGoogleSheets(entry) {
    if (CONFIG.SYNC_URL === 'DEINE_GOOGLE_APPS_SCRIPT_URL_HIER') {
        console.warn('⚠️ Google Apps Script URL nicht konfiguriert!');
        return false;
    }

    try {
        const response = await fetch(CONFIG.SYNC_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(entry)
        });

        console.log('✅ An Google Sheets gesendet:', entry);
        return true;
        
    } catch (error) {
        console.error('❌ Google Sheets Sync Fehler:', error);
        return false;
    }
}

async function syncAll() {
    if (!navigator.onLine) {
        console.log('⚠️ Offline - Sync übersprungen');
        return;
    }

    try {
        const entries = await getUnsyncedEntries();
        
        if (entries.length === 0) {
            console.log('✅ Keine Einträge zum Synchronisieren');
            return;
        }

        console.log(`🔄 Synchronisiere ${entries.length} Einträge...`);

        for (const entry of entries) {
            const success = await syncToGoogleSheets(entry);
            if (success) {
                await markAsSynced(entry.id);
                console.log(`✅ Eintrag ${entry.id} synchronisiert`);
            }
        }

        await updatePendingCount();
        showNotification('✅ Synchronisation erfolgreich!', 'success');
        
    } catch (error) {
        console.error('Synchronisierungsfehler:', error);
        showNotification('⚠️ Synchronisierungsfehler', 'error');
    }
}

// ========================================
// UI FUNKTIONEN
// ========================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateOnlineStatus() {
    const indicator = document.getElementById('onlineStatus');
    const statusText = document.getElementById('statusText');
    
    if (navigator.onLine) {
        if (indicator) indicator.className = 'online-indicator online';
        if (statusText) statusText.textContent = 'Online';
        syncAll();
    } else {
        if (indicator) indicator.className = 'online-indicator offline';
        if (statusText) statusText.textContent = 'Offline';
    }
}

async function updatePendingCount() {
    try {
        const entries = await getUnsyncedEntries();
        const count = entries.length;
        const badge = document.getElementById('pendingBadge');
        
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Fehler beim Aktualisieren der Pending-Anzahl:', error);
    }
}

// ========================================
// FORMULAR HANDLING
// ========================================
async function handleSubmit(event) {
    event.preventDefault();

    const form = event.target;
    
    // FIXED: Verwende "kategorie" statt "tag" um mit Google Apps Script übereinzustimmen
    const entry = {
        datum: form.datum.value,
        kategorie: form.tag.value,  // ← GEÄNDERT von "tag" zu "kategorie"
        kmStand: parseGermanNumber(form.kmStand.value),
        kmTrip: parseGermanNumber(form.kmTrip.value),
        spritLiter: parseGermanNumber(form.spritLiter.value),
        kosten: parseGermanNumber(form.kosten.value),
        preisJeLiter: parseGermanNumber(form.preisJeLiter.value),
        tankstelle: form.tankstelle.value,
        bemerkung: form.bemerkung.value
    };

    console.log('=== FORMULAR DATEN ===');
    console.log('Original kmStand:', form.kmStand.value);
    console.log('Bereinigt kmStand:', entry.kmStand);
    console.log('Vollständiger Eintrag:', entry);

    try {
        // Speichere lokal
        const entryId = await saveEntry(entry);
        console.log('✅ Lokal gespeichert:', entry);

        // Versuche sofort zu synchronisieren wenn online
        if (navigator.onLine) {
            const synced = await syncToGoogleSheets(entry);
            if (synced) {
                await markAsSynced(entryId);
                console.log(`✅ Eintrag ${entryId} sofort synchronisiert`);
            }
        }

        showNotification('✅ Eintrag gespeichert!', 'success');
        form.reset();
        
        // Setze Datum auf heute und Tag auf "Tanken"
        form.datum.value = new Date().toISOString().split('T')[0];
        form.tag.value = 'Tanken';
        
        await updatePendingCount();

    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showNotification('❌ Fehler beim Speichern', 'error');
    }
}

function resetForm() {
    const form = document.getElementById('fahrtenbuchForm');
    form.reset();
    form.datum.value = new Date().toISOString().split('T')[0];
    form.tag.value = 'Tanken';
}

// ========================================
// PWA INSTALLATION
// ========================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.style.display = 'block';
    }
});

async function installApp() {
    if (!deferredPrompt) {
        showNotification('⚠️ Installation nicht verfügbar', 'error');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        showNotification('✅ App installiert!', 'success');
    }
    
    deferredPrompt = null;
    document.getElementById('installBtn').style.display = 'none';
}

// ========================================
// SERVICE WORKER REGISTRATION
// ========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/fahrtenbuch/sw.js')
        .then(reg => console.log('Service Worker registriert', reg))
        .catch(err => console.log('Service Worker Fehler', err));
}

// ========================================
// EVENT LISTENERS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // Formular
    const form = document.getElementById('fahrtenbuchForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
        // Setze heutiges Datum und Tag als Standard
        form.datum.value = new Date().toISOString().split('T')[0];
        form.tag.value = 'Tanken';
    }

    // Reset Button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }

    // Install Button
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', installApp);
    }

    // Online/Offline Status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initiale Updates
    updateOnlineStatus();
    updatePendingCount();
});

// Auto-Sync alle 30 Sekunden wenn online
setInterval(() => {
    if (navigator.onLine) {
        syncAll();
    }
}, 30000);
