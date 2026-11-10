/* Demo Day 2026 · interfaz: página de evaluación (QR) y panel de administración. */
(function () {
  const { RUBRIC, NOMINATIONS, FEEDBACK, CATEGORIES, AWARDS } = window.DD;
  const A = window.DD.analytics;
  const store = window.DD.store;
  const { judgeKeyOf, evalId, newId } = window.DD.util;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => Number(n).toFixed(d);
  const pct = (p) => Math.round(p * 100) + '%';
  const newVoterId = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : newId() + newId() + newId() + newId());
  const teamLine = (t) => [t.group, t.category].filter(Boolean).join(' · ');
  const logoImg = (cls = '') => `<img class="logo ${cls}" src="assets/logo.png" alt="Logo de la carrera de Administración" width="440" height="400">`;
  // `short`: texto reducido que se usa en pantallas muy angostas.
  const statusPill = (tone, label, pulse, short) => `<span class="status ${tone}${pulse ? ' pulse' : ''}"><i></i>${short
    ? `<span class="full">${esc(label)}</span><span class="short">${esc(short)}</span>` : esc(label)}</span>`;
  /** Aviso de envío pendiente (sin señal). Pasa a «Enviada» solo cuando la cola de reintentos lo entrega. */
  const queuedNoteHtml = (res, noun) => (res.status === 'queued'
    ? `<div class="banner" id="queuedNote">${statusPill('warn', 'Pendiente de enviar')} Sin señal: tu ${noun} quedó guardad${noun === 'evaluación' ? 'a' : 'o'} en este teléfono y se enviará solo en cuanto vuelva la conexión. Puedes dejar esta página abierta o volver a abrir el sitio más tarde.</div>` : '');
  function watchQueued(res, kind, id, noun) {
    if (res.status !== 'queued') return;
    const off = window.DD.outbox.onChange(() => {
      if (window.DD.outbox.has(kind, id)) return;
      const el = $('#queuedNote');
      if (el) { el.className = 'banner info'; el.innerHTML = `${statusPill('on', 'Enviado')} Tu ${esc(noun)} ya llegó. ¡Gracias!`; }
      off();
    });
    onLeave(off);
  }
  const pendingBannerHtml = () => (window.DD.outbox && window.DD.outbox.pending()
    ? `<div class="banner">${statusPill('warn', 'Pendiente')} Tienes ${window.DD.outbox.pending()} envío(s) guardado(s) sin enviar; se reintentan solos.</div>` : '');
  const brandbar = (text) => `<div class="brandbar">${logoImg('sm')}<span>${esc(text)}</span></div>`;
  const stateScreen = (tone, icon, title, text) => `
    <div class="wrap narrow"><div class="card center state">
      ${logoImg('md')}<div class="state-icon ${tone}">${icon}</div><h2>${title}</h2><p class="muted">${text}</p>
    </div></div>`;
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const SHORT = { viabilidad: 'Viabilidad', problema: 'Problema', innovacion: 'Innovación', prototipo: 'Prototipo', defensa: 'Defensa' };
  const app = $('#app');
  const safeLS = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } },
  };

  let cleanups = [];
  const onLeave = (fn) => cleanups.push(fn);

  /* ------------------------------ utilidades UI ------------------------------ */
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
  }

  function openDialog(html, wide = false) {
    const d = document.createElement('dialog');
    d.className = 'modal' + (wide ? ' wide' : '');
    d.innerHTML = `<div class="modal-body">${html}</div>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.showModal();
    return d;
  }

  function confirmDialog(msg, okLabel = 'Eliminar') {
    return new Promise((res) => {
      const d = openDialog(`<h3>Confirmar</h3><p>${esc(msg)}</p>
        <div class="row end"><button class="btn ghost" data-close>Cancelar</button><button class="btn danger" id="okBtn">${esc(okLabel)}</button></div>`);
      $('#okBtn', d).onclick = () => { res(true); d.close(); };
      d.addEventListener('close', () => res(false));
    });
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function downloadCSV(filename, rows) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    downloadBlob(filename, new Blob(['﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  }

  function qrSvg(text) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }
  function svgToPngBlob(svgMarkup, size = 900) {
    return new Promise((res) => {
      const svg = svgMarkup.includes('xmlns') ? svgMarkup : svgMarkup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = size;
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, size, size);
        c.toBlob(res, 'image/png');
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  const isLocalUrl = (u) => /^file:|\/\/(localhost|127\.0\.0\.1)/.test(u);
  // En modo servidor local, si el admin abrió la página como "localhost", los QR usan automáticamente la IP de la red
  // (un celular no puede abrir "localhost": sería él mismo).
  const baseUrl = (settings) => {
    const cfg = settings.baseUrl || location.href.split('#')[0];
    const info = store.serverInfo;
    if (!settings.baseUrl && info && info.ips && info.ips.length && isLocalUrl(cfg)) return `http://${info.ips[0]}:${info.port}/`;
    return cfg.replace(/#.*$/, '');
  };
  const teamUrl = (settings, team) => `${baseUrl(settings)}#/e/${team.id}`;
  const voteUrl = (settings) => `${baseUrl(settings)}#/voto`;
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'equipo';
  const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '');

  /* ================================ ROUTER ================================ */
  function route() {
    cleanups.forEach((f) => { try { f(); } catch (e) { /* noop */ } });
    cleanups = [];
    document.body.classList.remove('is-admin');
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b] = h.split('/');
    window.scrollTo(0, 0);
    if (a === 'e' && b) return viewEval(b);
    if (a === 'voto') return viewVoto();
    if (a === 'admin') return viewAdmin();
    return viewHome();
  }
  window.addEventListener('hashchange', route);

  /* ================================= HOME ================================= */
  function viewHome() {
    app.innerHTML = `
      <div class="wrap narrow">
        <div class="card hero">
          ${logoImg('lg')}
          <h1>Demo Day 2026</h1>
          <p class="muted">Sistema de evaluación por código QR</p>
          <p><b>Jueces:</b> escaneen el código QR del stand del equipo que van a evaluar.</p>
          <p><b>Público:</b> escanea el QR general para votar por tu proyecto favorito.</p>
          <p><a class="btn" href="#/voto">Votar como público</a> <a class="btn primary" href="#/admin">Acceso de administrador</a></p>
          ${store.mode === 'local' ? '<p class="note">Modo demostración: los datos viven solo en este navegador. Configura <code>firebase-config.js</code> para usarlo en el evento.</p>' : ''}
        </div>
      </div>`;
  }

  /* ============================ EVALUACIÓN (QR) ============================ */
  async function viewEval(teamId) {
    app.innerHTML = '<div class="wrap narrow"><div class="card center">Cargando…</div></div>';
    let team, settings;
    try {
      await store.init();
      [team, settings] = await Promise.all([store.getTeam(teamId), store.getSettings()]);
    } catch (e) {
      app.innerHTML = `<div class="wrap narrow"><div class="card"><h2>No se pudo cargar</h2><p>${esc(e.message)}</p></div></div>`;
      return;
    }
    if (!team) {
      app.innerHTML = stateScreen('bad', '?', 'Proyecto no encontrado', 'Este código QR no corresponde a ningún equipo registrado. Avisa a los organizadores.');
      return;
    }
    if (!settings.open) {
      app.innerHTML = stateScreen('off', '🔒', 'Evaluaciones cerradas', `El periodo de evaluación de ${esc(settings.eventName)} ya terminó. Gracias por tu participación.`);
      return;
    }

    const saved = safeLS.get('dd_judge') || { name: '', email: '' };
    const members = (team.members || []).map((m) => `<li>${esc(m)}</li>`).join('');
    const criteriaHtml = RUBRIC.map((c) => `
      <fieldset class="crit" data-crit="${c.id}">
        <legend>${esc(c.name)} <span class="weight">${c.weight}% · máx. ${c.weight} pts</span></legend>
        <p class="muted">${esc(c.desc)}</p>
        ${c.levels.map((l) => `
          <label class="opt">
            <input type="radio" name="c_${c.id}" value="${l.pts}">
            <span class="opt-body"><span class="opt-top"><b>${esc(l.label)}</b><em>${l.pts} pts</em></span><small>${esc(l.text)}</small></span>
          </label>`).join('')}
      </fieldset>`).join('');
    const nomHtml = NOMINATIONS.map((n) => `
      <div class="nom">
        <p><b>${esc(n.question)}</b><br><span class="muted">${esc(n.hint)}</span></p>
        <div class="seg">
          <label><input type="radio" name="n_${n.id}" value="1"><span>Sí</span></label>
          <label><input type="radio" name="n_${n.id}" value="0" checked><span>No</span></label>
        </div>
      </div>`).join('');
    const fbHtml = FEEDBACK.map((f) => `
      <label class="field">
        <span>${esc(f.label)} ${f.required ? '<i class="req">obligatorio</i>' : '<i class="opt-tag">opcional</i>'}</span>
        <small>${esc(f.help)}</small>
        <textarea name="f_${f.id}" rows="3" maxlength="1500"></textarea>
      </label>`).join('');

    app.innerHTML = `
      <div class="wrap narrow">
        ${brandbar(settings.eventName + ' · Evaluación')}
        ${pendingBannerHtml()}
        <section class="card team-card">
          <span class="chip">${esc(team.category || 'Sin categoría')}</span>
          <h1>${esc(team.name)}</h1>
          <p class="muted">${esc(team.group || '')}${team.stand ? ' · Stand ' + esc(team.stand) : ''}</p>
          ${team.description ? `<p>${esc(team.description)}</p>` : ''}
          ${members ? `<h4>Integrantes</h4><ul class="members">${members}</ul>` : ''}
        </section>

        <form id="evalForm" novalidate>
          <section class="card">
            <h2>1. Evaluador</h2>
            <div id="existingBanner"></div>
            <label class="field"><span>Nombre del evaluador / juez <i class="req">obligatorio</i></span>
              <input name="judgeName" autocomplete="name" value="${esc(saved.name)}" required></label>
            <label class="field"><span>Correo electrónico <i class="req">obligatorio</i></span>
              <small>Sirve para que solo cuentes una vez por proyecto y puedas corregir tu evaluación.</small>
              <input name="judgeEmail" type="email" inputmode="email" autocomplete="email" value="${esc(saved.email)}" required></label>
          </section>

          <section class="card">
            <h2>2. Rúbrica (100 puntos)</h2>
            ${criteriaHtml}
          </section>

          <section class="card">
            <h2>3. Nominaciones a premios especiales</h2>
            ${nomHtml}
          </section>

          <section class="card">
            <h2>4. Retroalimentación</h2>
            ${fbHtml}
          </section>

          <div class="submitbar">
            <div class="total">Total <b id="liveTotal">0</b>/100<span class="progress" id="progress">0/5 criterios</span></div>
            <button class="btn primary" type="submit" id="sendBtn">Enviar evaluación</button>
          </div>
          <p class="error" id="formError" hidden></p>
        </form>
      </div>`;

    const form = $('#evalForm');
    const recalc = () => {
      let t = 0, answered = 0;
      RUBRIC.forEach((c) => {
        const r = form.querySelector(`input[name="c_${c.id}"]:checked`);
        if (r) { t += Number(r.value); answered++; }
        form.querySelector(`[data-crit="${c.id}"]`).classList.toggle('done', !!r);
      });
      $('#liveTotal').textContent = t;
      const ready = answered === RUBRIC.length && form.elements.f_fortalezas.value.trim()
        && form.elements.judgeName.value.trim() && /^\S+@\S+\.\S+$/.test(form.elements.judgeEmail.value.trim());
      const pr = $('#progress');
      pr.className = 'progress' + (ready ? ' ready' : '');
      pr.textContent = ready ? '✓ Listo para enviar' : `${answered}/${RUBRIC.length} criterios`;
    };
    form.addEventListener('input', recalc);
    form.addEventListener('change', (e) => {
      if (e.target.name && e.target.name.startsWith('c_')) { e.target.closest('fieldset').classList.remove('invalid'); recalc(); }
    });

    const fillForm = (ev) => {
      RUBRIC.forEach((c) => {
        const r = form.querySelector(`input[name="c_${c.id}"][value="${ev.scores[c.id]}"]`); if (r) r.checked = true;
      });
      NOMINATIONS.forEach((n) => {
        const r = form.querySelector(`input[name="n_${n.id}"][value="${ev.nominations && ev.nominations[n.id] ? 1 : 0}"]`); if (r) r.checked = true;
      });
      FEEDBACK.forEach((f) => { form.elements['f_' + f.id].value = ev[f.id] || ''; });
      recalc();
    };

    let existing = null;
    const checkExisting = async () => {
      const email = form.elements.judgeEmail.value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return;
      try {
        const ev = await store.getEvaluation(teamId, judgeKeyOf(email));
        existing = ev;
        $('#existingBanner').innerHTML = ev
          ? `<div class="banner info">${statusPill('on', 'Evaluación enviada')} Ya evaluaste este proyecto (${esc(fmtDate(ev.updatedAt))}). Cargamos tus respuestas: puedes modificarlas y volver a enviar.</div>` : '';
        if (ev) fillForm(ev);
      } catch (e) { /* sin permiso de lectura: se tratará como evaluación nueva */ }
    };
    form.elements.judgeEmail.addEventListener('change', checkExisting);
    if (saved.email) checkExisting();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#formError'); err.hidden = true;
      const name = form.elements.judgeName.value.trim();
      const email = form.elements.judgeEmail.value.trim();
      const scores = {}; const missing = [];
      RUBRIC.forEach((c) => {
        const r = form.querySelector(`input[name="c_${c.id}"]:checked`);
        if (r) scores[c.id] = Number(r.value); else missing.push(c.id);
      });
      const fortalezas = form.elements.f_fortalezas.value.trim();
      const problems = [];
      if (!name) problems.push('escribe tu nombre');
      if (!/^\S+@\S+\.\S+$/.test(email)) problems.push('escribe un correo válido');
      if (missing.length) problems.push('selecciona un nivel en cada criterio de la rúbrica');
      if (!fortalezas) problems.push('describe las fortalezas del proyecto');
      if (problems.length) {
        missing.forEach((id) => form.querySelector(`[data-crit="${id}"]`).classList.add('invalid'));
        err.textContent = 'Falta: ' + problems.join('; ') + '.'; err.hidden = false;
        const first = (missing.length && form.querySelector('.crit.invalid')) || err;
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const jk = judgeKeyOf(email);
      const now = Date.now();
      const ev = {
        id: evalId(teamId, jk), teamId, judgeKey: jk, judgeName: name, judgeEmail: email,
        scores, total: RUBRIC.reduce((s, c) => s + scores[c.id], 0),
        nominations: Object.fromEntries(NOMINATIONS.map((n) => [n.id, form.querySelector(`input[name="n_${n.id}"]:checked`).value === '1'])),
        createdAt: (existing && existing.createdAt) || now, updatedAt: now,
      };
      FEEDBACK.forEach((f) => { ev[f.id] = form.elements['f_' + f.id].value.trim(); });
      const btn = $('#sendBtn'); btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        const res = await window.DD.outbox.submit('eval', ev);
        safeLS.set('dd_judge', { name, email });
        const saved2 = ev;
        app.innerHTML = `
          <div class="wrap narrow"><div class="card center done">
            <div class="check">✓</div>
            <h2>${res.status === 'queued' ? 'Evaluación guardada' : '¡Evaluación registrada!'}</h2>
            ${queuedNoteHtml(res, 'evaluación')}
            <p><b>${esc(team.name)}</b><br>Tu puntaje: <b>${saved2.total}/100</b></p>
            <p class="muted">Gracias, ${esc(name)}. Puedes pasar al siguiente stand y escanear su código QR.</p>
            <button class="btn ghost" id="editAgain">Editar mi evaluación</button>
          </div></div>`;
        $('#editAgain').onclick = () => viewEval(teamId);
        watchQueued(res, 'eval', ev.id, 'evaluación');
        window.scrollTo(0, 0);
      } catch (ex) {
        btn.disabled = false; btn.textContent = 'Enviar evaluación';
        err.textContent = 'No se pudo enviar: ' + ex.message + '.'; err.hidden = false;
      }
    });
  }

  /* ======================== VOTO DEL PÚBLICO (QR general) ======================== */
  async function viewVoto() {
    app.innerHTML = '<div class="wrap narrow"><div class="card center">Cargando…</div></div>';
    let teams, settings;
    try {
      await store.init();
      [teams, settings] = await Promise.all([store.getTeams(), store.getSettings()]);
    } catch (e) {
      app.innerHTML = `<div class="wrap narrow"><div class="card"><h2>No se pudo cargar</h2><p>${esc(e.message)}</p></div></div>`;
      return;
    }
    if (!settings.votingOpen) {
      app.innerHTML = stateScreen('off', '🔒', 'Votación cerrada', `La votación del público de ${esc(settings.eventName)} ya terminó. ¡Gracias por participar!`);
      return;
    }
    let voterId = safeLS.get('dd_voter');
    if (!voterId) { voterId = newVoterId(); safeLS.set('dd_voter', voterId); }
    let current = null;
    try { current = await store.getVote(voterId); } catch (e) { /* sin voto previo */ }

    const order = (c) => { const i = CATEGORIES.indexOf(c); return i < 0 ? 99 : i; };
    const cats = [...new Set(teams.map((t) => t.category || 'Otros'))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
    app.innerHTML = `
      <div class="wrap narrow">
        ${brandbar(settings.eventName + ' · Premio del Público')}
        ${pendingBannerHtml()}
        <form id="voteForm">
          <section class="card">
            <h1>Vota por tu proyecto favorito</h1>
            <p class="muted">Elige un solo proyecto. Si cambias de opinión, puedes volver a entrar y cambiar tu voto mientras la votación siga abierta.</p>
            <p id="voteBanner">${current ? '<span class="banner">Ya votaste. Puedes cambiar tu voto si lo deseas.</span>' : ''}</p>
          </section>
          ${cats.map((cat) => `
            <section class="card">
              <h2>${esc(cat)}</h2>
              ${teams.filter((t) => (t.category || 'Otros') === cat).sort((a, b) => a.name.localeCompare(b.name)).map((t) => `
                <label class="opt">
                  <input type="radio" name="vote" value="${esc(t.id)}" ${current && current.teamId === t.id ? 'checked' : ''}>
                  <span class="opt-body"><span class="opt-top"><b>${esc(t.name)}</b>${t.stand ? `<em>Stand ${esc(t.stand)}</em>` : ''}</span>
                  <small>${esc(t.group || '')}</small></span>
                </label>`).join('')}
            </section>`).join('')}
          <div class="submitbar"><div class="total" id="voteSel">Elige un proyecto</div><button class="btn primary" id="voteBtn" type="submit">Enviar voto</button></div>
          <p class="error" id="voteErr" hidden></p>
        </form>
      </div>`;
    const form = $('#voteForm');
    const label = () => {
      const r = form.querySelector('input[name=vote]:checked');
      $('#voteSel').textContent = r ? (teams.find((t) => t.id === r.value) || {}).name : 'Elige un proyecto';
    };
    form.addEventListener('change', label); label();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = form.querySelector('input[name=vote]:checked');
      const err = $('#voteErr'); err.hidden = true;
      if (!r) { err.textContent = 'Elige un proyecto para votar.'; err.hidden = false; return; }
      const btn = $('#voteBtn'); btn.disabled = true; btn.textContent = 'Enviando…';
      const now = Date.now();
      try {
        const vote = { id: voterId, voterId, teamId: r.value, createdAt: (current && current.createdAt) || now, updatedAt: now };
        const res = await window.DD.outbox.submit('vote', vote);
        const t = teams.find((x) => x.id === r.value);
        app.innerHTML = `
          <div class="wrap narrow"><div class="card center done">
            <div class="check">✓</div><h2>${res.status === 'queued' ? 'Voto guardado' : '¡Voto registrado!'}</h2>
            ${queuedNoteHtml(res, 'voto')}
            <p>Votaste por <b>${esc(t.name)}</b></p>
            <p class="muted">Gracias por participar en el Premio del Público.</p>
            <button class="btn ghost" id="changeVote">Cambiar mi voto</button>
          </div></div>`;
        $('#changeVote').onclick = () => viewVoto();
        watchQueued(res, 'vote', vote.id, 'voto');
        window.scrollTo(0, 0);
      } catch (ex) {
        btn.disabled = false; btn.textContent = 'Enviar voto';
        err.textContent = 'No se pudo registrar tu voto: ' + ex.message; err.hidden = false;
      }
    });
  }

  /* =============================== ADMIN =============================== */
  const TABS = [
    ['ganadores', 'Ganadores'], ['estadisticas', 'Estadísticas'], ['equipos', 'Equipos y QR'],
    ['observaciones', 'Observaciones'], ['evaluaciones', 'Jueces'], ['ajustes', 'Ajustes'],
  ];
  const state = { teams: [], evals: [], votes: [], settings: { open: true, votingOpen: true, baseUrl: '', eventName: 'Demo Day 2026' }, tab: safeLS.get('dd_tab') || 'ganadores', evalError: null };
  let currentTab = null; // { update() }

  async function viewAdmin() {
    document.body.classList.add('is-admin');
    app.innerHTML = '<div class="wrap narrow"><div class="card center">Cargando…</div></div>';
    try { await store.init(); } catch (e) {
      app.innerHTML = `<div class="wrap narrow"><div class="card"><h2>No se pudo iniciar</h2><p>${esc(e.message)}</p></div></div>`; return;
    }
    const unAuth = store.auth.onChange((user) => { if (user) renderAdminShell(user); else renderLogin(); });
    onLeave(unAuth);
  }

  function renderLogin() {
    cleanups.filter((f) => f.__data).forEach((f) => f());
    app.innerHTML = `
      <div class="wrap narrow"><form class="card" id="loginForm">
        ${logoImg('md')}
        <h1 class="center">Administrador</h1>
        ${store.mode === 'server' ? `
        <label class="field"><span>PIN de administrador</span><small>Aparece en la ventana de PowerShell donde se inició el servidor.</small>
          <input name="pass" type="password" inputmode="numeric" autocomplete="current-password" required autofocus></label>` : `
        <label class="field"><span>Correo</span><input name="email" type="email" autocomplete="username" required></label>
        <label class="field"><span>Contraseña</span><input name="pass" type="password" autocomplete="current-password" required></label>`}
        <p class="error" id="loginErr" hidden></p>
        <button class="btn primary" type="submit">Entrar</button>
      </form></div>`;
    $('#loginForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await store.auth.signIn(e.target.email ? e.target.email.value.trim() : '', e.target.pass.value); }
      catch (ex) { const p = $('#loginErr'); p.textContent = 'No se pudo iniciar sesión: ' + ex.message; p.hidden = false; }
    };
  }

  function renderAdminShell(user) {
    app.innerHTML = `
      <header class="topbar">
        <div class="brand">${logoImg('sm')}<div><b id="evName">${esc(state.settings.eventName)}</b><span>Panel de evaluación</span></div></div>
        <nav class="tabs" id="tabs">${TABS.map(([id, label]) => `<button data-tab="${id}">${label}</button>`).join('')}</nav>
        <div class="who"><span id="livePill"></span>
          ${store.mode !== 'local' ? `<span class="who-mail">${esc(user.email)}</span><button class="btn ghost sm" id="logoutBtn">Salir</button>` : ''}</div>
      </header>
      <main class="admin-main"><div id="tab-content"></div></main>`;
    const lo = $('#logoutBtn'); if (lo) lo.onclick = () => store.auth.signOut();
    $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });

    const unsubs = [
      store.onTeams((t) => { state.teams = t; refresh(); }),
      store.onEvaluations((ev) => { state.evals = ev; state.evalError = null; refresh(); }, (err) => { state.evalError = err.message; refresh(); }),
      store.onVotes((v) => { state.votes = v; refresh(); }, () => { state.votes = []; }),
      store.onSettings((s) => { state.settings = s; const n = $('#evName'); if (n) n.textContent = s.eventName; refresh(); }),
    ];
    const stop = () => unsubs.forEach((u) => u && u());
    stop.__data = true;
    onLeave(stop);
    window.addEventListener('online', updateLive);
    window.addEventListener('offline', updateLive);
    onLeave(() => { window.removeEventListener('online', updateLive); window.removeEventListener('offline', updateLive); });
    updateLive();
    switchTab(state.tab);
  }

  /** Indicador de conexión: demostración (naranja), en vivo (verde), sin conexión / sin acceso (rojo). */
  function updateLive() {
    const el = $('#livePill'); if (!el) return;
    el.innerHTML = store.mode === 'local' ? statusPill('warn', 'Modo demostración', false, 'Demo')
      : !navigator.onLine ? statusPill('bad', 'Sin conexión', false, 'Sin red')
        : state.evalError ? statusPill('bad', store.mode === 'server' ? 'Sin conexión con el servidor' : 'Sin acceso a los datos', false, 'Sin datos')
          : statusPill('on', store.mode === 'server' ? 'En vivo · red local' : 'En vivo', true, 'En vivo');
  }

  let raf = 0;
  function refresh() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { updateLive(); if (currentTab) currentTab.update(); });
  }

  /** Estado del evento: tarjetas con interruptor para abrir/cerrar evaluaciones y votación. */
  function eventStatusHtml() {
    const s = state.settings;
    const card = (key, open, title, onHelp, offHelp, onTxt, offTxt) => `
      <div class="state-card ${open ? 'is-on' : 'is-off'}">
        <div>${statusPill(open ? 'on' : 'off', open ? onTxt : offTxt, open)}<b>${title}</b><small>${open ? onHelp : offHelp}</small></div>
        <button class="btn sm ${open ? '' : 'primary'}" data-toggle="${key}">${open ? 'Cerrar' : 'Reabrir'}</button>
      </div>`;
    return `<div class="statusgrid">
      ${card('open', s.open, 'Evaluaciones de jueces', 'Los jueces pueden enviar y corregir evaluaciones.', 'Ya no se aceptan evaluaciones nuevas ni cambios.', 'Abiertas', 'Cerradas')}
      ${card('votingOpen', s.votingOpen, 'Votación del público', 'El público puede votar con el QR general.', 'La votación está cerrada.', 'Abierta', 'Cerrada')}
    </div>`;
  }

  function switchTab(id) {
    state.tab = id; safeLS.set('dd_tab', id);
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
    const act = $('#tabs button.active'), strip = $('#tabs');
    if (act && strip) strip.scrollLeft = act.offsetLeft - (strip.clientWidth - act.offsetWidth) / 2;
    const el = $('#tab-content'); if (!el) return;
    const views = { ganadores: tabGanadores, estadisticas: tabEstadisticas, equipos: tabEquipos, observaciones: tabObservaciones, evaluaciones: tabEvaluaciones, ajustes: tabAjustes };
    el.innerHTML = '';
    currentTab = (views[id] || tabGanadores)(el);
    currentTab.update();
    window.scrollTo(0, 0);
  }

  /* ---------- datos derivados ---------- */
  function derived() {
    const ids = new Set(state.teams.map((t) => t.id));
    const evals = state.evals.filter((e) => ids.has(e.teamId) && e.scores);
    const stats = A.allStats(state.teams, evals, state.votes.filter((v) => ids.has(v.teamId)));
    const cats = [...new Set([...CATEGORIES, ...state.teams.map((t) => t.category).filter(Boolean)])]
      .filter((c) => state.teams.some((t) => t.category === c));
    return { evals, stats, cats, global: A.globalStats(stats, evals) };
  }
  const errBanner = () => (state.evalError
    ? `<div class="banner bad">No se pueden leer las evaluaciones: ${esc(state.evalError)}. ¿Iniciaste sesión y publicaste <code>firestore.rules</code>?</div>` : '');

  const metricTxt = (award, row) => {
    if (award.kind === 'promedio') return `${fmt(row.primary)} pts`;
    if (award.kind === 'votos') return `${row.primary} voto${row.primary === 1 ? '' : 's'}`;
    return `${row.primary} nominaci${row.primary === 1 ? 'ón' : 'ones'}`;
  };
  const awardSub = (award, w, g) => {
    if (award.kind === 'votos') return `de ${g.votes} voto${g.votes === 1 ? '' : 's'} en total`;
    return `${w.s.n} evaluaci${w.s.n === 1 ? 'ón' : 'ones'}`;
  };
  const awardVal = (award, v) => (award.kind === 'promedio' ? fmt(v) : v);

  /* ======================== TAB: GANADORES ======================== */
  function tabGanadores(el) {
    el.innerHTML = '<div id="g-body"></div>';
    $('#g-body').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-toggle]'); if (!b) return;
      const key = b.dataset.toggle; const cur = !!state.settings[key];
      const what = key === 'open' ? 'las evaluaciones de los jueces' : 'la votación del público';
      if (cur && !(await confirmDialog(`¿Cerrar ${what}? Nadie podrá enviar más hasta que las reabras.`, 'Cerrar'))) return;
      try { await store.saveSettings({ [key]: !cur }); toast(cur ? 'Cerrado' : 'Reabierto'); } catch (ex) { toast(ex.message, 'bad'); }
    });
    return {
      update() {
        const d = derived(); const g = d.global;
        const body = $('#g-body');
        if (!state.teams.length) { body.innerHTML = `${errBanner()}${eventStatusHtml()}<div class="card"><h2>Aún no hay equipos</h2><p>Ve a <b>Equipos y QR</b> para importar la lista y generar los códigos.</p></div>`; return; }
        const missing = g.teams - g.teamsEvaluated;
        const wins = A.winners(d.stats, d.cats);
        body.innerHTML = `
          ${errBanner()}
          ${eventStatusHtml()}
          <div class="kpis">
            <div class="kpi"><b>${g.teams}</b><span>Equipos</span></div>
            <div class="kpi"><b>${g.evaluations}</b><span>Evaluaciones</span></div>
            <div class="kpi"><b>${g.judges}</b><span>Jueces</span></div>
            <div class="kpi"><b>${g.evaluations ? fmt(g.avgTotal) : '–'}</b><span>Promedio global /100</span></div>
            <div class="kpi"><b>${g.votes}</b><span>Votos del público</span></div>
          </div>
          ${missing > 0 ? `<div class="banner">${missing} equipo${missing === 1 ? '' : 's'} aún sin evaluaciones: ${esc(d.stats.filter((s) => !s.n).map((s) => s.team.name).slice(0, 6).join(', '))}${missing > 6 ? '…' : ''}.</div>` : ''}
          <div class="awards">${wins.map((w) => awardCard(w, g)).join('')}</div>`;
      },
    };
  }

  function tieNote(award, res) {
    if (!res.winner || res.tied.length < 2) return '';
    const names = res.tied.map((r) => `«${esc(r.s.team.name)}»`).join(', ');
    if (res.resolvedByTiebreak) {
      const how = award.tieCriterion ? `el promedio en «${esc(RUBRIC.find((c) => c.id === award.tieCriterion).name)}»`
        : 'el promedio total de la rúbrica';
      return `<p class="tie">Empate en ${names}. Desempate sugerido por ${how}.</p>`;
    }
    return `<p class="tie full">EMPATE sin resolver entre ${names}: requiere deliberación de los docentes.</p>`;
  }

  function awardCard({ award, overall, byCategory }, g) {
    const w = overall.winner;
    const top = overall.rows.slice(0, 5);
    const maxP = Math.max(1, ...top.map((r) => r.primary));
    return `
      <section class="card award">
        <div class="award-head"><span class="trophy">🏆</span><div><h3>${esc(award.name)}</h3><p class="muted">${esc(award.basis)}</p></div></div>
        ${w ? `
          <div class="winner">
            <div><b>${esc(w.s.team.name)}</b><span>${esc(w.s.team.group || '')} · ${esc(w.s.team.category || '')}</span></div>
            <div class="metric">${metricTxt(award, w)}<small>${awardSub(award, w, g)}</small></div>
          </div>
          ${tieNote(award, overall)}
          <ol class="toplist">${top.map((r) => `
            <li><span class="nm">${esc(r.s.team.name)}</span>
              <div class="bar"><i style="width:${Math.round((r.primary / (award.kind === 'promedio' ? 100 : maxP)) * 100)}%"></i></div>
              <span class="val">${awardVal(award, r.primary)}</span></li>`).join('')}</ol>
          <details><summary>Ganador por categoría</summary>
            <div class="cat-grid">${byCategory.map(({ category, result }) => `
              <div class="cat-item"><span class="chip">${esc(category)}</span>
                ${result.winner ? `<b>${esc(result.winner.s.team.name)}</b><small>${metricTxt(award, result.winner)}${result.tied.length > 1 ? ' · empate' : ''}</small>` : '<small>Sin datos</small>'}</div>`).join('')}</div>
          </details>`
          : '<p class="muted">Todavía no hay resultados para este premio.</p>'}
      </section>`;
  }

  /* ======================= TAB: ESTADÍSTICAS ======================= */
  function radarSVG(series, teamId) {
    const n = RUBRIC.length, c = 170, R = 100;
    const pt = (i, v) => [c + R * v * Math.sin((2 * Math.PI * i) / n), c - R * v * Math.cos((2 * Math.PI * i) / n)];
    const ring = (v) => RUBRIC.map((_, i) => pt(i, v).join(',')).join(' ');
    const labels = RUBRIC.map((cr, i) => {
      const [x, y] = pt(i, 1.28); const a = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
      return `<text x="${x}" y="${y}" text-anchor="${a}" dominant-baseline="middle">${SHORT[cr.id]}</text>`;
    }).join('');
    const team = series.find((s) => s.cls === 'ser-t');
    return `<svg viewBox="-50 0 440 340" class="radar" role="img" aria-label="Gráfica de radar por criterio"
        data-cx="${c}" data-cy="${c}" data-r="${R}" data-team="${esc(teamId || '')}" data-pcts="${team ? team.values.join(',') : ''}" style="--cx:${c}px;--cy:${c}px">
      ${[0.25, 0.5, 0.75, 1].map((v, k) => `<polygon class="ring" style="--k:${k}" points="${ring(v)}"/>`).join('')}
      ${RUBRIC.map((_, i) => { const [x, y] = pt(i, 1); return `<line class="axis" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`; }).join('')}
      ${series.map((s) => `<polygon class="${s.cls}" points="${s.values.map((v, i) => pt(i, Math.max(0, Math.min(1, v))).join(',')).join(' ')}"/>`).join('')}
      ${team ? team.values.map((v, i) => { const [x, y] = pt(i, Math.max(0, Math.min(1, v))); return `<circle class="rdot" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/>`; }).join('') : ''}
      ${labels}</svg>`;
  }

  /** Pentágono (un vértice por criterio, anillo exterior = puntaje máximo, línea punteada = «Bueno» 80 %). */
  function pentagonSvg(pcts, o) {
    const n = RUBRIC.length;
    const pt = (i, v) => [o.cx + o.R * v * Math.sin((2 * Math.PI * i) / n), o.cy - o.R * v * Math.cos((2 * Math.PI * i) / n)];
    const str = (p) => p.map((x) => x.toFixed(1)).join(',');
    const poly = (v) => RUBRIC.map((_, i) => str(pt(i, v))).join(' ');
    const short = o.short ? RUBRIC.map((c, i) => {
      const [x, y] = pt(i, 1.2); const a = Math.abs(x - o.cx) < 8 ? 'middle' : x > o.cx ? 'start' : 'end';
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" dominant-baseline="middle">${SHORT[c.id]}</text>`;
    }).join('') : '';
    return `<svg viewBox="0 0 ${o.w} ${o.h}" class="pent-svg" role="img" aria-label="Gráfico de pentágono con el promedio por criterio"
        data-cx="${o.cx}" data-cy="${o.cy}" data-r="${o.R}" data-pcts="${pcts.join(',')}" style="--cx:${o.cx}px;--cy:${o.cy}px">
      ${[0.2, 0.4, 0.6, 0.8, 1].map((v, k) => `<polygon class="ring${v === 0.8 ? ' good' : ''}" style="--k:${k}" points="${poly(v)}"/>`).join('')}
      ${RUBRIC.map((_, i) => `<line class="axis" x1="${o.cx}" y1="${o.cy}" x2="${str(pt(i, 1)).split(',')[0]}" y2="${str(pt(i, 1)).split(',')[1]}"/>`).join('')}
      <polygon class="data" points="${pcts.map((v, i) => str(pt(i, Math.max(0.02, Math.min(1, v))))).join(' ')}"/>
      ${pcts.map((v, i) => { const [x, y] = pt(i, Math.max(0.02, Math.min(1, v))); return `<circle class="pdot ${v < A.GOOD ? 'dot-warn' : 'dot-ok'}" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5"/>`; }).join('')}
      ${short}</svg>`;
  }

  function pentagonHtml(crit) {
    const pcts = crit.map((c) => c.pct);
    // Escritorio: etiquetas HTML alrededor de cada vértice (posiciones en % del contenedor 820×520).
    const W = 820, H = 520;
    const pos = [
      { l: 260, w: 300, y: 98, cls: 'c', up: true },
      { l: 595, w: 225, y: 224, cls: 'l', mid: true },
      { l: 531, w: 289, y: 418, cls: 'l' },
      { l: 9, w: 280, y: 418, cls: 'r' },
      { l: 0, w: 225, y: 224, cls: 'r', mid: true },
    ];
    const labels = RUBRIC.map((c, i) => {
      const p = pos[i]; const k = crit[i]; const warn = k.pct < A.GOOD;
      return `<div class="pent-label ${p.cls}" data-i="${i}" style="--i:${i};left:${(p.l / W) * 100}%;width:${(p.w / W) * 100}%;top:${(p.y / H) * 100}%;--ty:${p.up ? '-100%' : p.mid ? '-50%' : '0%'}">
        <b>${esc(c.name)} (${c.weight}%)</b><span>${esc(c.desc)}</span>
        <strong class="${warn ? 'warn' : ''}" data-pi="${i}" data-w="${c.weight}" data-full="1">${fmt(k.avg)}/${c.weight} · ${pct(k.pct)}</strong></div>`;
    }).join('');
    // Móvil: pentágono compacto + lista.
    const list = RUBRIC.map((c, i) => `<li style="--i:${i}"><span>${esc(c.name)} <small>(${c.weight}%)</small></span><strong class="${crit[i].pct < A.GOOD ? 'warn' : ''}" data-pi="${i}" data-w="${c.weight}">${fmt(crit[i].avg)}/${c.weight}</strong></li>`).join('');
    return `
      <div class="pent-desktop"><div class="pent-wrap">${pentagonSvg(pcts, { w: W, h: H, cx: 410, cy: 275, R: 165 })}${labels}</div></div>
      <div class="pent-mobile">${pentagonSvg(pcts, { w: 340, h: 300, cx: 170, cy: 150, R: 92, short: true })}<ul class="pent-list">${list}</ul></div>`;
  }

  /* Animación del pentágono: crece desde el centro al aparecer y, si llegan datos nuevos, se transforma
     suavemente desde los valores anteriores (sin redibujarse de golpe). Respeta "reducir movimiento". */
  let pentLast = null, pentToken = 0;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function setShape(svg, polySel, dotSel, vals) {
    const cx = +svg.dataset.cx, cy = +svg.dataset.cy, R = +svg.dataset.r, n = vals.length;
    const pts = vals.map((v, i) => {
      const k = Math.max(0.02, Math.min(1, v));
      return [cx + R * k * Math.sin((2 * Math.PI * i) / n), cy - R * k * Math.cos((2 * Math.PI * i) / n)];
    });
    svg.querySelector(polySel).setAttribute('points', pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' '));
    svg.querySelectorAll(dotSel).forEach((c) => { const p = pts[+c.dataset.i]; c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); });
  }
  const setPentagon = (svg, vals) => setShape(svg, '.data', '.pdot', vals);

  /** Radar del equipo: crece desde el centro al elegir un equipo y se transforma si llegan evaluaciones nuevas. */
  let radarLast = null;
  function animateRadar() {
    const svg = $('.radar[data-team]');
    const body = $('#st-body');
    if (body) body.classList.remove('team-in'); // se vuelve a poner solo si hay que animar la entrada
    if (!svg || !svg.dataset.pcts) return;
    const to = svg.dataset.pcts.split(',').map(Number);
    const same = radarLast && radarLast.id === svg.dataset.team;
    const from = same ? radarLast.vals : to.map(() => 0);
    radarLast = { id: svg.dataset.team, vals: to };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!same && !reduce && body) body.classList.add('team-in');
    if (reduce || from.every((v, i) => Math.abs(v - to[i]) < 1e-6)) return;
    const token = ++pentToken, start = performance.now(), delay = same ? 0 : 300, dur = same ? 700 : 1100;
    setShape(svg, '.ser-t', '.rdot', from);
    const frame = (now) => {
      if (token !== pentToken) return;
      const t = Math.max(0, Math.min(1, (now - start - delay) / dur)), e = easeOut(t);
      setShape(svg, '.ser-t', '.rdot', to.map((v, i) => from[i] + (v - from[i]) * e));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function paintPentagonNumbers(vals) {
    $$('[data-pi]').forEach((el) => {
      const v = vals[+el.dataset.pi], w = +el.dataset.w;
      el.textContent = el.dataset.full ? `${fmt(v * w)}/${w} · ${pct(v)}` : `${fmt(v * w)}/${w}`;
    });
  }

  function animatePentagons() {
    const svgs = $$('.pent-svg');
    if (!svgs.length) return;
    const to = svgs[0].dataset.pcts.split(',').map(Number);
    const first = !pentLast;
    const from = pentLast || to.map(() => 0);
    pentLast = to;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (first && !reduce) $$('.pent-wrap, .pent-mobile').forEach((el) => el.classList.add('pent-in'));
    if (reduce || from.every((v, i) => Math.abs(v - to[i]) < 1e-6)) return;

    const token = ++pentToken, start = performance.now(), delay = first ? 350 : 0, dur = first ? 1200 : 700;
    svgs.forEach((svg) => setPentagon(svg, from));
    paintPentagonNumbers(from);
    const frame = (now) => {
      if (token !== pentToken) return; // otra animación (o un cambio de pestaña) tomó el control
      const t = Math.max(0, Math.min(1, (now - start - delay) / dur)), e = easeOut(t);
      const cur = to.map((v, i) => from[i] + (v - from[i]) * e);
      svgs.forEach((svg) => setPentagon(svg, cur));
      paintPentagonNumbers(cur);
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const LEVEL_TXT = { fuerte: ['Fortaleza', 'good'], bien: ['Bien', 'good'], mejorar: ['Por mejorar', 'warn'], critico: ['Punto crítico', 'bad'] };

  function tabEstadisticas(el) {
    el.innerHTML = `
      <div class="toolbar"><label class="inline">Ver: <select id="st-sel"></select></label></div>
      <div id="st-body"></div>`;
    const sel = $('#st-sel');
    pentLast = null; radarLast = null; pentToken++; // cada visita a la pestaña vuelve a animar la entrada
    sel.onchange = () => { state.statTeam = sel.value; pentLast = null; radarLast = null; pentToken++; currentTab.update(); };
    return {
      update() {
        const d = derived();
        const cur = state.statTeam || 'global';
        sel.innerHTML = '<option value="global">Resumen global del evento</option>' +
          [...d.stats].sort((a, b) => a.team.name.localeCompare(b.team.name)).map((s) => `<option value="${s.team.id}" ${cur === s.team.id ? 'selected' : ''}>${esc(s.team.name)}</option>`).join('');
        sel.value = d.stats.some((s) => s.team.id === cur) ? cur : 'global';
        $('#st-body').innerHTML = errBanner() + (sel.value === 'global' ? statsGlobalHtml(d) : statsTeamHtml(d, sel.value));
        animatePentagons();
        animateRadar();
      },
    };
  }

  function statsGlobalHtml(d) {
    const g = d.global;
    if (!g.evaluations) return '<div class="card"><p>Cuando lleguen las primeras evaluaciones verás aquí las estadísticas.</p></div>';
    const ranked = d.stats.filter((s) => s.n).sort((a, b) => b.avgTotal - a.avgTotal);
    const byCat = d.cats.map((cat) => {
      const ss = d.stats.filter((s) => s.team.category === cat && s.n);
      return { cat, teams: d.stats.filter((s) => s.team.category === cat).length, avg: A.mean(ss.map((s) => s.avgTotal)), n: ss.reduce((a, s) => a + s.n, 0) };
    });
    const weakest = [...g.crit].sort((a, b) => a.pct - b.pct);
    return `
      <div class="kpis">
        <div class="kpi"><b>${g.teamsEvaluated}/${g.teams}</b><span>Equipos evaluados</span></div>
        <div class="kpi"><b>${g.evaluations}</b><span>Evaluaciones</span></div>
        <div class="kpi"><b>${g.judges}</b><span>Jueces participantes</span></div>
        <div class="kpi"><b>${fmt(g.avgTotal)}</b><span>Promedio global /100</span></div>
      </div>
      <section class="card pent-card"><h3>Promedio por criterio (todo el evento)</h3>
        ${pentagonHtml(g.crit)}
        <p class="muted">Cada vértice es un criterio y el anillo exterior es el puntaje máximo. La línea punteada marca «Bueno» (80 %): los criterios en naranja quedaron por debajo.</p>
      </section>
      <section class="card"><h3>Criterios más débiles del evento</h3>
        <ol class="plain">${weakest.map((c) => {
          const k = g.weakTeamsByCrit.find((x) => x.id === c.id);
          return `<li><b>${esc(c.name)}</b> — promedio ${pct(c.pct)} del máximo · ${k.count} de ${g.teamsEvaluated} equipos por debajo de «Bueno»</li>`;
        }).join('')}</ol>
      </section>
      <section class="card"><h3>Ranking general por puntaje promedio</h3>
        <ol class="toplist wide">${ranked.map((s, i) => `
          <li><span class="rk">${i + 1}</span><span class="nm">${esc(s.team.name)}<small>${esc(s.team.category || '')}</small></span>
            <div class="bar"><i style="width:${fmt(s.avgTotal, 0)}%"></i></div>
            <span class="val">${fmt(s.avgTotal)}</span><span class="ev">${s.n} ev.</span></li>`).join('')}</ol>
      </section>
      ${g.votes ? `
      <section class="card"><h3>Voto del público</h3>
        <ol class="toplist wide">${[...d.stats].sort((a, b) => b.votes - a.votes).map((s, i) => `
          <li><span class="rk">${i + 1}</span><span class="nm">${esc(s.team.name)}<small>${esc(s.team.category || '')}</small></span>
            <div class="bar"><i style="width:${Math.round((s.votes / Math.max(1, ...d.stats.map((x) => x.votes))) * 100)}%"></i></div>
            <span class="val">${s.votes}</span><span class="ev">${Math.round((s.votes / g.votes) * 100)}%</span></li>`).join('')}</ol>
      </section>` : ''}
      <section class="card"><h3>Por categoría</h3>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Categoría</th><th>Equipos</th><th>Evaluaciones</th><th>Promedio</th></tr></thead>
        <tbody>${byCat.map((c) => `<tr><td>${esc(c.cat)}</td><td>${c.teams}</td><td>${c.n}</td><td>${c.n ? fmt(c.avg) : '–'}</td></tr>`).join('')}</tbody></table></div>
      </section>`;
  }

  function statsTeamHtml(d, teamId) {
    const s = d.stats.find((x) => x.team.id === teamId);
    const t = s.team;
    const head = `
      <section class="card team-head">
        <div><span class="chip">${esc(t.category || 'Sin categoría')}</span><h2>${esc(t.name)}</h2>
        <p class="muted">${esc(t.group || '')}${t.stand ? ' · Stand ' + esc(t.stand) : ''}</p></div>
        <ul class="members">${(t.members || []).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      </section>`;
    if (!s.n) return head + '<div class="card"><p>Este equipo aún no tiene evaluaciones.</p></div>';

    const rankAll = d.stats.filter((x) => x.n).sort((a, b) => b.avgTotal - a.avgTotal);
    const posAll = rankAll.findIndex((x) => x.team.id === teamId) + 1;
    const sameCat = rankAll.filter((x) => x.team.category === t.category);
    const posCat = sameCat.findIndex((x) => x.team.id === teamId) + 1;
    const imp = A.improvements(s);
    const flagged = imp.filter((c) => c.level === 'critico' || c.level === 'mejorar');
    const gCrit = Object.fromEntries(d.global.crit.map((c) => [c.id, c]));
    const teamEvals = d.evals.filter((e) => e.teamId === teamId);

    // Para cada nivel de la rúbrica, qué jueces lo otorgaron (de mejor a peor nivel).
    const judgeLevels = (rc) => rc.levels.map((l, i) => {
      const js = teamEvals.filter((e) => e.scores[rc.id] === l.pts).sort((a, b) => a.judgeName.localeCompare(b.judgeName));
      return js.length ? `<div class="jl"><span class="jl-lv lv${i}"><i></i>${esc(l.label)} · ${l.pts} pts</span>
        <span class="jl-names">${js.map((e) => `<span class="jchip" title="${esc(e.judgeEmail)}">${esc(e.judgeName)}</span>`).join('')}</span></div>` : '';
    }).join('');
    const obsByArea = FEEDBACK.map((f) => ({ f, items: teamEvals.filter((e) => (e[f.id] || '').trim()) }));

    return head + `
      <div class="kpis">
        <div class="kpi"><b>${fmt(s.avgTotal)}</b><span>Promedio /100</span></div>
        <div class="kpi"><b>${s.n}</b><span>Evaluaciones</span></div>
        <div class="kpi"><b>${posAll}º/${rankAll.length}</b><span>Lugar general</span></div>
        <div class="kpi"><b>${posCat}º/${sameCat.length}</b><span>En su categoría</span></div>
      </div>
      <div class="grid2">
        <section class="card"><h3>Perfil por criterio</h3>
          ${radarSVG([{ values: RUBRIC.map((c) => gCrit[c.id].pct), cls: 'ser-g' }, { values: RUBRIC.map((c) => s.crit[c.id].pct), cls: 'ser-t' }], teamId)}
          <p class="legend"><i class="dot t"></i> Este equipo <i class="dot g"></i> Promedio del evento</p>
        </section>
        <section class="card"><h3>Detalle por criterio</h3>
          ${RUBRIC.map((c, ci) => {
            const k = s.crit[c.id]; const lv = imp.find((x) => x.id === c.id).level; const diff = k.pct - gCrit[c.id].pct;
            return `<div class="crit-row" style="--n:${ci}">
              <div class="crit-top"><b>${esc(c.name)}</b><span class="tag ${LEVEL_TXT[lv][1]}">${LEVEL_TXT[lv][0]}</span></div>
              <div class="barrow"><div class="bar ${lv === 'mejorar' || lv === 'critico' ? 'warn' : ''}"><i style="width:${pct(k.pct)}"></i></div><b>${fmt(k.avg)}/${c.weight}</b></div>
              <div class="jl-list">${judgeLevels(c)}</div>
              <small class="crit-diff">${diff >= 0 ? '+' : ''}${fmt(diff * 100, 0)} pp vs. promedio del evento</small>
            </div>`;
          }).join('')}
        </section>
      </div>
      <section class="card"><h3>Puntos de mejora</h3>
        ${flagged.length ? `<ol class="plain">${flagged.map((c) => `<li><span class="tag ${LEVEL_TXT[c.level][1]}">${LEVEL_TXT[c.level][0]}</span> <b>${esc(c.name)}</b> — promedio ${fmt(c.avg)} de ${c.weight} pts (${pct(c.pct)}).</li>`).join('')}</ol>`
          : '<p>Ningún criterio quedó por debajo de «Bueno» (80 %). Excelente desempeño parejo.</p>'}
      </section>
      <section class="card"><h3>Nominaciones y votos</h3>
        <div class="kpis small">${NOMINATIONS.map((n) => `<div class="kpi"><b>${s.noms[n.id]}/${s.n}</b><span>${esc(n.award)}</span></div>`).join('')}
          <div class="kpi"><b>${s.votes}</b><span>Votos del público</span></div></div>
      </section>
      <section class="card"><h3>Observaciones de los jueces</h3>
        ${obsByArea.map(({ f, items }) => `
          <div class="obs-group"><h4>${esc(f.area)}</h4>
          ${items.length ? items.map((e) => `<blockquote>${esc(e[f.id])}<cite>${esc(e.judgeName)}</cite></blockquote>`).join('') : '<p class="muted">Sin comentarios.</p>'}</div>`).join('')}
      </section>`;
  }

  /* ========================= TAB: EQUIPOS Y QR ========================= */
  function parseMembers(v) {
    const s = String(v ?? '');
    const parts = /[;\n|]/.test(s) ? s.split(/[;\n|]/) : s.split(',');
    return parts.map((x) => x.trim()).filter(Boolean);
  }

  function rowsToTeams(rows) {
    const pick = (row, names) => { for (const k of Object.keys(row)) if (names.includes(norm(k))) return row[k]; return ''; };
    const out = [];
    rows.forEach((r) => {
      const name = String(pick(r, ['proyecto', 'nombre del proyecto', 'nombre', 'project']) || '').trim();
      if (!name) return;
      const catRaw = String(pick(r, ['categoria', 'category']) || '').trim();
      const cat = CATEGORIES.find((c) => norm(c) === norm(catRaw)) || catRaw;
      out.push({
        name, group: String(pick(r, ['grupo', 'group']) || '').trim(), category: cat,
        members: parseMembers(pick(r, ['integrantes', 'miembros', 'members', 'equipo'])),
        stand: String(pick(r, ['stand', 'numero de stand']) || '').trim(),
        description: String(pick(r, ['descripcion', 'description', 'resumen']) || '').trim(),
      });
    });
    return out;
  }

  function tabEquipos(el) {
    el.innerHTML = `
      <div class="toolbar">
        <button class="btn primary" id="eq-import">Importar Excel/CSV</button>
        <input type="file" id="eq-file" accept=".xlsx,.xls,.csv" hidden>
        <button class="btn" id="eq-add">+ Agregar equipo</button>
        <button class="btn ghost" id="eq-tpl">Descargar plantilla</button>
        <button class="btn" id="eq-print">Imprimir todos los QR</button>
        <button class="btn" id="eq-voto">QR del voto del público</button>
        <input class="search" id="eq-q" placeholder="Buscar proyecto, grupo o integrante…">
      </div>
      <div id="eq-warn"></div>
      <div id="eq-list"></div>`;
    $('#eq-add').onclick = () => teamDialog();
    $('#eq-import').onclick = () => $('#eq-file').click();
    $('#eq-file').onchange = async (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        importDialog(rowsToTeams(rows));
      } catch (ex) { toast('No se pudo leer el archivo: ' + ex.message, 'bad'); }
    };
    $('#eq-tpl').onclick = () => downloadCSV('plantilla_equipos.csv', [
      ['Proyecto', 'Grupo', 'Categoría', 'Integrantes', 'Stand', 'Descripción'],
      ['EcoRiego Inteligente', 'LAGE 5A', 'Sustentabilidad', 'Ana Pérez; Luis Gómez; María Soto', '1', 'Sistema de riego con sensores de humedad'],
    ]);
    $('#eq-print').onclick = () => printAllQR();
    $('#eq-voto').onclick = () => qrDialog({ name: 'Voto del público', group: 'Escanea para votar', category: '' }, voteUrl(state.settings));
    $('#eq-q').oninput = () => currentTab.update();
    $('#eq-warn').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ip]'); if (!b) return;
      store.saveSettings({ baseUrl: b.dataset.ip }).then(() => toast('Dirección de red guardada'), (ex) => toast(ex.message, 'bad'));
    });
    $('#eq-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const t = state.teams.find((x) => x.id === b.dataset.id); if (!t) return;
      if (b.dataset.act === 'qr') qrDialog(t);
      if (b.dataset.act === 'edit') teamDialog(t);
      if (b.dataset.act === 'del') confirmDialog(`¿Eliminar «${t.name}»? Sus evaluaciones dejarán de contarse.`).then((ok) => { if (ok) store.deleteTeam(t.id).then(() => toast('Equipo eliminado')); });
    });
    return {
      update() {
        const url = baseUrl(state.settings);
        const local = /^file:|localhost|127\.0\.0\.1/.test(url);
        let warn = '';
        if (store.mode === 'server') {
          const info = store.serverInfo || {};
          const others = (info.ips || []).filter((ip) => !url.includes('//' + ip + ':'));
          if (local) {
            warn = `<div class="banner">Los QR apuntan a <code>${esc(url)}</code>, que solo funciona en esta computadora y no se detectó ninguna red activa. Conéctate a una red Wi-Fi o activa la zona con cobertura inalámbrica de Windows y reinicia el servidor.</div>`;
          } else {
            warn = `<div class="banner info">${statusPill('on', 'Red local')} Los QR apuntan a <code>${esc(url)}</code>. Los celulares deben estar conectados a esta misma red; para probar, abre esa dirección en el navegador del celular.
              ${others.length ? `<br>¿Tus celulares usan otra red? <span class="ip-list">${others.map((ip) => `<button class="btn sm" data-ip="http://${esc(ip)}:${info.port}/">Usar ${esc(ip)}</button>`).join('')}</span>` : ''}</div>`;
          }
        } else if (local) {
          warn = `<div class="banner">Los QR apuntan a <code>${esc(url)}</code>, que solo funciona en esta computadora. Publica la página en internet (o usa el servidor de red local, ver README) y escribe su dirección en <b>Ajustes → URL pública</b> antes de imprimir los QR.</div>`;
        }
        $('#eq-warn').innerHTML = warn;
        const q = norm($('#eq-q').value);
        const d = derived(); const byId = Object.fromEntries(d.stats.map((s) => [s.team.id, s]));
        const list = [...state.teams].sort((a, b) => a.name.localeCompare(b.name))
          .filter((t) => !q || norm([t.name, t.group, t.category, (t.members || []).join(' ')].join(' ')).includes(q));
        $('#eq-list').innerHTML = state.teams.length ? `
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Proyecto</th><th>Grupo</th><th>Categoría</th><th>Integrantes</th><th>Estado</th><th></th></tr></thead><tbody>
          ${list.map((t) => `<tr>
            <td><b>${esc(t.name)}</b>${t.stand ? `<small>Stand ${esc(t.stand)}</small>` : ''}</td>
            <td>${esc(t.group)}</td><td><span class="chip">${esc(t.category || '–')}</span></td>
            <td class="members-cell">${esc((t.members || []).join(', '))}</td>
            <td>${teamStatusHtml(byId[t.id] ? byId[t.id].n : 0, d.global.judges)}</td>
            <td class="actions"><button class="btn sm" data-act="qr" data-id="${t.id}">QR</button>
              <button class="btn sm ghost" data-act="edit" data-id="${t.id}">Editar</button>
              <button class="btn sm ghost danger-t" data-act="del" data-id="${t.id}">Eliminar</button></td></tr>`).join('')}
          </tbody></table></div>`
          : '<div class="card"><p>No hay equipos. Importa tu lista (Excel/CSV) o agrega uno manualmente. Usa <b>Descargar plantilla</b> para ver el formato.</p></div>';
      },
    };
  }

  /** Estado de un equipo: Pendiente (0 evaluaciones), En curso, Completo (lo evaluaron todos los jueces activos). */
  function teamStatusHtml(n, judges) {
    const full = judges > 0 && n >= judges;
    const [tone, label] = n === 0 ? ['off', 'Pendiente'] : full ? ['on', 'Completo'] : ['warn', 'En curso'];
    const barTone = n === 0 ? '' : full ? 'ok' : 'warn';
    return `${statusPill(tone, label)}<div class="mini"><div class="bar ${barTone}"><i style="width:${judges ? Math.min(100, Math.round((n / judges) * 100)) : 0}%"></i></div><small>${n}/${judges || '–'} jueces</small></div>`;
  }

  function teamDialog(team) {
    const t = team || { name: '', group: '', category: '', members: [], stand: '', description: '' };
    const d = openDialog(`
      <h3>${team ? 'Editar equipo' : 'Nuevo equipo'}</h3>
      <form id="teamForm" class="stack-form">
        <label class="field"><span>Proyecto</span><input name="name" value="${esc(t.name)}" required></label>
        <div class="row"><label class="field"><span>Grupo</span><input name="group" value="${esc(t.group)}"></label>
        <label class="field"><span>Stand</span><input name="stand" value="${esc(t.stand)}"></label></div>
        <label class="field"><span>Categoría</span><input name="category" list="catlist" value="${esc(t.category)}">
          <datalist id="catlist">${CATEGORIES.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field"><span>Integrantes (uno por línea)</span><textarea name="members" rows="4">${esc((t.members || []).join('\n'))}</textarea></label>
        <label class="field"><span>Descripción breve (opcional)</span><textarea name="description" rows="2">${esc(t.description)}</textarea></label>
        <div class="row end"><button type="button" class="btn ghost" data-close>Cancelar</button><button class="btn primary">Guardar</button></div>
      </form>`);
    $('#teamForm', d).onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const rec = { ...t, id: t.id || newId(), name: f.name.value.trim(), group: f.group.value.trim(), stand: f.stand.value.trim(),
        category: f.category.value.trim(), members: parseMembers(f.members.value), description: f.description.value.trim() };
      if (!rec.name) return;
      try { await store.saveTeam(rec); toast('Equipo guardado'); d.close(); } catch (ex) { toast(ex.message, 'bad'); }
    };
  }

  function importDialog(list) {
    if (!list.length) { toast('No se encontraron filas con la columna «Proyecto».', 'bad'); return; }
    const key = (t) => norm(t.name) + '|' + norm(t.group);
    const existing = Object.fromEntries(state.teams.map((t) => [key(t), t]));
    const recs = list.map((t) => ({ ...t, id: (existing[key(t)] || {}).id || newId() }));
    const upd = recs.filter((r) => existing[key(r)]).length;
    const d = openDialog(`
      <h3>Importar ${recs.length} equipos</h3>
      <p>${recs.length - upd} nuevos · ${upd} ya existentes (se actualizan sin cambiar su QR).</p>
      <div class="table-wrap short"><table class="tbl"><thead><tr><th>Proyecto</th><th>Grupo</th><th>Categoría</th><th>Integrantes</th></tr></thead><tbody>
      ${recs.slice(0, 40).map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.group)}</td><td>${esc(r.category)}</td><td>${esc(r.members.join(', '))}</td></tr>`).join('')}
      </tbody></table></div>${recs.length > 40 ? `<p class="muted">…y ${recs.length - 40} más.</p>` : ''}
      <div class="row end"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="doImport">Importar</button></div>`, true);
    $('#doImport', d).onclick = async () => {
      try { await store.saveTeams(recs); toast(`${recs.length} equipos importados`); d.close(); } catch (ex) { toast(ex.message, 'bad'); }
    };
  }

  function qrDialog(t, urlOverride) {
    const url = urlOverride || teamUrl(state.settings, t);
    const svg = qrSvg(url);
    const d = openDialog(`
      <div class="qr-modal">
        <div class="qr-big">${svg}</div>
        <h3>${esc(t.name)}</h3><p class="muted">${esc(teamLine(t))}</p>
        <input class="url" readonly value="${esc(url)}">
        <div class="row end"><button class="btn ghost" id="cpUrl">Copiar enlace</button><button class="btn" id="dlPng">Descargar PNG</button><button class="btn primary" data-close>Cerrar</button></div>
      </div>`);
    $('#cpUrl', d).onclick = () => navigator.clipboard.writeText(url).then(() => toast('Enlace copiado'), () => $('.url', d).select());
    $('#dlPng', d).onclick = async () => downloadBlob(`qr-${slug(t.name)}.png`, await svgToPngBlob(svg));
  }

  function printAllQR() {
    if (!state.teams.length) return;
    const sheet = document.createElement('div'); sheet.id = 'print-sheet';
    const voteCard = `
      <div class="qr-card"><div class="qr-svg">${qrSvg(voteUrl(state.settings))}</div>
        <b>Voto del público</b><span>Escanea y vota por tu proyecto favorito</span><small>${esc(state.settings.eventName)}</small></div>`;
    sheet.innerHTML = voteCard + [...state.teams].sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name)).map((t) => `
      <div class="qr-card"><div class="qr-svg">${qrSvg(teamUrl(state.settings, t))}</div>
        <b>${esc(t.name)}</b><span>${esc(teamLine(t))}</span><small>Escanea para evaluar · ${esc(state.settings.eventName)}</small></div>`).join('');
    document.body.appendChild(sheet);
    const clean = () => { sheet.remove(); window.removeEventListener('afterprint', clean); };
    window.addEventListener('afterprint', clean);
    setTimeout(() => window.print(), 100);
  }

  /* ======================= TAB: OBSERVACIONES ======================= */
  function tabObservaciones(el) {
    el.innerHTML = `
      <div class="toolbar">
        <select id="ob-team"></select><select id="ob-cat"></select><select id="ob-area"></select>
        <input class="search" id="ob-q" placeholder="Buscar en los comentarios…">
      </div>
      <p class="muted" id="ob-count"></p><div id="ob-list"></div>`;
    const f = { team: '', cat: '', area: '', q: '' };
    ['team', 'cat', 'area'].forEach((k) => { $('#ob-' + k).onchange = (e) => { f[k] = e.target.value; currentTab.update(); }; });
    $('#ob-q').oninput = (e) => { f.q = e.target.value; currentTab.update(); };
    return {
      update() {
        const d = derived();
        const fill = (id, first, opts, cur) => { $('#' + id).innerHTML = `<option value="">${first}</option>` + opts.map(([v, l]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join(''); };
        fill('ob-team', 'Todos los equipos', [...state.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => [t.id, t.name]), f.team);
        fill('ob-cat', 'Todas las categorías', d.cats.map((c) => [c, c]), f.cat);
        fill('ob-area', 'Todas las áreas', FEEDBACK.map((x) => [x.id, x.area]), f.area);
        const q = norm(f.q);
        const items = A.observations(state.teams, d.evals).filter((o) =>
          (!f.team || o.team.id === f.team) && (!f.cat || o.team.category === f.cat) && (!f.area || o.fieldId === f.area) && (!q || norm(o.text).includes(q)));
        $('#ob-count').textContent = `${items.length} comentario${items.length === 1 ? '' : 's'}`;
        $('#ob-list').innerHTML = items.map((o) => `
          <article class="card obs"><div class="obs-meta"><b>${esc(o.team.name)}</b><span class="chip">${esc(o.area)}</span><small>${esc(o.judgeName)}</small></div><p>${esc(o.text)}</p></article>`).join('')
          || '<div class="card"><p class="muted">Sin comentarios que coincidan.</p></div>';
      },
    };
  }

  /* ========================== TAB: JUECES ========================== */
  function tabEvaluaciones(el) {
    el.innerHTML = `
      <div class="toolbar"><button class="btn" id="ev-csv">Exportar evaluaciones (CSV)</button></div>
      <div id="ev-body"></div>`;
    $('#ev-csv').onclick = () => {
      const d = derived(); const tById = Object.fromEntries(state.teams.map((t) => [t.id, t]));
      downloadCSV('evaluaciones_demoday.csv', [
        ['Proyecto', 'Grupo', 'Categoría', 'Juez', 'Correo', ...RUBRIC.map((c) => c.name), 'Total', ...NOMINATIONS.map((n) => n.award), ...FEEDBACK.map((f) => f.label), 'Fecha'],
        ...d.evals.map((e) => { const t = tById[e.teamId]; return [t.name, t.group, t.category, e.judgeName, e.judgeEmail, ...RUBRIC.map((c) => e.scores[c.id]), e.total,
          ...NOMINATIONS.map((n) => (e.nominations && e.nominations[n.id] ? 'Sí' : 'No')), ...FEEDBACK.map((f) => e[f.id] || ''), fmtDate(e.updatedAt)]; }),
      ]);
    };
    $('#ev-body').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      if (await confirmDialog('¿Eliminar esta evaluación? No se puede deshacer.')) store.deleteEvaluation(b.dataset.del).then(() => toast('Evaluación eliminada'));
    });
    return {
      update() {
        const d = derived(); const tById = Object.fromEntries(state.teams.map((t) => [t.id, t]));
        const judges = {};
        d.evals.forEach((e) => { (judges[e.judgeKey] = judges[e.judgeKey] || { name: e.judgeName, email: e.judgeEmail, teams: new Set() }).teams.add(e.teamId); });
        const list = Object.values(judges).sort((a, b) => a.name.localeCompare(b.name));
        const recent = [...d.evals].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        $('#ev-body').innerHTML = `${errBanner()}
          <section class="card"><h3>Participación por juez</h3>
            ${list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Juez</th><th>Correo</th><th>Proyectos evaluados</th><th>Faltan</th></tr></thead><tbody>
            ${list.map((j) => {
              const miss = state.teams.filter((t) => !j.teams.has(t.id));
              return `<tr><td>${esc(j.name)}</td><td>${esc(j.email)}</td><td>${j.teams.size}/${state.teams.length}</td>
                <td>${miss.length ? `<details><summary>${miss.length} pendiente${miss.length === 1 ? '' : 's'}</summary><small>${esc(miss.map((t) => t.name).join(', '))}</small></details>` : statusPill('on', 'Completo')}</td></tr>`;
            }).join('')}</tbody></table></div>` : '<p class="muted">Aún no hay evaluaciones.</p>'}
            <p class="muted">Un juez no tiene que evaluar todos los proyectos; úsalo para vigilar la cobertura.</p>
          </section>
          <section class="card"><h3>Todas las evaluaciones (${recent.length})</h3>
            ${recent.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Proyecto</th><th>Juez</th><th>Total</th><th>Nominaciones</th><th>Fecha</th><th></th></tr></thead><tbody>
            ${recent.map((e) => `<tr><td>${esc((tById[e.teamId] || {}).name)}</td><td>${esc(e.judgeName)}</td><td><b>${e.total}</b></td>
              <td>${NOMINATIONS.filter((n) => e.nominations && e.nominations[n.id]).map((n) => `<span class="chip">${esc(n.award)}</span>`).join(' ')}</td>
              <td>${esc(fmtDate(e.updatedAt))}</td><td><button class="btn sm ghost danger-t" data-del="${esc(e.id)}">Eliminar</button></td></tr>`).join('')}
            </tbody></table></div>` : '<p class="muted">Sin evaluaciones.</p>'}
          </section>`;
      },
    };
  }

  /* =========================== TAB: AJUSTES =========================== */
  function tabAjustes(el) {
    el.innerHTML = '<div id="aj-body"></div>';
    let built = false;
    return {
      update() {
        if (built) return; // evita borrar lo que el admin está escribiendo
        built = true;
        const s = state.settings;
        $('#aj-body').innerHTML = `
          <section class="card"><h3>Evento</h3>
            <form id="ajForm" class="stack-form">
              <label class="field"><span>Nombre del evento</span><input name="eventName" value="${esc(s.eventName)}"></label>
              <label class="field"><span>URL pública de esta página</span>
                <small>Dirección donde publicaste el sistema (termina en <code>index.html</code> o en el dominio). Los QR se generan con ella. Déjala vacía para usar la dirección actual.</small>
                <input name="baseUrl" placeholder="https://mi-demoday.web.app/" value="${esc(s.baseUrl)}"></label>
              <label class="check"><input type="checkbox" name="open" ${s.open ? 'checked' : ''}> Evaluaciones de jueces abiertas (desmárcalo al terminar el recorrido)</label>
              <label class="check"><input type="checkbox" name="votingOpen" ${s.votingOpen ? 'checked' : ''}> Votación del público abierta (desmárcalo para cerrar el voto)</label>
              <div><button class="btn primary">Guardar ajustes</button></div>
            </form>
          </section>
          <section class="card"><h3>Datos</h3>
            <p>${store.mode === 'firebase' ? 'Conectado a Firebase: los datos se comparten en tiempo real con todos los dispositivos.'
              : store.mode === 'server' ? 'Servidor de red local: los datos se guardan en <code>data.json</code> (junto a serve.ps1) y se comparten con los celulares de esta red.'
                : 'Modo demostración: los datos están solo en este navegador.'}</p>
            <div class="row">
              ${store.mode !== 'firebase' ? '<button class="btn" id="seedBtn">Cargar datos de demostración</button>' : ''}
              <button class="btn danger" id="clearRespBtn">Borrar evaluaciones y votos</button>
              <button class="btn danger" id="resetBtn">Borrar todo</button>
            </div>
            <p class="muted">«Borrar evaluaciones y votos» conserva los equipos y sus QR: úsalo después de las pruebas, antes del evento. «Borrar todo» también elimina los equipos y los ajustes.</p>
          </section>`;
        $('#ajForm').onsubmit = async (e) => {
          e.preventDefault(); const f = e.target;
          try { await store.saveSettings({ eventName: f.eventName.value.trim() || 'Demo Day 2026', baseUrl: f.baseUrl.value.trim(), open: f.open.checked, votingOpen: f.votingOpen.checked }); toast('Ajustes guardados'); }
          catch (ex) { toast(ex.message, 'bad'); }
        };
        if (store.mode !== 'firebase') $('#seedBtn').onclick = async () => { await window.DD.seedDemo(); toast('Datos de demostración cargados'); };
        const where = store.mode === 'firebase' ? 'de Firebase' : store.mode === 'server' ? 'del servidor' : 'de este navegador';
        const run = async (scope, okMsg) => {
          try { await store.clearData(scope); toast(okMsg); } catch (ex) { toast('No se pudo borrar: ' + ex.message, 'bad'); }
        };
        $('#clearRespBtn').onclick = async () => {
          const ne = state.evals.length, nv = state.votes.length;
          if (await confirmDialog(`¿Borrar ${ne} ${ne === 1 ? 'evaluación' : 'evaluaciones'} y ${nv} ${nv === 1 ? 'voto' : 'votos'} ${where}? Los equipos y sus QR se conservan. No se puede deshacer.`, 'Borrar')) await run('responses', 'Evaluaciones y votos borrados');
        };
        $('#resetBtn').onclick = async () => {
          if (await confirmDialog(`¿Borrar TODO ${where}: equipos, evaluaciones, votos y ajustes? Los QR impresos dejarán de funcionar. No se puede deshacer.`, 'Borrar todo')) await run('all', 'Todos los datos borrados');
        };
      },
    };
  }

  /* ============================ TEMA CLARO / OSCURO ============================ */
  function initTheme() {
    const btn = $('#themeBtn'); if (!btn) return;
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const effective = () => root.dataset.theme || (mq.matches ? 'dark' : 'light');
    const paint = () => {
      const dark = effective() === 'dark';
      btn.dataset.mode = dark ? 'dark' : 'light';
      btn.querySelector('.label').textContent = dark ? 'Tema claro' : 'Tema oscuro';
      btn.title = dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    };
    btn.addEventListener('click', () => {
      const next = effective() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next; safeLS.set('dd_theme', next); paint();
    });
    if (mq.addEventListener) mq.addEventListener('change', paint);
    paint();
  }

  /* ================================ ARRANQUE ================================ */
  initTheme();
  route();
})();
