// Fahrtenbuch App - Version mit Anti-Doppelklick-Schutz

const DB_NAME = 'FahrtenbuchDB';
const DB_VERSION = 2;
const STORE_NAME = 'entries';
const GOOGLE_SCRIPT_URL = 'DEINE_GOOGLE_SCRIPT_URL_HIER'; // TODO: Ersetzen mit deiner URL

let db;
let isSubmitting = false; // Debouncing-Flag

// IndexedDB initialisieren
async function initDB() {
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
                const objectStore = db.createObjectStore(STORE_NAME, { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                objectStore.createIndex('synced', 'synced', { unique: false });
                objectStore.createIndex('datum', 'datum', { unique: false });
            }
        };
    });
}

// Deutsche Zahl parsen (z.B. "1.234,56" -> "1234.56")
function parseGermanNumber(value) {
    if (!value) return '';
    let str = value.toString().trim();
    str = str.replace(/\./g, '');  // Entferne Tausenderpunkte
    str = str.replace(',', '.');   // Komma → Punkt für parseFloat
    return str;
}

// Eintrag in IndexedDB speichern
async function saveEntry(entry) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(entry);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Eintrag als synchronisiert markieren
async function markAsSynced(entryId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(entryId);

        request.onsuccess = () => {
            const entry = request.result;
            if (entry) {
                entry.synced = true;
                const updateRequest = store.put(entry);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                resolve();
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Unsynchronisierte Einträge abrufen
async function getUnsyncedEntries() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const entries = request.result.filter(entry => !entry.synced);
            resolve(entries);
        };
        request.onerror = () => reject(request.error);
    });
}

// Mit Google Sheets synchronisieren
async function syncToGoogleSheets(entryId) {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(entryId);

    return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
            const entry = request.result;
            if (!entry) {
                reject(new Error('Entry nicht gefunden'));
                return;
            }

            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        datum: entry.datum,
                        kategorie: entry.kategorie,
                        kmStand: parseGermanNumber(entry.kmStand),
                        kmTrip: parseGermanNumber(entry.kmTrip),
                        spritLiter: parseGermanNumber(entry.spritLiter),
                        kosten: parseGermanNumber(entry.kosten),
                        preisJeLiter: parseGermanNumber(entry.preisJeLiter),
                        tankstelle: entry.tankstelle,
                        bemerkung: entry.bemerkung
                    })
                });

                await markAsSynced(entryId);
                resolve(response);
            } catch (error) {
                reject(error);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// Auto-Sync für unsynchronisierte Einträge
async function autoSync() {
    if (!navigator.onLine) return;

    try {
        const unsyncedEntries = await getUnsyncedEntries();
        
        for (const entry of unsyncedEntries) {
            try {
                await syncToGoogleSheets(entry.id);
                console.log('Auto-Sync erfolgreich für Entry:', entry.id);
            } catch (error) {
                console.error('Auto-Sync Fehler für Entry:', entry.id, error);
            }
        }
    } catch (error) {
        console.error('Auto-Sync Fehler:', error);
    }
}

// UI Helper Functions
function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function setButtonState(state) {
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) return;

    switch(state) {
        case 'loading':
            submitButton.disabled = true;
            submitButton.textContent = '💾 Speichere...';
            submitButton.style.backgroundColor = '#ffa500';
            break;
        case 'success':
            submitButton.disabled = true;
            submitButton.textContent = '✓ Gespeichert!';
            submitButton.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
                submitButton.disabled = false;
                submitButton.textContent = 'Speichern';
                submitButton.style.backgroundColor = '';
            }, 2000);
            break;
        case 'error':
            submitButton.disabled = false;
            submitButton.textContent = '⚠ Fehler - Erneut versuchen';
            submitButton.style.backgroundColor = '#f44336';
            setTimeout(() => {
                submitButton.textContent = 'Speichern';
                submitButton.style.backgroundColor = '';
            }, 3000);
            break;
        default:
            submitButton.disabled = false;
            submitButton.textContent = 'Speichern';
            submitButton.style.backgroundColor = '';
    }
}

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('messageBox');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 4000);
}

// Formular-Handler
async function handleSubmit(e) {
    e.preventDefault();

    // Debouncing: Verhindere mehrfaches gleichzeitiges Absenden
    if (isSubmitting) {
        console.log('⚠ Bereits am Speichern... Bitte warten.');
        showMessage('Bereits am Speichern... Bitte warten.', 'warning');
        return;
    }

    isSubmitting = true;
    showLoading(true);
    setButtonState('loading');

    const form = e.target;

    try {
        // Daten sammeln
        const entry = {
            datum: form.datum.value,
            kategorie: form.kategorie.value,
            kmStand: form.kmStand.value,
            kmTrip: form.kmTrip.value,
            spritLiter: form.spritLiter.value,
            kosten: form.kosten.value,
            preisJeLiter: form.preisJeLiter.value,
            tankstelle: form.tankstelle.value,
            bemerkung: form.bemerkung.value,
            synced: false,
            timestamp: new Date().toISOString()
        };

        // In IndexedDB speichern
        const entryId = await saveEntry(entry);
        console.log('✓ In IndexedDB gespeichert:', entryId);

        // Versuche sofort zu synchronisieren (wenn online)
        if (navigator.onLine) {
            try {
                await syncToGoogleSheets(entryId);
                console.log('✓ Mit Google Sheets synchronisiert');
                showMessage('Erfolgreich gespeichert und synchronisiert!', 'success');
            } catch (syncError) {
                console.error('⚠ Sync-Fehler (wird später erneut versucht):', syncError);
                showMessage('Gespeichert! Wird synchronisiert sobald Verbindung stabil ist.', 'info');
            }
        } else {
            showMessage('Offline gespeichert! Wird synchronisiert sobald du online bist.', 'info');
        }

        // Formular zurücksetzen
        form.reset();
        
        // Datum auf heute setzen
        const today = new Date().toISOString().split('T')[0];
        form.datum.value = today;

        setButtonState('success');

    } catch (error) {
        console.error('❌ Fehler beim Speichern:', error);
        showMessage('Fehler beim Speichern! Bitte erneut versuchen.', 'error');
        setButtonState('error');
    } finally {
        showLoading(false);
        isSubmitting = false;
    }
}

// Online/Offline Status aktualisieren
function updateOnlineStatus() {
    const indicator = document.getElementById('onlineStatus');
    const statusText = document.getElementById('statusText');
    const badge = document.getElementById('pendingBadge');

    if (navigator.onLine) {
        if (indicator) indicator.className = 'online-indicator online';
        if (statusText) statusText.textContent = 'Online';
        
        // Auto-Sync starten
        autoSync();
        
        // Pending-Badge aktualisieren
        getUnsyncedEntries().then(entries => {
            if (badge && entries.length > 0) {
                badge.textContent = entries.length;
                badge.style.display = 'inline-block';
            } else if (badge) {
                badge.style.display = 'none';
            }
        });
    } else {
        if (indicator) indicator.className = 'online-indicator offline';
        if (statusText) statusText.textContent = 'Offline';
    }
}

// App initialisieren
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initDB();
        console.log('✓ IndexedDB initialisiert');

        const form = document.getElementById('fahrtenbuchForm');
        if (form) {
            form.addEventListener('submit', handleSubmit);
            
            // Datum auf heute setzen
            const today = new Date().toISOString().split('T')[0];
            form.datum.value = today;
        }

        // Online/Offline Events
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        // Auto-Sync alle 30 Sekunden
        setInterval(autoSync, 30000);

    } catch (error) {
        console.error('❌ Initialisierungsfehler:', error);
        showMessage('App konnte nicht initialisiert werden!', 'error');
    }
});

// Service Worker registrieren
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/fahrtenbuch/sw.js')
        .then(reg => console.log('✓ Service Worker registriert'))
        .catch(err => console.error('❌ Service Worker Fehler:', err));
}
