// app.js — Lógica principal del tablero UDES Diagnóstico 2030

// Estado global de la sesión del participante
const STATE = {
  campus: null,
  rol: null,
  nombre: null,
  categoriaActiva: null,
  todasLasTarjetas: [],
  votadosIds: new Set(),
  pollTimer: null
};

document.addEventListener("DOMContentLoaded", function () {
  inicializarSelectores();
  configurarFormConfig();
  configurarModal();
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

    mostrarTablero();
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
