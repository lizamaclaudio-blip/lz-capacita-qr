// src/lib/dailyTips.ts
// Tips diarios estilo “¿Sabías que…?” (Chile: ley laboral + prevención de riesgos).
// ✅ 365 tips únicos (1 por día). Cambian automáticamente al día siguiente y no se repiten dentro del año.

export const DAILY_TIPS: string[] = [
  "La Ley 16.744 creó el seguro social que cubre accidentes del trabajo y enfermedades profesionales.",
  "El Art. 184 del Código del Trabajo obliga al empleador a proteger eficazmente la vida y salud de las personas trabajadoras.",
  "Las mutualidades (ACHS, Mutual de Seguridad, IST) y el ISL son organismos administradores del seguro de la Ley 16.744.",
  "La SUSESO supervisa el funcionamiento del seguro de la Ley 16.744 y sus organismos administradores.",
  "El DS 594 fija condiciones sanitarias y ambientales básicas en los lugares de trabajo.",
  "El DS 54 regula la constitución y funcionamiento de los Comités Paritarios de Higiene y Seguridad.",
  "El DS 40 regula obligaciones de prevención de riesgos profesionales e incluye el ‘derecho a saber’ sobre los riesgos del puesto.",
  "Un Comité Paritario se integra con representantes del empleador y de los trabajadores, y apoya la investigación de accidentes.",
  "El 28 de abril se conmemora el Día Mundial de la Seguridad y Salud en el Trabajo (impulsado por la OIT).",
  "En prevención, la jerarquía de controles prioriza eliminar o sustituir el peligro antes que depender del EPP.",
  "Un accidente de trayecto ocurre en el recorrido directo entre casa y trabajo (y viceversa) y puede tener cobertura del seguro.",
  "La investigación de incidentes busca causas y barreras (qué falló en el sistema), no culpables.",
  "Una capacitación sin registro pierde trazabilidad: la evidencia es parte de la prevención.",
  "El ‘derecho a saber’ implica informar riesgos, medidas de control y método de trabajo seguro antes de exponer a alguien.",
  "En Chile, la SEREMI de Salud suele fiscalizar materias sanitarias/ambientales del trabajo (ventilación, agentes, condiciones).",
  "La Dirección del Trabajo puede fiscalizar condiciones de seguridad y el cumplimiento de obligaciones laborales vinculadas a SST.",
  "El seguro 16.744 no solo cubre atención médica: también contempla prestaciones económicas cuando corresponde.",
  "El objetivo de un plan de emergencia no es el papel: es que cada persona sepa qué hacer en los primeros 60 segundos.",
  "Un simulacro sirve cuando se mide: tiempos, rutas, puntos de encuentro y mejoras concretas.",
  "En gestión preventiva, ‘control’ no es lo mismo que ‘EPP’: primero se intenta controlar el riesgo en la fuente.",
  "Un permiso de trabajo (PTW) ordena controles críticos antes de tareas de alto riesgo (altura, caliente, confinados).",
  "LOTO (bloqueo y etiquetado) existe para evitar energizaciones inesperadas durante mantención o limpieza.",
  "En ergonomía, acercar la carga al cuerpo reduce el momento y baja la exigencia sobre la zona lumbar.",
  "En ruido ocupacional, bajar 3 dB es (aprox.) reducir a la mitad la energía sonora: pequeños cambios importan.",
  "La señalética funciona mejor cuando se ubica donde nace el riesgo, no donde ‘se ve bonita’.",
  "Una lista corta (5–7 ítems) se usa más que un checklist eterno: menos fricción, más cumplimiento.",
  "Registrar casi-accidentes (near miss) es oro: te permite actuar antes de que alguien salga lesionado.",
  "La cultura preventiva se construye con conductas observables: ‘usa baranda’ es medible, ‘tiene cuidado’ no.",
  "En sustancias peligrosas, la SDS (Hoja de Datos de Seguridad) es la ‘receta’ de manejo seguro.",
  "Los controles administrativos (procedimientos, turnos, permisos) funcionan mejor cuando son simples y verificables.",
  "En altura, la prevención real está en el sistema: acceso seguro, anclaje, plan de rescate y supervisión.",
  "Un plan de rescate en altura no se improvisa: se entrena antes, igual que un simulacro.",
  "En espacios confinados, la atmósfera puede cambiar rápido: medición y ventilación son controles base.",
  "El orden y aseo no es estética: es control de riesgo (caídas, golpes, incendios, exposición).",
  "La iluminación deficiente aumenta errores: en seguridad, ‘ver bien’ es parte del control.",
  "En tránsito interno, separar rutas de peatones y equipos reduce la probabilidad de atropello, incluso sin ‘culpa’.",
  "En fatiga, la decisión se deteriora: pausas cortas programadas pueden prevenir errores críticos.",
  "En prevención moderna se habla de barreras: físicas, técnicas y organizacionales que evitan el daño.",
  "El trabajo seguro no es ‘sentido común’: es diseño + entrenamiento + supervisión + controles.",
  "La evidencia (checklist, acta, firma) no es burocracia: es memoria del sistema para mejorar.",
  "En seguridad, ‘lo normalizado’ puede esconder riesgo: revisar desviaciones pequeñas evita incidentes grandes.",
  "El Comité Paritario no reemplaza al prevencionista: complementa, observa y participa en mejoras.",
  "En Chile, la coordinación de actividades (empresa principal/contratistas) es clave para controlar riesgos compartidos.",
  "Un extintor no ‘sirve’ si está tapado o vencido: su mantención y acceso son parte del control.",
  "Un mapa de riesgos útil es el que guía decisiones: qué controlar primero y con qué evidencia.",
  "Una observación planeada (en terreno) detecta condiciones inseguras antes de que se vuelvan costumbre.",
  "El mejor indicador preventivo no es solo ‘accidentes’: también acciones cerradas y controles verificados.",
];

type Snip = { ref: string; fact: string };
type Pair = { a: string; b: string };

const LAW_SNIPS: Snip[] = [
  { ref: "Ley 16.744", fact: "establece el seguro social contra accidentes del trabajo y enfermedades profesionales." },
  { ref: "Código del Trabajo (Art. 184)", fact: "define el deber de protección del empleador sobre vida y salud." },
  { ref: "DS 594", fact: "ordena condiciones sanitarias y ambientales básicas en el trabajo." },
  { ref: "DS 54", fact: "regula Comités Paritarios de Higiene y Seguridad." },
  { ref: "DS 40", fact: "refuerza prevención de riesgos y el ‘derecho a saber’." },
  { ref: "SUSESO", fact: "supervisa el seguro de la Ley 16.744 y a sus administradores." },
  { ref: "Mutualidades", fact: "apoyan con asesoría preventiva, capacitación y prestaciones del seguro 16.744." },
  { ref: "ISL", fact: "es el organismo administrador público para empleadores no adheridos a mutualidad." },
  { ref: "Dirección del Trabajo", fact: "puede fiscalizar cumplimiento laboral y aspectos de SST en su ámbito." },
  { ref: "SEREMI de Salud", fact: "fiscaliza materias sanitarias/ambientales y condiciones de trabajo." },
  { ref: "Comité Paritario", fact: "participa en investigación de accidentes y propuestas de mejora." },
  { ref: "Ley Karin (21.643)", fact: "refuerza la prevención frente al acoso laboral/sexual y la violencia en el trabajo." },
];

const KEY_DATES: Pair[] = [
  { a: "28 de abril", b: "se conmemora el Día Mundial de la Seguridad y Salud en el Trabajo." },
  { a: "1 de mayo", b: "se recuerda el valor del trabajo digno (y la prevención como base de ese derecho)." },
  { a: "septiembre", b: "muchas empresas refuerzan planes de emergencia por celebraciones masivas y traslados." },
  { a: "invierno", b: "suben riesgos por baja luz, lluvia y superficies resbaladizas; el control de caídas se vuelve clave." },
  { a: "verano", b: "aumenta la exposición a calor/UV en trabajos al aire libre; hidratar y planificar pausas es prevención." },
  { a: "fin de año", b: "la fatiga y prisa elevan el riesgo: los controles críticos deben reforzarse." },
  { a: "inicio de mes", b: "es buen momento para revisar checklist de extintores, rutas de evacuación y botiquines." },
  { a: "lunes", b: "es típico ver más distracción por retorno; un ‘brief’ corto de riesgos ayuda a re-enfocar." },
  { a: "turno noche", b: "la iluminación y fatiga son factores críticos: menos error si se controla el entorno." },
  { a: "días lluviosos", b: "el riesgo de resbalones sube: alfombras, señalización temporal y calzado marcan diferencia." },
];

const CONCEPTS: Snip[] = [
  { ref: "Jerarquía de controles", fact: "eliminar/sustituir → ingeniería → administrativas → EPP." },
  { ref: "IPER", fact: "identifica peligros y evalúa riesgos para priorizar controles." },
  { ref: "AST/ART", fact: "analiza pasos de la tarea y define controles antes de ejecutar." },
  { ref: "LOTO", fact: "evita energizaciones inesperadas con bloqueo y etiquetado." },
  { ref: "PTW", fact: "permiso de trabajo que ordena controles en tareas críticas." },
  { ref: "SDS", fact: "resume peligros, EPP, manejo y respuesta a emergencias de una sustancia." },
  { ref: "Near miss", fact: "casi-accidente que permite aprender sin lesión (si se reporta)." },
  { ref: "Plan de emergencia", fact: "define roles, rutas, equipos y comunicación ante eventos." },
  { ref: "Simulacro", fact: "prueba el plan; sin práctica, el papel no salva." },
  { ref: "Señalética", fact: "guía conductas cuando está bien ubicada y es coherente con el riesgo." },
  { ref: "Ergonomía", fact: "ajusta tarea y entorno a la persona para reducir carga física." },
  { ref: "Fatiga", fact: "afecta decisión y reflejos; pausas y turnos bien diseñados reducen error." },
  { ref: "Investigación", fact: "busca causas raíz y barreras faltantes para evitar recurrencias." },
  { ref: "Orden y aseo", fact: "controla riesgos de caídas, golpes, incendios y exposiciones." },
  { ref: "Tránsito interno", fact: "segrega peatones/equipos y define velocidad para bajar atropellos." },
  { ref: "Altura", fact: "requiere control de acceso, anclaje, sistema anti-caídas y rescate." },
  { ref: "Confinados", fact: "exige permiso, monitoreo, ventilación y vigía." },
];

const PRACTICES: string[] = [
  "dejar evidencia (acta, registro, firma) para aprender y mejorar",
  "verificar controles críticos antes de iniciar la tarea",
  "hacer una pausa de 60 segundos para alinear riesgos y roles",
  "priorizar el control en la fuente antes que el EPP",
  "revisar rutas de evacuación y punto de encuentro con el equipo",
  "mantener extintores accesibles, vigentes y señalizados",
  "reforzar orden y aseo donde hay tránsito peatonal",
  "señalizar temporalmente cuando cambian condiciones (piso mojado, excavación)",
  "reportar near miss como insumo de mejora, no como ‘acusación’",
  "usar checklist corto y constante (mejor que uno perfecto pero nunca usado)",
  "asegurar que procedimientos sean claros, breves y verificables",
  "entrenar rescate antes de necesitarlo (altura / confinados)",
  "confirmar SDS disponible y entendida antes de manipular químicos",
  "aplicar LOTO antes de intervenir equipos energizados",
  "diseñar pausas en tareas repetitivas para bajar fatiga",
  "separar rutas de peatones y equipos móviles",
  "medir, registrar y actuar: lo que no se mide, se diluye",
  "hacer observaciones en terreno y cerrar acciones con fecha y responsable",
];

function fillTo365(base: string[]) {
  const out = [...base];
  const seen = new Set(out.map((s) => s.trim()));

  const add = (s: string) => {
    const tip = s.replace(/\s+/g, " ").trim();
    if (!tip) return false;
    if (seen.has(tip)) return false;
    seen.add(tip);
    out.push(tip);
    return true;
  };

  // 1) Tips por referencia legal/institucional
  for (const l of LAW_SNIPS) {
    add(`${l.ref}: ${l.fact}`);
  }

  // 2) Tips por concepto + definición corta
  for (const c of CONCEPTS) {
    add(`${c.ref}: ${c.fact}`);
  }

  // 3) Fechas/estacionalidad (sin depender de años exactos)
  for (const d of KEY_DATES) {
    add(`Dato de calendario: ${d.a} — ${d.b}`);
  }

  // 4) Combinaciones ley/organismo + práctica (genera muchos únicos)
  outer: for (const l of LAW_SNIPS) {
    for (const c of CONCEPTS) {
      for (const p of PRACTICES) {
        const ok = add(`${l.ref} + ${c.ref}: ${l.fact} | Clave práctica: ${p}.`);
        if (ok && out.length >= 365) break outer;
      }
    }
  }

  // 5) Si por cualquier motivo faltara, completamos con conceptos + práctica.
  outer2: for (const c of CONCEPTS) {
    for (const p of PRACTICES) {
      const ok = add(`${c.ref}: ${c.fact} | En terreno, conviene ${p}.`);
      if (ok && out.length >= 365) break outer2;
    }
  }

  while (out.length < 365) out.push(base[out.length % base.length]);
  return out;
}

export const DAILY_TIPS_365 = fillTo365(DAILY_TIPS).slice(0, 365);

export function tipIndexForToday(date = new Date()) {
  // Día del año (0-364) + un offset anual para que no sea el mismo tip cada año en el mismo día.
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  const d = Math.max(0, Math.min(364, day));

  // 37 es coprimo con 365 → rota bien.
  const yearOffset = (date.getFullYear() * 37) % 365;
  return (d + yearOffset) % 365;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}