/**
 * Google Apps Script für Fahrtenbuch PWA
 * Empfängt Daten von der PWA und schreibt sie ins Google Sheet
 * Mit deutscher Zahlenformatierung
 */

function doPost(e) {
  try {
    // Sheet abrufen (verwendet das aktive Sheet)
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // JSON-Daten parsen
    const data = JSON.parse(e.postData.contents);
    
    // Daten extrahieren und in Zahlen konvertieren
    const datum = data.datum || '';
    const kmStand = data.kmStand ? parseFloat(data.kmStand) : '';
    const kmTrip = data.kmTrip ? parseFloat(data.kmTrip) : '';
    const spritLiter = data.spritLiter ? parseFloat(data.spritLiter) : '';
    const kosten = data.kosten ? parseFloat(data.kosten) : '';
    const preisJeLiter = data.preisJeLiter ? parseFloat(data.preisJeLiter) : '';
    const tankstelle = data.tankstelle || '';
    const bemerkung = data.bemerkung || '';
    
    // Neue Zeile hinzufügen
    const newRow = sheet.appendRow([
      datum,
      kmStand,
      kmTrip,
      spritLiter,
      kosten,
      preisJeLiter,
      tankstelle,
      bemerkung
    ]);
    
    // Formatierung anwenden (letzte Zeile)
    const lastRow = sheet.getLastRow();
    
    // Spalte B (Km-Stand): Zahlenformat mit Tausenderpunkt, keine Dezimalstellen
    if (kmStand) {
      sheet.getRange(lastRow, 2).setNumberFormat('#,##0');
    }
    
    // Spalte C (Km-Trip): Zahlenformat ohne Tausenderpunkt, keine Dezimalstellen
    if (kmTrip) {
      sheet.getRange(lastRow, 3).setNumberFormat('0');
    }
    
    // Spalte D (Sprit Liter): Zahlenformat mit Komma, 2 Dezimalstellen
    if (spritLiter) {
      sheet.getRange(lastRow, 4).setNumberFormat('#,##0.00');
    }
    
    // Spalte E (Kosten): Zahlenformat mit Komma, 2 Dezimalstellen
    if (kosten) {
      sheet.getRange(lastRow, 5).setNumberFormat('#,##0.00');
    }
    
    // Spalte F (Preis je Liter): Zahlenformat mit Komma, 3 Dezimalstellen (für genaue Preise)
    if (preisJeLiter) {
      sheet.getRange(lastRow, 6).setNumberFormat('#,##0.000');
    }
    
    // Erfolgreiche Antwort
    return ContentService
      .createTextOutput(JSON.stringify({
        'success': true,
        'message': 'Eintrag gespeichert'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Fehler zurückgeben
    return ContentService
      .createTextOutput(JSON.stringify({
        'success': false,
        'error': error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Test-Funktion um zu prüfen, ob das Script funktioniert
 * Klicke auf "Ausführen" um einen Test-Eintrag zu erstellen
 */
function testDoPost() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        datum: '2026-02-05',
        kmStand: '15000',
        kmTrip: '150',
        spritLiter: '40.5',
        kosten: '60.75',
        preisJeLiter: '1.499',
        tankstelle: 'Shell',
        bemerkung: 'Test-Eintrag mit Formatierung'
      })
    }
  };
  
  const result = doPost(testData);
  Logger.log(result.getContent());
}

/**
 * Hilfsfunktion: Formatiere alle vorhandenen Zeilen
 * Führe diese Funktion einmal aus, um bereits vorhandene Daten zu formatieren
 */
function formatiereAlleZeilen() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    Logger.log('Keine Daten zum Formatieren vorhanden');
    return;
  }
  
  // Formatiere Spalte B (Km-Stand): Tausenderpunkt
  sheet.getRange(2, 2, lastRow - 1, 1).setNumberFormat('#,##0');
  
  // Formatiere Spalte C (Km-Trip): Ohne Tausenderpunkt
  sheet.getRange(2, 3, lastRow - 1, 1).setNumberFormat('0');
  
  // Formatiere Spalte D (Sprit Liter): 2 Dezimalstellen
  sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat('#,##0.00');
  
  // Formatiere Spalte E (Kosten): 2 Dezimalstellen
  sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat('#,##0.00');
  
  // Formatiere Spalte F (Preis je Liter): 3 Dezimalstellen
  sheet.getRange(2, 6, lastRow - 1, 1).setNumberFormat('#,##0.000');
  
  Logger.log(`${lastRow - 1} Zeilen formatiert`);
}
