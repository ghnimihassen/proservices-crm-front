/* Tableau de bord de la direction (droit « reports.company ») — montants seulement avec « finance.view » */
import { useState } from 'react';
import { Link, useNavigate } from '../../nav';
import { useStore } from '../../store/Store';
import { Avatar } from '../UI';
import Icon from '../Icon';
import { Bars, Spark, Delta, Gauge } from '../Charts';
import AIAssistant, { InsightList } from '../AIAssistant';
import { MonthDetail, UserDetail, ProductDetail, VERDICT_CLS } from './Details';
import { growth, MONTHS_LONG } from '../../store/analytics';
import { switchableTypes, activeTypeId } from '../../store/permissions';
import { courseById } from '../../store/selectors';
import { fMoney } from '../../utils';

export default function Cockpit({ a }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const [month, setMonth] = useState(null);
  const [user, setUser] = useState(null);
  const [prod, setProd] = useState(null);
  const { money, cmp, fc, team, col, radar, series, insights } = a;
  const last12 = series.slice(-12);
  const at = activeTypeId(state); const typeName = at ? switchableTypes(state).find((x) => x.id === at)?.many : null;
  const chart = [
    ...last12.map((m) => ({ label: m.label, a: money ? m.revenue : m.won, b: money ? series.find((x) => x.year === m.year - 1 && x.month === m.month)?.revenue : series.find((x) => x.year === m.year - 1 && x.month === m.month)?.won, ref: m, faded: m.current })),
    ...(money && fc.ok ? fc.months.slice(1).map((f) => ({ label: f.short, a: f.value, low: f.low, high: f.high, forecast: true })) : []),
  ];
  const cur = cmp.mtd; const prev = cmp.prevMtd; const ly = cmp.lyMtd;
  const goTo = (link) => navigate(link);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Cockpit de direction</h1>
          <p>{typeName ? `Activité : ${typeName} · ` : ''}{MONTHS_LONG[cmp.month].replace(/^\w/, (c) => c.toUpperCase())} {cmp.year}, à date — comparaisons au même jour du mois dernier et de l'an dernier.</p>
        </div>
        <Link to="/rapports" className="btn ghost"><Icon name="chart" size={16} />Rapports détaillés</Link>
      </div>

      <section className="kpis" aria-label="Indicateurs clés">
        {money ? (
          <>
            <button className="card kpi dark kpi-btn" onClick={() => setMonth({ year: cmp.year, month: cmp.month })}>
              <div className="lbl">CA du mois (à date)</div>
              <div className="v">{fMoney(cur.revenue)}</div>
              <div className="sm">vs M-1 <Delta value={growth(cur.revenue, prev.revenue)} /> · vs N-1 <Delta value={ly.revenue ? growth(cur.revenue, ly.revenue) : null} /></div>
              <Spark values={series.slice(-12).map((m) => m.revenue)} width={150} color="#C4B5FD" />
            </button>
            <div className="card kpi">
              <span className="kico i-violet"><Icon name="sparkle" size={18} /></span>
              <div className="lbl">Prévision IA</div>
              <div className="v">{fc.ok ? fMoney(fc.months[0].value) : '—'}</div>
              <div className="muted sm">{fc.ok ? `${fMoney(fc.months[0].low)} – ${fMoney(fc.months[0].high)} · confiance ${fc.confidence}` : fc.reason}</div>
              {fc.ok && <div className="muted sm">Fin d'année : <b>{fMoney(fc.yearEnd)}</b> {fc.lastYear ? <Delta value={growth(fc.yearEnd, fc.lastYear)} label="vs l'an dernier" /> : null}</div>}
            </div>
            <div className="card kpi">
              <span className="kico i-green"><Icon name="wallet" size={18} /></span>
              <div className="lbl">Encaissé ce mois</div>
              <div className="v">{fMoney(cur.cashed)}</div>
              <div className="sm">vs M-1 <Delta value={growth(cur.cashed, prev.cashed)} /></div>
              <div className="muted sm">Reste à encaisser {fMoney(col.rest)}</div>
              {col.overdue > 0 && <Link to="/clients?tab=dues" className="sm b" style={{ color: 'var(--red-ink)' }}>{fMoney(col.overdue)} en retard →</Link>}
            </div>
            <div className="card kpi">
              <span className="kico i-orange"><Icon name="pipeline" size={18} /></span>
              <div className="lbl">Pipeline pondéré</div>
              <div className="v">{fMoney(fc.weighted || 0)}</div>
              <div className="muted sm">{radar.open.length} affaires ouvertes · cycle médian {fc.cycle || '—'} j</div>
            </div>
            <div className="card kpi">
              <span className="kico i-blue"><Icon name="target" size={18} /></span>
              <div className="lbl">Taux de signature</div>
              <div className="v">{cur.winRate} %</div>
              <div className="sm">M-1 {prev.winRate} % · N-1 {ly.winRate} %</div>
              <div className="muted sm">Panier moyen {fMoney(cur.avgDeal)} <Delta value={prev.avgDeal ? growth(cur.avgDeal, prev.avgDeal) : null} /></div>
            </div>
          </>
        ) : (
          <>
            <button className="card kpi dark kpi-btn" onClick={() => setMonth({ year: cmp.year, month: cmp.month })}>
              <div className="lbl">Signatures du mois</div><div className="v">{cur.won}</div>
              <div className="sm">vs M-1 <Delta value={growth(cur.won, prev.won)} /> · vs N-1 <Delta value={ly.won ? growth(cur.won, ly.won) : null} /></div>
            </button>
            <div className="card kpi"><div className="lbl">Taux de signature</div><div className="v">{cur.winRate} %</div><div className="sm">M-1 {prev.winRate} % · N-1 {ly.winRate} %</div></div>
            <div className="card kpi"><div className="lbl">Nouveaux leads</div><div className="v">{cur.leads}</div><div className="sm">vs M-1 <Delta value={growth(cur.leads, prev.leads)} /></div></div>
            <div className="card kpi"><div className="lbl">Joignabilité équipe</div><div className="v">{cur.reach} %</div><div className="sm">M-1 {prev.reach} %</div></div>
          </>
        )}
      </section>

      <div className="flexwrap">
        <section className="card pad24 grow3 stack12" aria-label="Évolution mensuelle" style={{ minWidth: 0 }}>
          <div className="card-h" style={{ margin: 0 }}>
            <div><h2>{money ? 'Chiffre d’affaires' : 'Signatures'} : 12 mois vs année précédente</h2><div className="muted sm">{money && fc.ok ? 'Avec la prévision IA des 2 prochains mois (zone orange = fourchette probable)' : 'Même mois de l’année précédente en gris'}</div></div>
            <Link to="/rapports?tab=overview" className="sm b">Comparer mois par mois →</Link>
          </div>
          <Bars data={chart} aLabel={money ? 'CA' : 'Signatures'} bLabel="Année précédente" format={money ? fMoney : (x) => x}
            onSelect={(i) => chart[i].ref && setMonth({ year: chart[i].ref.year, month: chart[i].ref.month })} />
        </section>
        <section className="card pad24 grow1 stack12" aria-label="Analyse IA" style={{ minWidth: 300 }}>
          <div className="card-h" style={{ margin: 0 }}><div className="row gap8"><span className="ico i-violet"><Icon name="sparkle" size={18} /></span><h2>Ce que l'IA a repéré</h2></div></div>
          <InsightList items={insights} limit={6} onNavigate={goTo} />
        </section>
      </div>

      <div className="flexwrap">
        <section className="card grow3" aria-label="Efficacité de l'équipe" style={{ minWidth: 0 }}>
          <div className="card-h" style={{ padding: '18px 20px 0' }}><div><h2>Efficacité de l'équipe commerciale</h2><div className="muted sm">90 derniers jours · score IA sur 100 (joignabilité, volume, RDV, signature, rapidité, relances) · cliquez pour le détail</div></div><Link to="/rapports?tab=equipe" className="sm b">Analyse complète →</Link></div>
          <div className="table-wrap">
            <table className="t click nowrap" style={{ minWidth: 760 }}>
              <thead><tr><th>Commercial</th><th>Score</th><th>Appels/j</th><th>Joignab.</th><th>RDV</th><th>Signature</th><th>1er appel</th>{money && <th style={{ textAlign: 'right' }}>CA signé</th>}</tr></thead>
              <tbody>{team.map((r, i) => (
                <tr key={r.u.id} onClick={() => setUser(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setUser(r)}>
                  <td><span className="row gap8"><span className="rank">{i + 1}</span><Avatar name={r.u.name} size={28} round /><b>{r.u.name}</b></span></td>
                  <td><span className="row gap8"><Gauge value={r.score} size={38} /></span></td>
                  <td>{r.callsPerDay.toFixed(1)}</td><td>{r.reach} %</td><td>{r.rdvRate} %</td><td><b>{r.winRate} %</b> <span className="muted xs">({r.won})</span></td>
                  <td>{r.response === null ? '—' : <span style={{ color: r.response > 12 ? 'var(--red-ink)' : r.response <= 2 ? 'var(--green-ink)' : undefined }}>{Math.round(r.response)} h</span>}</td>
                  {money && <td style={{ textAlign: 'right' }}><b>{fMoney(r.revenue)}</b></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <section className="card pad24 grow1 stack12" aria-label="Recommandations produits" style={{ minWidth: 300 }}>
          <div className="card-h" style={{ margin: 0 }}><h2>Produits : garder ou éliminer ?</h2><Link to="/rapports?tab=produits" className="sm b">Tout voir →</Link></div>
          {a.prod.types.length > 1 && <div className="row wrap gap8">{a.prod.types.map((t) => <button key={t.id} className={`pill ${VERDICT_CLS[t.verdict?.tone]}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => setProd(t)}>{t.name} · {t.verdict?.label}</button>)}</div>}
          {a.prod.products.filter((p) => p.leads > 0).slice(0, 7).map((p) => (
            <button key={p.id} className="prod-row" onClick={() => setProd(p)}>
              <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}><span className="b ell" style={{ display: 'block' }}>{p.name}</span><span className="muted xs">{money ? `${fMoney(p.rev12)} · ` : ''}{p.share} % du CA · <Delta value={p.g6} /></span></span>
              <span className={`pill ${VERDICT_CLS[p.verdict?.tone]}`}>{p.verdict?.label}</span>
            </button>
          ))}
        </section>
      </div>

      <div className="flexwrap">
        <section className="card pad24 grow1 stack12" aria-label="Affaires probables" style={{ minWidth: 300 }}>
          <div className="card-h" style={{ margin: 0 }}><div><h2>Affaires les plus probables</h2><div className="muted sm">Probabilité calculée par l'IA (étape, source, RDV, fraîcheur des échanges)</div></div></div>
          {radar.hot.map((x) => (
            <Link key={x.c.id} to={`/contacts/${x.c.id}`} className="opp">
              <span className="opp-p" style={{ '--p': Math.round(x.p * 100) }}>{Math.round(x.p * 100)}%</span>
              <span style={{ minWidth: 0, flex: 1 }}><b className="ell" style={{ display: 'block' }}>{x.c.org}</b><span className="muted xs ell" style={{ display: 'block' }}>{courseById(state, x.c.courseId)?.name || '—'} · {x.why[0]}</span></span>
              {money && <b className="num sm">{fMoney(x.c.value)}</b>}
            </Link>
          ))}
        </section>
        <section className="card pad24 grow1 stack12" aria-label="Affaires en danger" style={{ minWidth: 300 }}>
          <div className="card-h" style={{ margin: 0 }}><div><h2>Affaires en danger</h2><div className="muted sm">Montant important mais signaux négatifs</div></div></div>
          {radar.risk.length === 0 && <div className="muted sm">Rien à signaler.</div>}
          {radar.risk.map((x) => (
            <Link key={x.c.id} to={`/contacts/${x.c.id}`} className="opp">
              <span className="ico sm i-red"><Icon name="flag" size={16} /></span>
              <span style={{ minWidth: 0, flex: 1 }}><b className="ell" style={{ display: 'block' }}>{x.c.org}</b><span className="muted xs">{x.why.slice(1).join(' · ') || x.why[0]}</span></span>
              {money && <b className="num sm">{fMoney(x.c.value)}</b>}
            </Link>
          ))}
        </section>
        <div className="grow1" style={{ minWidth: 300 }}><AIAssistant bundle={a} compact /></div>
      </div>

      {month && <MonthDetail {...month} money={money} onClose={() => setMonth(null)} />}
      {user && <UserDetail row={user} money={money} onClose={() => setUser(null)} />}
      {prod && <ProductDetail p={prod} money={money} onClose={() => setProd(null)} />}
    </>
  );
}
