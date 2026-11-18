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
  // El Demo Day original conserva sus colecciones y QR; cada evaluación nueva vive aparte (events/{id}/...).
  const DEFAULT_EVENT = window.DD.DEFAULT_EVENT;

  /* ------------------------------ LOCAL ------------------------------ */
  function createLocal() {
    const K = { teams: 'dd_teams', evals: 'dd_evals', settings: 'dd_settings', votes: 'dd_votes' };
    const EVENTS_KEY = 'dd_events';
    const listeners = { teams: new Set(), evals: new Set(), settings: new Set(), votes: new Set() };
    let scope = DEFAULT_EVENT;
    const keyOf = (k, ev = scope) => (ev === DEFAULT_EVENT ? K[k] : `dd_ev_${ev}_${k}`);
    const read = (k, d, ev = scope) => { try { return JSON.parse(localStorage.getItem(keyOf(k, ev))) ?? d; } catch (e) { return d; } };
    const write = (k, v, ev = scope) => { localStorage.setItem(keyOf(k, ev), JSON.stringify(v)); if (ev === scope) emit(k); };
    const readEvents = () => { try { return JSON.parse(localStorage.getItem(EVENTS_KEY)) || {}; } catch (e) { return {}; } };
    const writeEvents = (v) => localStorage.setItem(EVENTS_KEY, JSON.stringify(v));
    const emit = (k) => listeners[k].forEach((cb) => cb(snapshot(k)));
    const snapshot = (k) => {
      if (k === 'settings') return { ...DEFAULT_SETTINGS, ...read('settings', {}) };
      return Object.values(read(k, {}));
    };
    const sub = (k) => (cb) => { listeners[k].add(cb); cb(snapshot(k)); return () => listeners[k].delete(cb); };
    window.addEventListener('storage', (e) => {
      const k = Object.keys(K).find((x) => keyOf(x) === e.key);
      if (k) emit(k);
    });

    return {
      mode: 'local', supportsEvents: true,
      init: async () => {},
      useEvent: (id) => { scope = id || DEFAULT_EVENT; },
      eventField: () => (scope === DEFAULT_EVENT ? {} : { eventId: scope }),
      getEventInfo: async () => {
        const ev = readEvents()[scope];
        if (scope === DEFAULT_EVENT) return { id: scope, config: ev ? ev.config : null };
        return ev ? { id: scope, config: ev.config } : null;
      },
      listEvents: async () => {
        const all = readEvents();
        const others = Object.keys(all).filter((id) => id !== DEFAULT_EVENT).sort((a, b) => all[a].createdAt - all[b].createdAt);
        return [DEFAULT_EVENT, ...others].map((id) => ({ id, eventName: { ...DEFAULT_SETTINGS, ...read('settings', {}, id) }.eventName }));
      },
      createEvent: async (eventName, config) => {
        const id = window.DD.randomId('ev'); const all = readEvents();
        all[id] = { config, createdAt: Date.now() }; writeEvents(all);
        write('settings', { eventName }, id);
        return id;
      },
      saveEventConfig: async (config) => { const all = readEvents(); all[scope] = { createdAt: Date.now(), ...all[scope], config }; writeEvents(all); },
      deleteEvent: async (id) => {
        Object.keys(K).forEach((k) => localStorage.removeItem(keyOf(k, id)));
        const all = readEvents(); delete all[id]; writeEvents(all);
      },
      onTeams: sub('teams'),
      onEvaluations: sub('evals'),
      onSettings: sub('settings'),
      onVotes: sub('votes'),
      getTeams: async () => Object.values(read('teams', {})),
      getVote: async (id) => read('votes', {})[id] || null,
      saveVote: async (v) => { const ev = v.eventId || DEFAULT_EVENT; const all = read('votes', {}, ev); all[v.id] = v; write('votes', all, ev); },
      getTeam: async (id) => read('teams', {})[id] || null,
      getSettings: async () => snapshot('settings'),
      getEvaluation: async (teamId, jk) => read('evals', {})[evalId(teamId, jk)] || null,
      saveEvaluation: async (e) => { const ev = e.eventId || DEFAULT_EVENT; const all = read('evals', {}, ev); all[e.id] = e; write('evals', all, ev); },
      deleteEvaluation: async (id) => { const all = read('evals', {}); delete all[id]; write('evals', all); },
      saveTeam: async (t) => { const all = read('teams', {}); all[t.id] = t; write('teams', all); },
      saveTeams: async (list) => { const all = read('teams', {}); list.forEach((t) => { all[t.id] = t; }); write('teams', all); },
      deleteTeam: async (id) => { const all = read('teams', {}); delete all[id]; write('teams', all); },
      saveSettings: async (p) => write('settings', { ...read('settings', {}), ...p }),
      auth: {
        onChange: (cb) => { cb({ email: 'modo-demostracion' }); return () => {}; },
        signIn: async () => {}, signOut: async () => {},
      },
      // what 'responses': solo evaluaciones y votos (conserva equipos y ajustes). 'all': todo.
      clearData: async (what) => {
        // En una evaluación adicional, "todo" conserva su nombre y su rúbrica.
        const keys = what === 'responses' ? ['evals', 'votes'] : scope === DEFAULT_EVENT ? Object.keys(K) : ['teams', 'evals', 'votes'];
        keys.forEach((k) => localStorage.removeItem(keyOf(k))); keys.forEach(emit);
      },
      resetLocal: async () => { Object.keys(K).forEach((k) => localStorage.removeItem(keyOf(k))); Object.keys(K).forEach(emit); },
    };
  }

  /* ----------------------------- FIREBASE ---------------------------- */
  // Carga un script una sola vez; si falla (p. ej. sin señal) se puede volver a intentar.
  const loadedScripts = {};
  function loadScript(src) {
    if (!loadedScripts[src]) {
      loadedScripts[src] = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res;
        s.onerror = () => { delete loadedScripts[src]; s.remove(); rej(new Error('No se pudo cargar ' + src)); };
        document.head.appendChild(s);
      });
    }
    return loadedScripts[src];
  }

  function createFirebase() {
    let db, auth, ready = null, scope = DEFAULT_EVENT;
    const sdk = (file) => loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/${file}`);
    const eventRef = (id = scope) => db.collection('events').doc(id);
    const col = (n, ev = scope) => (ev === DEFAULT_EVENT ? db : eventRef(ev)).collection(n);
    const settingsRef = () => (scope === DEFAULT_EVENT ? db.collection('settings').doc('event') : eventRef());
    const docs = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const wipe = async (name, ev = scope) => {
      const snap = await col(name, ev).get();
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = db.batch();
        snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    };
    // init se puede llamar muchas veces (cada vista lo hace): solo inicializa una vez.
    // Jueces y público solo necesitan Firestore; el inicio de sesión se carga aparte en initAdmin.
    const init = () => ready || (ready = (async () => {
      await sdk('firebase-app-compat.js');
      await sdk('firebase-firestore-compat.js');
      firebase.initializeApp(cfg);
      db = firebase.firestore();
    })().catch((e) => { ready = null; throw e; }));
    return {
      mode: 'firebase', supportsEvents: true,
      init,
      initAdmin: async () => {
        await sdk('firebase-app-compat.js');
        await sdk('firebase-auth-compat.js');
        await init();
        auth = firebase.auth();
      },
      useEvent: (id) => { scope = id || DEFAULT_EVENT; },
      eventField: () => (scope === DEFAULT_EVENT ? {} : { eventId: scope }),
      getEventInfo: async () => {
        try {
          const s = await eventRef().get();
          if (s.exists) return { id: scope, config: s.data().config || null };
        } catch (e) { if (scope !== DEFAULT_EVENT) throw e; }
        return scope === DEFAULT_EVENT ? { id: scope, config: null } : null;
      },
      listEvents: async () => {
        const [main, snap] = await Promise.all([db.collection('settings').doc('event').get(), db.collection('events').get()]);
        const others = docs(snap).filter((e) => e.id !== DEFAULT_EVENT).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        return [{ id: DEFAULT_EVENT, eventName: { ...DEFAULT_SETTINGS, ...(main.exists ? main.data() : {}) }.eventName }, ...others.map((e) => ({ id: e.id, eventName: e.eventName }))];
      },
      createEvent: async (eventName, config) => {
        const id = window.DD.randomId('ev');
        await eventRef(id).set({ eventName, open: true, votingOpen: true, baseUrl: '', config, createdAt: Date.now() });
        return id;
      },
      saveEventConfig: (config) => eventRef().set({ config }, { merge: true }),
      deleteEvent: async (id) => {
        await wipe('evaluations', id); await wipe('votes', id); await wipe('teams', id);
        await eventRef(id).delete();
      },
      clearData: async (what) => {
        await wipe('evaluations'); await wipe('votes');
        if (what !== 'responses') {
          await wipe('teams');
          if (scope === DEFAULT_EVENT) await settingsRef().delete(); // una evaluación adicional conserva nombre y rúbrica
        }
      },
      onTeams: (cb) => col('teams').onSnapshot((s) => cb(docs(s)), (e) => console.error('teams', e)),
      onEvaluations: (cb, onErr) => col('evaluations').onSnapshot((s) => cb(docs(s)), onErr || ((e) => console.error('evaluations', e))),
      onSettings: (cb) => settingsRef().onSnapshot((s) => cb({ ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) })),
      onVotes: (cb, onErr) => col('votes').onSnapshot((s) => cb(docs(s)), onErr || ((e) => console.error('votes', e))),
      getTeams: async () => docs(await col('teams').get()),
      getVote: async (id) => { const s = await col('votes').doc(id).get(); return s.exists ? { ...s.data(), id: s.id } : null; },
      saveVote: (v) => col('votes', v.eventId || DEFAULT_EVENT).doc(v.id).set(v),
      getTeam: async (id) => { const s = await col('teams').doc(id).get(); return s.exists ? { ...s.data(), id: s.id } : null; },
      getSettings: async () => { const s = await settingsRef().get(); return { ...DEFAULT_SETTINGS, ...(s.exists ? s.data() : {}) }; },
      getEvaluation: async (teamId, jk) => {
        const s = await col('evaluations').doc(evalId(teamId, jk)).get();
        return s.exists ? { ...s.data(), id: s.id } : null;
      },
      saveEvaluation: (ev) => col('evaluations', ev.eventId || DEFAULT_EVENT).doc(ev.id).set(ev),
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
      saveSettings: (p) => settingsRef().set(p, { merge: true }),
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
      mode: 'server', serverInfo: info, supportsEvents: false, // el servidor local maneja una sola evaluación
      init: async () => {},
      useEvent: () => {},
      eventField: () => ({}),
      getEventInfo: async () => ({ id: DEFAULT_EVENT, config: null }),
      listEvents: async () => [],
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
  window.DD.util = { judgeKeyOf, evalId, newId, loadScript };
})();
