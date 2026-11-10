/* Capa de datos con dos motores intercambiables:
   - "firebase": Firestore + Auth (producción, si firebase-config.js tiene claves).
   - "local": localStorage del navegador (demostración / pruebas sin cuenta). */
(function () {
  const FB_VERSION = '10.12.2';
  const cfg = window.FIREBASE_CONFIG || {};
  const useFirebase = !!(cfg.apiKey && cfg.projectId);

  const judgeKeyOf = (email) => String(email || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const evalId = (teamId, judgeKey) => `${teamId}__${judgeKey}`;
  const newId = () => Math.random().toString(36).slice(2, 8);
  const DEFAULT_SETTINGS = { open: true, votingOpen: true, baseUrl: '', eventName: 'Demo Day 2026' };

  /* ------------------------------ LOCAL ------------------------------ */
  function createLocal() {
    const K = { teams: 'dd_teams', evals: 'dd_evals', settings: 'dd_settings', votes: 'dd_votes' };
    const listeners = { teams: new Set(), evals: new Set(), settings: new Set(), votes: new Set() };
    const read = (k, d) => { try { return JSON.parse(localStorage.getItem(K[k])) ?? d; } catch (e) { return d; } };
    const write = (k, v) => { localStorage.setItem(K[k], JSON.stringify(v)); emit(k); };
    const emit = (k) => listeners[k].forEach((cb) => cb(snapshot(k)));
    const snapshot = (k) => {
      if (k === 'settings') return { ...DEFAULT_SETTINGS, ...read('settings', {}) };
      return Object.values(read(k, {}));
    };
    const sub = (k) => (cb) => { listeners[k].add(cb); cb(snapshot(k)); return () => listeners[k].delete(cb); };
    window.addEventListener('storage', (e) => {
      const k = Object.keys(K).find((x) => K[x] === e.key);
      if (k) emit(k);
    });

    return {
      mode: 'local',
      init: async () => {},
      onTeams: sub('teams'),
      onEvaluations: sub('evals'),
      onSettings: sub('settings'),
      onVotes: sub('votes'),
      getTeams: async () => Object.values(read('teams', {})),
      getVote: async (id) => read('votes', {})[id] || null,
      saveVote: async (v) => { const all = read('votes', {}); all[v.id] = v; write('votes', all); },
      getTeam: async (id) => read('teams', {})[id] || null,
      getSettings: async () => snapshot('settings'),
      getEvaluation: async (teamId, jk) => read('evals', {})[evalId(teamId, jk)] || null,
      saveEvaluation: async (ev) => { const all = read('evals', {}); all[ev.id] = ev; write('evals', all); },
      deleteEvaluation: async (id) => { const all = read('evals', {}); delete all[id]; write('evals', all); },
      saveTeam: async (t) => { const all = read('teams', {}); all[t.id] = t; write('teams', all); },
      saveTeams: async (list) => { const all = read('teams', {}); list.forEach((t) => { all[t.id] = t; }); write('teams', all); },
      deleteTeam: async (id) => { const all = read('teams', {}); delete all[id]; write('teams', all); },
      saveSettings: async (p) => write('settings', { ...read('settings', {}), ...p }),
      auth: {
        onChange: (cb) => { cb({ email: 'modo-demostracion' }); return () => {}; },
        signIn: async () => {}, signOut: async () => {},
      },
      // scope 'responses': solo evaluaciones y votos (conserva equipos y ajustes). 'all': todo.
      clearData: async (scope) => {
        const keys = scope === 'responses' ? ['evals', 'votes'] : Object.keys(K);
        keys.forEach((k) => localStorage.removeItem(K[k])); keys.forEach(emit);
      },
      resetLocal: async () => { Object.values(K).forEach((k) => localStorage.removeItem(k)); Object.keys(K).forEach(emit); },
    };
  }

  /* ----------------------------- FIREBASE ---------------------------- */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  function createFirebase() {
    let db, auth, ready = null;
    const col = (n) => db.collection(n);
    const docs = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const wipe = async (name) => {
      const snap = await col(name).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    };
    return {
      mode: 'firebase',
      // init se puede llamar muchas veces (cada vista lo hace): solo inicializa una vez.
      init: () => ready || (ready = (async () => {
        const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
        await loadScript(base + 'firebase-app-compat.js');
        await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
        firebase.initializeApp(cfg);
        db = firebase.firestore();
        auth = firebase.auth();
      })().catch((e) => { ready = null; throw e; })),
      clearData: async (scope) => {
        await wipe('evaluations'); await wipe('votes');
        if (scope !== 'responses') { await wipe('teams'); await col('settings').doc('event').delete(); }
      },
      onTeams: (cb) => col('teams').onSnapshot((s) => cb(docs(s)), (e) => console.error('teams', e)),
      onEvaluations: (cb, onErr) => col('evaluations').onSnapshot((s) => cb(docs(s)), onErr || ((e) => console.error('evaluations', e))),
      onSettings: (cb) => col('settings').doc('event').onSnapshot((s) => cb({ ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) })),
      onVotes: (cb, onErr) => col('votes').onSnapshot((s) => cb(docs(s)), onErr || ((e) => console.error('votes', e))),
      getTeams: async () => docs(await col('teams').get()),
      getVote: async (id) => { const s = await col('votes').doc(id).get(); return s.exists ? { ...s.data(), id: s.id } : null; },
      saveVote: (v) => col('votes').doc(v.id).set(v),
      getTeam: async (id) => { const s = await col('teams').doc(id).get(); return s.exists ? { ...s.data(), id: s.id } : null; },
      getSettings: async () => { const s = await col('settings').doc('event').get(); return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) }; },
      getEvaluation: async (teamId, jk) => {
        const s = await col('evaluations').doc(evalId(teamId, jk)).get();
        return s.exists ? { ...s.data(), id: s.id } : null;
      },
      saveEvaluation: (ev) => col('evaluations').doc(ev.id).set(ev),
      deleteEvaluation: (id) => col('evaluations').doc(id).delete(),
      saveTeam: (t) => col('teams').doc(t.id).set(t),
      saveTeams: async (list) => {
        for (let i = 0; i < list.length; i += 400) {
          const b = db.batch();
          list.slice(i, i + 400).forEach((t) => b.set(col('teams').doc(t.id), t));
          await b.commit();
        }
      },
      deleteTeam: (id) => col('teams').doc(id).delete(),
      saveSettings: (p) => col('settings').doc('event').set(p, { merge: true }),
      auth: {
        onChange: (cb) => auth.onAuthStateChanged((u) => cb(u ? { email: u.email } : null)),
        signIn: (email, pass) => auth.signInWithEmailAndPassword(email, pass),
        signOut: () => auth.signOut(),
      },
    };
  }

  /* ------------------- SERVIDOR DE RED LOCAL (serve.ps1) ------------------- */
  // Si la página se sirve con serve.ps1, existe /api/ping y los datos se comparten entre todos los dispositivos de la red.
  function probeServer() {
    if (!/^https?:$/.test(location.protocol)) return null;
    try {
      const x = new XMLHttpRequest();
      x.open('GET', 'api/ping', false); x.send();
      if (x.status === 200) { const j = JSON.parse(x.responseText); return j && j.ok ? j : null; }
    } catch (e) { /* no hay servidor local */ }
    return null;
  }

  function createServer(info) {
    const PIN_KEY = 'dd_admin_pin';
    const getPin = () => { try { return sessionStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; } };
    const setPin = (p) => { try { if (p) sessionStorage.setItem(PIN_KEY, p); else sessionStorage.removeItem(PIN_KEY); } catch (e) { /* sin sessionStorage */ } };

    async function api(method, path, body, admin) {
      const headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (admin) headers['X-Admin-Pin'] = getPin();
      const res = await fetch('api/' + path, { method, headers, cache: 'no-store', body: body !== undefined ? JSON.stringify(body) : undefined });
      if (res.status === 404) return null;
      if (!res.ok) {
        let msg = '';
        try { msg = (await res.json()).error; } catch (e) { /* sin cuerpo */ }
        throw new Error(msg || 'Error ' + res.status);
      }
      return res.json();
    }

    // Sondeo único compartido por todas las suscripciones del panel de administrador.
    const subs = { teams: new Set(), evals: new Set(), votes: new Set(), settings: new Set() };
    const errCbs = new Set();
    let cache = null, rev = -1, timer = null, failing = false;
    const slice = (k) => (k === 'settings' ? { ...DEFAULT_SETTINGS, ...cache.settings } : cache[k]);
    const emit = () => Object.keys(subs).forEach((k) => subs[k].forEach((cb) => cb(slice(k))));
    async function poll() {
      try {
        const s = await api('GET', 'state?since=' + rev, undefined, true);
        if (!s) throw new Error('El servidor no respondió');
        const recovered = failing; failing = false;
        if (s.changed !== false) { cache = s; rev = s.rev; emit(); } else if (recovered && cache) emit();
      } catch (e) { failing = true; errCbs.forEach((f) => f(e)); }
    }
    const kick = () => { rev = -1; return poll(); };
    function sub(k, onErr) {
      return (cb, errCb) => {
        subs[k].add(cb);
        if (errCb || onErr) errCbs.add(errCb || onErr);
        if (cache) cb(slice(k));
        if (!timer) { timer = setInterval(poll, 2500); poll(); }
        return () => {
          subs[k].delete(cb); if (errCb) errCbs.delete(errCb);
          if (!Object.values(subs).some((s) => s.size) && timer) { clearInterval(timer); timer = null; }
        };
      };
    }

    const authCbs = new Set();
    const notifyAuth = (u) => authCbs.forEach((cb) => cb(u));
    const withKick = (p) => p.then((r) => { kick(); return r; });

    return {
      mode: 'server', serverInfo: info,
      init: async () => {},
      onTeams: sub('teams'), onEvaluations: sub('evals'), onVotes: sub('votes'), onSettings: sub('settings'),
      getTeam: (id) => api('GET', 'teams/' + id),
      getTeams: async () => (await api('GET', 'teams')) || [],
      getSettings: async () => ({ ...DEFAULT_SETTINGS, ...((await api('GET', 'settings')) || {}) }),
      getEvaluation: (teamId, jk) => api('GET', 'eval/' + evalId(teamId, jk)),
      getVote: (id) => api('GET', 'vote/' + id),
      saveEvaluation: (ev) => api('PUT', 'eval/' + ev.id, ev),
      saveVote: (v) => api('PUT', 'vote/' + v.id, v),
      deleteEvaluation: (id) => withKick(api('DELETE', 'eval/' + id, undefined, true)),
      saveTeam: (t) => withKick(api('PUT', 'teams/' + t.id, t, true)),
      saveTeams: (list) => withKick(api('POST', 'teams/bulk', list, true)),
      deleteTeam: (id) => withKick(api('DELETE', 'teams/' + id, undefined, true)),
      saveSettings: (p) => withKick(api('PUT', 'settings', p, true)),
      clearData: (scope) => withKick(api('POST', 'reset?scope=' + (scope === 'responses' ? 'responses' : 'all'), {}, true)),
      resetLocal: () => withKick(api('POST', 'reset', {}, true)),
      auth: {
        onChange: (cb) => {
          authCbs.add(cb);
          if (!getPin()) cb(null);
          else api('GET', 'auth', undefined, true).then((r) => cb(r && r.ok ? { email: 'Administrador' } : null), () => cb(null));
          return () => authCbs.delete(cb);
        },
        signIn: async (_email, pin) => {
          setPin(String(pin || '').trim());
          try { await api('GET', 'auth', undefined, true); } catch (e) { setPin(''); throw e; }
          notifyAuth({ email: 'Administrador' });
        },
        signOut: async () => { setPin(''); notifyAuth(null); },
      },
    };
  }

  window.DD = window.DD || {};
  const serverInfo = useFirebase ? null : probeServer();
  window.DD.store = useFirebase ? createFirebase() : serverInfo ? createServer(serverInfo) : createLocal();
  window.DD.util = { judgeKeyOf, evalId, newId };
})();
