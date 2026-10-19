import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import brand from '../brand';
import { stageById, stageIndex, outcomeLabel, methodLabel, setStages, defaultStages, DEFAULT_STAGE_IDS, entryStage, isEntry, hasStage, shouldAdvanceTo, reachedIndex } from './constants';
import { uid, normPhone } from '../utils';
import { paymentSummary } from './selectors';
import { defaultRoles, ADMIN_ROLE_ID, can as canFn, scopedState, defaultTypeId } from './permissions';
import { diffOps } from '../api/sync';

/** L'activité (type de produit) d'un prospect suit celle de son produit */
function withType(s, c) {
  const p = c.courseId && (s.catalog || []).find((x) => x.id === c.courseId);
  return p?.typeId && p.typeId !== c.productTypeId ? { ...c, productTypeId: p.typeId } : c;
}

/*
 * Couche de données.
 * - Mode autonome : état React + sauvegarde dans le navigateur (localStorage).
 * - Mode API (prop `apiUrl`) : état chargé depuis le serveur Node.js / MongoDB (dossier /backend) ; chaque
 *   modification est comparée au dernier état connu et envoyée à POST /api/sync (voir ../api/sync.js).
 *   Les actions ci-dessous restent identiques dans les deux modes.
 */

export const KEY = brand.storageKey;

export function createSeed() {
  const d = brand.seed();
  return {
    version: 2, ...d,
    settings: { currentUserId: d.users[0].id, company: brand.name, ...brand.settings },
    session: null,
  };
}

/** Conditions générales proposées par défaut (modifiables dans le menu « Conditions générales ») */
export const defaultClauses = () => [
  { id: uid(), title: 'Engagement de paiement intégral', active: true, typeIds: [],
    text: 'Toute commande, inscription ou souscription validée engage {client} au paiement de la totalité du montant convenu ({montant}), y compris en cas d\u2019arrêt, d\u2019abandon ou d\u2019absence avant la date de fin. Aucun remboursement ne sera effectué, sauf accord écrit de {entreprise}.' },
  { id: uid(), title: 'Respect de l\u2019échéancier', active: true, typeIds: [],
    text: 'Les échéances figurant sur cette fiche doivent être honorées aux dates prévues. Tout chèque, traite ou prélèvement impayé rend immédiatement exigible le solde restant dû.' },
  { id: uid(), title: 'Report ou changement de session', active: false, typeIds: [],
    text: 'Un report vers une session ultérieure peut être accordé une seule fois, sur demande écrite au moins 7 jours avant le début. Le montant total reste dû.' },
];

/** Met à niveau les données enregistrées avec une version précédente */
function migrate(s) {
  const seed = createSeed();
  const out = { ...s };
  if (!out.guides) out.guides = seed.guides || [];
  if (!out.catalog) out.catalog = seed.catalog || [];
  if (!out.productTypes) {
    // Anciennes données : un seul nom de produit dans les paramètres → devient le premier type
    const one = s.settings?.productOne && s.settings.productOne !== 'Produit' ? s.settings.productOne : null;
    out.productTypes = one
      ? [{ id: uid(), one, many: s.settings.productMany || `${one}s` }]
      : (seed.productTypes?.length ? seed.productTypes : (out.catalog.length ? [{ id: uid(), one: 'Produit', many: 'Produits' }] : []));
  }
  if (out.productTypes.length) out.catalog = out.catalog.map((p) => (p.typeId && out.productTypes.some((t) => t.id === p.typeId) ? p : { ...p, typeId: out.productTypes[0].id }));
  if (!out.stages) out.stages = defaultStages();
  // Ancienne couleur pétrole de Proservices → violet de la charte Erudaxis
  out.stages = out.stages.map((x) => (x.color === '#0F766E' ? { ...x, color: '#7C3AED' } : x));
  if (!out.company) out.company = { name: brand.name, logo: '', address: s.settings?.centerAddress || '', phone: '', email: '', website: '', taxId: '', footer: '' };
  if (!out.clauses) out.clauses = defaultClauses();
  // Rôles et accès : rôles par défaut ; l'utilisateur courant devient Super admin s'il n'y en a aucun
  if (!out.roles?.length) out.roles = defaultRoles();
  if (!out.roles.some((r) => r.id === ADMIN_ROLE_ID)) out.roles = [defaultRoles()[0], ...out.roles];
  // v2 des droits : pilotage et chiffres (montants) ; les commerciaux ont leurs rapports personnels
  if ((s.settings?.rolesV || 1) < 2) {
    out.roles = out.roles.map((r) => {
      const p = { ...r.permissions };
      if (r.id === 'manager') { if (p['reports.company'] === undefined) p['reports.company'] = true; if (p['finance.view'] === undefined) p['finance.view'] = true; }
      if (r.id === 'sales') p['nav.reports'] = true;
      return { ...r, permissions: p };
    });
  }
  if (out.users?.length) {
    const cur = s.settings?.currentUserId || out.users[0].id;
    out.users = out.users.map((u) => (u.roleId && out.roles.some((r) => r.id === u.roleId) ? u : { ...u, roleId: u.id === cur && !out.users.some((x) => x.roleId === ADMIN_ROLE_ID) ? ADMIN_ROLE_ID : 'sales' }));
    if (!out.users.some((u) => u.roleId === ADMIN_ROLE_ID)) out.users = out.users.map((u, i) => (i === 0 ? { ...u, roleId: ADMIN_ROLE_ID } : u));
  }
  out.users = (out.users || []).map((u) => (Array.isArray(u.productTypeIds) ? u : { ...u, productTypeIds: [] }));
  // Le module Projets a été retiré : on nettoie les anciennes données
  delete out.projects; delete out.projectStages;
  setStages(out.stages);
  out.settings = { ...seed.settings, ...out.settings, rolesV: 2 };
  delete out.settings.productOne; delete out.settings.productMany;
  out.contacts = out.contacts.map((c0) => {
    let c = c0;
    if (c.maxStageId === undefined) { const { maxStage, ...rest } = c; c = { ...rest, maxStageId: DEFAULT_STAGE_IDS[maxStage || 0] || c.stage }; }
    if (!out.stages.some((x) => x.id === c.stage)) c = { ...c, stage: out.stages[0].id };
    c = withType(out, c);
    if (c.schedule) return withPayment(c);
    const paid = c.payment?.paid || 0;
    const schedule = paid > 0 ? [{ id: uid(), method: 'cash', amount: paid, due: c.wonAt || c.createdAt, ref: '', bank: '', status: 'paid', paidAt: c.wonAt || c.createdAt }] : [];
    return withPayment({ ...c, schedule });
  });
  return out;
}

/** Recalcule le statut de paiement à partir de l'échéancier */
function withPayment(c) {
  const p = paymentSummary(c);
  const status = p.paid <= 0 ? 'none' : p.paid >= p.total && p.total > 0 ? 'paid' : 'deposit';
  return { ...c, payment: { status, paid: p.paid } };
}

/**
 * Chargement initial :
 *  1. `initialData` fourni par votre application (ex. données venant de votre API) ;
 *  2. sinon les données enregistrées dans le navigateur (si `persist` est actif) ;
 *  3. sinon les données de démonstration (ou une base vide si `demoData={false}`).
 */
function load({ storageKey, initialData, persist, demoData, currentUser, remote }) {
  let data = null;
  if (remote) {
    // Mode API : les données viennent du serveur (GET /api/bootstrap), jamais du navigateur
    const out = migrate(initialData);
    out.settings = { ...out.settings, authManaged: true, apiMode: true };
    return out;
  }
  if (initialData) data = initialData;
  else if (persist) {
    try { const raw = localStorage.getItem(storageKey); if (raw) data = JSON.parse(raw); } catch { /* stockage indisponible */ }
  }
  if (!data) {
    const seed = createSeed();
    data = demoData ? seed : { ...seed, contacts: [], activities: [], appointments: [], tasks: [] };
  }
  const out = migrate(data);
  // Connexion gérée par l'application hôte (prop currentUser) : on masque le sélecteur d'utilisateur de démo
  out.settings = { ...out.settings, authManaged: !!currentUser?.id };
  if (currentUser?.id) {
    if (!out.users.some((u) => u.id === currentUser.id)) out.users = [...out.users, { active: true, role: 'Commercial', roleId: 'sales', productTypeIds: [], ...currentUser }];
    else {
      // L'application hôte peut imposer le rôle et les activités du membre
      const patch = {};
      if (currentUser.roleId) patch.roleId = currentUser.roleId;
      if (Array.isArray(currentUser.productTypeIds)) patch.productTypeIds = currentUser.productTypeIds;
      out.users = out.users.map((u) => (u.id === currentUser.id ? { ...u, ...patch } : u));
    }
    out.settings = { ...out.settings, currentUserId: currentUser.id };
  }
  return out;
}

const reducer = (state, fn) => fn(state);
const Ctx = createContext(null);
const now = () => new Date().toISOString();
const emptyQ = () => Object.fromEntries(brand.qualification.map((q) => [q.key, '']));

export function StoreProvider({ children, storageKey = KEY, initialData, persist = true, demoData = true, onChange, currentUser, remote }) {
  const [state, dispatch] = useReducer(reducer, { storageKey, initialData, persist, demoData, currentUser, remote }, load);
  setStages(state.stages);
  // Mode API : dernier état connu du serveur, pour n'envoyer que les différences
  const baseRef = useRef(state);
  const skipRef = useRef(false);

  useEffect(() => {
    if (remote) {
      if (skipRef.current) { skipRef.current = false; baseRef.current = state; }
      else { const ops = diffOps(baseRef.current, state); baseRef.current = state; remote.sync.push(ops); }
    } else if (persist) { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* quota / privé */ } }
    onChange?.(state);
  }, [state]);

  const api = useMemo(() => {
    const me = () => state.settings.currentUserId;
    const update = (fn) => dispatch(fn);
    /** Remplace tout l'état par celui du serveur, sans le renvoyer */
    const replaceAll = (data) => { skipRef.current = true; dispatch(() => { const out = migrate(data); out.settings = { ...out.settings, authManaged: true, apiMode: true }; return out; }); };
    const reloadRemote = async () => { if (!remote) return; await remote.sync.flush(); replaceAll(await remote.reload()); };
    /** Import d'un état complet côté serveur (démo, sauvegarde, remise à zéro) — Super admin */
    const importRemote = async (data) => {
      try {
        await remote.sync.flush();
        await remote.client.post('/admin/import', { state: data, mode: 'replace' });
        replaceAll(await remote.reload());
      } catch (e) { remote.sync.emit({ type: 'rejected', errors: [{ error: e.message }] }); }
    };

    const mkActivity = (s, a) => ({ id: uid(), at: now(), userId: s.settings.currentUserId, text: '', ...a });

    const applyStage = (s, contact, stage, extra = {}) => {
      if (!contact || contact.stage === stage) return { contact: { ...contact, ...extra }, acts: [] };
      const from = stageById(contact.stage).label;
      const to = stageById(stage).label;
      const idx = stageIndex(stage);
      const c = {
        ...contact, ...extra, stage, updatedAt: now(),
        maxStageId: idx > reachedIndex(contact) ? stage : (contact.maxStageId || contact.stage),
        wonAt: stage === 'won' ? now() : contact.wonAt,
        probability: stage === 'won' ? 100 : stage === 'lost' ? 0 : contact.probability,
      };
      const text = `Étape : ${from} → ${to}${extra.lostReason ? ` · Motif : ${extra.lostReason}` : ''}`;
      return { contact: c, acts: [mkActivity(s, { contactId: contact.id, type: 'stage', text })] };
    };

    const replaceContact = (s, c) => { const nc = withPayment(withType(s, c)); return s.contacts.map((x) => (x.id === nc.id ? nc : x)); };

    return {
      me,
      // ---------- Contacts ----------
      findDuplicate(data, excludeId) {
        const p = normPhone(data.phone);
        const e = (data.email || '').trim().toLowerCase();
        const o = (data.org || '').trim().toLowerCase();
        return state.contacts.find((c) => c.id !== excludeId && (
          (p && p.length >= 6 && normPhone(c.phone) === p) ||
          (e && (c.email || '').toLowerCase() === e) ||
          (o && c.org.trim().toLowerCase() === o)
        ));
      },
      addContact(data) {
        const c = withType(state, {
          id: uid(), org: '', name: '', role: '', phone: '', email: '', city: '', type: '', source: '',
          ownerId: state.settings.currentUserId, tags: [], value: 0, probability: 0, lostReason: '', noAnswerCount: 0,
          qualification: emptyQ(), courseId: null, payment: { status: 'none', paid: 0 }, schedule: [],
          people: [], files: [], createdAt: now(), lastContactAt: null, wonAt: null,
          productTypeId: defaultTypeId(state),
          ...data, stage: data.stage || entryStage(), maxStageId: data.stage || entryStage(),
        });
        update((s) => ({
          ...s, contacts: [c, ...s.contacts],
          activities: [...s.activities, mkActivity(s, { contactId: c.id, type: 'created', text: `Contact ajouté${c.source ? ` (source : ${c.source})` : ''}` })],
        }));
        return c;
      },
      importContacts(list) {
        update((s) => {
          const notes = [];
          const cs = list.map(({ _note, ...d }) => {
            const c = withType(s, {
              productTypeId: defaultTypeId(s),
              id: uid(), org: '', name: '', role: '', phone: '', email: '', city: '', type: '', source: 'Import',
              ownerId: s.settings.currentUserId, tags: [], value: 0, probability: 0, lostReason: '', noAnswerCount: 0,
              qualification: emptyQ(), courseId: null, payment: { status: 'none', paid: 0 }, schedule: [],
              people: [], files: [], createdAt: now(), lastContactAt: null, wonAt: null, stage: entryStage(), maxStageId: entryStage(), ...d,
            });
            if (_note) notes.push(mkActivity(s, { contactId: c.id, type: 'note', text: _note }));
            return c;
          });
          return {
            ...s, contacts: [...cs, ...s.contacts],
            activities: [...s.activities, ...cs.map((c) => mkActivity(s, { contactId: c.id, type: 'created', text: `Contact importé (source : ${c.source})` })), ...notes],
          };
        });
      },
      updateContact(id, patch) {
        update((s) => {
          const c = s.contacts.find((x) => x.id === id);
          if (!c) return s;
          const p = typeof patch === 'function' ? patch(c) : patch;
          if (p.stage && p.stage !== c.stage) {
            const { stage, ...rest } = p;
            const r = applyStage(s, c, stage, rest);
            return { ...s, contacts: replaceContact(s, r.contact), activities: [...s.activities, ...r.acts] };
          }
          return { ...s, contacts: replaceContact(s, { ...c, ...p, updatedAt: now() }) };
        });
      },
      bulkUpdate(ids, patch) {
        update((s) => {
          let acts = [];
          const contacts = s.contacts.map((c) => {
            if (!ids.includes(c.id)) return c;
            const p = typeof patch === 'function' ? patch(c) : patch;
            if (p.stage && p.stage !== c.stage) {
              const { stage, ...rest } = p;
              const r = applyStage(s, c, stage, rest);
              acts = acts.concat(r.acts);
              return r.contact;
            }
            return withType(s, { ...c, ...p, updatedAt: now() });
          });
          return { ...s, contacts, activities: [...s.activities, ...acts] };
        });
      },
      deleteContacts(ids) {
        update((s) => ({
          ...s,
          contacts: s.contacts.filter((c) => !ids.includes(c.id)),
          activities: s.activities.filter((a) => !ids.includes(a.contactId)),
          appointments: s.appointments.filter((a) => !ids.includes(a.contactId)),
          tasks: s.tasks.filter((t) => !ids.includes(t.contactId)),
        }));
      },
      setStage(id, stage, extra = {}) {
        update((s) => {
          const c = s.contacts.find((x) => x.id === id);
          const r = applyStage(s, c, stage, extra);
          return { ...s, contacts: replaceContact(s, r.contact), activities: [...s.activities, ...r.acts] };
        });
      },

      // ---------- Activités ----------
      addActivity(a) {
        update((s) => {
          const act = mkActivity(s, a);
          const touch = ['call', 'email', 'whatsapp'].includes(a.type);
          return {
            ...s, activities: [...s.activities, act],
            contacts: touch ? s.contacts.map((c) => (c.id === a.contactId ? { ...c, lastContactAt: act.at } : c)) : s.contacts,
          };
        });
      },
      deleteActivity(id) {
        update((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) }));
      },

      /**
       * Enregistre le résultat d'un appel et toutes ses conséquences :
       * historique, étape, tâche de rappel, RDV, motif de perte.
       */
      logCall(contactId, outcome, text, opts = {}) {
        update((s) => {
          let c = s.contacts.find((x) => x.id === contactId);
          if (!c) return s;
          const acts = [mkActivity(s, { contactId, type: 'call', outcome, text: text || '' })];
          const tasks = [];
          const appts = [];
          c = { ...c, lastContactAt: now(), noAnswerCount: outcome === 'noanswer' ? (c.noAnswerCount || 0) + 1 : 0 };
          const go = (stage, extra) => {
            const r = applyStage(s, c, stage, extra);
            c = r.contact; acts.push(...r.acts);
          };
          if (isEntry(c.stage) && hasStage('contacted')) go('contacted');
          if (outcome === 'noanswer' && opts.retryAt) {
            tasks.push({ id: uid(), title: `Nouvel essai d’appel (${c.noAnswerCount} sans réponse)`, due: opts.retryAt, contactId, ownerId: s.settings.currentUserId, type: 'call', priority: 'low', done: false, createdAt: now() });
          }
          if (outcome === 'later' && opts.laterAt) {
            tasks.push({ id: uid(), title: opts.laterTitle || 'Rappeler', due: opts.laterAt, contactId, ownerId: s.settings.currentUserId, type: 'call', priority: 'high', done: false, createdAt: now() });
          }
          if (outcome === 'interested') {
            if (shouldAdvanceTo(c, 'interested')) go('interested');
            if (opts.followAt) tasks.push({ id: uid(), title: opts.followTitle || 'Relancer / proposer un RDV', due: opts.followAt, contactId, ownerId: s.settings.currentUserId, type: 'call', priority: 'medium', done: false, createdAt: now() });
          }
          if (outcome === 'no') {
            go('lost', { lostReason: opts.lostReason || 'Autre' });
            if (opts.recontactAt) tasks.push({ id: uid(), title: 'Recontacter (perdu)', due: opts.recontactAt, contactId, ownerId: s.settings.currentUserId, type: 'call', priority: 'low', done: false, createdAt: now() });
          }
          if (outcome === 'yes' && opts.rdv) {
            const r = { id: uid(), contactId, ownerId: s.settings.currentUserId, status: 'planned', evaluation: null, report: '', duration: 60, ...opts.rdv };
            appts.push(r);
            if (shouldAdvanceTo(c, 'rdv')) go('rdv');
            acts.push(mkActivity(s, { contactId, type: 'rdv', text: `RDV ${r.mode === 'online' ? 'en ligne' : 'présentiel'} planifié · ${new Date(r.start).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${r.title ? ` · ${r.title}` : ''}` }));
          }
          // Les tâches d'appel ouvertes pour ce contact sont considérées faites
          const closed = s.tasks.map((t) => (t.contactId === contactId && !t.done && t.type === 'call' && new Date(t.due) <= new Date(Date.now() + 864e5) ? { ...t, done: true, doneAt: now() } : t));
          return {
            ...s,
            contacts: replaceContact(s, c),
            activities: [...s.activities, ...acts],
            tasks: [...closed, ...tasks],
            appointments: [...s.appointments, ...appts],
          };
        });
      },

      // ---------- Rendez-vous ----------
      addRdv(data) {
        update((s) => {
          const r = { id: uid(), ownerId: s.settings.currentUserId, status: 'planned', evaluation: null, report: '', duration: 60, title: '', location: '', link: '', ...data };
          let contacts = s.contacts;
          let acts = [mkActivity(s, { contactId: r.contactId, type: 'rdv', text: `RDV ${r.mode === 'online' ? 'en ligne' : 'présentiel'} planifié · ${new Date(r.start).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${r.title ? ` · ${r.title}` : ''}` })];
          const c = s.contacts.find((x) => x.id === r.contactId);
          if (c && shouldAdvanceTo(c, 'rdv')) {
            const res = applyStage(s, c, 'rdv');
            contacts = replaceContact(s, res.contact);
            acts = acts.concat(res.acts);
          }
          return { ...s, contacts, appointments: [...s.appointments, r], activities: [...s.activities, ...acts] };
        });
      },
      updateRdv(id, patch) {
        update((s) => {
          const old = s.appointments.find((a) => a.id === id);
          if (!old) return s;
          const acts = [];
          if (patch.start && patch.start !== old.start) {
            acts.push(mkActivity(s, { contactId: old.contactId, type: 'rdv', text: `RDV reporté au ${new Date(patch.start).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}` }));
          }
          if (patch.status === 'cancelled' && old.status !== 'cancelled') {
            acts.push(mkActivity(s, { contactId: old.contactId, type: 'rdv', text: 'RDV annulé' }));
          }
          return { ...s, appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)), activities: [...s.activities, ...acts] };
        });
      },
      completeRdv(id, evaluation, report, nextStage) {
        update((s) => {
          const r = s.appointments.find((a) => a.id === id);
          if (!r) return s;
          const evalLabel = { positive: 'Positive', neutral: 'Neutre', negative: 'Négative' }[evaluation];
          let acts = [mkActivity(s, { contactId: r.contactId, type: 'report', outcome: evaluation, text: `Évaluation : ${evalLabel}${report ? ` — ${report}` : ''}` })];
          let contacts = s.contacts;
          const c = s.contacts.find((x) => x.id === r.contactId);
          if (c && nextStage && nextStage !== c.stage) {
            const res = applyStage(s, c, nextStage, nextStage === 'lost' ? { lostReason: 'Évaluation RDV négative' } : {});
            contacts = replaceContact(s, res.contact);
            acts = acts.concat(res.acts);
          }
          return {
            ...s, contacts,
            appointments: s.appointments.map((a) => (a.id === id ? { ...a, status: 'done', evaluation, report } : a)),
            activities: [...s.activities, ...acts],
          };
        });
      },
      deleteRdv(id) {
        update((s) => ({ ...s, appointments: s.appointments.filter((a) => a.id !== id) }));
      },

      // ---------- Tâches ----------
      addTask(t) {
        update((s) => ({ ...s, tasks: [...s.tasks, { id: uid(), ownerId: s.settings.currentUserId, type: 'todo', priority: 'medium', done: false, createdAt: now(), ...t }] }));
      },
      updateTask(id, patch) {
        update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      },
      toggleTask(id) {
        update((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: !t.done ? now() : null } : t)) }));
      },
      deleteTask(id) {
        update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
      },

      // ---------- Catalogue de formations ----------
      addCourse(c) {
        const p = { id: uid(), active: true, sessions: [], typeId: state.productTypes?.[0]?.id || null, ...c };
        update((s) => ({ ...s, catalog: [...(s.catalog || []), p] }));
        return p;
      },

      // ---------- Types de produits (Formations, Services, Matériel…) ----------
      addProductType(t) {
        const nt = { id: uid(), one: '', many: '', ...t };
        // Nouveau type : on repasse sur « toutes les activités » pour qu'il soit visible tout de suite
        update((s) => ({ ...s, productTypes: [...(s.productTypes || []), nt], users: s.users.map((u) => (u.id === s.settings.currentUserId ? { ...u, activeTypeId: '' } : u)) }));
        return nt;
      },
      updateProductType(id, patch) { update((s) => ({ ...s, productTypes: (s.productTypes || []).map((t) => (t.id === id ? { ...t, ...patch } : t)) })); },
      /** Supprime un type ; ses produits passent dans le type de remplacement */
      deleteProductType(id, moveTo) {
        update((s) => ({
          ...s,
          productTypes: (s.productTypes || []).filter((t) => t.id !== id),
          catalog: (s.catalog || []).map((p) => (p.typeId === id ? { ...p, typeId: moveTo || null } : p)),
          contacts: s.contacts.map((c) => (c.productTypeId === id ? { ...c, productTypeId: moveTo || '' } : c)),
          users: s.users.map((u) => ({ ...u, productTypeIds: (u.productTypeIds || []).filter((x) => x !== id), activeTypeId: u.activeTypeId === id ? '' : u.activeTypeId })),
        }));
      },
      updateCourse(id, patch) { update((s) => ({ ...s, catalog: (s.catalog || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) })); },
      deleteCourse(id) {
        update((s) => ({
          ...s, catalog: (s.catalog || []).filter((c) => c.id !== id),
          contacts: s.contacts.map((c) => (c.courseId === id ? { ...c, courseId: null } : c)),
          guides: (s.guides || []).map((g) => ({ ...g, productIds: (g.productIds || []).filter((p) => p !== id) })),
        }));
      },

      // ---------- Paiements (inscriptions) ----------
      /** Encaissement libre (hors échéance prévue) : ajouté à l'échéancier comme payé aujourd'hui */
      recordPayment(contactId, amount, method = 'cash', ref = '') {
        update((s) => {
          const c = s.contacts.find((x) => x.id === contactId);
          if (!c || !(amount > 0)) return s;
          if ((c.schedule || []).reduce((x, i) => x + (Number(i.amount) || 0), 0) + amount > (Number(c.value) || 0)) return s;
          const item = { id: uid(), method, amount, due: now(), ref, bank: '', status: 'paid', paidAt: now() };
          const nc = withPayment({ ...c, schedule: [...(c.schedule || []), item], updatedAt: now() });
          return {
            ...s, contacts: replaceContact(s, nc),
            activities: [...s.activities, mkActivity(s, { contactId, type: 'payment', text: `Paiement reçu : ${amount} DT (${methodLabel(method)}${ref ? ` n° ${ref}` : ''}) · total ${nc.payment.paid} / ${c.value || 0} DT` })],
          };
        });
      },
      /** Remplace tout l'échéancier (génération) */
      setSchedule(contactId, items) {
        update((s) => {
          const c = s.contacts.find((x) => x.id === contactId);
          if (!c) return s;
          const nc = withPayment({ ...c, schedule: items.map((i) => ({ id: uid(), status: 'pending', ref: '', bank: '', ...i })), updatedAt: now() });
          const n = items.filter((i) => i.status !== 'paid').length;
          return { ...s, contacts: replaceContact(s, nc), activities: [...s.activities, mkActivity(s, { contactId, type: 'payment', text: `Échéancier planifié : ${n} échéance${n > 1 ? 's' : ''}` })] };
        });
      },
      upsertInstallment(contactId, item) {
        update((s) => {
          const c = s.contacts.find((x) => x.id === contactId);
          if (!c) return s;
          const list = c.schedule || [];
          const exists = item.id && list.some((i) => i.id === item.id);
          const schedule = exists ? list.map((i) => (i.id === item.id ? { ...i, ...item } : i)) : [...list, { id: uid(), status: 'pending', ref: '', bank: '', ...item }];
          // Sécurité : la somme des échéances ne peut pas dépasser le montant total
          if (schedule.reduce((x, i) => x + (Number(i.amount) || 0), 0) > (Number(c.value) || 0)) return s;
          return { ...s, contacts: replaceContact(s, withPayment({ ...c, schedule, updatedAt: now() })) };
        });
      },
      deleteInstallment(contactId, itemId) {
        update((s) => {
          const c = s.contacts.find((x) => x.id === contactId);
          if (!c) return s;
          return { ...s, contacts: replaceContact(s, withPayment({ ...c, schedule: (c.schedule || []).filter((i) => i.id !== itemId) })) };
        });
      },
      /** Marque une échéance comme encaissée (ou l'annule) */
      toggleInstallment(contactId, itemId) {
        update((s) => {
          const c = s.contacts.find((x) => x.id === contactId);
          const it = c?.schedule?.find((i) => i.id === itemId);
          if (!it) return s;
          const paidNow = it.status !== 'paid';
          const schedule = c.schedule.map((i) => (i.id === itemId ? { ...i, status: paidNow ? 'paid' : 'pending', paidAt: paidNow ? now() : null } : i));
          const nc = withPayment({ ...c, schedule, updatedAt: now() });
          return {
            ...s, contacts: replaceContact(s, nc),
            activities: [...s.activities, mkActivity(s, { contactId, type: 'payment', text: paidNow
              ? `Échéance encaissée : ${it.amount} DT (${methodLabel(it.method)}${it.ref ? ` n° ${it.ref}` : ''}) · total ${nc.payment.paid} / ${c.value || 0} DT`
              : `Encaissement annulé : ${it.amount} DT (${methodLabel(it.method)})` })],
          };
        });
      },

      // ---------- Profil de l'entreprise (fiche imprimée, menu) ----------
      updateCompany(patch) { update((s) => ({ ...s, company: { ...s.company, ...patch } })); },

      // ---------- Conditions générales ----------
      addClause(c) { update((s) => ({ ...s, clauses: [...(s.clauses || []), { title: '', text: '', active: true, typeIds: [], ...c, id: uid() }] })); },
      updateClause(id, patch) { update((s) => ({ ...s, clauses: (s.clauses || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) })); },
      deleteClause(id) { update((s) => ({ ...s, clauses: (s.clauses || []).filter((c) => c.id !== id) })); },
      moveClause(id, dir) {
        update((s) => {
          const list = [...(s.clauses || [])];
          const i = list.findIndex((c) => c.id === id); const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return s;
          [list[i], list[j]] = [list[j], list[i]];
          return { ...s, clauses: list };
        });
      },

      // ---------- Colonnes du pipeline ----------
      /** Ajoute une colonne après `afterId` (jamais après « gagné », toujours dernière) */
      addStage({ label, color }, afterId) {
        const st = { id: `st_${uid().slice(0, 8)}`, label, color };
        update((s) => {
          const list = [...s.stages];
          const wonIdx = list.findIndex((x) => x.id === 'won');
          let at = afterId ? list.findIndex((x) => x.id === afterId) + 1 : wonIdx;
          if (at < 0 || at > wonIdx) at = wonIdx;
          list.splice(at, 0, st);
          return { ...s, stages: list };
        });
        return st;
      },
      updateStage(id, patch) { update((s) => ({ ...s, stages: s.stages.map((x) => (x.id === id ? { ...x, ...patch } : x)) })); },
      /** Déplace une colonne d'un cran (« gagné » reste la dernière colonne) */
      moveStage(id, dir) {
        update((s) => {
          const list = [...s.stages];
          const i = list.findIndex((x) => x.id === id);
          const j = i + dir;
          if (i < 0 || ['won', 'lost'].includes(id) || j < 0 || ['won', 'lost'].includes(list[j]?.id)) return s;
          [list[i], list[j]] = [list[j], list[i]];
          return { ...s, stages: list };
        });
      },
      /** Supprime une colonne ; ses contacts passent dans `moveTo` */
      deleteStage(id, moveTo) {
        update((s) => {
          if (['won', 'lost'].includes(id) || !s.stages.some((x) => x.id === moveTo) || moveTo === id) return s;
          const label = s.stages.find((x) => x.id === id)?.label;
          const to = s.stages.find((x) => x.id === moveTo)?.label;
          const moved = s.contacts.filter((c) => c.stage === id);
          return {
            ...s,
            stages: s.stages.filter((x) => x.id !== id),
            contacts: s.contacts.map((c) => (c.stage === id ? { ...c, stage: moveTo, maxStageId: c.maxStageId === id ? moveTo : c.maxStageId } : c.maxStageId === id ? { ...c, maxStageId: moveTo } : c)),
            activities: [...s.activities, ...moved.map((c) => mkActivity(s, { contactId: c.id, type: 'stage', text: `Étape : ${label} → ${to} (colonne supprimée)` }))],
          };
        });
      },
      resetStages() { update((s) => ({ ...s, stages: defaultStages(), contacts: s.contacts.map((c) => (defaultStages().some((x) => x.id === c.stage) ? c : { ...c, stage: defaultStages()[0].id })) })); },

      // ---------- Guides d'appel ----------
      addGuide(g) { update((s) => ({ ...s, guides: [...(s.guides || []), { name: '', productIds: [], questions: [], ...g, id: uid() }] })); },
      updateGuide(id, patch) { update((s) => ({ ...s, guides: (s.guides || []).map((g) => (g.id === id ? { ...g, ...patch } : g)) })); },
      deleteGuide(id) { update((s) => ({ ...s, guides: (s.guides || []).filter((g) => g.id !== id) })); },

      // ---------- Équipe & réglages ----------
      addUser(u) { const nu = { id: uid(), active: true, roleId: 'sales', productTypeIds: [], ...u }; update((s) => ({ ...s, users: [...s.users, nu] })); return nu; },
      /** Bascule de l'utilisateur connecté entre ses activités ('' = toutes) */
      setActiveType(typeId) { update((s) => ({ ...s, users: s.users.map((u) => (u.id === s.settings.currentUserId ? { ...u, activeTypeId: typeId || '' } : u)) })); },
      updateUser(id, patch) {
        update((s) => {
          const users = s.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
          if (!users.some((u) => u.roleId === ADMIN_ROLE_ID)) return s; // toujours au moins un Super admin
          return { ...s, users };
        });
      },

      // ---------- Rôles et accès ----------
      addRole(r) {
        const nr = { description: '', ...r, id: `role_${uid().slice(0, 8)}`, locked: false };
        update((s) => ({ ...s, roles: [...(s.roles || []), nr] }));
        return nr;
      },
      updateRole(id, patch) { update((s) => ({ ...s, roles: s.roles.map((r) => (r.id === id && !r.locked ? { ...r, ...patch } : r)) })); },
      /** Supprime un rôle ; ses utilisateurs passent dans `moveTo` */
      deleteRole(id, moveTo) {
        update((s) => {
          const r = s.roles.find((x) => x.id === id);
          if (!r || r.locked || !s.roles.some((x) => x.id === moveTo) || moveTo === id) return s;
          return { ...s, roles: s.roles.filter((x) => x.id !== id), users: s.users.map((u) => (u.roleId === id ? { ...u, roleId: moveTo } : u)) };
        });
      },
      /** Le droit `key` est-il accordé à l'utilisateur connecté ? */
      can: (key) => canFn(state, key),
      deleteUser(id, reassignTo) {
        update((s) => (s.users.filter((u) => u.id !== id).some((u) => u.roleId === ADMIN_ROLE_ID) ? {
          ...s,
          users: s.users.filter((u) => u.id !== id),
          contacts: s.contacts.map((c) => (c.ownerId === id ? { ...c, ownerId: reassignTo } : c)),
          tasks: s.tasks.map((t) => (t.ownerId === id ? { ...t, ownerId: reassignTo } : t)),
          appointments: s.appointments.map((a) => (a.ownerId === id ? { ...a, ownerId: reassignTo } : a)),
        } : s));
      },
      updateSettings(patch) { update((s) => ({ ...s, settings: { ...s.settings, ...patch } })); },

      // ---------- Session d'appels ----------
      startSession(ids, name = 'Session d’appels') {
        update((s) => ({ ...s, session: { id: uid(), name, ids, index: 0, startedAt: now(), results: {} } }));
      },
      updateSession(patch) { update((s) => (s.session ? { ...s, session: { ...s.session, ...patch } } : s)); },
      endSession() { update((s) => ({ ...s, session: null })); },

      // ---------- Données ----------
      resetDemo() { if (remote) return importRemote(createSeed()); update(() => migrate(createSeed())); },
      clearAll() {
        if (remote) return importRemote({ ...createSeed(), contacts: [], activities: [], appointments: [], tasks: [], users: state.users, settings: state.settings, catalog: state.catalog, guides: state.guides, productTypes: state.productTypes, stages: state.stages, company: state.company, clauses: state.clauses, roles: state.roles });
        update((s) => ({ ...createSeed(), contacts: [], activities: [], appointments: [], tasks: [], users: s.users, settings: s.settings, catalog: s.catalog, guides: s.guides, productTypes: s.productTypes, stages: s.stages, company: s.company, clauses: s.clauses }));
      },
      restore(data) { if (remote) return importRemote(data); update(() => migrate(data)); },
      remote, reloadRemote,
      outcomeLabel,
    };
  }, [state]);

  // `state` est limité au périmètre de l'utilisateur (ses prospects s'il n'a pas « data.all ») ; `fullState` = toutes les données
  return <Ctx.Provider value={{ state: scopedState(state), fullState: state, ...api }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
