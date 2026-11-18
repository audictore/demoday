/* Rúbrica, nominaciones y retroalimentación del Demo Day 2026.
   Fuente: "Guía de evaluación del DemoDay2026" + "Guía Operativa Demo Day Expo". */
(function () {
  const lvl = (key, label, pts, text) => ({ key, label, pts, text });

  const RUBRIC = [
    {
      id: 'viabilidad', name: 'Viabilidad del Negocio', weight: 25,
      desc: 'Coherencia en mercado, clientes objetivo e ingresos.',
      levels: [
        lvl('excelente', 'Excelente', 25, 'Modelo de ingresos claro, mercado definido y alto potencial comercial.'),
        lvl('bueno', 'Bueno', 20, 'Mercado e ingresos definidos, pero con leves inconsistencias operativas.'),
        lvl('suficiente', 'Suficiente', 15, 'Propuesta de mercado básica y modelo de ingresos poco claro.'),
        lvl('insuficiente', 'Insuficiente', 5, 'Sin definición de mercado ni modelo de negocio viable.'),
      ],
    },
    {
      id: 'problema', name: 'Identificación del Problema', weight: 20,
      desc: 'Claridad y relevancia de la necesidad o problemática planteada.',
      levels: [
        lvl('excelente', 'Excelente', 20, 'Problema bien delimitado, de alto impacto y sustentado con evidencias.'),
        lvl('bueno', 'Bueno', 16, 'Problema claro y relevante, pero con justificación limitada.'),
        lvl('suficiente', 'Suficiente', 12, 'Problema vago o de baja relevancia detectada.'),
        lvl('insuficiente', 'Insuficiente', 4, 'No se identifica un problema claro ni justificado.'),
      ],
    },
    {
      id: 'innovacion', name: 'Innovación', weight: 20,
      desc: 'Originalidad de la solución mostrada frente a lo existente.',
      levels: [
        lvl('excelente', 'Excelente', 20, 'Solución disruptiva, original e inédita.'),
        lvl('bueno', 'Bueno', 16, 'Innovaciones significativas frente a soluciones actuales.'),
        lvl('suficiente', 'Suficiente', 12, 'Innovación incremental ligera; existen productos muy similares.'),
        lvl('insuficiente', 'Insuficiente', 4, 'Solución convencional sin valor diferencial.'),
      ],
    },
    {
      id: 'prototipo', name: 'Desarrollo del Prototipo', weight: 20,
      desc: 'Calidad tangible y funcionalidad demostrable del prototipo.',
      levels: [
        lvl('excelente', 'Excelente', 20, 'Prototipo 100% funcional en vivo, con excelente acabado.'),
        lvl('bueno', 'Bueno', 16, 'Prototipo funcional con fallas menores o detalles estéticos a pulir.'),
        lvl('suficiente', 'Suficiente', 12, 'Prototipo parcialmente funcional o en fase conceptual previa.'),
        lvl('insuficiente', 'Insuficiente', 4, 'El prototipo no funciona o carece de elementos tangibles.'),
      ],
    },
    {
      id: 'defensa', name: 'Calidad de la Defensa', weight: 15,
      desc: 'Seguridad, claridad y dominio del producto en el stand.',
      levels: [
        lvl('excelente', 'Excelente', 15, 'Exposición clara, segura y con respuesta precisa a cuestionamientos.'),
        lvl('bueno', 'Bueno', 12, 'Presentación clara y buen dominio, con ligeras dudas al responder.'),
        lvl('suficiente', 'Suficiente', 9, 'Exposición titubeante o dominio parcial del proyecto.'),
        lvl('insuficiente', 'Insuficiente', 3, 'Presentación desorganizada, sin claridad ni dominio.'),
      ],
    },
  ];

  // Nominaciones "Sí / No": el ganador es quien acumula más "Sí".
  const NOMINATIONS = [
    {
      id: 'defensa', award: 'Mejor Defensa en Stand',
      question: '¿Nomina a este proyecto para el premio "Mejor Defensa en Stand"?',
      hint: 'Por destacar de forma sobresaliente en fluidez, pitch, seguridad y atención al público.',
      tieCriterion: 'defensa',
    },
    {
      id: 'innovador', award: 'Proyecto Más Innovador',
      question: '¿Nomina a este proyecto para el premio "Proyecto Más Innovador"?',
      hint: 'Por presentar la solución más original, creativa o disruptiva del evento.',
      tieCriterion: 'innovacion',
    },
    {
      id: 'prototipo', award: 'Mejor Prototipo',
      question: '¿Nomina a este proyecto para el premio "Mejor Prototipo"?',
      hint: 'Por la calidad física/digital, acabados y funcionalidad demostrada en vivo.',
      tieCriterion: 'prototipo',
    },
  ];

  const FEEDBACK = [
    {
      id: 'fortalezas', label: 'Fortalezas clave del proyecto', required: true,
      help: 'Mencione los aspectos técnicos, de equipo o comerciales más consolidados.',
      area: 'Fortalezas',
    },
    {
      id: 'mejoraPrototipo', label: 'Sugerencias de mejora para el prototipo (diseño y funcionalidad)', required: false,
      help: 'Recomendaciones sobre materiales, ergonomía, experiencia de usuario (UX/UI), acabados o pruebas técnicas.',
      area: 'Prototipo',
    },
    {
      id: 'mejoraNegocio', label: 'Recomendaciones para el modelo de negocio y viabilidad comercial', required: false,
      help: 'Sugerencias sobre estrategia de precios, definición de clientes objetivo, alianzas clave o canales de distribución.',
      area: 'Modelo de negocio',
    },
    {
      id: 'mejoraEscala', label: 'Recomendaciones para aumentar la factibilidad y escalabilidad', required: false,
      help: 'Aspectos legales, regulatorios, técnicos o financieros que el equipo debe resolver para llevar el producto al mercado real.',
      area: 'Factibilidad y escalabilidad',
    },
  ];

  // Categorías de navegación de la Guía Operativa (los equipos pueden traer otras).
  const CATEGORIES = ['Salud y Bienestar', 'Tecnología', 'Educación', 'Servicios', 'Sustentabilidad'];

  // Premios. "negocio" por promedio; defensa/innovador/prototipo por nominaciones "Sí";
  // "publico" por votos del QR general.
  const AWARDS = [
    { id: 'negocio', name: 'Mejor Idea de Negocio', basis: 'Mayor promedio total en la rúbrica de 100 puntos', kind: 'promedio' },
    ...NOMINATIONS.map((n) => ({
      id: n.id, name: n.award, basis: 'Mayor acumulación de nominaciones "Sí"', kind: 'nominaciones',
      tieCriterion: n.tieCriterion,
    })),
    { id: 'publico', name: 'Premio del Público', basis: 'Mayor número de votos del público (QR general)', kind: 'votos' },
  ];

  /* ---------- Evaluaciones configurables ----------
     Cada evaluación guarda su propia configuración; sin ella se usa la del Demo Day definida arriba. */
  const DEFAULT_EVENT = 'demoday';
  const DEFAULT_CONFIG = { overallAward: AWARDS[0].name, rubric: RUBRIC, nominations: NOMINATIONS, feedback: FEEDBACK, categories: CATEGORIES };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const randomId = (prefix) => prefix + Math.random().toString(36).slice(2, 8);

  /** Completa los datos derivados: máximo por criterio, puntaje total y lista de premios. */
  function normalizeConfig(raw) {
    const c = raw && raw.rubric && raw.rubric.length ? raw : DEFAULT_CONFIG;
    const rubric = c.rubric.map((r) => {
      const levels = [...r.levels].map((l) => ({ ...l, pts: Number(l.pts) })).sort((a, b) => b.pts - a.pts);
      return { ...r, desc: r.desc || '', levels, weight: levels[0].pts };
    });
    const ids = new Set(rubric.map((r) => r.id));
    const nominations = (c.nominations || []).map((n) => ({ ...n, hint: n.hint || '', tieCriterion: ids.has(n.tieCriterion) ? n.tieCriterion : '' }));
    const feedback = (c.feedback || []).map((f) => ({ ...f, help: f.help || '', required: !!f.required, area: f.area || f.label }));
    const maxTotal = rubric.reduce((s, r) => s + r.weight, 0);
    const overallAward = c.overallAward || AWARDS[0].name;
    const awards = [
      { id: 'negocio', name: overallAward, basis: `Mayor promedio total en la rúbrica de ${maxTotal} puntos`, kind: 'promedio' },
      ...nominations.map((n) => ({ id: n.id, name: n.award, basis: 'Mayor acumulación de nominaciones "Sí"', kind: 'nominaciones', tieCriterion: n.tieCriterion })),
      AWARDS[AWARDS.length - 1],
    ];
    return { overallAward, rubric, nominations, feedback, categories: c.categories || [], maxTotal, awards };
  }

  /** Punto de partida para una evaluación nueva sin copiar otra. */
  function blankConfig() {
    const levels = () => [
      { key: 'excelente', label: 'Excelente', pts: 10, text: '' }, { key: 'bueno', label: 'Bueno', pts: 8, text: '' },
      { key: 'suficiente', label: 'Suficiente', pts: 6, text: '' }, { key: 'insuficiente', label: 'Insuficiente', pts: 2, text: '' },
    ];
    return {
      overallAward: 'Mejor proyecto', categories: [], nominations: [],
      rubric: [1, 2, 3].map((n) => ({ id: randomId('c'), name: `Criterio ${n}`, desc: '', levels: levels() })),
      feedback: [{ id: 'fortalezas', label: 'Fortalezas del proyecto', help: '', required: true, area: 'Fortalezas' }],
    };
  }

  /** Revisa lo capturado en el editor. Devuelve los problemas y la configuración lista para guardar. */
  function validateConfig(d) {
    const errors = [];
    const txt = (v) => String(v ?? '').trim();
    if (d.rubric.length < 3 || d.rubric.length > 8) errors.push('La rúbrica debe tener entre 3 y 8 criterios.');
    const rubric = d.rubric.map((r, i) => {
      const name = txt(r.name) || `criterio ${i + 1}`;
      if (!txt(r.name)) errors.push(`El criterio ${i + 1} no tiene nombre.`);
      if (r.levels.length < 2 || r.levels.length > 6) errors.push(`«${name}» debe tener entre 2 y 6 niveles.`);
      const levels = r.levels.map((l) => ({ key: l.key || randomId('l'), label: txt(l.label), pts: Number(l.pts), text: txt(l.text) }));
      if (levels.some((l) => !l.label)) errors.push(`«${name}» tiene un nivel sin nombre.`);
      if (levels.some((l) => !Number.isFinite(l.pts) || l.pts < 0)) errors.push(`«${name}» tiene puntos inválidos.`);
      if (new Set(levels.map((l) => l.pts)).size !== levels.length) errors.push(`En «${name}» cada nivel debe tener puntos distintos.`);
      return { id: r.id, name: txt(r.name), desc: txt(r.desc), levels: levels.sort((a, b) => b.pts - a.pts) };
    });
    const ids = new Set(rubric.map((r) => r.id));
    const max = rubric.reduce((s, r) => s + Math.max(0, ...r.levels.map((l) => l.pts || 0)), 0);
    if (max <= 0 || max > 1000) errors.push('El puntaje máximo de la rúbrica debe estar entre 1 y 1000.');
    const nominations = d.nominations.map((n, i) => {
      if (!txt(n.award) || !txt(n.question)) errors.push(`El premio ${i + 1} necesita nombre y pregunta.`);
      return { id: n.id, award: txt(n.award), question: txt(n.question), hint: txt(n.hint), tieCriterion: ids.has(n.tieCriterion) ? n.tieCriterion : '' };
    });
    const feedback = d.feedback.map((f, i) => {
      if (!txt(f.label)) errors.push(`La pregunta abierta ${i + 1} no tiene texto.`);
      return { id: f.id, label: txt(f.label), help: txt(f.help), required: !!f.required, area: txt(f.area) || txt(f.label) };
    });
    if (!txt(d.overallAward)) errors.push('Escribe el nombre del premio al mejor promedio.');
    const categories = (Array.isArray(d.categories) ? d.categories : String(d.categories || '').split(',')).map(txt).filter(Boolean);
    return { errors, config: { overallAward: txt(d.overallAward), rubric, nominations, feedback, categories } };
  }

  window.DD = window.DD || {};
  Object.assign(window.DD, {
    RUBRIC, NOMINATIONS, FEEDBACK, CATEGORIES, AWARDS, MAX_TOTAL: 100,
    DEFAULT_EVENT, normalizeConfig, blankConfig, validateConfig, cloneConfig: clone, randomId,
    current: normalizeConfig(null),
  });
})();
