/*
 * Synchronisation avec l'API : le CRM continue de fonctionner sur son état React (réactif, hors ligne quelques
 * secondes sans souci), et ce module envoie au serveur ce qui a changé.
 *
 * - diffOps(avant, après) compare les deux états (les objets modifiés sont de nouvelles références) et produit
 *   des opérations { coll, op: 'upsert' | 'delete' | 'order' | 'set', ... } ;
 * - SyncEngine les regroupe (≈ 300 ms), les envoie à POST /api/sync, réessaie en cas de coupure réseau,
 *   et signale les opérations refusées par le serveur (droits, règles métier) pour recharger les données.
 */
export const SYNC_COLLECTIONS = ['contacts', 'activities', 'appointments', 'tasks', 'catalog', 'productTypes', 'guides', 'stages', 'clauses', 'users', 'roles'];
export const ORDERED = ['stages', 'clauses', 'productTypes', 'catalog', 'guides'];
export const CLIENT_ONLY_SETTINGS = ['currentUserId', 'authManaged', 'apiMode', 'session'];

export function diffOps(prev, next) {
  if (!prev || prev === next) return [];
  const ops = [];
  for (const coll of SYNC_COLLECTIONS) {
    const a = prev[coll] || []; const b = next[coll] || [];
    if (a === b) continue;
    const before = new Map(a.map((d) => [d.id, d]));
    const after = new Map(b.map((d) => [d.id, d]));
    for (const d of b) if (before.get(d.id) !== d) ops.push({ coll, op: 'upsert', doc: d });
    for (const d of a) if (!after.has(d.id)) ops.push({ coll, op: 'delete', id: d.id });
    if (ORDERED.includes(coll)) {
      const ia = a.map((d) => d.id).filter((id) => after.has(id)); const ib = b.map((d) => d.id).filter((id) => before.has(id));
      if (ia.join('|') !== ib.join('|')) ops.push({ coll, op: 'order', ids: b.map((d) => d.id) });
    }
  }
  if (prev.company !== next.company && next.company) ops.push({ coll: 'company', op: 'set', doc: next.company });
  if (prev.settings !== next.settings && next.settings) {
    const strip = (s) => Object.fromEntries(Object.entries(s || {}).filter(([k]) => !CLIENT_ONLY_SETTINGS.includes(k)));
    const x = strip(prev.settings); const y = strip(next.settings);
    if (JSON.stringify(x) !== JSON.stringify(y)) ops.push({ coll: 'settings', op: 'set', doc: y });
  }
  return ops;
}

/** Fusionne les opérations en attente : une seule écriture par document */
function compact(ops) {
  const out = []; const last = new Map();
  ops.forEach((o) => {
    const k = o.op === 'order' || o.op === 'set' ? `${o.coll}:${o.op}` : `${o.coll}:${o.op === 'upsert' ? o.doc.id : o.id}`;
    if (last.has(k)) out[last.get(k)] = null;
    last.set(k, out.length); out.push(o);
  });
  return out.filter(Boolean);
}

export class SyncEngine {
  constructor(client, { delay = 300 } = {}) {
    this.client = client; this.delay = delay;
    this.queue = []; this.timer = null; this.inflight = null; this.listeners = new Set();
    this.status = 'idle'; this.retry = 0; this.waiters = [];
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { this.listeners.forEach((fn) => fn(ev)); }
  setStatus(s, extra = {}) { this.status = s; this.emit({ type: 'status', status: s, pending: this.queue.length, ...extra }); }
  push(ops) {
    if (!ops.length) return;
    this.queue.push(...ops);
    this.setStatus('pending');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), this.delay);
  }
  async run() {
    if (this.inflight || !this.queue.length) { if (!this.queue.length && !this.inflight) this.resolveWaiters(); return; }
    const batch = compact(this.queue.splice(0));
    this.setStatus('saving');
    this.inflight = this.client.post('/sync', { ops: batch });
    try {
      const r = await this.inflight;
      this.retry = 0;
      const bad = (r?.results || []).filter((x) => !x.ok);
      if (bad.length) this.emit({ type: 'rejected', errors: bad });
      this.setStatus(this.queue.length ? 'pending' : 'saved');
    } catch (e) {
      if (e.status === 0 || e.status >= 500) {
        // coupure réseau / serveur : on remet le lot en tête et on réessaie
        this.queue.unshift(...batch);
        this.retry = Math.min(this.retry + 1, 6);
        this.setStatus('offline', { error: e.message });
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.run(), 1000 * 2 ** this.retry);
      } else {
        this.emit({ type: 'rejected', errors: [{ error: e.message, code: e.code }] });
        this.setStatus('error', { error: e.message });
      }
    } finally {
      this.inflight = null;
    }
    if (this.queue.length && this.status !== 'offline') await this.run();
    else if (!this.queue.length) this.resolveWaiters();
  }
  resolveWaiters() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  /** Attend que tout soit enregistré (ex. avant de définir le mot de passe d'un nouveau membre) */
  flush() {
    clearTimeout(this.timer);
    if (!this.queue.length && !this.inflight) return Promise.resolve();
    const p = new Promise((res) => this.waiters.push(res));
    this.run();
    return p;
  }
}
