/*
 * Historique de démonstration (≈ 22 mois) : ventes, pertes, appels, RDV et encaissements passés.
 * Généré de façon déterministe (même résultat à chaque chargement) pour alimenter
 * les tendances, comparaisons N / N-1, prévisions et recommandations produits.
 * Ne sert qu'à la démo : avec demoData={false}, rien n'est généré.
 */
import { uid, startOfDay, addDays } from '../utils';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FIRST = ['Ahmed', 'Mariem', 'Youssef', 'Sana', 'Bilel', 'Asma', 'Omar', 'Nadia', 'Hamza', 'Rim', 'Mehdi', 'Ons', 'Aziz', 'Syrine', 'Karim', 'Yosra', 'Anis', 'Molka', 'Firas', 'Emna', 'Seif', 'Chaima', 'Wassim', 'Dorra', 'Ali', 'Hiba', 'Nizar', 'Sirine', 'Tarek', 'Amal'];
const LAST = ['Ben Ali', 'Trabelsi', 'Jaziri', 'Mekki', 'Chebbi', 'Hammami', 'Bouazizi', 'Masmoudi', 'Ayari', 'Dridi', 'Khelifi', 'Sfaxi', 'Ghannouchi', 'Kammoun', 'Baccouche', 'Zribi', 'Fourati', 'Mabrouk', 'Ouni', 'Bouslama'];
const SCHOOL = ['École', 'Institut', 'Collège privé', 'Centre', 'Académie', 'Lycée privé'];
const SCHOOL_N = ['Ibn Khaldoun', 'Les Oliviers', 'El Amal', 'Elite', 'Horizon', 'La Réussite', 'Pythagore', 'Avicenne', 'Les Pins', 'Al Jazira', 'Le Savoir', 'Nour', 'Phénix', 'Victor Hugo', 'Les Lauriers'];
const CITIES = ['Tunis', 'Ariana', 'Sousse', 'Sfax', 'Nabeul', 'Monastir', 'Bizerte', 'Ben Arous'];
const COMPANIES = ['Société', 'Groupe', 'Clinique', 'Banque', 'Assurances', 'Laboratoires'];

/* Profil de chaque produit : volume de leads, taux de signature, durée de cycle, tendance mensuelle, saisonnalité */
const SEASON_TRAINING = [1.25, 1.1, 1.0, 0.9, 0.8, 0.65, 0.45, 0.5, 1.45, 1.4, 1.1, 0.85];
const SEASON_SCHOOL = [0.7, 0.65, 0.7, 0.8, 0.9, 1.3, 1.45, 1.5, 1.35, 0.9, 0.75, 0.6];
export const HISTORY_PROFILES = {
  f1: { leads: 6.0, win: 0.27, cycle: 18, trend: 1.012, season: SEASON_TRAINING, start: -22, types: ['Demandeur d’emploi', 'Étudiant', 'Particulier'] },
  f2: { leads: 4.6, win: 0.29, cycle: 12, trend: 1.004, season: SEASON_TRAINING, start: -22, types: ['Particulier', 'Étudiant'] },
  f3: { leads: 3.2, win: 0.31, cycle: 10, trend: 1.0, season: SEASON_TRAINING, start: -22, types: ['Demandeur d’emploi', 'Particulier'] },
  f4: { leads: 4.2, win: 0.24, cycle: 9, trend: 0.99, season: SEASON_TRAINING, start: -22, types: ['Particulier', 'Étudiant', 'Entreprise'] },
  f5: { leads: 4.4, win: 0.17, cycle: 14, trend: 0.93, season: SEASON_TRAINING, start: -22, types: ['Étudiant', 'Particulier'], lost: ['Prix trop élevé', 'Formation non disponible', 'A choisi un autre centre'] },
  f6: { leads: 2.4, win: 0.36, cycle: 16, trend: 1.045, season: SEASON_TRAINING, start: -22, types: ['Entreprise'], seats: [2, 6] },
  e1: { leads: 2.1, win: 0.3, cycle: 34, trend: 1.06, season: SEASON_SCHOOL, start: -11, types: ['Établissement'], school: true },
  e2: { leads: 1.7, win: 0.27, cycle: 28, trend: 1.03, season: SEASON_SCHOOL, start: -11, types: ['Établissement'], school: true },
  e3: { leads: 1.1, win: 0.5, cycle: 18, trend: 1.04, season: SEASON_SCHOOL, start: -9, types: ['Établissement'], school: true },
};

/* Commerciaux : activité par type, efficacité, délai de 1er appel (heures), date d'arrivée */
const REPS = {
  t1: [['u1', 0.22], ['u2', 0.18], ['u3', 0.38], ['u5', 0.22]],
  t2: [['u4', 0.62], ['u5', 0.23], ['u2', 0.15]],
};
const REP = {
  u1: { win: 1.0, reach: 1.0, delay: 6, since: -22 }, u2: { win: 0.85, reach: 0.9, delay: 22, since: -22 },
  u3: { win: 1.18, reach: 1.12, delay: 2, since: -22 }, u4: { win: 1.12, reach: 1.05, delay: 4, since: -10 },
  u5: { win: 0.82, reach: 0.95, delay: 11, since: -8 },
};
const SOURCES_T1 = [['Facebook', 0.3], ['Instagram', 0.14], ['TikTok', 0.11], ['Google', 0.08], ['Site web', 0.12], ['WhatsApp', 0.08], ['Bouche à oreille', 0.09], ['LinkedIn', 0.04], ['Salon / forum', 0.04]];
const SOURCES_T2 = [['LinkedIn', 0.32], ['Site web', 0.22], ['Salon / forum', 0.22], ['Bouche à oreille', 0.14], ['Facebook', 0.1]];
const SOURCE_WIN = { 'Bouche à oreille': 1.55, 'Site web': 1.2, LinkedIn: 1.15, 'Salon / forum': 1.1, WhatsApp: 1.05, Google: 1.0, Facebook: 0.9, Instagram: 0.85, TikTok: 0.55 };
const LOST = [['Prix trop élevé', 0.32], ['Horaires incompatibles', 0.16], ['A choisi un autre centre', 0.14], ['Pas le bon moment', 0.18], ['Injoignable', 0.14], ['Autre', 0.06]];
const LOST_T2 = [['Prix trop élevé', 0.3], ['Pas le bon moment', 0.3], ['A choisi un autre centre', 0.2], ['Injoignable', 0.1], ['Autre', 0.1]];
const METHODS = [['cash', 0.25], ['cheque', 0.3], ['traite', 0.15], ['virement', 0.2], ['carte', 0.1]];

export function makeHistory({ catalog, qualificationKeys, seed = 202 }) {
  const r = rng(seed);
  const pick = (list) => { let x = r() * list.reduce((s, [, w]) => s + w, 0); for (const [v, w] of list) { x -= w; if (x <= 0) return v; } return list[list.length - 1][0]; };
  const any = (arr) => arr[Math.floor(r() * arr.length)];
  const poisson = (l) => { let k = 0; let p = 1; const L = Math.exp(-l); do { k++; p *= r(); } while (p > L); return k - 1; };
  const emptyQ = Object.fromEntries(qualificationKeys.map((k) => [k, '']));
  const now = new Date();
  const today = startOfDay();
  const contacts = []; const activities = []; const appointments = [];
  const price = Object.fromEntries(catalog.map((p) => [p.id, p]));
  const usedNames = new Set();

  const reachP = (hour, rep) => {
    const base = hour >= 10 && hour < 12 ? 0.66 : hour >= 18 && hour < 20 ? 0.72 : hour >= 13 && hour < 15 ? 0.38 : hour < 10 ? 0.48 : 0.55;
    return Math.min(0.95, base * rep.reach);
  };

  for (let m = -22; m <= -1; m++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const days = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    Object.entries(HISTORY_PROFILES).forEach(([pid, pr]) => {
      const prod = price[pid];
      if (!prod || m < pr.start) return;
      const age = m - pr.start;
      const n = poisson(pr.leads * Math.pow(pr.trend, age) * pr.season[monthStart.getMonth()]);
      for (let i = 0; i < n; i++) {
        const t = pr.school ? 't2' : 't1';
        const reps = REPS[t].filter(([u]) => REP[u].since <= m);
        const ownerId = pick(reps);
        const rep = REP[ownerId];
        const source = pick(pr.school ? SOURCES_T2 : SOURCES_T1);
        const created = new Date(monthStart); created.setDate(1 + Math.floor(r() * days)); created.setHours(8 + Math.floor(r() * 12), Math.floor(r() * 60), 0, 0);
        const pWin = Math.min(0.85, pr.win * rep.win * (SOURCE_WIN[source] || 1));
        const won = r() < pWin;
        const cycle = Math.max(2, Math.round(pr.cycle * (0.5 + r())));
        const closed = addDays(created, won ? cycle : Math.round(cycle * (0.4 + r() * 0.8)));
        if (closed >= today) continue; // dossier encore ouvert : géré par les données du jour
        let org = pr.school ? `${any(SCHOOL)} ${any(SCHOOL_N)}${r() < 0.4 ? ` ${any(CITIES)}` : ''}`
          : pr.seats ? `${any(COMPANIES)} ${any(LAST)}` : `${any(FIRST)} ${any(LAST)}`;
        if (usedNames.has(org)) org = `${org} (${any(CITIES)})`;
        usedNames.add(org);
        const seats = pr.seats ? pr.seats[0] + Math.floor(r() * (pr.seats[1] - pr.seats[0] + 1)) : 1;
        const value = Math.round((prod.price * seats * (pr.school ? 0.85 + r() * 0.3 : 1)) / 10) * 10;
        const id = uid();
        const lostReason = won ? '' : pick(pr.lost ? pr.lost.map((l) => [l, 1]) : (pr.school ? LOST_T2 : LOST));
        const maxStageId = won ? 'won' : any(['contacted', 'contacted', 'interested', 'interested', 'rdv', 'negotiation']);

        // Appels : 1er appel après le délai propre au commercial, puis relances
        const nCalls = 1 + Math.floor(r() * (won ? 4 : 3));
        let tCall = new Date(created.getTime() + rep.delay * (0.4 + r() * 1.2) * 36e5);
        let last = created;
        for (let k = 0; k < nCalls && tCall < closed; k++) {
          const hour = 9 + Math.floor(r() * 11);
          tCall.setHours(hour, Math.floor(r() * 60), 0, 0);
          if (tCall < created) tCall = new Date(created.getTime() + 36e5);
          const reached = r() < reachP(tCall.getHours(), rep);
          const isLast = k === nCalls - 1;
          const outcome = !reached ? 'noanswer' : isLast ? (won ? 'yes' : (lostReason === 'Injoignable' ? 'noanswer' : 'no')) : any(['later', 'interested', 'interested']);
          activities.push({ id: uid(), contactId: id, type: 'call', outcome, text: '', userId: ownerId, at: tCall.toISOString() });
          last = tCall;
          tCall = addDays(tCall, 1 + Math.floor(r() * Math.max(2, cycle / 3)));
        }
        activities.push({ id: uid(), contactId: id, type: 'created', text: `Contact ajouté (source : ${source})`, userId: ownerId, at: created.toISOString() });

        // RDV réalisés
        if ((won && r() < 0.85) || (!won && ['rdv', 'negotiation'].includes(maxStageId))) {
          const start = new Date(created.getTime() + (closed - created) * (0.55 + r() * 0.3)); start.setHours(10 + Math.floor(r() * 8), 0, 0, 0);
          appointments.push({ id: uid(), contactId: id, title: pr.school ? 'Démo Erudaxis' : 'Entretien d’orientation', mode: r() < 0.6 ? 'onsite' : 'online', start: start.toISOString(), duration: 45, location: '', link: '', ownerId, status: 'done', evaluation: won ? (r() < 0.85 ? 'positive' : 'neutral') : (r() < 0.6 ? 'negative' : 'neutral'), report: '' });
        }

        // Paiements : 1 à 3 échéances, réglées pour la plupart
        let schedule = [];
        if (won) {
          const parts = pr.school ? (r() < 0.5 ? 2 : 1) : (value >= 1000 ? 1 + Math.floor(r() * 3) : 1);
          const each = Math.round(value / parts);
          for (let k = 0; k < parts; k++) {
            const due = addDays(closed, k * 30);
            const amount = k === parts - 1 ? value - each * (parts - 1) : each;
            const late = due < today ? r() : 1;
            const paid = due < today && late > 0.08;
            const paidAt = paid ? addDays(due, Math.floor(r() * (late < 0.25 ? 25 : 6))) : null;
            schedule.push({ id: uid(), method: pick(METHODS), amount, due: due.toISOString(), ref: '', bank: '', status: paid && paidAt < now ? 'paid' : 'pending', paidAt: paid && paidAt < now ? paidAt.toISOString() : null });
          }
        }
        contacts.push({
          id, org, name: pr.school || pr.seats ? `${any(FIRST)} ${any(LAST)}` : '', role: pr.school ? any(['Directeur', 'Directrice', 'DAF', 'Gérant']) : pr.seats ? 'Responsable RH' : '',
          phone: `+216 ${20 + Math.floor(r() * 79)} ${100 + Math.floor(r() * 899)} ${100 + Math.floor(r() * 899)}`, email: '', city: any(CITIES),
          type: any(pr.types), source, ownerId, tags: [], value, probability: won ? 100 : 0, lostReason, noAnswerCount: 0,
          qualification: { ...emptyQ }, courseId: pid, productTypeId: t, payment: { status: 'none', paid: 0 }, schedule,
          people: [], files: [], createdAt: created.toISOString(), updatedAt: closed.toISOString(), lastContactAt: last.toISOString(),
          wonAt: won ? closed.toISOString() : null, lostAt: won ? null : closed.toISOString(), stage: won ? 'won' : 'lost', maxStageId, history: true,
        });
      }
    });
  }
  return { contacts, activities, appointments };
}
