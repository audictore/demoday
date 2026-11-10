/* Datos de demostración (solo modo local): equipos, jueces y evaluaciones inventadas. */
(function () {
  const { RUBRIC, NOMINATIONS } = window.DD;
  const { judgeKeyOf, evalId } = window.DD.util;

  const TEAMS = [
    ['EcoRiego Inteligente', 'LAGE 5A', 'Sustentabilidad', ['Ana Pérez', 'Luis Gómez', 'María Soto'], 0.9],
    ['SaludMóvil', 'TSU GCH 3B', 'Salud y Bienestar', ['Carlos Ruiz', 'Diana López'], 0.72],
    ['TutorBot', 'LAGE 7A', 'Educación', ['Fernanda Cruz', 'Iván Herrera', 'Paola Díaz'], 0.8],
    ['LimpiaMax', 'TSU EFEP 3A', 'Servicios', ['Jorge Medina', 'Sofía Reyes'], 0.5],
    ['FarmaTrack', 'LAGE 5B', 'Salud y Bienestar', ['Daniela Ortiz', 'Mario Vega', 'Elena Cano'], 0.78],
    ['AgroSense', 'TSU GCH 3A', 'Tecnología', ['Pablo Núñez', 'Rosa Luna'], 0.66],
    ['ReciclaApp', 'LAGE 7B', 'Sustentabilidad', ['Tomás Ibarra', 'Karla Mejía', 'Hugo Salas'], 0.58],
    ['BecaFácil', 'TSU EFEP 3B', 'Educación', ['Lucía Paredes', 'Andrés Rojas'], 0.45],
    ['Domicilio Seguro', 'LAGE 5A', 'Servicios', ['Valeria Campos', 'Raúl Estrada', 'Nadia Fuentes'], 0.7],
    ['SmartInventario', 'TSU GCH 3B', 'Tecnología', ['Óscar Montes', 'Irene Bravo', 'Emilio Rangel'], 0.85],
  ];
  const JUDGES = [['Dra. Martínez', 'martinez@demo.mx'], ['Mtro. Hernández', 'hernandez@demo.mx'], ['Ing. Salazar', 'salazar@demo.mx'],
    ['Lic. Domínguez', 'dominguez@demo.mx'], ['Dr. Vargas', 'vargas@demo.mx'], ['Mtra. Olvera', 'olvera@demo.mx']];

  const POOL = {
    fortalezas: ['Equipo muy cohesionado y con dominio del tema.', 'El prototipo resuelve un problema real con claridad.', 'Buena segmentación de clientes y propuesta de valor.', 'Excelente comunicación con el público.', 'Diseño atractivo y fácil de entender.'],
    mejoraPrototipo: ['Mejorar los acabados y la ergonomía del prototipo.', 'Agregar pruebas de usabilidad con usuarios reales.', 'La interfaz necesita mayor consistencia visual.', 'Documentar las pruebas técnicas de funcionamiento.'],
    mejoraNegocio: ['Definir con precisión la estrategia de precios.', 'Aclarar quién es el cliente que paga y quién el usuario.', 'Buscar alianzas con proveedores o instituciones.', 'Detallar los canales de distribución.'],
    mejoraEscala: ['Revisar requisitos regulatorios antes de salir al mercado.', 'Estimar costos de producción a mayor escala.', 'Plan financiero a 12 meses poco claro.', 'Considerar propiedad intelectual y registro de marca.'],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  window.DD.seedDemo = async function () {
    const store = window.DD.store;
    const now = Date.now();
    const teams = TEAMS.map(([name, group, category, members], i) => ({ id: 'demo' + (i + 1), name, group, category, members, stand: String(i + 1), description: '' }));
    await store.saveTeams(teams);
    for (let ti = 0; ti < TEAMS.length; ti++) {
      const q = TEAMS[ti][4];
      for (let ji = 0; ji < JUDGES.length; ji++) {
        if (Math.random() < 0.12) continue; // algunos jueces se saltan algún stand
        const scores = {};
        RUBRIC.forEach((c) => {
          const r = q + (Math.random() - 0.5) * 0.45;
          const idx = r > 0.8 ? 0 : r > 0.6 ? 1 : r > 0.4 ? 2 : 3;
          scores[c.id] = c.levels[idx].pts;
        });
        const jk = judgeKeyOf(JUDGES[ji][1]);
        const ev = {
          id: evalId(teams[ti].id, jk), teamId: teams[ti].id, judgeKey: jk, judgeName: JUDGES[ji][0], judgeEmail: JUDGES[ji][1],
          scores, total: Object.values(scores).reduce((a, b) => a + b, 0),          nominations: Object.fromEntries(NOMINATIONS.map((n) => [n.id, Math.random() < q * q * 0.7])),
          fortalezas: pick(POOL.fortalezas),
          mejoraPrototipo: Math.random() < 0.7 ? pick(POOL.mejoraPrototipo) : '',
          mejoraNegocio: Math.random() < 0.6 ? pick(POOL.mejoraNegocio) : '',
          mejoraEscala: Math.random() < 0.5 ? pick(POOL.mejoraEscala) : '',
          createdAt: now - Math.floor(Math.random() * 3600e3), updatedAt: now - Math.floor(Math.random() * 3600e3),
        };
        await store.saveEvaluation(ev);
      }
    }
    // Voto del público: 60 dispositivos, con más votos para los equipos mejor calificados.
    const weights = TEAMS.map((t) => t[4] * t[4]);
    const sum = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 60; i++) {
      let r = Math.random() * sum; let ti = 0;
      while (ti < weights.length - 1 && r > weights[ti]) { r -= weights[ti]; ti++; }
      await store.saveVote({ id: 'demovoter' + i, voterId: 'demovoter' + i, teamId: teams[ti].id, createdAt: now, updatedAt: now });
    }
  };
})();
