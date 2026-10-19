/*
 * Moteur d'analyse du CRM : séries mensuelles, comparaisons N / N-1, prévisions,
 * encaissements, efficacité de l'équipe, recommandations produits et coaching.
 * Fonctions pures : elles reçoivent l'état (déjà limité au périmètre de l'utilisateur) et renvoient des chiffres.
 *
 * Les prévisions combinent : tendance (régression linéaire sur 12 mois), saisonnalité (mêmes mois des années
 * précédentes) et pipeline pondéré par les taux de transformation réellement observés à chaque étape.
 */
import { PIPELINE_STAGES, reachedIndex, isOpen } from './constants';
import { isReached } from './selectors';
import { startOfDay, startOfMonth, addDays, pct } from '../utils';

export const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const MONTHS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAY = 864e5;
const t = (d) => (d ? new Date(d).getTime() : NaN);
const within = (d, from, to) => { const x = t(d); return x >= from && x < to; };
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const growth = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : cur ? 100 : 0);
export const monthStart = (y, m) => new Date(y, m, 1).getTime();
export const lostAt = (c) => c.lostAt || c.updatedAt || c.lastContactAt || c.createdAt;
const workDaysBetween = (from, to) => { let n = 0; for (let d = new Date(from); d < to; d = addDays(d, 1)) if (d.getDay() !== 0) n++; return Math.max(1, n); };

/* ---------- Agrégats de base ---------- */
const wonIn = (s, from, to) => s.contacts.filter((c) => c.stage === 'won' && within(c.wonAt, from, to));
const paidIn = (s, from, to) => s.contacts.flatMap((c) => (c.schedule || []).filter((i) => i.status === 'paid' && within(i.paidAt, from, to)));

export function periodTotals(s, from, to) {
  const won = wonIn(s, from, to);
  const calls = s.activities.filter((a) => a.type === 'call' && within(a.at, from, to));
  const reached = calls.filter(isReached);
  const leads = s.contacts.filter((c) => within(c.createdAt, from, to));
  const lost = s.contacts.filter((c) => c.stage === 'lost' && within(lostAt(c), from, to));
  const rdvDone = s.appointments.filter((a) => a.status === 'done' && within(a.start, from, to));
  const rdvSet = s.activities.filter((a) => a.type === 'call' && a.outcome === 'yes' && within(a.at, from, to));
  return {
    revenue: sum(won, (c) => c.value), won: won.length, avgDeal: won.length ? sum(won, (c) => c.value) / won.length : 0,
    cashed: sum(paidIn(s, from, to), (i) => i.amount), leads: leads.length, lost: lost.length,
    calls: calls.length, reached: reached.length, reach: pct(reached.length, calls.length),
    rdvDone: rdvDone.length, rdvSet: rdvSet.length, winRate: pct(won.length, won.length + lost.length),
  };
}

/** n derniers mois (le dernier = mois en cours) */
export function monthlySeries(s, n = 24) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const y = now.getFullYear(); const m = now.getMonth() - (n - 1 - i);
    const from = monthStart(y, m); const to = monthStart(y, m + 1);
    const d = new Date(from);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, month: d.getMonth(), year: d.getFullYear(), from, to, current: i === n - 1, ...periodTotals(s, from, to) };
  });
}

/** Comparaisons « à date » : mois en cours vs même nombre de jours du mois dernier et de l'an dernier ; année vs année */
export function comparisons(s) {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth(); const day = now.getDate();
  const cut = (yy, mm) => Math.min(new Date(yy, mm, day + 1).getTime(), monthStart(yy, mm + 1));
  const mtd = periodTotals(s, monthStart(y, m), now.getTime() + 1);
  const prevMtd = periodTotals(s, monthStart(y, m - 1), cut(y, m - 1));
  const lyMtd = periodTotals(s, monthStart(y - 1, m), cut(y - 1, m));
  const prevFull = periodTotals(s, monthStart(y, m - 1), monthStart(y, m));
  const ytd = periodTotals(s, monthStart(y, 0), now.getTime() + 1);
  const lyYtd = periodTotals(s, monthStart(y - 1, 0), new Date(y - 1, m, day + 1).getTime());
  const lyFull = periodTotals(s, monthStart(y - 1, 0), monthStart(y, 0));
  return { mtd, prevMtd, lyMtd, prevFull, ytd, lyYtd, lyFull, year: y, month: m };
}

/** Tableau mois par mois de l'année en cours et de l'année précédente */
export function yearOverYear(s) {
  const y = new Date().getFullYear();
  return MONTHS_FR.map((label, m) => {
    const cur = periodTotals(s, monthStart(y, m), monthStart(y, m + 1));
    const prev = periodTotals(s, monthStart(y - 1, m), monthStart(y - 1, m + 1));
    return { m, label, cur, prev, future: monthStart(y, m) > Date.now() };
  });
}

/* ---------- Probabilités par étape (apprises sur les dossiers clos) ---------- */
export function stageProbabilities(s) {
  const closed = s.contacts.filter((c) => c.stage === 'won' || c.stage === 'lost');
  return PIPELINE_STAGES.map((st, i) => {
    const reached = closed.filter((c) => reachedIndex(c) >= i);
    const won = reached.filter((c) => c.stage === 'won').length;
    return { id: st.id, label: st.label, color: st.color, p: st.id === 'won' ? 1 : reached.length >= 5 ? won / reached.length : null, n: reached.length };
  });
}
const cycleDays = (c) => (t(c.wonAt) - t(c.createdAt)) / DAY;

/** Probabilité estimée de signature d'un prospect ouvert (0–1) et explication */
export function dealProbability(s, c, ctx = {}) {
  const probs = ctx.probs || stageProbabilities(s);
  const idx = Math.max(0, reachedIndex(c));
  let p = probs[idx]?.p ?? (c.probability ? c.probability / 100 : 0.15);
  const why = [`étape « ${probs[idx]?.label || c.stage} » : ${Math.round(p * 100)} % de signature constatée`];
  const src = ctx.sources?.find((x) => x.source === (c.source || 'Autre'));
  if (src && src.closed >= 8 && ctx.globalWin) {
    const f = Math.max(0.6, Math.min(1.5, src.winRate / ctx.globalWin));
    if (Math.abs(f - 1) > 0.12) why.push(`source ${c.source} ${f > 1 ? 'plus' : 'moins'} performante (×${f.toFixed(1)})`);
    p *= f;
  }
  const idle = c.lastContactAt ? (Date.now() - t(c.lastContactAt)) / DAY : (Date.now() - t(c.createdAt)) / DAY;
  if (idle > 21) { p *= 0.55; why.push(`aucun échange depuis ${Math.round(idle)} j`); } else if (idle > 10) { p *= 0.8; why.push(`${Math.round(idle)} j sans échange`); }
  const rdv = s.appointments.filter((a) => a.contactId === c.id);
  if (rdv.some((a) => a.evaluation === 'positive')) { p *= 1.25; why.push('RDV jugé positif'); }
  if (rdv.some((a) => a.evaluation === 'negative')) { p *= 0.6; why.push('RDV jugé négatif'); }
  if (rdv.some((a) => a.status === 'planned')) { p *= 1.1; why.push('RDV planifié'); }
  if ((c.noAnswerCount || 0) >= 3) { p *= 0.7; why.push(`${c.noAnswerCount} appels sans réponse`); }
  return { p: Math.max(0.01, Math.min(0.97, p)), why };
}

/* ---------- Prévisions ---------- */
function regression(ys) {
  const n = ys.length; if (n < 2) return { a: ys[0] || 0, b: 0 };
  const xs = ys.map((_, i) => i); const mx = avg(xs); const my = avg(ys);
  const b = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / (sum(xs.map((x) => (x - mx) ** 2)) || 1);
  return { a: my - b * mx, b };
}

export function forecast(s, horizon = 3) {
  const series = monthlySeries(s, 25);
  const done = series.slice(0, -1); // mois complets
  const current = series[series.length - 1];
  const history = done.filter((m, i) => i >= done.findIndex((x) => x.revenue > 0) && done.some((x) => x.revenue > 0));
  if (history.length < 4) return { ok: false, reason: 'Pas assez d’historique (4 mois de ventes minimum).', series };

  // Saisonnalité : indice par mois de l'année, lissé vers 1 (moins d'un an d'historique → neutre)
  const mean = avg(history.map((m) => m.revenue)) || 1;
  const season = Array.from({ length: 12 }, (_, mo) => {
    const xs = history.filter((m) => m.month === mo).map((m) => m.revenue);
    if (history.length < 13 || !xs.length) return 1;
    return Math.max(0.5, Math.min(1.8, 0.5 + 0.5 * (avg(xs) / mean)));
  });
  const last12 = history.slice(-12);
  const des = last12.map((m) => m.revenue / season[m.month]);
  const { a, b } = regression(des);
  const fitted = last12.map((m, i) => (a + b * i) * season[m.month]);
  const resid = last12.map((m, i) => m.revenue - fitted[i]);
  const sigma = Math.sqrt(avg(resid.map((r) => r * r)));
  const trendPct = Math.round((b / (avg(des) || 1)) * 100);

  // Pipeline pondéré, réparti selon la durée de cycle observée
  const probs = stageProbabilities(s);
  const won = s.contacts.filter((c) => c.stage === 'won' && c.wonAt);
  const cycle = median(won.map(cycleDays).filter((x) => x >= 0)) || 20;
  const srcs = sourceStats(s); const globalWin = s.contacts.filter((c) => c.stage === 'won').length / (s.contacts.filter((c) => !isOpen(c.stage)).length || 1);
  const open = s.contacts.filter((c) => isOpen(c.stage) && c.value > 0);
  const now = new Date();
  const monthOf = (d) => (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth();
  const pipeByMonth = Array(horizon).fill(0);
  const deals = open.map((c) => {
    const { p, why } = dealProbability(s, c, { probs, sources: srcs, globalWin });
    const age = (Date.now() - t(c.createdAt)) / DAY;
    const close = addDays(now, Math.max(3, Math.round(cycle - age > 3 ? cycle - age : cycle * 0.4)));
    const k = Math.max(0, monthOf(close));
    if (k < horizon) pipeByMonth[k] += c.value * p;
    return { c, p, why, expected: c.value * p, close };
  }).sort((x, y) => y.expected - x.expected);
  const weighted = sum(deals, (d) => d.expected);

  const day = now.getDate(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const months = Array.from({ length: horizon }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    const trend = Math.max(0, (a + b * (last12.length + k)) * season[d.getMonth()]);
    let value; let low; let high;
    if (k === 0) {
      // Reste du mois : tendance, corrigée par ce que le pipeline laisse espérer (plafonné pour éviter les doubles comptes)
      const rest = trend * Math.max(0, (dim - day) / dim);
      value = current.revenue + 0.6 * rest + 0.4 * Math.min(pipeByMonth[0], rest * 2);
      low = current.revenue + Math.max(0, value - current.revenue - sigma * 0.8);
      high = value + sigma * 0.8;
    } else {
      value = 0.75 * trend + 0.25 * (pipeByMonth[k] + trend * 0.6);
      low = Math.max(0, value - 1.28 * sigma); high = value + 1.28 * sigma;
    }
    return { key: d.getMonth(), label: `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`, short: `${MONTHS_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, value, low, high, trend, pipeline: pipeByMonth[k], actual: k === 0 ? current.revenue : 0 };
  });

  // Fin d'année : réalisé + prévision des mois restants
  const y = now.getFullYear();
  const ytd = sum(series.filter((m) => m.year === y), (m) => m.revenue);
  const remaining = Array.from({ length: 11 - now.getMonth() }, (_, k) => Math.max(0, (a + b * (last12.length + k + 1)) * season[(now.getMonth() + k + 1) % 12]));
  const yearEnd = ytd + (months[0].value - current.revenue) + sum(remaining);
  const lastYear = sum(series.filter((m) => m.year === y - 1), (m) => m.revenue) || sum(history.slice(-12), (m) => m.revenue);
  const cv = sigma / (mean || 1);
  const confidence = history.length >= 13 && cv < 0.45 ? 'élevée' : cv < 0.8 ? 'moyenne' : 'faible';

  // Encaissements attendus : échéances à venir × taux d'encaissement observé
  const col = collections(s);
  const cashByMonth = Array.from({ length: horizon }, (_, k) => {
    const from = monthStart(now.getFullYear(), now.getMonth() + k); const to = monthStart(now.getFullYear(), now.getMonth() + k + 1);
    const due = sum(s.contacts.flatMap((c) => (c.schedule || []).filter((i) => i.status !== 'paid' && within(i.due, k === 0 ? Date.now() - 1 : from, to))), (i) => i.amount);
    return { due, expected: due * (col.rate / 100 || 0.85) + (k === 0 ? col.overdue * 0.35 : 0) };
  });

  return { ok: true, series, history, months, weighted, deals, cycle: Math.round(cycle), trendPct, sigma, season, yearEnd, ytd, lastYear, confidence, probs, cashByMonth, seasonal: history.length >= 13 };
}

/* ---------- Encaissements ---------- */
export function collections(s) {
  const today = startOfDay().getTime();
  const items = s.contacts.filter((c) => c.stage === 'won').flatMap((c) => (c.schedule || []).map((i) => ({ ...i, c })));
  const pastDue = items.filter((i) => t(i.due) < today);
  const onTime = pastDue.filter((i) => i.status === 'paid' && t(i.paidAt) - t(i.due) <= 7 * DAY);
  const paidLate = items.filter((i) => i.status === 'paid' && i.paidAt);
  const overdueItems = pastDue.filter((i) => i.status !== 'paid');
  const billed = sum(s.contacts.filter((c) => c.stage === 'won'), (c) => c.value);
  const paid = sum(items.filter((i) => i.status === 'paid'), (i) => i.amount);
  const methods = {};
  items.forEach((i) => { methods[i.method] = (methods[i.method] || 0) + Number(i.amount || 0); });
  return {
    billed, paid, rest: Math.max(0, billed - paid), overdue: sum(overdueItems, (i) => i.amount), overdueItems: overdueItems.sort((a, b) => t(a.due) - t(b.due)),
    rate: pct(onTime.length, pastDue.length), delay: Math.round(avg(paidLate.map((i) => Math.max(0, (t(i.paidAt) - t(i.due)) / DAY)))), methods,
  };
}

/* ---------- Sources ---------- */
export function sourceStats(s, from = 0, to = Infinity) {
  const map = {};
  s.contacts.filter((c) => within(c.createdAt, from, to)).forEach((c) => {
    const k = c.source || 'Autre';
    const x = map[k] || (map[k] = { source: k, leads: 0, won: 0, lost: 0, revenue: 0 });
    x.leads++;
    if (c.stage === 'won') { x.won++; x.revenue += c.value || 0; }
    if (c.stage === 'lost') x.lost++;
  });
  return Object.values(map).map((x) => ({ ...x, closed: x.won + x.lost, winRate: (x.won + x.lost) ? x.won / (x.won + x.lost) : 0 })).sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);
}

/* ---------- Équipe ---------- */
export function teamStats(s, from, to, users = s.users) {
  const goal = s.settings.dailyCallGoal || 40;
  const days = workDaysBetween(new Date(from), new Date(Math.min(to, Date.now())));
  const rows = users.filter((u) => u.active !== false).map((u) => {
    const mine = s.contacts.filter((c) => c.ownerId === u.id);
    const calls = s.activities.filter((a) => a.type === 'call' && a.userId === u.id && within(a.at, from, to));
    const reached = calls.filter(isReached);
    const set = calls.filter((a) => a.outcome === 'yes').length;
    const won = mine.filter((c) => c.stage === 'won' && within(c.wonAt, from, to));
    const lost = mine.filter((c) => c.stage === 'lost' && within(lostAt(c), from, to));
    const leads = mine.filter((c) => within(c.createdAt, from, to));
    const rdv = s.appointments.filter((a) => a.ownerId === u.id && a.status === 'done' && within(a.start, from, to));
    const firstCalls = leads.map((c) => {
      const f = s.activities.filter((a) => a.type === 'call' && a.contactId === c.id).sort((a, b) => t(a.at) - t(b.at))[0];
      return f ? Math.max(0, (t(f.at) - t(c.createdAt)) / 36e5) : null;
    }).filter((x) => x !== null);
    const openTasks = s.tasks.filter((x) => x.ownerId === u.id && !x.done);
    const late = openTasks.filter((x) => t(x.due) < startOfDay().getTime());
    const revenue = sum(won, (c) => c.value);
    return {
      u, leads: leads.length, calls: calls.length, callsPerDay: calls.length / days, reach: pct(reached.length, calls.length), rdvSet: set,
      rdvRate: pct(set, reached.length), rdvDone: rdv.length, won: won.length, lost: lost.length, winRate: pct(won.length, won.length + lost.length),
      revenue, avgDeal: won.length ? revenue / won.length : 0, cycle: won.length ? Math.round(avg(won.map(cycleDays))) : null,
      response: median(firstCalls), lateTasks: late.length, followUp: openTasks.length ? 100 - pct(late.length, openTasks.length) : 100,
      callsPerWin: won.length ? Math.round(calls.length / won.length) : null,
    };
  }).filter((r) => r.calls || r.leads || r.won || r.lost);
  const teamWin = avg(rows.filter((r) => r.won + r.lost).map((r) => r.winRate)) || 1;
  rows.forEach((r) => {
    const c = {
      reach: Math.min(1, r.reach / 70), activity: Math.min(1, r.callsPerDay / goal), rdv: Math.min(1, r.rdvRate / 35),
      win: Math.min(1, r.winRate / (teamWin * 1.5)), speed: r.response === null ? 0.5 : Math.max(0, Math.min(1, 1 - (r.response - 2) / 46)), follow: r.followUp / 100,
    };
    r.parts = c;
    r.score = Math.round(100 * (0.2 * c.reach + 0.15 * c.activity + 0.15 * c.rdv + 0.3 * c.win + 0.1 * c.speed + 0.1 * c.follow));
  });
  return rows.sort((a, b) => b.score - a.score);
}

/* ---------- Produits et types : performance et recommandations ---------- */
export function productStats(s) {
  const now = Date.now();
  const m12 = addDays(new Date(), -365).getTime(); const m24 = addDays(new Date(), -730).getTime();
  const m6 = addDays(new Date(), -182).getTime();
  const totalRev12 = sum(s.contacts.filter((c) => c.stage === 'won' && t(c.wonAt) >= m12), (c) => c.value) || 1;
  const analyse = (filter, meta) => {
    const cs = s.contacts.filter(filter);
    const won = cs.filter((c) => c.stage === 'won');
    const lost = cs.filter((c) => c.stage === 'lost');
    const rev = (from, to) => sum(won.filter((c) => within(c.wonAt, from, to)), (c) => c.value);
    const rev12 = rev(m12, now + 1); const revPrev12 = rev(m24, m12);
    const rev6 = rev(m6, now + 1); const revPrev6 = rev(m12, m6);
    const leads6 = cs.filter((c) => t(c.createdAt) >= m6).length; const leadsPrev6 = cs.filter((c) => within(c.createdAt, m12, m6)).length;
    const closed12 = [...won.filter((c) => t(c.wonAt) >= m12), ...lost.filter((c) => t(lostAt(c)) >= m12)];
    const winRate = pct(closed12.filter((c) => c.stage === 'won').length, closed12.length);
    const reasons = {}; lost.filter((c) => t(lostAt(c)) >= m12).forEach((c) => { reasons[c.lostReason || 'Autre'] = (reasons[c.lostReason || 'Autre'] || 0) + 1; });
    const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
    const lastSale = won.map((c) => t(c.wonAt)).sort((a, b) => b - a)[0] || null;
    const items = won.flatMap((c) => c.schedule || []);
    const paid = sum(items.filter((i) => i.status === 'paid'), (i) => i.amount);
    const billed = sum(won, (c) => c.value);
    return {
      ...meta, leads: cs.length, open: cs.filter((c) => isOpen(c.stage)).length, won12: won.filter((c) => t(c.wonAt) >= m12).length,
      rev12, revPrev12, rev6, revPrev6, g6: growth(rev6, revPrev6), yoy: growth(rev12, revPrev12), leads6, leadsPrev6, gLeads: growth(leads6, leadsPrev6),
      winRate, share: Math.round((rev12 / totalRev12) * 1000) / 10, cycle: won.length ? Math.round(avg(won.map(cycleDays))) : null,
      topReason: topReason ? { label: topReason[0], n: topReason[1], share: pct(topReason[1], lost.filter((c) => t(lostAt(c)) >= m12).length) } : null,
      lastSale, collect: pct(paid, billed), monthly: Array.from({ length: 12 }, (_, i) => { const d = new Date(); return rev(monthStart(d.getFullYear(), d.getMonth() - 11 + i), monthStart(d.getFullYear(), d.getMonth() - 10 + i)); }),
    };
  };
  const products = (s.catalog || []).map((p) => analyse((c) => c.courseId === p.id, { id: p.id, name: p.name, typeId: p.typeId, category: p.category, price: p.price, active: p.active !== false }));
  const types = (s.productTypes || []).map((ty) => analyse((c) => (s.catalog || []).find((p) => p.id === c.courseId)?.typeId === ty.id || (!c.courseId && c.productTypeId === ty.id), { id: ty.id, name: ty.many, isType: true }));
  const classify = (list) => {
    const live = list.filter((x) => x.leads > 0);
    const avgShare = 100 / Math.max(1, live.length);
    const avgWin = avg(live.filter((x) => x.won12 + x.winRate).map((x) => x.winRate)) || 25;
    list.forEach((x) => {
      const reasons = [];
      const noSale6 = !x.lastSale || x.lastSale < m6;
      if (x.leads === 0) { x.verdict = { id: 'new', label: 'Sans données', tone: 'gray', action: 'Lancer une première campagne pour le tester' }; x.reasons = ['Aucun prospect pour l’instant']; x.score = 50; return; }
      reasons.push(`${x.share} % du CA des 12 derniers mois`);
      if (x.revPrev6 || x.rev6) reasons.push(`CA des 6 derniers mois ${x.g6 >= 0 ? '+' : ''}${x.g6} % vs les 6 précédents`);
      reasons.push(`taux de signature ${x.winRate} % (moyenne ${Math.round(avgWin)} %)`);
      if (x.gLeads && (x.leads6 + x.leadsPrev6) >= 4) reasons.push(`demande (leads) ${x.gLeads >= 0 ? '+' : ''}${x.gLeads} % sur 6 mois`);
      if (x.topReason && x.topReason.share >= 35) reasons.push(`motif de perte n°1 : ${x.topReason.label} (${x.topReason.share} %)`);
      const big = x.share >= avgShare * 0.7; const up = x.g6 >= 5; const down = x.g6 <= -15;
      const goodWin = x.winRate >= avgWin;
      // Score de santé 0–100 : poids, dynamique, efficacité commerciale, demande
      x.score = Math.round(Math.max(0, Math.min(100, 35 * Math.min(1, x.share / (avgShare * 1.5)) + 25 * Math.max(0, Math.min(1, (x.g6 + 50) / 100)) + 25 * Math.min(1, x.winRate / (avgWin * 1.4)) + 15 * Math.max(0, Math.min(1, (x.gLeads + 50) / 100)))));
      if (noSale6 && x.leads6 <= 2) x.verdict = { id: 'drop', label: 'À éliminer', tone: 'red', action: 'Plus de ventes ni de demande : retirer de l’offre ou le remplacer' };
      else if (!big && down && !goodWin) x.verdict = { id: 'drop', label: 'À éliminer', tone: 'red', action: 'Petit, en recul et peu transformé : arrêter ou refondre l’offre' };
      else if (big && (up || !down)) x.verdict = { id: 'star', label: big && up ? 'Star — à développer' : 'Pilier — à garder', tone: 'green', action: up ? 'Augmenter le budget pub et ouvrir des sessions/capacités' : 'Garder, protéger les marges et fidéliser' };
      else if (big && down) x.verdict = { id: 'watch', label: 'Pilier en recul', tone: 'orange', action: 'Garder mais analyser la baisse (prix, concurrence, saison)' };
      else if ((up || goodWin) && !down) x.verdict = { id: 'grow', label: 'Potentiel — à pousser', tone: 'violet', action: goodWin ? 'Bonne transformation : générer plus de leads' : 'Demande en hausse : travailler le discours et la conversion' };
      else x.verdict = { id: 'review', label: 'À revoir', tone: 'orange', action: x.topReason ? `Corriger le frein principal : ${x.topReason.label.toLowerCase()}` : 'Revoir le prix, le contenu ou le ciblage' };
      x.reasons = reasons;
    });
    return list.sort((a, b) => b.rev12 - a.rev12 || b.leads - a.leads);
  };
  return { products: classify(products), types: classify(types) };
}

/* ---------- Prospects chauds / à risque ---------- */
export function opportunityRadar(s, limit = 6) {
  const probs = stageProbabilities(s); const sources = sourceStats(s);
  const globalWin = s.contacts.filter((c) => c.stage === 'won').length / (s.contacts.filter((c) => !isOpen(c.stage)).length || 1);
  const open = s.contacts.filter((c) => isOpen(c.stage)).map((c) => ({ c, ...dealProbability(s, c, { probs, sources, globalWin }) }));
  const hot = [...open].sort((a, b) => b.p * (b.c.value || 1) - a.p * (a.c.value || 1)).slice(0, limit);
  const risk = open.filter((x) => (x.c.value || 0) > 0 && x.why.some((w) => /sans échange|négatif|sans réponse/.test(w))).sort((a, b) => (b.c.value || 0) - (a.c.value || 0)).slice(0, limit);
  return { hot, risk, open };
}

/* ---------- Analyse personnelle (commercial) : uniquement des taux et de l'activité ---------- */
export function personalStats(s, userId, from, to) {
  const calls = s.activities.filter((a) => a.type === 'call' && a.userId === userId && within(a.at, from, to));
  const reached = calls.filter(isReached);
  const set = calls.filter((a) => a.outcome === 'yes').length;
  const mine = s.contacts.filter((c) => c.ownerId === userId);
  const won = mine.filter((c) => c.stage === 'won' && within(c.wonAt, from, to)).length;
  const lost = mine.filter((c) => c.stage === 'lost' && within(lostAt(c), from, to)).length;
  const rdvAll = s.appointments.filter((a) => a.ownerId === userId && within(a.start, from, to) && a.status !== 'cancelled');
  const rdvDone = rdvAll.filter((a) => a.status === 'done');
  const rdvPos = rdvDone.filter((a) => a.evaluation === 'positive').length;
  const leads = mine.filter((c) => within(c.createdAt, from, to));
  const firsts = leads.map((c) => { const f = s.activities.filter((a) => a.type === 'call' && a.contactId === c.id).sort((a, b) => t(a.at) - t(b.at))[0]; return f ? (t(f.at) - t(c.createdAt)) / 36e5 : null; }).filter((x) => x !== null && x >= 0);
  const contacted24 = leads.length ? pct(firsts.filter((h) => h <= 24).length, leads.length) : null;
  const days = workDaysBetween(new Date(from), new Date(Math.min(to, Date.now())));
  const outcomes = {}; calls.forEach((a) => { outcomes[a.outcome || 'other'] = (outcomes[a.outcome || 'other'] || 0) + 1; });
  return {
    calls: calls.length, callsPerDay: Math.round((calls.length / days) * 10) / 10, reach: pct(reached.length, calls.length), rdvRate: pct(set, reached.length),
    showRate: pct(rdvDone.length, rdvAll.filter((a) => t(a.start) < Date.now()).length), rdvPositive: pct(rdvPos, rdvDone.length),
    winRate: won + lost ? pct(won, won + lost) : null, response: median(firsts), contacted24, outcomes, days,
  };
}

/** Taux de décroché par jour et créneau horaire */
export function timeSlots(s, userId, days = 120) {
  const from = addDays(new Date(), -days).getTime();
  const slots = [[8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 21]];
  const grid = Array.from({ length: 6 }, () => slots.map(() => ({ n: 0, r: 0 })));
  s.activities.filter((a) => a.type === 'call' && (!userId || a.userId === userId) && t(a.at) >= from).forEach((a) => {
    const d = new Date(a.at); const wd = (d.getDay() + 6) % 7; if (wd > 5) return;
    const si = slots.findIndex(([x, y]) => d.getHours() >= x && d.getHours() < y); if (si < 0) return;
    grid[wd][si].n++; if (isReached(a)) grid[wd][si].r++;
  });
  const bySlot = slots.map((sl, i) => { const n = sum(grid.map((row) => row[i].n)); const r = sum(grid.map((row) => row[i].r)); return { slot: sl, n, rate: pct(r, n) }; });
  const best = bySlot.filter((x) => x.n >= 5).sort((a, b) => b.rate - a.rate)[0] || null;
  const worst = bySlot.filter((x) => x.n >= 5).sort((a, b) => a.rate - b.rate)[0] || null;
  return { slots, grid, bySlot, best, worst };
}

/** Activité quotidienne (appels / décrochés / RDV fixés) sur n jours */
export function dailyActivity(s, userId, n = 14) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(startOfDay(), i - n + 1); const from = d.getTime(); const to = from + DAY;
    const calls = s.activities.filter((a) => a.type === 'call' && (!userId || a.userId === userId) && within(a.at, from, to));
    return { d, label: `${['di', 'lu', 'ma', 'me', 'je', 've', 'sa'][d.getDay()]} ${d.getDate()}`, calls: calls.length, reached: calls.filter(isReached).length, rdv: calls.filter((a) => a.outcome === 'yes').length, sunday: d.getDay() === 0 };
  });
}

export { startOfMonth };
