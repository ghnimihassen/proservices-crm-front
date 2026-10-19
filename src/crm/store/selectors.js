import { endOfDay, startOfDay, addDays } from '../utils';
import { isEntry, isOpen, stageIndex, hasStage } from './constants';

export const userById = (state, id) => state.users.find((u) => u.id === id);
export const contactById = (state, id) => state.contacts.find((c) => c.id === id);

/** Prochaine action d'un contact : tâche ouverte ou RDV à venir le plus proche */
export function nextAction(state, contactId) {
  const t = state.tasks
    .filter((x) => x.contactId === contactId && !x.done)
    .map((x) => ({ kind: 'task', label: x.title, at: x.due, ref: x }));
  const r = state.appointments
    .filter((x) => x.contactId === contactId && x.status === 'planned' && new Date(x.start) >= startOfDay())
    .map((x) => ({ kind: 'rdv', label: `RDV ${x.mode === 'online' ? 'en ligne' : 'présentiel'}`, at: x.start, ref: x }));
  const all = [...t, ...r].sort((a, b) => new Date(a.at) - new Date(b.at));
  return all[0] || null;
}

export const lastActivity = (state, contactId) =>
  state.activities
    .filter((a) => a.contactId === contactId && a.type !== 'stage')
    .sort((a, b) => new Date(b.at) - new Date(a.at))[0];


/** Vues enregistrées de la base de contacts */
export const VIEWS = [
  { id: 'all', label: 'Tous', test: () => true },
  {
    id: 'tocall', label: 'À appeler',
    test: (c, s) => isEntry(c.stage) || s.tasks.some((t) => t.contactId === c.id && !t.done && t.type === 'call' && new Date(t.due) <= endOfDay()),
    tone: 'orange',
  },
  {
    id: 'followup', label: 'À relancer',
    test: (c, s) => isOpen(c.stage) && !isEntry(c.stage) && (
      !c.lastContactAt || new Date(c.lastContactAt) < addDays(new Date(), -7) ||
      s.tasks.some((t) => t.contactId === c.id && !t.done && new Date(t.due) < startOfDay())
    ),
    tone: 'red',
  },
  { id: 'interested', label: 'Intéressés', test: (c) => isOpen(c.stage) && stageIndex(c.stage) >= (hasStage('interested') ? stageIndex('interested') : 2) },
  { id: 'noanswer', label: 'Sans réponse ×3', test: (c) => (c.noAnswerCount || 0) >= 3 && c.stage !== 'lost' && c.stage !== 'won' },
  { id: 'mine', label: 'Mes contacts', test: (c, s) => c.ownerId === s.settings.currentUserId },
];

/** File d'appels par défaut : « À appeler » du commercial connecté */
export function defaultCallQueue(state) {
  const me = state.settings.currentUserId;
  const tocall = VIEWS.find((v) => v.id === 'tocall');
  return state.contacts
    .filter((c) => c.ownerId === me && tocall.test(c, state) && c.stage !== 'won' && c.stage !== 'lost')
    .sort((a, b) => {
      const na = nextAction(state, a.id); const nb = nextAction(state, b.id);
      return new Date(na?.at || a.createdAt) - new Date(nb?.at || b.createdAt);
    })
    .map((c) => c.id);
}

export const isReached = (a) => a.type === 'call' && a.outcome && a.outcome !== 'noanswer';

export const courseById = (state, id) => (state.catalog || []).find((c) => c.id === id);

/** Libellé générique du catalogue ; chaque type de produit a ensuite son propre nom (Formations, Services…) */
// eslint-disable-next-line no-unused-vars
export const productLabels = (state) => ({ one: 'Produit', many: 'Produits' });
export const typeById = (state, id) => (state.productTypes || []).find((t) => t.id === id);
export const productsOfType = (state, typeId) => (state.catalog || []).filter((p) => !typeId || p.typeId === typeId);
/** Nom à afficher pour le produit d'un contact : le type du produit (ex. « Formation ») ou « Produit » */
export const productTypeLabel = (state, productId) => typeById(state, courseById(state, productId)?.typeId)?.one || 'Produit';

/** Échéancier : total payé, reste, prochaine échéance, retards */
export function paymentSummary(c) {
  const items = c.schedule || [];
  const paid = items.filter((i) => i.status === 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const planned = items.filter((i) => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const total = Number(c.value) || 0;
  const pending = items.filter((i) => i.status !== 'paid').sort((a, b) => new Date(a.due) - new Date(b.due));
  const overdue = pending.filter((i) => new Date(i.due) < startOfDay());
  return { paid, planned, total, rest: Math.max(0, total - paid), unplanned: Math.max(0, total - paid - planned), next: pending[0] || null, overdue };
}

export const guidesFor = (state, productId) =>
  (state.guides || []).filter((g) => !g.productIds?.length || (productId && g.productIds.includes(productId)))
    .sort((a, b) => (b.productIds?.length ? 1 : 0) - (a.productIds?.length ? 1 : 0));

/** Conditions générales à imprimer pour un contact (actives, et liées à son type de produit ou à tous) */
export const clausesFor = (state, contact) => {
  const typeId = courseById(state, contact?.courseId)?.typeId;
  return (state.clauses || []).filter((c) => c.active !== false && (!c.typeIds?.length || (typeId && c.typeIds.includes(typeId))));
};
/** Remplace {client}, {entreprise}, {produit}, {montant}, {date} dans le texte d'une clause */
export const fillClause = (text, { client, company, product, amount }) => (text || '')
  .replace(/\{client\}/g, client || 'le client')
  .replace(/\{entreprise\}/g, company || 'l\u2019entreprise')
  .replace(/\{produit\}/g, product || 'la prestation')
  .replace(/\{montant\}/g, amount || 'convenu')
  .replace(/\{date\}/g, new Date().toLocaleDateString('fr-FR'));

