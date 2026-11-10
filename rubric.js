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

  window.DD = window.DD || {};
  Object.assign(window.DD, { RUBRIC, NOMINATIONS, FEEDBACK, CATEGORIES, AWARDS, MAX_TOTAL: 100 });
})();
