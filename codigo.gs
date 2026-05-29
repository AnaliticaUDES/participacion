// codigo.gs — Google Apps Script para UDES Diagnóstico Institucional 2030
//
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Abrir la hoja de Google Sheets y crear una hoja llamada "Tarjetas"
// 2. En el menú: Extensiones > Apps Script
// 3. Borrar el contenido y pegar este código completo
// 4. Cambiar ADMIN_PASSWORD al valor deseado (usar el mismo en admin.js)
// 5. Guardar el proyecto (nombre sugerido: "UDES Padlet Backend")
// 6. Clic en "Desplegar" > "Nueva implementación"
//    - Tipo: Aplicación web
//    - Ejecutar como: Yo (tu cuenta de Google)
//    - Quién tiene acceso: Cualquier persona
// 7. Copiar la URL del endpoint y pegarla en config.js (campo GAS_URL)

var SHEET_NAME    = "Tarjetas";
var ENCUESTA_SHEET = "Encuesta";
var ADMIN_PASSWORD = "UDES2030admin"; // ← CAMBIAR ANTES DE DESPLEGAR

// IDs de las preguntas del cuestionario. Deben coincidir con CONFIG.PREGUNTAS en config.js.
var PREGUNTAS_IDS = ["p1", "p2", "p3"];

var CAMPUS_VALIDOS = ["Bucaramanga", "Valledupar", "Cúcuta", "Bogotá", "Arauca"];
var ROLES_VALIDOS  = ["Directivo", "Docente", "Estudiante", "Administrativo"];

// ── Endpoints HTTP ────────────────────────────────────────────────────────────

function doGet(e) {
  var action = e.parameter.action;
  var response;

  if (action === "getCards") {
    response = getCards();
  } else if (action === "getEncuesta") {
    response = getEncuesta();
  } else {
    response = { error: "Acción no reconocida" };
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "JSON inválido" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var response;
  var action = data.action;

  if (action === "saveCard") {
    response = saveCard(data);
  } else if (action === "vote") {
    response = addVote(data.id);
  } else if (action === "deleteCard") {
    response = deleteCard(data);
  } else if (action === "moveCard") {
    response = moveCard(data);
  } else if (action === "saveEncuesta") {
    response = saveEncuesta(data);
  } else {
    response = { error: "Acción no reconocida" };
  }

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Acceso a la hoja ──────────────────────────────────────────────────────────

function getSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["id", "timestamp", "campus", "rol", "nombre", "categoria", "texto", "votos"]);

    // Formato de cabecera
    var headerRange = sheet.getRange(1, 1, 1, 8);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1a237e");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

// ── saveCard ──────────────────────────────────────────────────────────────────

function saveCard(data) {
  var camposValidos = {
    campus:    ["Bucaramanga", "Valledupar", "Cúcuta", "Bogotá", "Arauca"],
    rol:       ["Directivo", "Docente", "Estudiante", "Administrativo"],
    categoria: ["retos", "vision", "oportunidades", "fortalezas"]
  };

  if (!data.campus || camposValidos.campus.indexOf(data.campus) === -1) {
    return { error: "Campus inválido" };
  }
  if (!data.rol || camposValidos.rol.indexOf(data.rol) === -1) {
    return { error: "Rol inválido" };
  }
  if (!data.categoria || camposValidos.categoria.indexOf(data.categoria) === -1) {
    return { error: "Categoría inválida" };
  }
  if (typeof data.texto !== "string" || data.texto.trim().length < 5) {
    return { error: "El texto debe tener al menos 5 caracteres" };
  }
  if (data.texto.length > 500) {
    return { error: "El texto no puede superar 500 caracteres" };
  }

  var sheet     = getSheet();
  var id        = Utilities.getUuid();
  var timestamp = new Date().toISOString();
  var nombre    = (data.nombre && data.nombre.trim() !== "") ? data.nombre.trim() : "Anónimo";

  sheet.appendRow([id, timestamp, data.campus, data.rol, nombre, data.categoria, data.texto.trim(), 0]);

  return { success: true, id: id, timestamp: timestamp };
}

// ── getCards ──────────────────────────────────────────────────────────────────

function getCards() {
  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { cards: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  var cards = values
    .filter(function (row) { return row[0] !== ""; }) // omitir filas vacías
    .map(function (row) {
      return {
        id:        row[0],
        timestamp: row[1] instanceof Date ? row[1].toISOString() : String(row[1]),
        campus:    row[2],
        rol:       row[3],
        nombre:    row[4],
        categoria: row[5],
        texto:     row[6],
        votos:     parseInt(row[7]) || 0
      };
    });

  // Más recientes primero
  cards.sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return { cards: cards };
}

// ── deleteCard ────────────────────────────────────────────────────────────────

function deleteCard(data) {
  if (!data.password || data.password !== ADMIN_PASSWORD) {
    return { error: "No autorizado" };
  }
  if (!data.id) {
    return { error: "Se requiere el id de la tarjeta" };
  }

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { error: "Tarjeta no encontrada" };
  }

  var idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === data.id) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }

  return { error: "Tarjeta no encontrada" };
}

// ── moveCard ──────────────────────────────────────────────────────────────────

function moveCard(data) {
  if (!data.password || data.password !== ADMIN_PASSWORD) {
    return { error: "No autorizado" };
  }
  if (!data.id) {
    return { error: "Se requiere el id de la tarjeta" };
  }

  var categoriasValidas = ["retos", "vision", "oportunidades", "fortalezas"];
  if (!data.nuevaCategoria || categoriasValidas.indexOf(data.nuevaCategoria) === -1) {
    return { error: "Categoría inválida" };
  }

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { error: "Tarjeta no encontrada" };
  }

  var idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === data.id) {
      sheet.getRange(i + 2, 6).setValue(data.nuevaCategoria);
      return { success: true, nuevaCategoria: data.nuevaCategoria };
    }
  }

  return { error: "Tarjeta no encontrada" };
}

// ── addVote ───────────────────────────────────────────────────────────────────

function addVote(cardId) {
  if (!cardId) {
    return { error: "Se requiere el id de la tarjeta" };
  }

  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return { error: "Tarjeta no encontrada" };
  }

  var idColumn = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (var i = 0; i < idColumn.length; i++) {
    if (idColumn[i][0] === cardId) {
      var rowNumber  = i + 2;
      var votosCell  = sheet.getRange(rowNumber, 8);
      var currentVotes = parseInt(votosCell.getValue()) || 0;
      votosCell.setValue(currentVotes + 1);
      return { success: true, votos: currentVotes + 1 };
    }
  }

  return { error: "Tarjeta no encontrada" };
}

// ── Cuestionario ──────────────────────────────────────────────────────────────

function getEncuestaSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ENCUESTA_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(ENCUESTA_SHEET);
    var encabezados = ["id", "timestamp", "campus", "rol", "nombre"].concat(PREGUNTAS_IDS);
    sheet.appendRow(encabezados);

    var headerRange = sheet.getRange(1, 1, 1, encabezados.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#1a237e");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function saveEncuesta(data) {
  if (!data.campus || CAMPUS_VALIDOS.indexOf(data.campus) === -1) {
    return { error: "Campus inválido" };
  }
  if (!data.rol || ROLES_VALIDOS.indexOf(data.rol) === -1) {
    return { error: "Rol inválido" };
  }
  if (!data.respuestas || typeof data.respuestas !== "object") {
    return { error: "Respuestas inválidas" };
  }

  // Cada pregunta debe tener al menos una opción marcada
  for (var k = 0; k < PREGUNTAS_IDS.length; k++) {
    var sel = data.respuestas[PREGUNTAS_IDS[k]];
    if (!sel || !sel.length) {
      return { error: "Falta responder la pregunta " + PREGUNTAS_IDS[k] };
    }
  }

  var sheet     = getEncuestaSheet();
  var id        = Utilities.getUuid();
  var timestamp = new Date().toISOString();
  var nombre    = (data.nombre && data.nombre.trim() !== "") ? data.nombre.trim() : "Anónimo";

  var fila = [id, timestamp, data.campus, data.rol, nombre];
  PREGUNTAS_IDS.forEach(function (pid) {
    var sel = data.respuestas[pid] || [];
    fila.push(sel.join("; "));
  });

  sheet.appendRow(fila);

  return { success: true, id: id, timestamp: timestamp };
}

function getEncuesta() {
  var sheet   = getEncuestaSheet();
  var lastRow = sheet.getLastRow();
  var nCols   = 5 + PREGUNTAS_IDS.length;

  if (lastRow <= 1) {
    return { respuestas: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, nCols).getValues();

  var respuestas = values
    .filter(function (row) { return row[0] !== ""; })
    .map(function (row) {
      var obj = {
        id:        row[0],
        timestamp: row[1] instanceof Date ? row[1].toISOString() : String(row[1]),
        campus:    row[2],
        rol:       row[3],
        nombre:    row[4]
      };
      PREGUNTAS_IDS.forEach(function (pid, idx) {
        var celda = row[5 + idx];
        obj[pid] = (celda === "" || celda == null)
          ? []
          : String(celda).split("; ").filter(function (s) { return s !== ""; });
      });
      return obj;
    });

  return { respuestas: respuestas };
}
