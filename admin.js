// admin.js — Panel de administrador UDES Diagnóstico 2030
//
// La contraseña aquí es una protección superficial (client-side) para evitar
// acceso casual. Los datos en Google Sheets son públicamente legibles.
// Cambiar al mismo valor que ADMIN_PASSWORD en codigo.gs antes de desplegar.

var ADMIN_PASS_LOCAL = "UDES2030admin";

// URL de la hoja de Google Sheets (opcional, para el botón "Ver Google Sheets")
var SHEETS_URL = "";

document.addEventListener("DOMContentLoaded", function () {
  configurarAdminLogin();
  configurarFiltrosAdmin();
  configurarBotonSalir();
});

// ── Login administrador ───────────────────────────────────────────────────────

function configurarAdminLogin() {
  document.getElementById("btn-admin-login").addEventListener("click", function () {
    document.getElementById("screen-admin-login").classList.remove("hidden");
    setTimeout(function () {
      document.getElementById("input-admin-pass").focus();
    }, 80);
  });

  document.getElementById("btn-admin-cancel").addEventListener("click", function () {
    cerrarLoginAdmin();
  });

  document.getElementById("btn-admin-submit").addEventListener("click", function () {
    verificarAdmin();
  });

  document.getElementById("input-admin-pass").addEventListener("keydown", function (e) {
    if (e.key === "Enter") verificarAdmin();
    if (e.key === "Escape") cerrarLoginAdmin();
  });
}

function cerrarLoginAdmin() {
  document.getElementById("screen-admin-login").classList.add("hidden");
  document.getElementById("input-admin-pass").value = "";
  document.getElementById("admin-login-error").classList.add("hidden");
}

function verificarAdmin() {
  var pass    = document.getElementById("input-admin-pass").value;
  var errorEl = document.getElementById("admin-login-error");

  if (pass === ADMIN_PASS_LOCAL) {
    cerrarLoginAdmin();
    mostrarPanelAdmin();
  } else {
    errorEl.classList.remove("hidden");
    document.getElementById("input-admin-pass").value = "";
    document.getElementById("input-admin-pass").focus();
  }
}

// ── Panel administrador ───────────────────────────────────────────────────────

function mostrarPanelAdmin() {
  document.getElementById("screen-config").classList.add("hidden");
  document.getElementById("screen-board").classList.add("hidden");
  document.getElementById("screen-admin").classList.remove("hidden");

  if (SHEETS_URL) {
    var btnSheets = document.getElementById("btn-sheets-link");
    btnSheets.href = SHEETS_URL;
    btnSheets.classList.remove("hidden");
  }

  // Llenar filtros de la pantalla admin
  var filterCampus    = document.getElementById("filter-campus");
  var filterCategoria = document.getElementById("filter-categoria");
  var filterRol       = document.getElementById("filter-rol");

  // Limpiar opciones antes de llenar (evitar duplicados si admin entra varias veces)
  filterCampus.innerHTML    = '<option value="">Todos</option>';
  filterCategoria.innerHTML = '<option value="">Todas</option>';
  filterRol.innerHTML       = '<option value="">Todos</option>';

  CONFIG.CAMPUS.forEach(function (c) {
    filterCampus.insertAdjacentHTML("beforeend",
      '<option value="' + c + '">' + c + '</option>');
  });

  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var cat = CONFIG.CATEGORIAS[key];
    filterCategoria.insertAdjacentHTML("beforeend",
      '<option value="' + key + '">' + cat.emoji + " " + cat.label + '</option>');
  });

  CONFIG.ROLES.forEach(function (r) {
    filterRol.insertAdjacentHTML("beforeend",
      '<option value="' + r + '">' + r + '</option>');
  });

  cargarDatosAdmin();

  document.getElementById("btn-admin-refresh").addEventListener("click", cargarDatosAdmin);
}

function cargarDatosAdmin() {
  fetch(CONFIG.GAS_URL + "?action=getCards")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.cards) {
        STATE.todasLasTarjetas = data.cards;
        renderizarAdmin(data.cards);
      }
    })
    .catch(function (err) {
      console.error("Error cargando datos admin:", err);
      document.getElementById("admin-table-body").innerHTML =
        '<tr><td colspan="7" class="px-4 py-8 text-center text-red-500">Error al conectar con el servidor. Verifica la URL del endpoint.</td></tr>';
    });
}

function renderizarAdmin(tarjetas) {
  renderizarEstadisticas(tarjetas);
  renderizarTablaAdmin(tarjetas);
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

function renderizarEstadisticas(tarjetas) {
  var statsEl = document.getElementById("admin-stats");
  statsEl.innerHTML = "";

  // Total general
  statsEl.appendChild(crearStatCard("Total aportes", tarjetas.length, "#374151"));

  // Por campus
  CONFIG.CAMPUS.forEach(function (campus) {
    var count = tarjetas.filter(function (t) { return t.campus === campus; }).length;
    statsEl.appendChild(crearStatCard(campus, count, "#1a237e"));
  });

  // Por categoría
  Object.keys(CONFIG.CATEGORIAS).forEach(function (key) {
    var cat   = CONFIG.CATEGORIAS[key];
    var count = tarjetas.filter(function (t) { return t.categoria === key; }).length;
    statsEl.appendChild(crearStatCard(cat.emoji + " " + cat.label.split(" ")[0], count, "#374151"));
  });

  // Total votos
  var totalVotos = tarjetas.reduce(function (sum, t) { return sum + (t.votos || 0); }, 0);
  statsEl.appendChild(crearStatCard("Total votos 👍", totalVotos, "#c62828"));
}

function crearStatCard(titulo, valor, color) {
  var div = document.createElement("div");
  div.className = "text-white rounded-xl p-4 text-center shadow-sm";
  div.style.backgroundColor = color;
  div.innerHTML =
    '<div class="text-3xl font-bold">' + valor + "</div>" +
    '<div class="text-xs mt-1 opacity-80 leading-tight">' + escapeHtml(titulo) + "</div>";
  return div;
}

// ── Tabla con filtros ─────────────────────────────────────────────────────────

function configurarFiltrosAdmin() {
  ["filter-campus", "filter-categoria", "filter-rol"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", aplicarFiltrosAdmin);
  });
}

function aplicarFiltrosAdmin() {
  var campus    = document.getElementById("filter-campus").value;
  var categoria = document.getElementById("filter-categoria").value;
  var rol       = document.getElementById("filter-rol").value;

  var tarjetas = STATE.todasLasTarjetas;
  if (campus)    tarjetas = tarjetas.filter(function (t) { return t.campus === campus; });
  if (categoria) tarjetas = tarjetas.filter(function (t) { return t.categoria === categoria; });
  if (rol)       tarjetas = tarjetas.filter(function (t) { return t.rol === rol; });

  renderizarTablaAdmin(tarjetas);
}

function renderizarTablaAdmin(tarjetas) {
  var tbody     = document.getElementById("admin-table-body");
  var countEl   = document.getElementById("table-count");
  countEl.textContent = tarjetas.length + " tarjeta" + (tarjetas.length !== 1 ? "s" : "");
  tbody.innerHTML = "";

  if (tarjetas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="px-4 py-8 text-center text-gray-400">No hay tarjetas para los filtros seleccionados.</td></tr>';
    return;
  }

  tarjetas.forEach(function (t) {
    var cat  = CONFIG.CATEGORIAS[t.categoria] || { emoji: "?", label: t.categoria };
    var fila = document.createElement("tr");
    fila.setAttribute("data-id", t.id);
    fila.className = "border-t border-gray-100 hover:bg-gray-50";

    var opcionesCategoria = Object.keys(CONFIG.CATEGORIAS).map(function (key) {
      var c = CONFIG.CATEGORIAS[key];
      var sel = key === t.categoria ? " selected" : "";
      return '<option value="' + key + '"' + sel + ">" + c.emoji + " " + c.label + "</option>";
    }).join("");

    fila.innerHTML =
      '<td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">' + formatearFechaAdmin(t.timestamp) + "</td>" +
      '<td class="px-4 py-3 text-sm font-medium text-gray-700">' + escapeHtml(t.campus) + "</td>" +
      '<td class="px-4 py-3 text-sm text-gray-600">' + escapeHtml(t.rol) + "</td>" +
      '<td class="px-4 py-3 text-sm text-gray-500">' + escapeHtml(t.nombre || "Anónimo") + "</td>" +
      '<td class="px-4 py-3 text-sm">' + cat.emoji + " " + escapeHtml(cat.label) + "</td>" +
      '<td class="px-4 py-3 text-sm text-gray-700 max-w-xs">' + escapeHtml(t.texto) + "</td>" +
      '<td class="px-4 py-3 text-sm text-center font-bold text-blue-600">' + (t.votos || 0) + "</td>" +
      '<td class="px-4 py-3 text-center">' +
        '<div class="flex flex-col gap-1 items-center">' +
          '<button class="btn-eliminar text-xs bg-red-100 text-red-700 hover:bg-red-200 px-2 py-1 rounded-lg transition-colors" data-id="' + t.id + '">🗑 Eliminar</button>' +
          '<select class="sel-mover text-xs border border-gray-200 rounded-lg px-1 py-1 text-gray-600 bg-white" data-id="' + t.id + '">' +
            opcionesCategoria +
          "</select>" +
          '<button class="btn-mover text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-2 py-1 rounded-lg transition-colors" data-id="' + t.id + '">↕ Mover</button>' +
        "</div>" +
      "</td>";
    tbody.appendChild(fila);
  });

  tbody.addEventListener("click", function (e) {
    var btnEliminar = e.target.closest(".btn-eliminar");
    var btnMover    = e.target.closest(".btn-mover");
    if (btnEliminar) eliminarTarjeta(btnEliminar.getAttribute("data-id"));
    if (btnMover)    moverTarjeta(btnMover.getAttribute("data-id"));
  });
}

// ── Salir del panel admin ─────────────────────────────────────────────────────

function configurarBotonSalir() {
  document.getElementById("btn-admin-exit").addEventListener("click", function () {
    document.getElementById("screen-admin").classList.add("hidden");
    document.getElementById("screen-config").classList.remove("hidden");
  });
}

// ── Acciones de moderación ────────────────────────────────────────────────────

function eliminarTarjeta(id) {
  if (!confirm("¿Eliminar esta tarjeta? Esta acción no se puede deshacer.")) return;

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "deleteCard", id: id, password: ADMIN_PASS_LOCAL })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        cargarDatosAdmin();
      } else {
        alert("Error al eliminar: " + (data.error || "desconocido"));
      }
    })
    .catch(function () { alert("Error de conexión al eliminar la tarjeta."); });
}

function moverTarjeta(id) {
  var fila = document.querySelector('tr[data-id="' + id + '"]');
  if (!fila) return;
  var select = fila.querySelector(".sel-mover");
  if (!select) return;
  var nuevaCategoria = select.value;

  fetch(CONFIG.GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "moveCard", id: id, nuevaCategoria: nuevaCategoria, password: ADMIN_PASS_LOCAL })
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.success) {
        cargarDatosAdmin();
      } else {
        alert("Error al mover: " + (data.error || "desconocido"));
      }
    })
    .catch(function () { alert("Error de conexión al mover la tarjeta."); });
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatearFechaAdmin(iso) {
  if (!iso) return "";
  try {
    var d = new Date(iso);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit", month: "2-digit", year: "2-digit"
    }) + " " + d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  } catch (e) { return ""; }
}
