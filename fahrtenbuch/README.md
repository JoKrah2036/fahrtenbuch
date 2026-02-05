# 🚗 Fahrtenbuch PWA - Offline-fähiges Fahrtenbuch

Eine Progressive Web App (PWA), die offline funktioniert und automatisch mit Google Sheets synchronisiert.

## ✨ Features

- ✅ **Vollständig offline-fähig** - Funktioniert ohne Internetverbindung
- 📱 **Installierbar als App** - Wie eine native App auf dem Smartphone
- 🔄 **Automatische Synchronisation** - Sendet Daten automatisch, sobald du online bist
- 💾 **Lokale Speicherung** - Alle Einträge werden sicher lokal gespeichert
- 🎨 **Modernes Design** - Schöne, intuitive Benutzeroberfläche
- 📊 **Google Sheets Integration** - Alle Daten landen automatisch in deinem Sheet

## 🚀 Setup-Anleitung

### Schritt 1: Google Sheets vorbereiten

1. Erstelle ein neues Google Sheet oder öffne ein bestehendes
2. Klicke auf **"Erweiterungen"** → **"Apps Script"**
3. Lösche den vorhandenen Code
4. Kopiere den kompletten Code aus der Datei `google-apps-script.js` und füge ihn ein
5. Klicke auf **"Speichern"** (Disketten-Symbol)

### Schritt 2: Web-App bereitstellen

1. Klicke auf **"Bereitstellen"** → **"Neue Bereitstellung"**
2. Klicke auf das Zahnrad-Symbol und wähle **"Web-App"**
3. Konfiguration:
   - **Beschreibung:** "Fahrtenbuch API" (optional)
   - **Ausführen als:** "Ich"
   - **Wer hat Zugriff:** "Jeder"
4. Klicke auf **"Bereitstellen"**
5. **WICHTIG:** Kopiere die **Web-App-URL** (sieht etwa so aus: `https://script.google.com/macros/s/...`)

### Schritt 3: PWA konfigurieren

1. Öffne die Datei `app.js` in einem Text-Editor
2. Finde diese Zeile (ganz am Anfang):
   ```javascript
   SYNC_URL: 'DEINE_GOOGLE_APPS_SCRIPT_URL_HIER'
   ```
3. Ersetze `'DEINE_GOOGLE_APPS_SCRIPT_URL_HIER'` mit deiner kopierten URL:
   ```javascript
   SYNC_URL: 'https://script.google.com/macros/s/...'
   ```
4. Speichere die Datei

### Schritt 4: App-Icons hinzufügen (optional, aber empfohlen)

Du brauchst zwei Icon-Dateien:
- `icon-192.png` (192 x 192 Pixel)
- `icon-512.png` (512 x 512 Pixel)

**Einfachste Methode:**
1. Gehe zu https://www.pwabuilder.com/imageGenerator
2. Lade ein Bild hoch (z.B. ein Auto-Icon oder dein Firmenlogo)
3. Lade die generierten Icons herunter
4. Benenne sie um zu `icon-192.png` und `icon-512.png`
5. Lege sie in den `fahrtenbuch-pwa` Ordner

**Alternative:** Verwende ein beliebiges Bild und skaliere es auf die benötigten Größen mit einem Bildbearbeitungsprogramm.

### Schritt 5: App hosten

Du hast mehrere Möglichkeiten:

#### Option A: GitHub Pages (kostenlos, empfohlen)

1. Erstelle ein GitHub-Konto (falls noch nicht vorhanden)
2. Erstelle ein neues Repository
3. Lade alle Dateien hoch
4. Gehe zu **Settings** → **Pages**
5. Wähle **"main"** Branch als Source
6. Speichern - deine App ist jetzt unter `https://deinbenutzername.github.io/fahrtenbuch-pwa` erreichbar

#### Option B: Netlify Drop (kostenlos, super einfach)

1. Gehe zu https://app.netlify.com/drop
2. Ziehe den gesamten `fahrtenbuch-pwa` Ordner per Drag & Drop
3. Fertig! Du bekommst sofort eine URL

#### Option C: Eigener Webserver

Falls du bereits einen Webserver hast, lade einfach alle Dateien in ein Verzeichnis hoch.

### Schritt 6: App auf dem Handy installieren

#### Android:
1. Öffne die App-URL in Chrome
2. Tippe auf die drei Punkte (⋮) oben rechts
3. Wähle **"Zum Startbildschirm hinzufügen"**
4. Fertig! Die App erscheint auf deinem Homescreen

#### iOS (iPhone/iPad):
1. Öffne die App-URL in Safari
2. Tippe auf das Teilen-Symbol (□↑)
3. Scrolle runter und wähle **"Zum Home-Bildschirm"**
4. Fertig!

## 📱 Verwendung

### Eintrag erstellen

1. Öffne die App
2. Fülle die Felder aus:
   - **Datum:** Automatisch auf heute gesetzt
   - **Kilometer:** Gefahrene Strecke
   - **Liter:** (optional) Getankte Menge
   - **Kosten:** (optional) Tankkosten
   - **Zweck:** Beschreibung der Fahrt
3. Klicke auf **"Speichern"**

### Offline-Modus

- Die App funktioniert **komplett ohne Internet**
- Einträge werden lokal gespeichert
- Sobald du wieder online bist, werden alle Einträge automatisch synchronisiert
- Du siehst unten, wie viele Einträge noch warten

### Online-Status

- **Grüner Punkt:** Online - Synchronisation läuft automatisch
- **Gelber Punkt:** Offline - Einträge werden lokal gespeichert

## 🔧 Technische Details

### Verwendete Technologien

- **IndexedDB:** Lokale Datenbank im Browser
- **Service Worker:** Ermöglicht Offline-Funktionalität
- **Fetch API:** Kommunikation mit Google Sheets
- **Web App Manifest:** Ermöglicht Installation als App

### Datenschutz

- Alle Daten werden lokal auf deinem Gerät gespeichert
- Synchronisation erfolgt direkt zu deinem Google Sheet
- Keine Daten werden auf fremden Servern gespeichert
- Du hast volle Kontrolle über deine Daten

### Automatische Synchronisation

- Alle 30 Sekunden wird geprüft, ob neue Einträge zu senden sind
- Bei jedem neuen Eintrag wird sofort versucht zu synchronisieren
- Beim Wechsel von offline zu online startet automatisch eine Synchronisation

## 🐛 Troubleshooting

### App synchronisiert nicht

1. Überprüfe, ob die `SYNC_URL` in `app.js` korrekt eingetragen ist
2. Teste die URL direkt im Browser - sie sollte nicht "Fehler" anzeigen
3. Öffne die Browser-Konsole (F12) und prüfe auf Fehlermeldungen
4. Stelle sicher, dass die Google Apps Script Web-App auf "Jeder" gesetzt ist

### App installiert sich nicht

1. Stelle sicher, dass die App über **HTTPS** läuft (GitHub Pages und Netlify machen das automatisch)
2. Bei localhost: `localhost` gilt als sicher, aber `127.0.0.1` nicht
3. Prüfe, ob die Icons vorhanden sind

### Einträge erscheinen nicht im Google Sheet

1. Öffne die Browser-Konsole (F12 → Console)
2. Prüfe auf Fehlermeldungen
3. Teste das Google Apps Script direkt:
   - Öffne Apps Script Editor
   - Klicke auf `testDoPost` Funktion
   - Klicke auf "Ausführen"
   - Prüfe, ob eine Zeile im Sheet erscheint

### Browser-Konsole öffnen

- **Chrome/Edge:** F12 oder Rechtsklick → "Untersuchen" → "Console"
- **Firefox:** F12 oder Rechtsklick → "Element untersuchen" → "Konsole"
- **Safari:** Cmd+Option+C → "Konsole"
- **Chrome Android:** chrome://inspect/#devices

## 🎨 Anpassungen

### Farben ändern

In der `index.html` findest du im `<style>` Bereich die Farben:

```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

Ersetze die Hex-Codes mit deinen Wunschfarben.

### Felder hinzufügen/entfernen

1. **In `index.html`:** Füge neue Formular-Felder hinzu oder entferne bestehende
2. **In `app.js`:** Passe das `entry` Objekt im Submit-Handler an
3. **In `google-apps-script.js`:** Füge die neuen Felder zur `appendRow` Zeile hinzu

### Sheet-Name ändern

Standardmäßig wird das aktive Sheet verwendet. Um ein bestimmtes Sheet zu verwenden:

```javascript
// In google-apps-script.js, ersetze diese Zeile:
const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

// Mit:
const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MeinSheetName');
```

## 📞 Support

Bei Problemen:
1. Prüfe diese README-Datei
2. Öffne die Browser-Konsole für Fehlermeldungen
3. Überprüfe alle Setup-Schritte nochmal

## 📄 Lizenz

Dieses Projekt ist frei verwendbar. Du kannst es nach Belieben anpassen und erweitern.

---

**Viel Erfolg mit deinem Offline-Fahrtenbuch! 🚗💨**
