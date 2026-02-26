// src/lib/dailyTips.ts
// 365 tips únicos (1 por día). Puedes editar o reemplazar cuando quieras.

export const DAILY_TIPS: string[] = [
  "Antes de iniciar una charla, valida que el QR sea legible en un celular con brillo medio.",
  "Usa ejemplos reales del trabajo: la gente aprende más cuando se reconoce en el caso.",
  "En capacitaciones, una sola idea fuerte vale más que diez ideas medianas.",
  "Cierra cada charla con 3 puntos: riesgo, conducta segura y evidencia (firma/PDF).",
  "Si hay ruido, habla más lento (no más fuerte): mejora comprensión y control del grupo.",
  "Define el objetivo en 1 frase: ‘Hoy lograremos que…’.",
  "Evita textos largos en pantalla: usa frases cortas y refuerza con voz.",
  "Antes de firmar, confirma identidad (nombre y RUT) para evitar registros erróneos.",
  "En inducción, incluye rutas de evacuación y puntos de encuentro (siempre).",
  "Una medida preventiva sin responsable y plazo es solo una intención.",
  "El mejor ‘check’ es observable: ‘usa casco’ (sí/no), no ‘tiene conciencia’.",
  "Planifica 5 minutos para preguntas: baja la resistencia y sube adherencia.",
  "Si la gente está de pie, reduce la charla a 10–15 minutos y usa demostración.",
  "Para EPP: explica ‘cuándo, cómo y por qué’, no solo ‘qué’.",
  "En faena, revisa piso/orden antes de comenzar: el entorno arruina la mejor charla.",
  "Enfoca la charla en 1 riesgo crítico del día (no en todo el manual).",
  "Usa historias cortas: incidente → causa → barrera → aprendizaje.",
  "Si una persona no puede firmar, define protocolo de excepción (trazable).",
  "QR en pantalla grande: mejor contraste (blanco/negro) y tamaño mínimo 25 cm.",
  "Recuerda: la evidencia protege al trabajador y a la empresa (PDF final).",
  "Al inicio, pide ‘silencio 30 segundos’: establece regla sin pelear.",
  "En trabajos en altura: siempre 3 puntos de anclaje al subir/bajar.",
  "En manipulación manual: enseña ‘cadera atrás’ y carga cerca del cuerpo.",
  "En químicos: etiqueta y hoja de datos de seguridad (SDS) siempre disponible.",
  "Orden y aseo: si no hay espacio, hay accidente en pausa.",
  "En extintores: PAS (Puntería–Apretar–Barrer) y distancia segura.",
  "En electricidad: bloqueo y etiquetado (LOTO) antes de intervenir.",
  "En tránsito interno: velocidad baja + separación de peatones.",
  "La mejor señalética es la que se ve desde donde nace el riesgo.",
  "Antes de comenzar: define roles de emergencia (quién llama, quién guía, quién corta energía).",
  "En espacios confinados: permiso, medición, ventilación y vigía.",
  "En herramientas: revisa guardas y cables antes de usar (30 segundos).",
  "Crea ‘checklist’ de 5 ítems: la gente sí lo usa si es corto.",
  "Si un riesgo no se puede eliminar, sube el nivel de control (ingeniería → admin → EPP).",
  "Evita culpabilizar: busca la causa en el sistema, no en la persona.",
  "Si vas a medir éxito: define un indicador (asistencia, hallazgos, acciones cerradas).",
  "En charlas: repite 2 veces la instrucción crítica, con palabras distintas.",
  "Una firma clara es evidencia útil: pide trazo firme y completo.",
  "En corte y esmeril: pantalla facial + guantes adecuados (no de tela).",
  "En resbalones: controla agua/suelo + calzado + señalización temporal.",
  "Siempre confirma: ¿hay botiquín y teléfono de emergencia visibles?",
  "Si hay contratistas: define reglas en 2 minutos antes de entrar al área.",
  "Asegura iluminación en pasillos: lo invisible es peligro silencioso.",
  "Si hay fatiga: pausas cortas programadas ganan productividad.",
  "En levantamiento: evita torsión; gira con los pies.",
  "En sustancias: no mezclar químicos sin procedimiento (nunca).",
  "Antes del cierre: valida que el relator firme y quede PDF generado.",
];

// Si no hay 365 acá, completamos automáticamente con variaciones seguras.
function fillTo365(base: string[]) {
  const out = [...base];

  // Generador de tips únicos (sin numeritos visibles).
  const THEMES = [
    "QR y asistencia",
    "Firma digital",
    "Cierre de charla",
    "Trazabilidad",
    "Orden y aseo",
    "Resbalones y caídas",
    "Trabajo en altura",
    "EPP",
    "Extintores",
    "Evacuación",
    "Tránsito interno",
    "Manipulación de cargas",
    "Herramientas",
    "Electricidad",
    "Químicos",
    "Espacios confinados",
    "Ergonomía",
    "Ruido",
    "Iluminación",
    "Contratistas",
    "Comunicación",
    "Checklist",
    "Emergencias",
    "Prevención",
  ];

  const ACTIONS = [
    "haz una verificación rápida antes de iniciar",
    "define una regla simple y visible para el equipo",
    "refuerza con una demostración de 30 segundos",
    "cierra con una acción concreta y responsable",
    "usa una frase corta y repítela al final",
    "valida el entorno (piso/orden/señalética) antes de hablar",
    "prioriza el riesgo crítico del día (1 solo)",
    "deja evidencia: registro y PDF final",
    "pide confirmación: ‘¿quedó claro?’ y una respuesta",
    "evita la culpa: enfócate en barreras y controles",
    "mantén el material visual mínimo: 3 bullets",
    "prepara el QR con buen contraste y tamaño",
    "reserva 2 minutos para preguntas al final",
    "comprueba que la firma quede legible",
  ];

  const SUFFIX = [
    "para que el equipo lo aplique hoy.",
    "y deja todo trazable.",
    "sin recargar de información.",
    "con foco en conducta segura.",
    "y asegúrate de registrar la evidencia.",
    "(Chile)" ,
  ];

  const seen = new Set(out.map((s) => s.trim()));

  outer: for (const t of THEMES) {
    for (const a of ACTIONS) {
      for (const s of SUFFIX) {
        const tip = `${t}: ${a} ${s}`.replace(/\s+/g, " ").trim();
        if (seen.has(tip)) continue;
        out.push(tip);
        seen.add(tip);
        if (out.length >= 365) break outer;
      }
    }
  }

  // Si por cualquier motivo faltara, repetimos base (sin añadir números).
  while (out.length < 365) out.push(base[out.length % base.length]);
  return out;
}

export const DAILY_TIPS_365 = fillTo365(DAILY_TIPS).slice(0, 365);

export function tipIndexForToday(date = new Date()) {
  // Día del año (0-364)
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(364, day));
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
