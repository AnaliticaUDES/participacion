// app.js — Lógica principal del tablero UDES Diagnóstico 2030

// Estado global de la sesión del participante
const STATE = {
  campus: null,
  rol: null,
  nombre: null,
  categoriaActiva: null,
  todasLasTarjetas: [],
  votadosIds: new Set(),
  pollTimer: null,
  pollResultados: null
};

// Instancias de Chart.js activas, indexadas por id de canvas (para destruir al re-renderizar)
var CHARTS = {};

document.addEventListener("DOMContentLoaded", function () {
  inicializarSelectores();
  configurarFormConfig();
  configurarModal();
  configurarEncuesta();
  configurarResultados();
  cargarVotosDesdeStorage();
});

// ── Selectores de campus y rol ────────────────────────────────────────────────

function inicializarSelectores() {
  var selectCampus = document.getElementById("select-campus");
  var selectRol    = document.getElementById("select-rol");

  CONFIG.CAMPUS.forEach(function (c) {
    selectCampus.insertAdjacentHTML("beforeend",
      '<option value="' + c + '">' + c + '</option>');
  });

  CONFIG.ROLES.forEach(function (r) {
    selectRol.insertAdjacentHTML("beforeend",
      '<option value="' + r + '">' + r + '</option>');
  });
}

// ── Formulario de ingreso ─────────────────────────────────────────────────────

function configurarFormConfig() {
  document.getElementById("form-config").addEventListener("submit", function (e) {
    e.preventDefault();
    var campus = document.getElementById("select-campus").value;
    var rol    = document.getElementById("select-rol").value;
    var nombre = document.getElementById("input-nombre").value.trim();

    if (!campus || !rol) return;

    STATE.campus = campus;
    STATE.rol    = rol;
    STATE.nombre = nombre || "Anónimo";

    mostrarEncuesta();
  });
}

// ── Cuestionario (paso previo al tablero) ─────────────────────────────────────

function configurarEncuesta() {
  document.getElementById("form-encuesta").addEventListener("submit", function (e) {
    e.preventDefault();
    enviarEncuesta();
  });
}

function mostrarEncuesta() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-encuesta").classList.remove("hidden");

  document.getElementById("encuesta-info").textContent =
    STATE.campus + " · " + STATE.rol +
    (STATE.nombre !== "Anónimo" ? " · " + STATE.nombre : " · Anónimo");

  renderEncuesta();
}

function renderEncuesta() {
  var cont = document.getElementById("preguntas");
  cont.innerHTML = "";

  CONFIG.PREGUNTAS.forEach(function (p, i) {
    var opcionesHTML = p.opciones.map(function (op) {
      return (
        '<label class="encuesta-opcion">' +
          '<input type="checkbox" name="' + p.id + '" value="' + escapeHtml(op) + '">' +
          "<span>" + escapeHtml(op) + "</span>" +
        "</label>"
      );
    }).join("");

    var otraHTML = p.permiteOtra
      ? '<label class="encuesta-opcion">' +
          '<input type="checkbox" class="chk-otra" data-pid="' + p.id + '" value="__otra__">' +
          "<span>Otra ¿cuál?</span>" +
        "</label>" +
        '<input type="text" class="input-otra hidden" data-pid="' + p.id + '" maxlength="120" ' +
          'placeholder="Escribe tu respuesta…">'
      : "";

    cont.insertAdjacentHTML("beforeend",
      '<div class="bg-white rounded-2xl shadow-sm p-5" data-pregunta="' + p.id + '">' +
        '<p class="font-semibold text-gray-800 mb-3">' + (i + 1) + ". " + escapeHtml(p.texto) + "</p>" +
        '<div class="encuesta-opciones">' + opcionesHTML + otraHTML + "</div>" +
      "</div>");
  });

  // Mostrar/ocultar el campo de texto al marcar "Otra"
  cont.querySelectorAll(".chk-otra").forEach(function (chk) {
    chk.addEventListener("change", function () {
      var input = cont.querySelector('.input-otra[data-pid="' + chk.dataset.pid + '"]');
      if (!input) return;
      if (chk.checked) {
        input.classList.remove("hidden");
        setTimeout(function () { input.focus(); }, 50);
      } else {
        input.classList.add("hidden");
        input.value = "";
      }
    });
  });
}

function recopilarRespuestas() {
  var cont = document.getElementById("preguntas");
  var respuestas = {};

  CONFIG.PREGUNTAS.forEach(function (p) {
    var seleccion = [];
    cont.querySelectorAll('input[name="' + p.id + '"]:checked').forEach(function (chk) {
      seleccion.push(chk.value);
    });
    var otraChk = cont.querySelector('.chk-otra[data-pid="' + p.id + '"]');
    if (otraChk && otraChk.checked) {
      var input = cont.querySelector('.input-otra[data-pid="' + p.id + '"]');
      var txt = input ? input.value.trim() : "";
      if (txt) seleccion.push("Otra: " + txt);
    }
    respuestas[p.id] = seleccion;
  });

  return respuestas;
}

function enviarEncuesta() {
  var errorEl   = document.getElementById("encuesta-error");
  var submitBtn = document.getElementById("btn-encuesta-submit");
  errorEl.classList.add("hidden");

  var respuestas = recopilarRespuestas();

  // Validar: al menos una opción por pregunta
  var faltante = CONFIG.PREGUNTAS.find(function (p) {
    return !respuestas[p.id] || respuestas[p.id].length === 0;
  });
  if (faltante) {
    errorEl.textContent = "Por favor responde todas las preguntas (marca al menos una opción).";
    errorEl.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>';

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action:     "saveEncuesta",
      campus:     STATE.campus,
      rol:        STATE.rol,
      nombre:     STATE.nombre,
      respuestas: respuestas
    })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        document.getElementById("screen-encuesta").classList.add("hidden");
        mostrarTablero();
      } else {
        errorEl.textContent = data.error || "Error al enviar. Inténtalo de nuevo.";
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Enviar y continuar al tablero →";
      }
    })
    .catch(function () {
      errorEl.textContent = "Error de conexión. Verifica tu internet e inténtalo de nuevo.";
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar y continuar al tablero →";
    });
}

// ── Navegación a pantalla del tablero ────────────────────────────────────────

function mostrarTablero() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-board").classList.remove("hidden");

  document.getElementById("header-info").textContent =
    STATE.campus + " · " + STATE.rol +
    (STATE.nombre !== "Anónimo" ? " · " + STATE.nombre : " · Anónimo");

  construirColumnas();
  cargarTarjetas();

  STATE.pollTimer = setInterval(cargarTarjetas, CONFIG.POLL_INTERVAL);

  document.getElementById("btn-refresh").addEventListener("click", function () {
    cargarTarjetas();
  });
}

// ── Construcción de columnas ──────────────────────────────────────────────────

function construirColumnas() {
  var container = document.getElementById("board-columns");
  container.innerHTML = "";

  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var cat = CONFIG.CATEGORIAS[key];
    var col = document.createElement("div");
    col.className = "board-column";
    col.dataset.categoria = key;

    col.innerHTML =
      '<div class="flex items-center justify-between mb-3">' +
        '<h3 class="font-bold text-gray-700 text-sm">' +
          cat.emoji + " " + cat.label +
        "</h3>" +
        '<span class="text-xs bg-white border border-gray-200 text-gray-500 rounded-full px-2 py-0.5" id="count-' + key + '">0</span>' +
      "</div>" +
      '<button class="btn-add-card" data-categoria="' + key + '">' +
        "+ Agregar tarjeta" +
      "</button>" +
      '<div class="cards-container" id="cards-' + key + '"></div>';

    container.appendChild(col);

    col.querySelector(".btn-add-card").addEventListener("click", function () {
      abrirModal(key);
    });
  });
}

// ── Carga y renderizado de tarjetas ──────────────────────────────────────────

function cargarTarjetas() {
  var indicator = document.getElementById("loading-indicator");
  indicator.classList.remove("hidden");

  fetch(CONFIG.GAS_URL + "?action=getCards")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.cards) {
        STATE.todasLasTarjetas = data.cards;
        renderizarTarjetas(data.cards);
        var lastUpdate = document.getElementById("last-update");
        lastUpdate.classList.remove("hidden");
        lastUpdate.textContent = "Actualizado " + formatearHora(new Date());
      }
    })
    .catch(function (err) {
      console.error("Error al cargar tarjetas:", err);
    })
    .finally(function () {
      indicator.classList.add("hidden");
    });
}

function renderizarTarjetas(tarjetas) {
  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var c = document.getElementById("cards-" + key);
    if (c) c.innerHTML = "";
  });

  tarjetas.forEach(function (tarjeta) {
    var container = document.getElementById("cards-" + tarjeta.categoria);
    if (!container) return;
    container.insertAdjacentHTML("beforeend", crearHTMLTarjeta(tarjeta));
  });

  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var count = tarjetas.filter(function (t) { return t.categoria === key; }).length;
    var el = document.getElementById("count-" + key);
    if (el) el.textContent = count;
  });

  enlazarEventosVoto();
}

function crearHTMLTarjeta(tarjeta) {
  var fecha    = formatearFecha(tarjeta.timestamp);
  var yaVote   = STATE.votadosIds.has(tarjeta.id);
  var voteCls  = "btn-vote" + (yaVote ? " voted" : "");
  var disabled = yaVote ? "disabled" : "";
  var nombre   = tarjeta.nombre && tarjeta.nombre !== "Anónimo"
    ? ' · <span class="font-medium">' + escapeHtml(tarjeta.nombre) + "</span>"
    : "";

  return (
    '<div class="card-item card-' + tarjeta.categoria + '" data-id="' + escapeHtml(tarjeta.id) + '">' +
      '<p class="text-sm text-gray-800 leading-relaxed mb-2">' + escapeHtml(tarjeta.texto) + "</p>" +
      '<div class="flex items-center justify-between text-xs text-gray-400">' +
        '<div>' +
          '<span class="font-semibold text-gray-600">' + escapeHtml(tarjeta.campus) + "</span>" +
          " · " + escapeHtml(tarjeta.rol) + nombre +
        "</div>" +
        '<span class="whitespace-nowrap ml-2">' + fecha + "</span>" +
      "</div>" +
      '<div class="mt-2">' +
        '<button class="' + voteCls + '" data-id="' + escapeHtml(tarjeta.id) + '" ' + disabled + ">" +
          "👍 <span class=\"vote-count\">" + (tarjeta.votos || 0) + "</span>" +
        "</button>" +
      "</div>" +
    "</div>"
  );
}

function enlazarEventosVoto() {
  document.querySelectorAll(".btn-vote:not([disabled])").forEach(function (btn) {
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  document.querySelectorAll(".btn-vote:not([disabled])").forEach(function (btn) {
    btn.addEventListener("click", function () {
      votar(btn.dataset.id, btn);
    });
  });
}

// ── Votación ──────────────────────────────────────────────────────────────────

function votar(cardId, btnEl) {
  if (STATE.votadosIds.has(cardId)) return;

  btnEl.disabled = true;
  btnEl.classList.add("voted");

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "vote", id: cardId })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        STATE.votadosIds.add(cardId);
        guardarVotosEnStorage();
        var countEl = btnEl.querySelector(".vote-count");
        if (countEl) countEl.textContent = data.votos;
      } else {
        btnEl.disabled = false;
        btnEl.classList.remove("voted");
      }
    })
    .catch(function () {
      btnEl.disabled = false;
      btnEl.classList.remove("voted");
    });
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function configurarModal() {
  var textarea  = document.getElementById("modal-texto");
  var charCount = document.getElementById("char-count");

  textarea.addEventListener("input", function () {
    charCount.textContent = textarea.value.length + " / " + CONFIG.MAX_CHARS;
  });

  document.getElementById("modal-cancel").addEventListener("click", cerrarModal);
  document.getElementById("modal-card").addEventListener("click", function (e) {
    if (e.target === document.getElementById("modal-card")) cerrarModal();
  });
  document.getElementById("modal-submit").addEventListener("click", publicarTarjeta);
}

function abrirModal(categoria) {
  STATE.categoriaActiva = categoria;
  var cat = CONFIG.CATEGORIAS[categoria];

  document.getElementById("modal-title").textContent =
    cat.emoji + "  " + cat.label;
  document.getElementById("modal-campus-rol").textContent =
    STATE.campus + " · " + STATE.rol;
  document.getElementById("modal-texto").value = "";
  document.getElementById("char-count").textContent = "0 / " + CONFIG.MAX_CHARS;
  document.getElementById("modal-error").classList.add("hidden");
  document.getElementById("modal-submit").disabled = false;
  document.getElementById("modal-submit").textContent = "Publicar";

  document.getElementById("modal-card").classList.remove("hidden");
  setTimeout(function () { document.getElementById("modal-texto").focus(); }, 80);
}

function cerrarModal() {
  document.getElementById("modal-card").classList.add("hidden");
  STATE.categoriaActiva = null;
}

function publicarTarjeta() {
  var texto    = document.getElementById("modal-texto").value.trim();
  var errorEl  = document.getElementById("modal-error");
  var submitBtn = document.getElementById("modal-submit");

  errorEl.classList.add("hidden");

  if (texto.length < 5) {
    errorEl.textContent = "Por favor escribe al menos 5 caracteres.";
    errorEl.classList.remove("hidden");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>';

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action:    "saveCard",
      campus:    STATE.campus,
      rol:       STATE.rol,
      nombre:    STATE.nombre,
      categoria: STATE.categoriaActiva,
      texto:     texto
    })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        cerrarModal();
        cargarTarjetas();
      } else {
        errorEl.textContent = data.error || "Error al publicar. Inténtalo de nuevo.";
        errorEl.classList.remove("hidden");
        submitBtn.disabled = false;
        submitBtn.textContent = "Publicar";
      }
    })
    .catch(function () {
      errorEl.textContent = "Error de conexión. Verifica tu internet e inténtalo de nuevo.";
      errorEl.classList.remove("hidden");
      submitBtn.disabled = false;
      submitBtn.textContent = "Publicar";
    });
}

// ── Resultados en vivo (participante) ─────────────────────────────────────────

function configurarResultados() {
  var btnVer = document.getElementById("btn-ver-resultados");
  if (btnVer) btnVer.addEventListener("click", mostrarResultados);

  var btnVolver = document.getElementById("btn-volver-tablero");
  if (btnVolver) btnVolver.addEventListener("click", function () {
    if (STATE.pollResultados) { clearInterval(STATE.pollResultados); STATE.pollResultados = null; }
    document.getElementById("screen-resultados").classList.add("hidden");
    document.getElementById("screen-board").classList.remove("hidden");
  });
}

function mostrarResultados() {
  document.getElementById("screen-board").classList.add("hidden");
  document.getElementById("screen-resultados").classList.remove("hidden");

  cargarResultados("resultados-charts", "resultados-total");
  if (STATE.pollResultados) clearInterval(STATE.pollResultados);
  STATE.pollResultados = setInterval(function () {
    cargarResultados("resultados-charts", "resultados-total");
  }, CONFIG.POLL_INTERVAL);
}

// ── Carga, agregación y gráficas (compartido con el panel admin) ──────────────

function cargarResultados(contenedorId, totalElId) {
  fetch(CONFIG.GAS_URL + "?action=getEncuesta")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      var respuestas = data.respuestas || [];
      var agg = agregarResultados(respuestas);
      renderGraficas(contenedorId, agg, respuestas.length);
      var totalEl = document.getElementById(totalElId);
      if (totalEl) {
        totalEl.textContent = respuestas.length + " respuesta" + (respuestas.length !== 1 ? "s" : "");
      }
    })
    .catch(function (err) {
      console.error("Error al cargar resultados:", err);
    });
}

function agregarResultados(respuestas) {
  var total = respuestas.length;
  var agg = {};

  CONFIG.PREGUNTAS.forEach(function (p) {
    var conteo = {};
    p.opciones.forEach(function (op) { conteo[op] = 0; });
    if (p.permiteOtra) conteo["Otra"] = 0;

    respuestas.forEach(function (r) {
      var sel = r[p.id] || [];
      sel.forEach(function (op) {
        if (!op) return;
        if (conteo.hasOwnProperty(op)) {
          conteo[op]++;
        } else {
          // Respuestas tipo "Otra: texto" o valores no listados
          conteo["Otra"] = (conteo["Otra"] || 0) + 1;
        }
      });
    });

    agg[p.id] = { texto: p.texto, conteo: conteo, total: total };
  });

  return agg;
}

function renderGraficas(contenedorId, agg, total) {
  var cont = document.getElementById(contenedorId);
  if (!cont) return;

  if (total === 0) {
    cont.innerHTML =
      '<p class="text-center text-gray-400 text-sm py-8">Aún no hay respuestas. ' +
      "Las gráficas aparecerán aquí en cuanto lleguen.</p>";
    return;
  }

  CONFIG.PREGUNTAS.forEach(function (p, i) {
    var data       = agg[p.id];
    var canvasId   = contenedorId + "_" + p.id;
    var labels     = Object.keys(data.conteo);
    var valores    = labels.map(function (op) { return data.conteo[op]; });
    var etiquetas  = labels.map(function (op) {
      var pct = data.total > 0 ? Math.round((data.conteo[op] / data.total) * 100) : 0;
      return op + " (" + pct + "%)";
    });
    var colores    = labels.map(function (op) {
      return op === "Otra" ? "#c62828" : "#1a237e";
    });

    // Crear la tarjeta + canvas la primera vez
    var card = document.getElementById("card_" + canvasId);
    if (!card) {
      cont.insertAdjacentHTML("beforeend",
        '<div id="card_' + canvasId + '" class="bg-white rounded-2xl shadow-sm p-4">' +
          '<p class="font-semibold text-gray-800 text-sm mb-3">' + (i + 1) + ". " + escapeHtml(p.texto) + "</p>" +
          '<canvas id="' + canvasId + '"></canvas>' +
        "</div>");
    }

    var ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (CHARTS[canvasId]) {
      // Actualizar datos in situ (más fluido para "en vivo")
      CHARTS[canvasId].data.labels = etiquetas;
      CHARTS[canvasId].data.datasets[0].data = valores;
      CHARTS[canvasId].data.datasets[0].backgroundColor = colores;
      CHARTS[canvasId].update();
    } else {
      CHARTS[canvasId] = new Chart(ctx, {
        type: "bar",
        data: {
          labels: etiquetas,
          datasets: [{ data: valores, backgroundColor: colores, borderRadius: 4 }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (item) { return item.parsed.x + " respuesta(s)"; }
              }
            }
          },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  });
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatearFecha(iso) {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) +
      " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}

function formatearHora(d) {
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cargarVotosDesdeStorage() {
  try {
    var guardados = localStorage.getItem("udes_votos_2030");
    if (guardados) {
      JSON.parse(guardados).forEach(function (id) { STATE.votadosIds.add(id); });
    }
  } catch (e) {}
}

function guardarVotosEnStorage() {
  try {
    localStorage.setItem("udes_votos_2030",
      JSON.stringify(Array.from(STATE.votadosIds)));
  } catch (e) {}
}
