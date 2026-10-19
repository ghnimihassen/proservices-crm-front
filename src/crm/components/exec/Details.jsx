/* Fenêtres de détail (« détail du détail ») : un mois, un commercial, un produit */
import { useMemo } from 'react';
import { Link } from '../../nav';
import { useStore } from '../../store/Store';
import { Modal, Avatar } from '../UI';
import { Bars, Spark, Gauge, Delta } from '../Charts';
import { courseById, userById } from '../../store/selectors';
import { MONTHS_LONG, MONTHS_FR, monthStart, lostAt, growth, periodTotals } from '../../store/analytics';
import { fMoney, fDate, pct } from '../../utils';

const within = (d, a, b) => { const x = new Date(d).getTime(); return x >= a && x < b; };

export function MonthDetail({ year, month, money, onClose }) {
  const { state } = useStore();
  const from = monthStart(year, month); const to = monthStart(year, month + 1);
  const d = useMemo(() => {
    const won = state.contacts.filter((c) => c.stage === 'won' && within(c.wonAt, from, to)).sort((a, b) => (b.value || 0) - (a.value || 0));
    const lost = state.contacts.filter((c) => c.stage === 'lost' && within(lostAt(c), from, to));
    const cur = periodTotals(state, from, to); const prev = periodTotals(state, monthStart(year, month - 1), from); const ly = periodTotals(state, monthStart(year - 1, month), monthStart(year - 1, month + 1));
    const byProduct = {}; won.forEach((c) => { const k = courseById(state, c.courseId)?.name || 'Sans produit'; byProduct[k] = byProduct[k] || { n: 0, v: 0 }; byProduct[k].n++; byProduct[k].v += c.value || 0; });
    const byUser = {}; won.forEach((c) => { const k = c.ownerId; byUser[k] = byUser[k] || { n: 0, v: 0 }; byUser[k].n++; byUser[k].v += c.value || 0; });
    const reasons = {}; lost.forEach((c) => { reasons[c.lostReason || 'Autre'] = (reasons[c.lostReason || 'Autre'] || 0) + 1; });
    return { won, lost, cur, prev, ly, byProduct: Object.entries(byProduct).sort((a, b) => b[1].v - a[1].v), byUser: Object.entries(byUser).sort((a, b) => b[1].v - a[1].v), reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]) };
  }, [state, from, to, year, month]);
  const k = (label, cur, prev, ly, f = (x) => x) => (
    <div className="mini-kpi"><span className="muted xs">{label}</span><b>{f(cur)}</b><span className="xs">vs M-1 <Delta value={growth(cur, prev)} /> · vs N-1 <Delta value={ly ? growth(cur, ly) : null} /></span></div>
  );
  return (
    <Modal title={`${MONTHS_LONG[month].replace(/^\w/, (c) => c.toUpperCase())} ${year}`} subtitle="Détail du mois : ventes, pertes, répartition" onClose={onClose} width={900}
      footer={<button className="btn primary" onClick={onClose}>Fermer</button>}>
      <div className="stack16">
        <div className="mini-kpis">
          {money && k('Chiffre d’affaires', d.cur.revenue, d.prev.revenue, d.ly.revenue, fMoney)}
          {k('Signatures', d.cur.won, d.prev.won, d.ly.won)}
          {k('Nouveaux leads', d.cur.leads, d.prev.leads, d.ly.leads)}
          {k('Appels', d.cur.calls, d.prev.calls, d.ly.calls)}
          <div className="mini-kpi"><span className="muted xs">Taux de signature</span><b>{d.cur.winRate} %</b><span className="xs">M-1 : {d.prev.winRate} % · N-1 : {d.ly.winRate} %</span></div>
          {money && k('Encaissé', d.cur.cashed, d.prev.cashed, d.ly.cashed, fMoney)}
        </div>
        <div className="flexwrap">
          <div className="grow1 stack8" style={{ minWidth: 240 }}>
            <h3>Par produit</h3>
            {d.byProduct.length === 0 && <div className="muted sm">Aucune vente.</div>}
            {d.byProduct.map(([n, x]) => <div key={n} className="row between gap8 sm"><span className="ell">{n}</span><b className="num">{x.n}{money ? ` · ${fMoney(x.v)}` : ''}</b></div>)}
          </div>
          <div className="grow1 stack8" style={{ minWidth: 220 }}>
            <h3>Par commercial</h3>
            {d.byUser.map(([u, x]) => <div key={u} className="row between gap8 sm"><span className="row gap8"><Avatar name={userById(state, u)?.name || '?'} size={22} round />{userById(state, u)?.name || '—'}</span><b className="num">{x.n}{money ? ` · ${fMoney(x.v)}` : ''}</b></div>)}
          </div>
          <div className="grow1 stack8" style={{ minWidth: 200 }}>
            <h3>Pertes ({d.lost.length})</h3>
            {d.reasons.map(([r, n]) => <div key={r} className="row between sm"><span>{r}</span><b>{pct(n, d.lost.length)} %</b></div>)}
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 8 }}>Ventes du mois ({d.won.length})</h3>
          <div className="table-wrap" style={{ maxHeight: 280 }}>
            <table className="t" style={{ minWidth: 560 }}>
              <thead><tr><th>Client</th><th>Produit</th><th>Commercial</th><th>Date</th>{money && <th style={{ textAlign: 'right' }}>Montant</th>}</tr></thead>
              <tbody>{d.won.map((c) => (
                <tr key={c.id}><td><Link to={`/contacts/${c.id}`} className="b" onClick={onClose}>{c.org}</Link><br /><span className="muted xs">{c.source}</span></td><td className="sm">{courseById(state, c.courseId)?.name || '—'}</td><td className="sm">{userById(state, c.ownerId)?.name || '—'}</td><td className="sm">{fDate(c.wonAt)}</td>{money && <td style={{ textAlign: 'right' }}><b>{fMoney(c.value)}</b></td>}</tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const PARTS = [['reach', 'Joignabilité', 20], ['activity', 'Volume d’appels', 15], ['rdv', 'Prise de RDV', 15], ['win', 'Signature', 30], ['speed', 'Rapidité 1er appel', 10], ['follow', 'Relances à jour', 10]];
export function UserDetail({ row, money, onClose }) {
  const { state } = useStore();
  const m = useMemo(() => {
    const d = new Date();
    return Array.from({ length: 12 }, (_, i) => { const from = monthStart(d.getFullYear(), d.getMonth() - 11 + i); const to = monthStart(d.getFullYear(), d.getMonth() - 10 + i);
      const won = state.contacts.filter((c) => c.ownerId === row.u.id && c.stage === 'won' && within(c.wonAt, from, to));
      const calls = state.activities.filter((a) => a.type === 'call' && a.userId === row.u.id && within(a.at, from, to)).length;
      return { label: MONTHS_FR[new Date(from).getMonth()], a: money ? won.reduce((s, c) => s + (c.value || 0), 0) : won.length, line: calls };
    });
  }, [state, row, money]);
  const prods = useMemo(() => {
    const map = {}; state.contacts.filter((c) => c.ownerId === row.u.id && c.stage === 'won').forEach((c) => { const n = courseById(state, c.courseId)?.name || '—'; map[n] = (map[n] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [state, row]);
  return (
    <Modal title={row.u.name} subtitle={`${row.u.role || ''} · 90 derniers jours`} onClose={onClose} width={860} footer={<button className="btn primary" onClick={onClose}>Fermer</button>}>
      <div className="stack16">
        <div className="row wrap gap16" style={{ alignItems: 'center' }}>
          <Gauge value={row.score} size={86} label="Score d’efficacité" />
          <div className="mini-kpis grow1">
            <div className="mini-kpi"><span className="muted xs">Appels / jour</span><b>{row.callsPerDay.toFixed(1)}</b></div>
            <div className="mini-kpi"><span className="muted xs">Joignabilité</span><b>{row.reach} %</b></div>
            <div className="mini-kpi"><span className="muted xs">Prise de RDV</span><b>{row.rdvRate} %</b></div>
            <div className="mini-kpi"><span className="muted xs">Signature</span><b>{row.winRate} %</b></div>
            <div className="mini-kpi"><span className="muted xs">1er appel (médiane)</span><b>{row.response === null ? '—' : `${Math.round(row.response)} h`}</b></div>
            <div className="mini-kpi"><span className="muted xs">Cycle de vente</span><b>{row.cycle === null ? '—' : `${row.cycle} j`}</b></div>
            {money && <div className="mini-kpi"><span className="muted xs">CA signé</span><b>{fMoney(row.revenue)}</b></div>}
            {money && <div className="mini-kpi"><span className="muted xs">Panier moyen</span><b>{fMoney(row.avgDeal)}</b></div>}
          </div>
        </div>
        <div className="flexwrap">
          <div className="grow1 stack8" style={{ minWidth: 260 }}>
            <h3>Composition du score</h3>
            {PARTS.map(([k, l, w]) => (
              <div key={k} className="hbar" style={{ gridTemplateColumns: '140px 1fr 52px' }}>
                <span className="sm">{l} <span className="muted xs">({w} %)</span></span>
                <span className="track"><span style={{ width: `${Math.round(row.parts[k] * 100)}%`, background: row.parts[k] >= 0.7 ? 'var(--green)' : row.parts[k] >= 0.45 ? 'var(--accent)' : 'var(--red)' }} /></span>
                <b className="sm" style={{ textAlign: 'right' }}>{Math.round(row.parts[k] * 100)}</b>
              </div>
            ))}
          </div>
          <div className="grow1 stack8" style={{ minWidth: 200 }}>
            <h3>Produits les plus vendus</h3>
            {prods.length === 0 && <div className="muted sm">Aucune vente.</div>}
            {prods.map(([n, c]) => <div key={n} className="row between sm"><span className="ell">{n}</span><b>{c}</b></div>)}
            <div className="muted xs">Relances en retard : <b>{row.lateTasks}</b> · appels par signature : <b>{row.callsPerWin ?? '—'}</b></div>
          </div>
        </div>
        <div><h3 style={{ marginBottom: 6 }}>12 derniers mois</h3><Bars data={m} aLabel={money ? 'CA signé' : 'Signatures'} lineLabel="Appels" format={money ? fMoney : (x) => x} height={190} /></div>
      </div>
    </Modal>
  );
}

export const VERDICT_CLS = { green: 'p-green', red: 'p-red', orange: 'p-orange', violet: 'p-violet', gray: 'p-gray' };
export function ProductDetail({ p, money, onClose }) {
  const d = new Date();
  const data = p.monthly.map((v, i) => ({ label: MONTHS_FR[new Date(d.getFullYear(), d.getMonth() - 11 + i, 1).getMonth()], a: v }));
  return (
    <Modal title={p.name} subtitle={p.isType ? 'Type de produit' : `${p.category || ''}${p.price && money ? ` · ${fMoney(p.price)}` : ''}`} onClose={onClose} width={820} footer={<button className="btn primary" onClick={onClose}>Fermer</button>}>
      <div className="stack16">
        <div className="alert" style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Gauge value={p.score ?? 50} size={64} label="Score de santé" />
          <div style={{ flex: 1, minWidth: 200 }}><span className={`pill ${VERDICT_CLS[p.verdict?.tone]}`}>{p.verdict?.label}</span><div className="b" style={{ marginTop: 6 }}>Recommandation IA : {p.verdict?.action}</div>
            <ul className="sm muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{(p.reasons || []).map((r) => <li key={r}>{r}</li>)}</ul></div>
        </div>
        <div className="mini-kpis">
          {money && <div className="mini-kpi"><span className="muted xs">CA 12 mois</span><b>{fMoney(p.rev12)}</b><span className="xs">vs 12 mois précédents <Delta value={p.revPrev12 ? p.yoy : null} /></span></div>}
          <div className="mini-kpi"><span className="muted xs">Part du CA</span><b>{p.share} %</b></div>
          <div className="mini-kpi"><span className="muted xs">Dynamique 6 mois</span><b><Delta value={p.g6} /></b></div>
          <div className="mini-kpi"><span className="muted xs">Demande (leads 6 mois)</span><b>{p.leads6}</b><span className="xs"><Delta value={p.gLeads} /></span></div>
          <div className="mini-kpi"><span className="muted xs">Taux de signature</span><b>{p.winRate} %</b></div>
          <div className="mini-kpi"><span className="muted xs">Cycle moyen</span><b>{p.cycle === null ? '—' : `${p.cycle} j`}</b></div>
          {money && <div className="mini-kpi"><span className="muted xs">Encaissement</span><b>{p.collect} %</b></div>}
          <div className="mini-kpi"><span className="muted xs">Dernière vente</span><b>{p.lastSale ? fDate(p.lastSale) : '—'}</b></div>
        </div>
        {p.topReason && <div className="sm">Motif de perte principal : <b>{p.topReason.label}</b> ({p.topReason.share} % des pertes sur 12 mois)</div>}
        {money && <div><h3 style={{ marginBottom: 6 }}>CA mensuel sur 12 mois</h3><Bars data={data} aLabel="CA signé" format={fMoney} height={180} /></div>}
        {!money && <div className="row gap8"><span className="muted sm">Tendance des ventes</span><Spark values={p.monthly} width={220} height={40} /></div>}
      </div>
    </Modal>
  );
}
