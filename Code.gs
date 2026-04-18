const CONFIG = {
  SPREADSHEET_ID: '1DUyoAGXUi-hVVIUChya5IfYacm9uHAaatHO2co9yP-0',
  BOOKS_SHEET: 'Livros',
  RESERVATIONS_SHEET: 'Reservas'
};

function doGet(e) {
  const cb = e && e.parameter && e.parameter.callback;
  let json;

  if (e && e.parameter && e.parameter.action === 'reserve') {
    const data = JSON.parse(decodeURIComponent(e.parameter.data || '{}'));
    json = createReservation(data.bookId, data.nome, data.whatsapp, data.tipo);
  } else {
    json = getBooks();
  }

  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchCoverUrl(isbn) {
  if (!isbn) return '';
  const cache = CacheService.getScriptCache();
  const key = 'cover_' + isbn;
  const cached = cache.get(key);
  if (cached !== null) return cached;

  let url = '';
  try {
    const resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn +
      '&fields=items/volumeInfo/imageLinks&maxResults=1',
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() === 200) {
      const data = JSON.parse(resp.getContentText());
      const links = data.items && data.items[0] &&
                    data.items[0].volumeInfo && data.items[0].volumeInfo.imageLinks;
      const raw = links && (links.thumbnail || links.smallThumbnail);
      if (raw) url = raw.replace('http://', 'https://').replace('zoom=1', 'zoom=2');
    }
  } catch (e) {}

  cache.put(key, url, 21600);
  return url;
}

function getBooks() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const booksSheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
  const reservationsSheet = ss.getSheetByName(CONFIG.RESERVATIONS_SHEET);

  const booksData = booksSheet.getDataRange().getValues();
  const reservationsData = reservationsSheet.getDataRange().getValues();

  const queueCount = {};
  if (reservationsData.length > 1) {
    for (let i = 1; i < reservationsData.length; i++) {
      const bookId = String(reservationsData[i][1]);
      const status = reservationsData[i][7];
      if (status === 'ativa') {
        queueCount[bookId] = (queueCount[bookId] || 0) + 1;
      }
    }
  }

  const books = [];
  for (let i = 1; i < booksData.length; i++) {
    const row = booksData[i];
    if (!row[0]) continue;
    const isbn = row[5] ? String(row[5]) : '';
    const capaUrl = row[6] ? String(row[6]) : fetchCoverUrl(isbn);
    books.push({
      id: String(row[0]),
      titulo: String(row[1]),
      autor: String(row[2]),
      preco: row[3],
      status: row[4],
      isbn: isbn,
      capaUrl: capaUrl,
      interessados: queueCount[String(row[0])] || 0
    });
  }

  return JSON.stringify(books);
}

function createReservation(bookId, nome, whatsapp, tipo) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const booksSheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
    const reservationsSheet = ss.getSheetByName(CONFIG.RESERVATIONS_SHEET);

    const booksData = booksSheet.getDataRange().getValues();
    let bookRow = -1;
    let bookStatus = '';

    for (let i = 1; i < booksData.length; i++) {
      if (String(booksData[i][0]) === String(bookId)) {
        bookRow = i + 1;
        bookStatus = booksData[i][4];
        break;
      }
    }

    if (bookRow === -1) return JSON.stringify({ success: false, error: 'Livro não encontrado' });
    if (bookStatus === 'Vendido') return JSON.stringify({ success: false, error: 'Este livro já foi vendido' });

    const now = new Date();
    const expiraEm = new Date(now);
    expiraEm.setDate(expiraEm.getDate() + 1);
    expiraEm.setHours(12, 0, 0, 0);

    reservationsSheet.appendRow([
      Utilities.getUuid(),
      bookId,
      nome,
      whatsapp,
      tipo,
      now.toISOString(),
      expiraEm.toISOString(),
      'ativa'
    ]);

    if (bookStatus === 'Disponível') {
      booksSheet.getRange(bookRow, 5).setValue('Reservado');
    }

    return JSON.stringify({ success: true, expiraEm: expiraEm.toISOString() });
  } catch (e) {
    return JSON.stringify({ success: false, error: e.toString() });
  }
}

function checkExpiredReservations() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const booksSheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
  const reservationsSheet = ss.getSheetByName(CONFIG.RESERVATIONS_SHEET);

  const now = new Date();
  const reservationsData = reservationsSheet.getDataRange().getValues();

  for (let i = 1; i < reservationsData.length; i++) {
    if (reservationsData[i][7] !== 'ativa') continue;
    if (now >= new Date(reservationsData[i][6])) {
      reservationsSheet.getRange(i + 1, 8).setValue('expirada');
    }
  }

  const updatedReservations = reservationsSheet.getDataRange().getValues();
  const activeByBook = {};
  for (let i = 1; i < updatedReservations.length; i++) {
    if (updatedReservations[i][7] === 'ativa') {
      const id = String(updatedReservations[i][1]);
      activeByBook[id] = (activeByBook[id] || 0) + 1;
    }
  }

  const booksData = booksSheet.getDataRange().getValues();
  for (let i = 1; i < booksData.length; i++) {
    if (!booksData[i][0] || booksData[i][4] === 'Vendido') continue;
    const bookId = String(booksData[i][0]);
    const newStatus = activeByBook[bookId] > 0 ? 'Reservado' : 'Disponível';
    if (booksData[i][4] !== newStatus) {
      booksSheet.getRange(i + 1, 5).setValue(newStatus);
    }
  }
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkExpiredReservations')
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();
}
