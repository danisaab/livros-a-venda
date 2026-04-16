const CONFIG = {
  SPREADSHEET_ID: 'SEU_ID_AQUI', // Substitua pelo ID da sua planilha
  BOOKS_SHEET: 'Livros',
  RESERVATIONS_SHEET: 'Reservas'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Livros à Venda')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getBooks() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const booksSheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
  const reservationsSheet = ss.getSheetByName(CONFIG.RESERVATIONS_SHEET);

  const booksData = booksSheet.getDataRange().getValues();
  const reservationsData = reservationsSheet.getDataRange().getValues();

  // Conta reservas ativas por livro
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
    books.push({
      id: String(row[0]),
      titulo: row[1],
      autor: row[2],
      preco: row[3],
      status: row[4],
      isbn: row[5] ? String(row[5]) : '',
      capaUrl: row[6] || '',
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

// Trigger: configurar para rodar todo dia às 12h
function checkExpiredReservations() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const booksSheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
  const reservationsSheet = ss.getSheetByName(CONFIG.RESERVATIONS_SHEET);

  const now = new Date();
  const reservationsData = reservationsSheet.getDataRange().getValues();

  // Expira reservas vencidas
  for (let i = 1; i < reservationsData.length; i++) {
    if (reservationsData[i][7] !== 'ativa') continue;
    if (now >= new Date(reservationsData[i][6])) {
      reservationsSheet.getRange(i + 1, 8).setValue('expirada');
    }
  }

  // Recalcula status dos livros
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

// Roda uma vez para criar o trigger automático de expiração
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('checkExpiredReservations')
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();
}
