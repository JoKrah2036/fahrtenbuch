// Fahrtenbuch App - Version 2.9 - Definitiver Fix für doppelte Einträge

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
        request.onsuccess = () => { db = request.result; resolve(db); };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
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

// Felder basierend auf Kategorie anpassen
function updateFieldsForCategory() {
    const kategorie = document.getElementById('kategorie').value;
    const tankFields = ['group-kmTrip', 'group-spritLiter', 'group-preisJeLiter'];

    if (kategorie === 'Werkstatt' || kategorie === 'Sonstiges') {
        tankFields.forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('group-kosten')?.classList.remove('hidden');
        document.getElementById('group-tankstelle')?.classList.remove('hidden');
        const lbl = document.querySelector('label[for="tankstelle"]');
        if (lbl) lbl.innerHTML = 'Ort <span class="optional-hint">(optional)</span>';
    } else if (kategorie === 'Sonderfahrt') {
        document.getElementById('group-kmTrip')?.classList.remove('hidden');
        document.getElementById('group-spritLiter')?.classList.add('hidden');
        document.getElementById('group-kosten')?.classList.remove('hidden');
        document.getElementById('group-preisJeLiter')?.classList.add('hidden');
        document.getElementById('group-tankstelle')?.classList.remove('hidden');
        const lbl = document.querySelector('label[for="tankstelle"]');
        if (lbl) lbl.innerHTML = 'Ort <span class="optional-hint">(optional)</span>';
    } else {
        tankFields.forEach(id => document.getElementById(id)?.classList.remove('hidden'));
        document.getElementById('group-kosten')?.classList.remove('hidden');
        document.getElementById('group-tankstelle')?.classList.remove('hidden');
        const lbl = document.querySelector('label[for="tankstelle"]');
        if (lbl) lbl.innerHTML = 'Tankstelle <span class="optional-hint">(optional)</span>';
    }
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

// Sync-Status setzen (true = synced, false = unsynced)
async function setSyncStatus(entryId, synced) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(entryId);
        request.onsuccess = () => {
            const entry = request.result;
            if (entry) {
                entry.synced = synced;
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
            resolve(request.result.filter(entry => !entry.synced));
        };
        request.onerror = () => reject(request.error);
    });
}

// MIT GOOGLE SHEETS SYNCHRONISIEREN
// WICHTIG: Entry wird VOR dem Senden als "synced" markiert!
// Bei Fehler: Zurücksetzen auf "unsynced"
async function syncToGoogleSheets(entryId) {

    // Verhindere parallele Sync-Versuche für dieselbe ID
    if (currentlySyncing.has(entryId)) {
        console.log('⚠ Entry', entryId, 'wird bereits synchronisiert, überspringe...');
        return;
    }
    currentlySyncing.add(entryId);

    try {
        // SCHRITT 1: SOFORT als synced markieren (VOR dem Fetch!)
        // Verhindert dass Auto-Sync denselben Entry nochmal sendet
        await setSyncStatus(entryId, true);

        // SCHRITT 2: Entry aus IndexedDB lesen
        const entry = await new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(entryId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (!entry) {
            currentlySyncing.delete(entryId);
            return;
        }

        // SCHRITT 3: Fetch mit Timeout (5 Sekunden)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
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
            console.log('✓ Entry', entryId, 'erfolgreich synchronisiert');

        } catch (fetchError) {
            clearTimeout(timeoutId);
            // SCHRITT 4: Bei Fehler → Zurücksetzen auf unsynced für späteren Retry
            console.log('⚠ Fetch-Fehler für Entry', entryId, '- setze zurück auf unsynced');
            await setSyncStatus(entryId, false);
        }

    } catch (error) {
        // Bei allgemeinem Fehler → Zurücksetzen
        console.error('❌ Sync-Fehler für Entry', entryId, error);
        try { await setSyncStatus(entryId, false); } catch (e) {}
    } finally {
        currentlySyncing.delete(entryId);
    }
}

// Auto-Sync für unsynchronisierte Einträge
async function autoSync() {
    if (!navigator.onLine) return;

    try {
        const unsyncedEntries = await getUnsyncedEntries();
        updatePendingBadge(unsyncedEntries.length);

        for (const entry of unsyncedEntries) {
            if (currentlySyncing.has(entry.id)) continue;
            await syncToGoogleSheets(entry.id);
        }

        const remaining = await getUnsyncedEntries();
        updatePendingBadge(remaining.length);

    } catch (error) {
        console.error('Auto-Sync Fehler:', error);
    }
}

// Pending-Badge aktualisieren
function updatePendingBadge(count) {
    const badge = document.getElementById('pendingBadge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// UI Helper Functions
function setButtonState(state) {
    const btn = document.querySelector('button[type="submit"]');
    if (!btn) return;
    switch(state) {
        case 'loading':
            btn.disabled = true;
            btn.textContent = '💾 Speichere...';
            btn.style.backgroundColor = '#ffa500';
            break;
        case 'success':
            btn.disabled = true;
            btn.textContent = '✓ Gespeichert!';
            btn.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = 'Speichern';
                btn.style.backgroundColor = '';
            }, 1500);
            break;
        case 'error':
            btn.disabled = false;
            btn.textContent = '⚠ Fehler - Erneut versuchen';
            btn.style.backgroundColor = '#f44336';
            setTimeout(() => {
                btn.textContent = 'Speichern';
                btn.style.backgroundColor = '';
            }, 3000);
            break;
        default:
            btn.disabled = false;
            btn.textContent = 'Speichern';
            btn.style.backgroundColor = '';
    }
}

function showMessage(message, type = 'info') {
    const div = document.getElementById('messageBox');
    if (!div) return;
    div.textContent = message;
    div.className = `message ${type}`;
    div.style.display = 'block';
    setTimeout(() => { div.style.display = 'none'; }, 3000);
}

// Formular-Handler
async function handleSubmit(e) {
    e.preventDefault();

    if (isSubmitting) {
        showMessage('Bereits am Speichern... Bitte warten.', 'warning');
        return;
    }

    isSubmitting = true;
    setButtonState('loading');

    const form = e.target;

    try {
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

        // SCHRITT 1: In IndexedDB speichern
        const entryId = await saveEntry(entry);
        console.log('✓ In IndexedDB gespeichert:', entryId);

        // SCHRITT 2: SOFORT Formular leeren (Optimistisches UI)
        form.reset();
        form.datum.value = new Date().toISOString().split('T')[0];
        updateFieldsForCategory();
        setButtonState('success');
        showMessage('Gespeichert! Wird synchronisiert...', 'success');

        // SCHRITT 3: Im Hintergrund synchronisieren (nicht blockierend)
        if (navigator.onLine) {
            syncToGoogleSheets(entryId)
                .then(() => getUnsyncedEntries().then(e => updatePendingBadge(e.length)))
                .catch(() => getUnsyncedEntries().then(e => updatePendingBadge(e.length)));
        } else {
            getUnsyncedEntries().then(e => updatePendingBadge(e.length));
        }

    } catch (error) {
        console.error('❌ Fehler beim Speichern:', error);
        showMessage('Fehler beim Speichern! Bitte erneut versuchen.', 'error');
        setButtonState('error');
    } finally {
        isSubmitting = false;
    }
}

// Online/Offline Status
function updateOnlineStatus() {
    if (navigator.onLine) {
        autoSync();
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
            form.datum.value = new Date().toISOString().split('T')[0];

            const kategorieSelect = document.getElementById('kategorie');
            if (kategorieSelect) {
                kategorieSelect.addEventListener('change', updateFieldsForCategory);
                updateFieldsForCategory();
            }
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        // Auto-Sync alle 10 Sekunden
        setInterval(autoSync, 10000);

        // Sofort prüfen beim App-Start
        const unsyncedEntries = await getUnsyncedEntries();
        if (unsyncedEntries.length > 0) {
            updatePendingBadge(unsyncedEntries.length);
            if (navigator.onLine) autoSync();
        }

    } catch (error) {
        console.error('❌ Initialisierungsfehler:', error);
        showMessage('App konnte nicht initialisiert werden!', 'error');
    }
});

// Service Worker registrieren
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/fahrtenbuch/sw.js')
        .then(() => console.log('✓ Service Worker registriert'))
        .catch(err => console.error('❌ Service Worker Fehler:', err));
}
