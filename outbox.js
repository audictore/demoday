/* Cola de envíos pendientes: si un celular pierde la señal al enviar una evaluación o un voto,
   el envío se guarda en el teléfono y se reintenta solo hasta que llegue. Es seguro reintentar:
   cada evaluación/voto tiene un id fijo, así que enviarlo dos veces solo lo sobrescribe. */
(function () {
  const KEY = 'dd_outbox';
  const RETRY_MS = 6000, TIMEOUT_MS = 12000;
  const listeners = new Set();
  let timer = null, flushing = false;

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* sin almacenamiento */ }
    listeners.forEach((f) => f(list.length));
    schedule(list.length);
  };
  const same = (x, kind, id) => x.kind === kind && x.doc.id === id;

  // Errores de red/tiempo se reintentan; los demás (evaluaciones cerradas, datos inválidos) no.
  const isNetwork = (e) => !!e && (e instanceof TypeError || e.name === 'TimeoutError'
    || e.code === 'unavailable' || e.code === 'deadline-exceeded' || /failed to fetch|network|offline|timeout|load failed/i.test(e.message || ''));

  const withTimeout = (p, ms) => new Promise((resolve, reject) => {
    const t = setTimeout(() => { const e = new Error('Tiempo de espera agotado'); e.name = 'TimeoutError'; reject(e); }, ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

  async function send(item) {
    const store = window.DD.store;
    await store.init();
    return item.kind === 'eval' ? store.saveEvaluation(item.doc) : store.saveVote(item.doc);
  }

  function remove(kind, id) {
    const list = read(), rest = list.filter((x) => !same(x, kind, id));
    if (rest.length !== list.length) write(rest);
  }

  /** Envía ya; si no hay red, lo deja en cola. Devuelve {status:'sent'|'queued'}. Lanza si el servidor lo rechaza. */
  async function submit(kind, doc) {
    try {
      await withTimeout(send({ kind, doc }), TIMEOUT_MS);
      remove(kind, doc.id);
      return { status: 'sent' };
    } catch (e) {
      if (!isNetwork(e)) throw e;
      write(read().filter((x) => !same(x, kind, doc.id)).concat({ kind, doc, at: Date.now() }));
      return { status: 'queued' };
    }
  }

  async function flush() {
    if (flushing) return;
    flushing = true;
    try {
      for (const item of read()) {
        try { await withTimeout(send(item), TIMEOUT_MS); remove(item.kind, item.doc.id); }
        catch (e) {
          if (isNetwork(e)) break;            // sigue sin señal: se vuelve a intentar luego
          remove(item.kind, item.doc.id);     // rechazado de forma definitiva (p. ej. evaluaciones cerradas)
        }
      }
    } finally { flushing = false; }
  }

  function schedule(n) {
    if (n > 0 && !timer) timer = setInterval(flush, RETRY_MS);
    if (!n && timer) { clearInterval(timer); timer = null; }
  }

  window.addEventListener('online', flush);
  window.DD = window.DD || {};
  window.DD.outbox = {
    submit, flush,
    pending: () => read().length,
    has: (kind, id) => read().some((x) => same(x, kind, id)),
    onChange: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  };
  schedule(read().length);
  if (read().length) setTimeout(flush, 1500);
})();
