// config.js — Configuración central de la aplicación UDES Diagnóstico
// IMPORTANTE: Reemplazar GAS_URL con la URL real después de desplegar el Web App en Google Apps Script

const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbzAxvSvaLLJelhnjLB28ZfvnIV1iKb73DgzhNMZdzIEbhBD5zFc7ewKezCM-QJGyRqZgw/exec",

  CAMPUS: ["Bucaramanga", "Valledupar", "Cúcuta", "Bogotá", "Arauca"],

  ROLES: ["Directivo", "Docente", "Estudiante", "Administrativo"],

  CATEGORIAS: {
    retos:         { label: "Retos actuales del campus",  emoji: "🔴", borderColor: "#ef4444" },
    vision:        { label: "Visión a 2030",              emoji: "🟢", borderColor: "#22c55e" },
    oportunidades: { label: "Oportunidades de mejora",    emoji: "💡", borderColor: "#eab308" },
    fortalezas:    { label: "Fortalezas del campus",      emoji: "⭐", borderColor: "#3b82f6" }
  },

  // Intervalo de recarga automática en milisegundos (30 segundos)
  POLL_INTERVAL: 30000,

  MAX_CHARS: 500
};
