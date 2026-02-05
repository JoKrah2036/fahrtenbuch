/**
 * GOOGLE APPS SCRIPT FÜR GOOGLE SHEETS
 * 
 * SETUP-ANLEITUNG:
 * 1. Öffne dein Google Sheet
 * 2. Klicke auf "Erweiterungen" > "Apps Script"
 * 3. Lösche den vorhandenen Code
 * 4. Kopiere diesen Code und füge ihn ein
 * 5. Klicke auf "Bereitstellen" > "Neue Bereitstellung"
 * 6. Wähle "Web-App"
 * 7. Wähle "Ich" unter "Ausführen als"
 * 8. Wähle "Jeder" unter "Wer hat Zugriff"
 * 9. Klicke auf "Bereitstellen"
 * 10. Kopiere die Web-App-URL
 * 11. Füge diese URL in die app.js Datei bei CONFIG.SYNC_URL ein
 */

function doPost(e) {
  try {
    // JSON-Daten parsen
    const data = JSON.parse(e.postData.contents);
    
    // Zugriff auf das aktive Sheet (oder spezifisches Sheet angeben)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Wenn das Sheet leer ist, Header hinzufügen
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Datum', 'Kilometer', 'Liter', 'Kosten (€)', 'Zweck', 'Gespeichert am']);
      // Header formatieren
      const headerRange = sheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4285f4');
      headerRange.setFontColor('#ffffff');
    }
    
    // Daten in neue Zeile einfügen
    sheet.appendRow([
      data.datum,
      data.km,
      data.liter || '',
      data.kosten || '',
      data.zweck,
      data.timestamp
    ]);
    
    // Erfolgs-Response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Eintrag gespeichert'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Fehler-Response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test-Funktion (optional)
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        datum: '2025-02-04',
        km: 45.5,
        liter: 5.2,
        kosten: 8.50,
        zweck: 'Kundenbesuch',
        timestamp: new Date().toISOString()
      })
    }
  };
  
  const result = doPost(testData);
  Logger.log(result.getContent());
}
