/* Cálculos puros: promedios, puntos de mejora, rankings y ganadores. */
(function () {
  const { RUBRIC, NOMINATIONS, AWARDS, FEEDBACK } = window.DD;

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const r1 = (x) => Math.round(x * 10) / 10;

  // Umbrales sobre el % del máximo del criterio (Bueno = 80 %, Suficiente = 60 %).
  const GOOD = 0.8;
  const CRITICAL = 0.6;

  function teamStats(team, evals, votes = 0) {
    const n = evals.length;
    const crit = {};
    RUBRIC.forEach((c) => {
      const vals = evals.map((e) => e.scores[c.id]).filter((v) => typeof v === 'number');
      const avg = mean(vals);
      crit[c.id] = {
        id: c.id, name: c.name, weight: c.weight,
        avg, pct: avg / c.weight,
        dist: c.levels.map((l) => ({ ...l, count: vals.filter((v) => v === l.pts).length })),
      };
    });
    const noms = {};
    NOMINATIONS.forEach((nm) => { noms[nm.id] = evals.filter((e) => e.nominations && e.nominations[nm.id]).length; });
    return {
      team, n, crit, noms, votes,
      avgTotal: mean(evals.map((e) => e.total)),
      judges: new Set(evals.map((e) => e.judgeKey)).size,
    };
  }

  /** Puntos de mejora: criterios por debajo de "Bueno", del más débil al más fuerte. */
  function improvements(stats) {
    return Object.values(stats.crit)
      .filter(() => stats.n > 0)
      .sort((a, b) => a.pct - b.pct)
      .map((c) => ({
        ...c,
        level: c.pct >= 0.9 ? 'fuerte' : c.pct >= GOOD ? 'bien' : c.pct >= CRITICAL ? 'mejorar' : 'critico',
      }));
  }

  function allStats(teams, evals, votes = []) {
    const byTeam = {};
    evals.forEach((e) => { (byTeam[e.teamId] = byTeam[e.teamId] || []).push(e); });
    const votesBy = {};
    votes.forEach((v) => { votesBy[v.teamId] = (votesBy[v.teamId] || 0) + 1; });
    return teams.map((t) => teamStats(t, byTeam[t.id] || [], votesBy[t.id] || 0));
  }

  function globalStats(statsList, evals) {
    const withEvals = statsList.filter((s) => s.n > 0);
    const crit = RUBRIC.map((c) => {
      const vals = evals.map((e) => e.scores[c.id]).filter((v) => typeof v === 'number');
      const avg = mean(vals);
      return { id: c.id, name: c.name, weight: c.weight, avg, pct: avg / c.weight };
    });
    return {
      teams: statsList.length,
      teamsEvaluated: withEvals.length,
      evaluations: evals.length,
      judges: new Set(evals.map((e) => e.judgeKey)).size,
      avgTotal: mean(evals.map((e) => e.total)),
      votes: statsList.reduce((a, s) => a + s.votes, 0),
      crit,
      weakTeamsByCrit: RUBRIC.map((c) => ({
        id: c.id, name: c.name,
        count: withEvals.filter((s) => s.crit[c.id].pct < GOOD).length,
      })),
    };
  }

  /** Ranking de un premio dentro de un conjunto de equipos. Devuelve filas ordenadas + metadatos de empate. */
  function rankAward(award, statsList) {
    const kind = award.kind;
    const pool = statsList.filter((s) => (kind === 'votos' ? s.votes > 0 : s.n > 0));
    const primary = (s) => (kind === 'promedio' ? s.avgTotal : kind === 'votos' ? s.votes : s.noms[award.id]);
    const tie1 = (s) => (award.tieCriterion ? s.crit[award.tieCriterion].avg : s.avgTotal);
    const rows = pool
      .map((s) => ({ s, primary: primary(s), tie1: tie1(s), tie2: s.avgTotal }))
      .sort((a, b) => b.primary - a.primary || b.tie1 - a.tie1 || b.tie2 - a.tie2);
    if (!rows.length) return { rows, winner: null, tied: [], resolvedByTiebreak: false, fullTie: false };

    const eq = (x, y) => Math.abs(x - y) < 1e-9;
    const top = rows[0];
    const tied = rows.filter((r) => eq(r.primary, top.primary));
    const stillTied = tied.filter((r) => eq(r.tie1, top.tie1) && eq(r.tie2, top.tie2));
    // Un premio por conteo/votos sin ningún punto no tiene ganador.
    const noWinner = kind !== 'promedio' && top.primary === 0;
    return {
      rows,
      winner: noWinner ? null : top,
      tied,
      resolvedByTiebreak: tied.length > 1 && stillTied.length === 1,
      fullTie: tied.length > 1 && stillTied.length > 1,
      stillTied,
    };
  }

  function winners(statsList, categories) {
    return AWARDS.map((award) => ({
      award,
      overall: rankAward(award, statsList),
      byCategory: categories.map((cat) => ({
        category: cat,
        result: rankAward(award, statsList.filter((s) => s.team.category === cat)),
      })),
    }));
  }

  /** Observaciones planas, listas para filtrar. */
  function observations(teams, evals) {
    const tById = Object.fromEntries(teams.map((t) => [t.id, t]));
    const out = [];
    evals.forEach((e) => {
      const team = tById[e.teamId];
      if (!team) return;
      FEEDBACK.forEach((f) => {
        const text = (e[f.id] || '').trim();
        if (text) out.push({ team, judgeName: e.judgeName, fieldId: f.id, area: f.area, text, at: e.updatedAt || e.createdAt || 0 });
      });
    });
    return out.sort((a, b) => b.at - a.at);
  }

  window.DD.analytics = { mean, r1, teamStats, improvements, allStats, globalStats, rankAward, winners, observations, GOOD, CRITICAL };
})();
