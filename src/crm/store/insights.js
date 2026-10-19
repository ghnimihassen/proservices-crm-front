/*
 * « IA » du CRM : transforme les analyses en constats, alertes et recommandations rédigés.
 * - executiveInsights : pour la direction (peut inclure l'argent si `money` est vrai)
 * - salesCoaching     : pour un commercial (uniquement taux et activité, jamais de montants ni de volumes globaux)
 * - answerLocally     : répond aux questions posées à l'assistant quand aucun modèle d'IA externe n'est branché
 */
import { fMoney } from '../utils';
import { MONTHS_LONG, growth } from './analytics';

const sign = (n) => `${n > 0 ? '+' : ''}${n} %`;
const first = (u) => u?.name?.split(' ')[0] || '';

export function executiveInsights({ cmp, fc, team, prod, col, src, radar, money }) {
  const out = [];
  const v = (n) => (money ? fMoney(n) : '');
  // Chiffre d'affaires à date
  if (money) {
    const g = growth(cmp.mtd.revenue, cmp.prevMtd.revenue);
    const gy = growth(cmp.mtd.revenue, cmp.lyMtd.revenue);
    out.push({ tone: g >= 0 ? 'good' : 'bad', icon: 'chart', title: `CA du mois ${sign(g)} vs le mois dernier à date`,
      text: `${v(cmp.mtd.revenue)} signés depuis le 1er ${MONTHS_LONG[cmp.month]}, contre ${v(cmp.prevMtd.revenue)} à la même date le mois dernier${cmp.lyMtd.revenue ? ` et ${v(cmp.lyMtd.revenue)} l'an dernier (${sign(gy)})` : ''}.` });
    const gytd = growth(cmp.ytd.revenue, cmp.lyYtd.revenue);
    if (cmp.lyYtd.revenue) out.push({ tone: gytd >= 0 ? 'good' : 'warn', icon: 'calendar', title: `Année ${cmp.year} : ${sign(gytd)} vs ${cmp.year - 1} à date`, text: `${v(cmp.ytd.revenue)} depuis janvier contre ${v(cmp.lyYtd.revenue)} sur la même période de ${cmp.year - 1}.` });
  } else {
    const g = growth(cmp.mtd.won, cmp.prevMtd.won);
    out.push({ tone: g >= 0 ? 'good' : 'bad', icon: 'chart', title: `Signatures du mois ${sign(g)} vs le mois dernier à date`, text: `Taux de signature ${cmp.mtd.winRate} % (mois dernier ${cmp.prevMtd.winRate} %).` });
  }
  // Prévision
  if (fc.ok && money) {
    const m0 = fc.months[0]; const m1 = fc.months[1];
    out.push({ tone: 'info', icon: 'zap', title: `Prévision : ${v(m0.value)} en ${MONTHS_LONG[m0.key]}`, text: `Fourchette ${v(m0.low)} – ${v(m0.high)} (confiance ${fc.confidence}). ${m1 ? `${MONTHS_LONG[m1.key]} : ${v(m1.value)}. ` : ''}Projection fin d'année : ${v(fc.yearEnd)}${fc.lastYear ? ` (${sign(growth(fc.yearEnd, fc.lastYear))} vs l'an dernier)` : ''}.` });
    if (Math.abs(fc.trendPct) >= 2) out.push({ tone: fc.trendPct > 0 ? 'good' : 'warn', icon: fc.trendPct > 0 ? 'up' : 'down', title: `Tendance de fond ${fc.trendPct > 0 ? 'haussière' : 'baissière'} : ${sign(fc.trendPct)} par mois`, text: fc.seasonal ? 'Calculée hors effet saisonnier (comparaison avec les mêmes mois des années précédentes).' : 'Moins de 13 mois d’historique : la saisonnalité n’est pas encore prise en compte.' });
  }
  // Encaissements
  if (money && col.overdue > 0) out.push({ tone: 'bad', icon: 'wallet', title: `${v(col.overdue)} d'échéances en retard`, text: `${col.overdueItems.length} échéance(s) non encaissée(s). Taux d'encaissement à temps : ${col.rate} %, retard moyen ${col.delay} j.`, link: '/clients?tab=dues' });
  // Équipe
  if (team.length >= 2) {
    const best = team[0]; const worst = team[team.length - 1];
    out.push({ tone: 'good', icon: 'star', title: `${first(best.u)} est le plus efficace (score ${best.score}/100)`, text: `Joignabilité ${best.reach} %, signature ${best.winRate} %${best.response !== null ? `, 1er appel en ${Math.round(best.response)} h` : ''}${money ? `, ${v(best.revenue)} signés` : ''}.` });
    if (worst.score < best.score - 15) {
      const weak = Object.entries(worst.parts).sort((a, b) => a[1] - b[1])[0][0];
      const tip = { reach: 'appeler aux créneaux où les prospects décrochent le plus', activity: 'augmenter le volume d’appels quotidien', rdv: 'travailler la proposition de RDV au téléphone', win: 'se faire accompagner sur les RDV et la négociation', speed: 'rappeler les nouveaux leads dans l’heure', follow: 'traiter les relances en retard' }[weak];
      out.push({ tone: 'warn', icon: 'users', title: `${first(worst.u)} : marge de progression (score ${worst.score}/100)`, text: `Point faible principal : ${tip}.` });
    }
    const slow = team.filter((r) => r.response !== null && r.response > 12);
    if (slow.length) out.push({ tone: 'warn', icon: 'clock', title: `Délai de 1er appel trop long pour ${slow.map((r) => first(r.u)).join(', ')}`, text: 'Un lead rappelé dans l’heure signe beaucoup plus souvent qu’un lead rappelé le lendemain.' });
  }
  // Produits
  const drops = prod.products.filter((p) => p.verdict?.id === 'drop');
  const stars = prod.products.filter((p) => p.verdict?.id === 'star');
  if (stars.length) out.push({ tone: 'good', icon: 'star', title: `À développer : ${stars.slice(0, 2).map((p) => p.name).join(', ')}`, text: stars[0].reasons.slice(0, 2).join(' · ') + '.', link: '/rapports?tab=produits' });
  if (drops.length) out.push({ tone: 'bad', icon: 'trash', title: `À éliminer ou revoir : ${drops.map((p) => p.name).join(', ')}`, text: drops[0].reasons.slice(0, 3).join(' · ') + '.', link: '/rapports?tab=produits' });
  // Sources
  const ranked = src.filter((x) => x.closed >= 8).sort((a, b) => b.winRate - a.winRate);
  if (ranked.length >= 3) {
    const b = ranked[0]; const w = ranked[ranked.length - 1];
    out.push({ tone: 'info', icon: 'target', title: `Meilleure source : ${b.source} (${Math.round(b.winRate * 100)} % de signature)`, text: `${w.source} ne transforme que ${Math.round(w.winRate * 100)} % : ${b.winRate > w.winRate * 2 ? 'déplacer une partie du budget publicitaire.' : 'à surveiller.'}` });
  }
  if (radar.risk.length && money) out.push({ tone: 'warn', icon: 'flag', title: `${radar.risk.length} affaire(s) importante(s) en danger`, text: radar.risk.slice(0, 3).map((x) => `${x.c.org} (${fMoney(x.c.value)}, ${x.why[x.why.length - 1]})`).join(' · ') + '.' });
  return out;
}

export function salesCoaching({ me, team, slots, daily, goal }) {
  const out = [];
  if (slots.best) out.push({ tone: 'good', icon: 'clock', title: `Votre meilleur créneau : ${slots.best.slot[0]}h–${slots.best.slot[1]}h`, text: `${slots.best.rate} % de décroché${slots.worst && slots.worst !== slots.best ? `, contre ${slots.worst.rate} % entre ${slots.worst.slot[0]}h et ${slots.worst.slot[1]}h` : ''}. Gardez ce créneau pour vos sessions d'appels.` });
  if (team && me.reach !== undefined) {
    const d = me.reach - team.reach;
    out.push({ tone: d >= 0 ? 'good' : 'warn', icon: 'phone', title: `Joignabilité ${d >= 0 ? 'au-dessus' : 'en dessous'} de la moyenne de l'équipe (${d >= 0 ? '+' : ''}${d} pts)`, text: d >= 0 ? 'Continuez : vos horaires et votre rythme fonctionnent.' : 'Essayez d’appeler davantage à votre meilleur créneau et laissez un message WhatsApp après 2 appels sans réponse.' });
  }
  if (team && me.rdvRate !== undefined && team.rdvRate) {
    const d = me.rdvRate - team.rdvRate;
    if (Math.abs(d) >= 3) out.push({ tone: d >= 0 ? 'good' : 'warn', icon: 'calendar', title: `Prise de RDV ${d >= 0 ? 'meilleure' : 'plus faible'} que la moyenne (${d >= 0 ? '+' : ''}${d} pts)`, text: d >= 0 ? 'Votre discours convainc : proposez systématiquement 2 créneaux précis.' : 'Après la découverte, proposez directement deux créneaux (« mardi 10h ou jeudi 18h ? ») au lieu de demander une disponibilité.' });
  }
  if (me.response !== null && me.response !== undefined) out.push({ tone: me.response <= 2 ? 'good' : me.response <= 12 ? 'info' : 'warn', icon: 'zap', title: `Nouveaux leads rappelés en ${me.response < 1 ? 'moins d’une heure' : `${Math.round(me.response)} h`} (médiane)`, text: me.response <= 2 ? 'Excellent : la rapidité est le 1er facteur de signature.' : 'Objectif : rappeler chaque nouveau lead dans les 2 heures.' });
  const recent = daily.slice(-7).filter((d) => !d.sunday);
  const hit = recent.filter((d) => d.calls >= goal).length;
  out.push({ tone: hit >= 4 ? 'good' : 'info', icon: 'target', title: `Objectif d'appels atteint ${hit} jour(s) sur ${recent.length} cette semaine`, text: hit >= 4 ? 'Belle régularité.' : `Visez ${goal} appels par jour, en 2 sessions de 45 minutes.` });
  if (me.showRate && me.showRate < 75) out.push({ tone: 'warn', icon: 'flag', title: `${100 - me.showRate} % de vos RDV ne se tiennent pas`, text: 'Envoyez un rappel WhatsApp la veille et le matin du RDV.' });
  return out;
}

/* ---------- Assistant : réponses locales (sans modèle externe) ---------- */
const has = (q, ...w) => w.some((x) => q.includes(x));
export function answerLocally(question, b) {
  const q = (question || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const money = b.money;
  if (!b.exec) {
    // Commercial : coaching uniquement
    if (has(q, 'creneau', 'heure', 'quand')) return b.slots.best ? `Votre meilleur créneau d'appel est ${b.slots.best.slot[0]}h–${b.slots.best.slot[1]}h (${b.slots.best.rate} % de décroché).` : 'Pas encore assez d’appels pour identifier votre meilleur créneau.';
    if (has(q, 'ameliorer', 'conseil', 'progress', 'mieux')) return b.coaching.map((c) => `• ${c.title}. ${c.text}`).join('\n');
    if (has(q, 'appeler', 'priorit', 'chaud')) return b.hot.length ? `Prospects à appeler en priorité :\n${b.hot.map((x) => `• ${x.c.org} — ${Math.round(x.p * 100)} % de chances (${x.why[0]})`).join('\n')}` : 'Aucun prospect chaud pour le moment.';
    return 'Je peux vous aider sur : vos meilleurs créneaux d’appel, les prospects à appeler en priorité, et comment améliorer vos taux.';
  }
  if (has(q, 'prevision', 'prevoir', 'prochain', 'fin d', 'projection', 'objectif')) {
    if (!b.fc.ok) return b.fc.reason;
    if (!money) return `Tendance des signatures : ${b.fc.trendPct >= 0 ? 'en hausse' : 'en baisse'}. Les montants ne sont pas visibles avec votre rôle.`;
    return `Prévisions (confiance ${b.fc.confidence}) :\n${b.fc.months.map((m) => `• ${m.label} : ${fMoney(m.value)} (${fMoney(m.low)} – ${fMoney(m.high)})`).join('\n')}\n• Fin ${new Date().getFullYear()} : ${fMoney(b.fc.yearEnd)}${b.fc.lastYear ? ` (${sign(growth(b.fc.yearEnd, b.fc.lastYear))} vs l'an dernier)` : ''}\nMéthode : tendance sur 12 mois, saisonnalité et pipeline pondéré (${fMoney(b.fc.weighted)}).`;
  }
  if (has(q, 'eliminer', 'arreter', 'supprimer', 'garder', 'produit', 'type')) {
    const g = (id) => b.prod.products.filter((p) => p.verdict?.id === id).map((p) => p.name);
    return [`À développer : ${g('star').join(', ') || '—'}`, `À pousser : ${g('grow').join(', ') || '—'}`, `À surveiller / revoir : ${[...g('watch'), ...g('review')].join(', ') || '—'}`, `À éliminer : ${g('drop').join(', ') || 'aucun'}`,
      `Par type : ${b.prod.types.map((ty) => `${ty.name} → ${ty.verdict?.label || '—'}`).join(' · ')}`].join('\n');
  }
  if (has(q, 'equipe', 'commercial', 'meilleur', 'efficac', 'vendeur', 'classement')) return `Classement par score d'efficacité :\n${b.team.map((r, i) => `${i + 1}. ${r.u.name} — ${r.score}/100 · joignabilité ${r.reach} % · signature ${r.winRate} %${money ? ` · ${fMoney(r.revenue)}` : ''}`).join('\n')}`;
  if (has(q, 'compar', 'mois', 'annee', 'an dernier', 'evolution')) {
    const c = b.cmp;
    return money ? `• Ce mois à date : ${fMoney(c.mtd.revenue)} vs ${fMoney(c.prevMtd.revenue)} le mois dernier (${sign(growth(c.mtd.revenue, c.prevMtd.revenue))}) et ${fMoney(c.lyMtd.revenue)} l'an dernier.\n• Depuis janvier : ${fMoney(c.ytd.revenue)} vs ${fMoney(c.lyYtd.revenue)} (${sign(growth(c.ytd.revenue, c.lyYtd.revenue))}).\n• Mois dernier complet : ${fMoney(c.prevFull.revenue)}, ${c.prevFull.won} signatures.`
      : `• Signatures ce mois à date : ${c.mtd.won} vs ${c.prevMtd.won}. • Taux de signature ${c.mtd.winRate} % vs ${c.prevMtd.winRate} %.`;
  }
  if (has(q, 'encaiss', 'retard', 'impaye', 'tresorerie', 'argent', 'cash')) return money ? `Encaissé : ${fMoney(b.col.paid)} sur ${fMoney(b.col.billed)} facturés. Reste ${fMoney(b.col.rest)}, dont ${fMoney(b.col.overdue)} en retard (${b.col.overdueItems.length} échéances). Encaissement à temps : ${b.col.rate} %. Attendu ce mois : ${fMoney(b.fc.cashByMonth?.[0]?.expected || 0)}.` : 'Les montants ne sont pas visibles avec votre rôle.';
  if (has(q, 'source', 'pub', 'canal', 'marketing')) return `Sources par taux de signature :\n${b.src.filter((x) => x.closed >= 5).sort((a, c) => c.winRate - a.winRate).map((x) => `• ${x.source} : ${Math.round(x.winRate * 100)} % (${x.leads} leads${money ? `, ${fMoney(x.revenue)}` : ''})`).join('\n')}`;
  if (has(q, 'risque', 'danger', 'chaud', 'priorit', 'affaire')) return `Affaires les plus probables :\n${b.radar.hot.map((x) => `• ${x.c.org} — ${Math.round(x.p * 100)} %${money ? ` · ${fMoney(x.c.value)}` : ''}`).join('\n')}${b.radar.risk.length ? `\nEn danger :\n${b.radar.risk.map((x) => `• ${x.c.org} — ${x.why[x.why.length - 1]}`).join('\n')}` : ''}`;
  return b.insights.slice(0, 5).map((i) => `• ${i.title}. ${i.text}`).join('\n');
}

/** Contexte résumé envoyé à un modèle d'IA externe (prop `ai`) */
export function aiContext(b) {
  const base = { date: new Date().toISOString().slice(0, 10), role: b.exec ? 'direction' : 'commercial', montantsVisibles: !!b.money };
  if (!b.exec) return { ...base, mesTaux: b.me, coaching: b.coaching.map((c) => c.title) };
  const strip = (o) => (b.money ? o : Object.fromEntries(Object.entries(o).filter(([k]) => !/revenue|rev|cash|value|ca|paid|billed/i.test(k))));
  return {
    ...base,
    mois: b.fc.series?.map((m) => strip({ mois: m.key, revenue: m.revenue, signatures: m.won, leads: m.leads, appels: m.calls, joignabilite: m.reach, cashed: m.cashed })),
    prevision: b.money && b.fc.ok ? b.fc.months.map((m) => ({ mois: m.label, valeur: Math.round(m.value), bas: Math.round(m.low), haut: Math.round(m.high) })) : undefined,
    equipe: b.team.map((r) => strip({ nom: r.u.name, score: r.score, joignabilite: r.reach, signature: r.winRate, rdv: r.rdvRate, delai1erAppelH: r.response, revenue: r.revenue })),
    produits: b.prod.products.map((p) => strip({ produit: p.name, verdict: p.verdict?.label, rev12: p.rev12, partCA: p.share, evol6m: p.g6, signature: p.winRate, demande6m: p.gLeads })),
    sources: b.src.map((x) => strip({ source: x.source, leads: x.leads, signature: Math.round(x.winRate * 100), revenue: x.revenue })),
  };
}
