// config.js — Configuración central de la aplicación UDES Diagnóstico
// IMPORTANTE: Reemplazar GAS_URL con la URL real después de desplegar el Web App en Google Apps Script

const CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbwSNS288JhcMUqRnRilLD2cJW8QTUCsWNGrFS_w5OsFMTpg2Z16HoqTbT8fugzcRHXy9g/exec",

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

  MAX_CHARS: 500,

  // Cuestionario previo al tablero. Cada pregunta es de selección múltiple
  // (se puede marcar varias) y con opción "Otra" abierta. Los id (p1, p2, p3)
  // deben coincidir con PREGUNTAS_IDS en codigo.gs.
  PREGUNTAS: [
    {
      id: "p1",
      texto: "¿Qué aspecto considera prioritario fortalecer en los jóvenes santandereanos?",
      opciones: [
        "Disciplina y liderazgo",
        "Bilingüismo",
        "Creatividad e innovación",
        "Competencias digitales",
        "Formación deportiva",
        "Trabajo colaborativo"
      ],
      permiteOtra: true
    },
    {
      id: "p2",
      texto: "¿Cómo deberían responder las instituciones de educación superior frente a los cambios tecnológicos y sociales?",
      opciones: [
        "Innovando en programas académicos",
        "Impulsando el Bilingüismo",
        "Integrando Inteligencia Artificial",
        "Fortaleciendo investigación",
        "Trabajando más con empresas",
        "Formando en habilidades humanas"
      ],
      permiteOtra: true
    },
    {
      id: "p3",
      texto: "¿Cuál debería ser la prioridad educativa del departamento hacia 2050?",
      opciones: [
        "Cobertura educativa",
        "Calidad académica",
        "Formación tecnológica",
        "Investigación e innovación",
        "Internacionalización"
      ],
      permiteOtra: true
    }
  ]
};
