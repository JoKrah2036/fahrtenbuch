// Fahrtenbuch App - Version 2.8 - Performance-Optimierungen

const DB_NAME = 'FahrtenbuchDB';
const DB_VERSION = 2;
const STORE_NAME = 'entries';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYycEZz5HC-eD72ziXaRTMxwi7tfFRYOf4sXc0aFqL0YzUz8bbqSxZUUHf30SSCoW1/exec';

let db;
let isSubmitting = false;
let currentlySyncing = new Set();

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

// Deutsche Zahl parsen
function parseGermanNumber(value) {
    if (!value) return '';
    let str = value.toString().trim();
    str = str.replace(/\./g, '');
    str = str.replace(',', '.');
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

// Mit Google Sheets synchronisieren (mit Timeout)
async function syncToGoogleSheets(entryId) {
    if (currentlySyncing.has(entryId)) {
        console.log('⚠ Entry', entryId, 'wird bereits synchronisiert, überspringe...');
        return;
    }

    currentlySyncing.add(entryId);

    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(entryId);

        return new Promise((resolve, reject) => {
            request.onsuccess = async () => {
                const entry = request.result;
                if (!entry) {
                    currentlySyncing.delete(entryId);
                    reject(new Error('Entry nicht gefunden'));
                    return;
                }

                try {
                    // WICHTIG: Timeout für Fetch-Request (5 Sekunden)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);

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
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    await markAsSynced(entryId);
                    currentlySyncing.delete(entryId);
                    resolve(response);
                } catch (error) {
                    currentlySyncing.delete(entryId);
                    // Bei Timeout oder Netzwerkfehler: Entry bleibt unsynced für späteren Retry
                    console.log('Sync-Fehler für Entry', entryId, '- wird später erneut versucht');
                    reject(error);
                }
            };
            request.onerror = () => {
                currentlySyncing.delete(entryId);
                reject(request.error);
            };
        });
    } catch (error) {
        currentlySyncing.delete(entryId);
        throw error;
    }
}

// Auto-Sync für unsynchronisierte Einträge
async function autoSync() {
    if (!navigator.onLine) return;

    try {
        const unsyncedEntries = await getUnsyncedEntries();
        
        // Zeige Badge wenn unsynchronisierte Einträge vorhanden
        updatePendingBadge(unsyncedEntries.length);
        
        for (const entry of unsyncedEntries) {
            if (currentlySyncing.has(entry.id)) {
                console.log('Auto-Sync: Entry', entry.id, 'wird bereits synchronisiert, überspringe...');
                continue;
            }

            try {
                await syncToGoogleSheets(entry.id);
                console.log('✓ Auto-Sync erfolgreich für Entry:', entry.id);
            } catch (error) {
                console.log('⚠ Auto-Sync Fehler für Entry:', entry.id, '- Retry beim nächsten Intervall');
            }
        }
        
        // Badge aktualisieren nach Sync
        const remainingEntries = await getUnsyncedEntries();
        updatePendingBadge(remainingEntries.length);
        
    } catch (error) {
        console.error('Auto-Sync Fehler:', error);
    }
}

// Pending-Badge aktualisieren
function updatePendingBadge(count) {
    const badge = document.getElementById('pendingBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
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
            }, 1500); // Reduziert von 2000 auf 1500ms
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
    }, 3000); // Reduziert von 4000 auf 3000ms
}

// OPTIMISTISCHES UI: Formular-Handler
async function handleSubmit(e) {
    e.preventDefault();

    if (isSubmitting) {
        console.log('⚠ Bereits am Speichern... Bitte warten.');
        showMessage('Bereits am Speichern... Bitte warten.', 'warning');
        return;
    }

    isSubmitting = true;
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

        // SCHRITT 1: In IndexedDB speichern (SCHNELL)
        const entryId = await saveEntry(entry);
        console.log('✓ In IndexedDB gespeichert:', entryId);

        // SCHRITT 2: SOFORT Formular zurücksetzen (OPTIMISTISCH)
        form.reset();
        const today = new Date().toISOString().split('T')[0];
        form.datum.value = today;
        
        setButtonState('success');
        showMessage('Gespeichert! Wird synchronisiert...', 'success');

        // SCHRITT 3: Im Hintergrund synchronisieren (NICHT BLOCKIEREND)
        // Wir warten NICHT auf das Ergebnis!
        if (navigator.onLine) {
            syncToGoogleSheets(entryId)
                .then(() => {
                    console.log('✓ Mit Google Sheets synchronisiert');
                    // Badge aktualisieren
                    getUnsyncedEntries().then(entries => updatePendingBadge(entries.length));
                })
                .catch((error) => {
                    console.log('⚠ Sync-Fehler (wird später erneut versucht):', error);
                    // Badge aktualisieren
                    getUnsyncedEntries().then(entries => updatePendingBadge(entries.length));
                });
        } else {
            console.log('Offline - Eintrag wird später synchronisiert');
            // Badge aktualisieren
            getUnsyncedEntries().then(entries => updatePendingBadge(entries.length));
        }

    } catch (error) {
        console.error('❌ Fehler beim Speichern:', error);
        showMessage('Fehler beim Speichern! Bitte erneut versuchen.', 'error');
        setButtonState('error');
    } finally {
        isSubmitting = false;
    }
}

// Online/Offline Status aktualisieren
function updateOnlineStatus() {
    const indicator = document.getElementById('onlineStatus');
    const statusText = document.getElementById('statusText');

    if (navigator.onLine) {
        if (indicator) indicator.className = 'online-indicator online';
        if (statusText) statusText.textContent = 'Online';
        
        // Sofort Auto-Sync starten wenn online
        autoSync();
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

        // Auto-Sync alle 10 Sekunden (statt 30!)
        setInterval(autoSync, 10000);
        
        // Sofort prüfen ob unsynchronisierte Einträge vorhanden
        const unsyncedEntries = await getUnsyncedEntries();
        if (unsyncedEntries.length > 0) {
            console.log(`⚠ ${unsyncedEntries.length} unsynchronisierte Einträge gefunden`);
            updatePendingBadge(unsyncedEntries.length);
            // Sofort versuchen zu synchronisieren
            if (navigator.onLine) {
                autoSync();
            }
        }

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
