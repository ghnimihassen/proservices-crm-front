import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '../nav';
import { useStore } from '../store/Store';
import { Avatar } from '../components/UI';
import Icon from '../components/Icon';
import { Bars, Spark, Delta, Gauge } from '../components/Charts';
import AIAssistant, { useAnalytics, InsightList } from '../components/AIAssistant';
import { MonthDetail, UserDetail, ProductDetail, VERDICT_CLS } from '../components/exec/Details';
import { RateCards, ActivityCharts } from '../components/sales/SalesPanel';
import { yearOverYear, teamStats, sourceStats, growth, MONTHS_LONG, lostAt, personalStats } from '../store/analytics';
import { methodLabel, LOST_REASONS, outcomeLabel } from '../store/constants';
import { courseById, userById } from '../store/selectors';
import { addDays, startOfDay, fMoney, fDate, pct } from '../utils';

const TABS = [['overview', 'Vue d’ensemble'], ['previsions', 'Prévisions IA'], ['equipe', 'Équipe'], ['produits', 'Produits & types'], ['sources', 'Sources & pertes'], ['encaissements', 'Encaissements']];

export default function Reports() {
  const a = useAnalytics();
  return a.exec ? <ExecReports a={a} /> : <MyReports a={a} />;
}

/* =================== Direction =================== */
function ExecReports({ a }) {
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter(([k]) => a.money || !['previsions', 'encaissements'].includes(k));
  const tab = tabs.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'overview';
  const setTab = (k) => setParams({ tab: k }, { replace: true });
  return (
    <>
      <div className="page-h">
        <div><h1>Rapports de direction</h1><p>Comparaisons mois / années, prévisions, efficacité de l'équipe et recommandations produits{a.money ? '' : ' (sans montants pour votre rôle)'}.</p></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Rapports">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'overview' && <Overview a={a} />}
      {tab === 'previsions' && <Forecast a={a} />}
      {tab === 'equipe' && <Team a={a} />}
      {tab === 'produits' && <Products a={a} />}
      {tab === 'sources' && <Sources a={a} />}
      {tab === 'encaissements' && <Cash a={a} />}
    </>
  );
}

function Overview({ a }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const [metric, setMetric] = useState(a.money ? 'revenue' : 'won');
  const [month, setMonth] = useState(null);
  const yoy = useMemo(() => yearOverYear(state), [state]);
  const y = new Date().getFullYear();
  const METRICS = [...(a.money ? [['revenue', 'CA signé', fMoney], ['cashed', 'Encaissé', fMoney], ['avgDeal', 'Panier moyen', fMoney]] : []), ['won', 'Signatures', (x) => x], ['leads', 'Nouveaux leads', (x) => x], ['winRate', 'Taux de signature', (x) => `${x} %`], ['calls', 'Appels', (x) => x], ['reach', 'Joignabilité', (x) => `${x} %`]];
  const [, mLabel, fmt] = METRICS.find(([k]) => k === metric) || METRICS[0];
  const chart = yoy.map((r) => ({ label: r.label, a: r.future ? 0 : r.cur[metric], b: r.prev[metric], faded: r.future }));
  const totCur = yoy.filter((r) => !r.future); const n = totCur.length;
  const sumOf = (rows, k, side) => rows.reduce((s, r) => s + (r[side][k] || 0), 0);
  const isRate = ['winRate', 'reach', 'avgDeal'].includes(metric);
  const tc = isRate ? Math.round(sumOf(totCur, metric, 'cur') / Math.max(1, n)) : sumOf(totCur, metric, 'cur');
  const tp = isRate ? Math.round(sumOf(yoy.slice(0, n), metric, 'prev') / Math.max(1, n)) : sumOf(yoy.slice(0, n), metric, 'prev');
  return (
    <>
      <section className="card pad24 stack12" aria-label="Comparaison des années">
        <div className="card-h" style={{ margin: 0 }}>
          <div><h2>{y} vs {y - 1} · {mLabel}</h2><div className="muted sm">Cumul de janvier au mois en cours : <b>{fmt(tc)}</b> contre <b>{fmt(tp)}</b> sur la même période <Delta value={isRate ? tc - tp : growth(tc, tp)} suffix={isRate && metric !== 'avgDeal' ? ' pts' : ' %'} /></div></div>
          <label className="chip on"><span className="sr">Indicateur</span><select value={metric} onChange={(e) => setMetric(e.target.value)}>{METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <Bars data={chart} aLabel={String(y)} bLabel={String(y - 1)} format={fmt} onSelect={(i) => !yoy[i].future && setMonth({ year: y, month: i })} />
      </section>

      <section className="card" aria-label="Mois par mois">
        <div className="card-h" style={{ padding: '18px 20px 0' }}><div><h2>Mois par mois</h2><div className="muted sm">Cliquez sur un mois pour le détail des ventes, pertes et répartitions</div></div></div>
        <div className="table-wrap">
          <table className="t click" style={{ minWidth: 900 }}>
            <thead><tr><th>Mois</th>{a.money && <><th>CA {y}</th><th>CA {y - 1}</th><th>Évol.</th><th>Encaissé</th></>}<th>Signatures</th><th>Évol.</th><th>Leads</th><th>Signature</th><th>Appels</th><th>Joignab.</th></tr></thead>
            <tbody>{yoy.map((r) => (
              <tr key={r.m} onClick={() => !r.future && setMonth({ year: y, month: r.m })} style={r.future ? { opacity: 0.45 } : undefined} tabIndex={r.future ? -1 : 0} onKeyDown={(e) => e.key === 'Enter' && !r.future && setMonth({ year: y, month: r.m })}>
                <td><b>{MONTHS_LONG[r.m].replace(/^\w/, (c) => c.toUpperCase())}</b></td>
                {a.money && <><td><b>{r.future ? '—' : fMoney(r.cur.revenue)}</b></td><td className="muted">{fMoney(r.prev.revenue)}</td><td>{r.future ? '' : <Delta value={r.prev.revenue ? growth(r.cur.revenue, r.prev.revenue) : null} />}</td><td>{r.future ? '—' : fMoney(r.cur.cashed)}</td></>}
                <td>{r.future ? '—' : <b>{r.cur.won}</b>} <span className="muted xs">/ {r.prev.won}</span></td><td>{r.future ? '' : <Delta value={r.prev.won ? growth(r.cur.won, r.prev.won) : null} />}</td>
                <td>{r.future ? '—' : r.cur.leads}</td><td>{r.future ? '—' : `${r.cur.winRate} %`}</td><td>{r.future ? '—' : r.cur.calls}</td><td>{r.future ? '—' : `${r.cur.reach} %`}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <div className="flexwrap">
        <section className="card pad24 grow1 stack12" style={{ minWidth: 300 }} aria-label="Constats IA">
          <div className="row gap8"><span className="ico i-violet"><Icon name="sparkle" size={18} /></span><h2>Constats et recommandations de l'IA</h2></div>
          <InsightList items={a.insights} onNavigate={(l) => navigate(l)} />
        </section>
        <div className="grow1" style={{ minWidth: 300 }}><AIAssistant bundle={a} /></div>
      </div>
      {month && <MonthDetail {...month} money={a.money} onClose={() => setMonth(null)} />}
    </>
  );
}

function Forecast({ a }) {
  const { state } = useStore();
  const fc = a.fc;
  if (!fc.ok) return <div className="card pad24"><b>Prévisions indisponibles</b><div className="muted sm">{fc.reason}</div></div>;
  const hist = fc.series.slice(-13, -1).map((m) => ({ label: m.label, a: m.revenue }));
  const data = [...hist, ...fc.months.map((m, i) => ({ label: m.short, a: m.value, low: m.low, high: m.high, forecast: i > 0, line: i === 0 ? m.actual : undefined }))];
  return (
    <>
      <section className="kpis">
        {fc.months.map((m, i) => (
          <div key={m.label} className={`card kpi${i === 0 ? ' dark' : ''}`}>
            <div className="lbl">{i === 0 ? 'Ce mois (prévision)' : m.label}</div>
            <div className="v">{fMoney(m.value)}</div>
            <div className="sm">{fMoney(m.low)} – {fMoney(m.high)}</div>
            {i === 0 && <div className="sm">Déjà signé : <b>{fMoney(m.actual)}</b></div>}
          </div>
        ))}
        <div className="card kpi"><span className="kico i-violet"><Icon name="sparkle" size={18} /></span><div className="lbl">Projection fin {new Date().getFullYear()}</div><div className="v">{fMoney(fc.yearEnd)}</div><div className="sm">{fc.lastYear ? <>vs {new Date().getFullYear() - 1} : <Delta value={growth(fc.yearEnd, fc.lastYear)} /></> : ''}</div><div className="muted xs">Confiance {fc.confidence}</div></div>
      </section>
      <section className="card pad24 stack12" aria-label="Courbe de prévision">
        <div><h2>Réalisé et prévision</h2><div className="muted sm">12 derniers mois puis prévision (zone orange = fourchette à 80 %). Tendance de fond : <b>{fc.trendPct >= 0 ? '+' : ''}{fc.trendPct} % / mois</b>{fc.seasonal ? ', saisonnalité prise en compte' : ''}.</div></div>
        <Bars data={data} aLabel="CA" lineLabel="Déjà signé ce mois" format={fMoney} />
      </section>
      <div className="flexwrap">
        <section className="card pad24 grow1 stack12" style={{ minWidth: 300 }} aria-label="Méthode">
          <h2>Comment l'IA calcule</h2>
          <ol className="sm stack8" style={{ paddingLeft: 18, margin: 0 }}>
            <li><b>Tendance</b> : régression sur les 12 derniers mois, corrigée de la saisonnalité.</li>
            <li><b>Saisonnalité</b> : chaque mois comparé aux mêmes mois des années précédentes ({fc.seasonal ? 'active' : 'pas encore assez d’historique'}).</li>
            <li><b>Pipeline</b> : chaque affaire ouverte × sa probabilité réelle de signature, placée dans le mois où elle devrait se conclure (cycle médian {fc.cycle} j).</li>
            <li><b>Fourchette</b> : écart observé entre la tendance et le réalisé.</li>
          </ol>
          <h3>Probabilité de signature constatée par étape</h3>
          {fc.probs.filter((p) => p.id !== 'won').map((p) => (
            <div key={p.id} className="hbar" style={{ gridTemplateColumns: '130px 1fr 52px' }}><span className="sm">{p.label}</span><span className="track"><span style={{ width: `${Math.round((p.p || 0) * 100)}%`, background: p.color }} /></span><b className="sm" style={{ textAlign: 'right' }}>{p.p === null ? '—' : `${Math.round(p.p * 100)} %`}</b></div>
          ))}
          <h3>Encaissements attendus</h3>
          {fc.cashByMonth.map((c, i) => <div key={i} className="row between sm"><span>{fc.months[i].label}</span><span>{fMoney(c.due)} d'échéances → <b>{fMoney(c.expected)}</b> attendus</span></div>)}
        </section>
        <section className="card grow2" style={{ minWidth: 0 }} aria-label="Affaires prévues">
          <div className="card-h" style={{ padding: '18px 20px 0' }}><div><h2>Affaires qui composent la prévision</h2><div className="muted sm">Pipeline pondéré : <b>{fMoney(fc.weighted)}</b></div></div></div>
          <div className="table-wrap" style={{ maxHeight: 520 }}>
            <table className="t" style={{ minWidth: 860 }}>
              <thead><tr><th>Prospect</th><th>Produit</th><th>Probabilité</th><th>Signature estimée</th><th style={{ textAlign: 'right' }}>Montant</th><th style={{ textAlign: 'right' }}>Pondéré</th></tr></thead>
              <tbody>{fc.deals.slice(0, 40).map((x) => (
                <tr key={x.c.id}>
                  <td style={{ minWidth: 190 }}><Link to={`/contacts/${x.c.id}`} className="b">{x.c.org}</Link><br /><span className="muted xs">{userById(state, x.c.ownerId)?.name}</span></td>
                  <td className="sm">{courseById(state, x.c.courseId)?.name || '—'}</td>
                  <td title={x.why.join(' · ')}><b>{Math.round(x.p * 100)} %</b><br /><span className="muted xs">{x.why.slice(-1)[0]}</span></td>
                  <td className="sm" style={{ whiteSpace: 'nowrap' }}>{fDate(x.close)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fMoney(x.c.value)}</td><td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><b>{fMoney(x.expected)}</b></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

const PERIODS = [[30, '30 jours'], [90, '90 jours'], [180, '6 mois'], [365, '12 mois']];
function Team({ a }) {
  const { state } = useStore();
  const [days, setDays] = useState(90);
  const [user, setUser] = useState(null);
  const d = useMemo(() => {
    const now = Date.now(); const from = addDays(startOfDay(), -days).getTime(); const prevFrom = addDays(startOfDay(), -2 * days).getTime();
    const cur = teamStats(state, from, now + 1); const prev = teamStats(state, prevFrom, from);
    return cur.map((r) => ({ ...r, prev: prev.find((p) => p.u.id === r.u.id) }));
  }, [state, days]);
  const best = (k, inv) => { const xs = d.filter((r) => r[k] !== null && r.calls > 5); return xs.sort((x, y) => (inv ? x[k] - y[k] : y[k] - x[k]))[0]; };
  const champs = [['reach', 'Meilleure joignabilité', (r) => `${r.reach} %`], ['rdvRate', 'Meilleure prise de RDV', (r) => `${r.rdvRate} %`], ['winRate', 'Meilleur taux de signature', (r) => `${r.winRate} %`], ['response', 'Rappelle le plus vite', (r) => `${Math.round(r.response)} h`, true]];
  return (
    <>
      <div className="row between wrap gap12">
        <div className="muted sm">Score IA = joignabilité 20 % · volume 15 % · prise de RDV 15 % · signature 30 % · rapidité 10 % · relances 10 %</div>
        <div className="seg">{PERIODS.map(([v, l]) => <button key={v} className={days === v ? 'on' : ''} onClick={() => setDays(v)}>{l}</button>)}</div>
      </div>
      <section className="kpis">
        {champs.map(([k, l, f, inv]) => { const r = best(k, inv); return (
          <div key={k} className="card kpi"><span className="kico i-orange"><Icon name="trophy" size={18} /></span><div className="lbl">{l}</div>{r ? <><div className="row gap8"><Avatar name={r.u.name} size={28} round /><b>{r.u.name}</b></div><div className="v" style={{ fontSize: 24 }}>{f(r)}</div></> : <div className="muted">—</div>}</div>
        ); })}
      </section>
      <section className="card" aria-label="Tableau de l'équipe">
        <div className="table-wrap">
          <table className="t click nowrap" style={{ minWidth: 1100 }}>
            <thead><tr><th>Commercial</th><th>Score</th><th>Leads</th><th>Appels/j</th><th>Joignab.</th><th>RDV fixés</th><th>RDV faits</th><th>Signatures</th><th>Signature</th><th>Cycle</th><th>1er appel</th><th>Relances</th>{a.money && <><th>CA</th><th>Panier</th></>}</tr></thead>
            <tbody>{d.map((r) => (
              <tr key={r.u.id} onClick={() => setUser(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setUser(r)}>
                <td><span className="row gap8"><Avatar name={r.u.name} size={28} round /><b>{r.u.name}</b></span></td>
                <td><span className="row gap4"><Gauge value={r.score} size={36} /><Delta value={r.prev ? r.score - r.prev.score : null} suffix="" /></span></td>
                <td>{r.leads}</td><td>{r.callsPerDay.toFixed(1)}</td>
                <td>{r.reach} % <Delta value={r.prev ? r.reach - r.prev.reach : null} suffix="" /></td>
                <td>{r.rdvSet} <span className="muted xs">({r.rdvRate} %)</span></td><td>{r.rdvDone}</td>
                <td><b>{r.won}</b> <span className="muted xs">/ {r.won + r.lost}</span></td>
                <td><b>{r.winRate} %</b> <Delta value={r.prev ? r.winRate - r.prev.winRate : null} suffix="" /></td>
                <td>{r.cycle === null ? '—' : `${r.cycle} j`}</td>
                <td>{r.response === null ? '—' : `${Math.round(r.response)} h`}</td>
                <td>{r.lateTasks ? <span className="pill p-red">{r.lateTasks} en retard</span> : <span className="pill p-green">À jour</span>}</td>
                {a.money && <><td><b>{fMoney(r.revenue)}</b> <Delta value={r.prev?.revenue ? growth(r.revenue, r.prev.revenue) : null} /></td><td>{fMoney(r.avgDeal)}</td></>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {user && <UserDetail row={user} money={a.money} onClose={() => setUser(null)} />}
    </>
  );
}

function Products({ a }) {
  const [p, setP] = useState(null);
  const [filter, setFilter] = useState('');
  const list = a.prod.products.filter((x) => !filter || x.verdict?.id === filter || (filter === 'watch' && x.verdict?.id === 'review'));
  const count = (id) => a.prod.products.filter((x) => x.verdict?.id === id || (id === 'watch' && x.verdict?.id === 'review')).length;
  return (
    <>
      {a.prod.types.length > 0 && (
        <section className="kpis">
          {a.prod.types.map((t) => (
            <button key={t.id} className="card kpi kpi-btn" onClick={() => setP(t)}>
              <div className="row between"><div className="lbl">{t.name}</div><Gauge value={t.score ?? 50} size={46} /></div>
              {a.money && <div className="v" style={{ fontSize: 24 }}>{fMoney(t.rev12)}</div>}
              <div className="sm">{t.share} % du CA · 6 mois <Delta value={t.g6} /> · signature {t.winRate} %</div>
              <span className={`pill ${VERDICT_CLS[t.verdict?.tone]}`} style={{ alignSelf: 'flex-start' }}>{t.verdict?.label}</span>
              <div className="muted xs">{t.verdict?.action}</div>
            </button>
          ))}
        </section>
      )}
      <div className="row wrap gap8">
        {[['', 'Tous'], ['star', 'À développer / garder'], ['grow', 'À pousser'], ['watch', 'À surveiller / revoir'], ['drop', 'À éliminer']].map(([k, l]) => (
          <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{l}{k ? ` (${count(k)})` : ''}</button>
        ))}
      </div>
      <section className="card" aria-label="Produits">
        <div className="table-wrap">
          <table className="t click" style={{ minWidth: 1420 }}>
            <thead><tr><th>Produit</th><th>Tendance 12 mois</th>{a.money && <><th>CA 12 mois</th><th>vs N-1</th></>}<th>Part</th><th>6 mois</th><th>Demande</th><th>Signature</th><th>Cycle</th><th>Frein n°1</th>{a.money && <th>Encaiss.</th>}<th>Santé</th><th>Recommandation IA</th></tr></thead>
            <tbody>{list.map((x) => (
              <tr key={x.id} onClick={() => setP(x)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setP(x)}>
                <td style={{ minWidth: 220 }}><b>{x.name}</b><br /><span className="muted xs">{x.category}{x.active ? '' : ' · inactif'}</span></td>
                <td><Spark values={x.monthly} /></td>
                {a.money && <><td><b>{fMoney(x.rev12)}</b></td><td><Delta value={x.revPrev12 ? x.yoy : null} /></td></>}
                <td>{x.share} %</td><td><Delta value={x.g6} /></td><td>{x.leads6} <Delta value={x.leadsPrev6 ? x.gLeads : null} /></td>
                <td>{x.winRate} %</td><td>{x.cycle === null ? '—' : `${x.cycle} j`}</td>
                <td className="sm" style={{ minWidth: 150 }}>{x.topReason ? `${x.topReason.label} (${x.topReason.share} %)` : '—'}</td>
                {a.money && <td>{x.collect} %</td>}
                <td><Gauge value={x.score ?? 50} size={36} /></td>
                <td style={{ maxWidth: 260 }}><span className={`pill ${VERDICT_CLS[x.verdict?.tone]}`}>{x.verdict?.label}</span><div className="muted xs" style={{ whiteSpace: 'normal', marginTop: 4 }}>{x.verdict?.action}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <div className="muted xs">Règles : « À éliminer » = pas de vente ni de demande depuis 6 mois, ou petit produit en recul et peu transformé. « Star » = forte part du CA et en croissance. Le score de santé combine part du CA (35 %), dynamique (25 %), taux de signature (25 %) et demande (15 %).</div>
      {p && <ProductDetail p={p} money={a.money} onClose={() => setP(null)} />}
    </>
  );
}

function Sources({ a }) {
  const { state } = useStore();
  const [days, setDays] = useState(365);
  const d = useMemo(() => {
    const from = days ? addDays(startOfDay(), -days).getTime() : 0;
    const src = sourceStats(state, from);
    const lost = state.contacts.filter((c) => c.stage === 'lost' && new Date(lostAt(c)).getTime() >= from);
    const reasons = [...LOST_REASONS, 'Autre'].filter((v, i, arr) => arr.indexOf(v) === i).map((l) => ({ l, n: lost.filter((c) => (c.lostReason || 'Autre') === l).length })).filter((x) => x.n).sort((x, y) => y.n - x.n);
    return { src, lost: lost.length, reasons };
  }, [state, days]);
  const maxR = Math.max(1, ...d.reasons.map((x) => x.n));
  return (
    <>
      <div className="row end"><div className="seg">{[[90, '90 jours'], [180, '6 mois'], [365, '12 mois'], [0, 'Tout']].map(([v, l]) => <button key={v} className={days === v ? 'on' : ''} onClick={() => setDays(v)}>{l}</button>)}</div></div>
      <section className="card" aria-label="Sources">
        <div className="card-h" style={{ padding: '18px 20px 0' }}><div><h2>Rentabilité des sources de leads</h2><div className="muted sm">Où investir le budget marketing</div></div></div>
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 760 }}>
            <thead><tr><th>Source</th><th>Leads</th><th>Signatures</th><th>Taux de signature</th>{a.money && <><th>CA</th><th>CA par lead</th></>}</tr></thead>
            <tbody>{d.src.map((x) => (
              <tr key={x.source}><td><b>{x.source}</b></td><td>{x.leads}</td><td>{x.won}</td>
                <td><span className="row gap8"><span className="track" style={{ width: 90, height: 8, background: 'var(--soft)', borderRadius: 99, overflow: 'hidden', display: 'inline-block' }}><span style={{ display: 'block', height: '100%', width: `${Math.round(x.winRate * 100)}%`, background: 'var(--primary)' }} /></span><b>{Math.round(x.winRate * 100)} %</b></span></td>
                {a.money && <><td><b>{fMoney(x.revenue)}</b></td><td>{fMoney(x.leads ? x.revenue / x.leads : 0)}</td></>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="card pad24 stack12" aria-label="Motifs de perte">
        <h2>Motifs de perte <span className="muted" style={{ fontWeight: 500 }}>({d.lost})</span></h2>
        {d.reasons.map((x) => (
          <div key={x.l} className="hbar"><span className="sm">{x.l}</span><span className="track red"><span style={{ width: `${(x.n / maxR) * 100}%` }} /></span><span className="sm" style={{ textAlign: 'right' }}>{pct(x.n, d.lost)} %</span></div>
        ))}
      </section>
    </>
  );
}

function Cash({ a }) {
  const c = a.col;
  const methods = Object.entries(c.methods).sort((x, y) => y[1] - x[1]);
  const totalM = methods.reduce((s, [, v]) => s + v, 0) || 1;
  const series = a.series.slice(-12).map((m) => ({ label: m.label, a: m.cashed, b: m.revenue }));
  return (
    <>
      <section className="kpis">
        <div className="card kpi dark"><div className="lbl">Facturé (ventes signées)</div><div className="v">{fMoney(c.billed)}</div></div>
        <div className="card kpi"><span className="kico i-green"><Icon name="wallet" size={18} /></span><div className="lbl">Encaissé</div><div className="v">{fMoney(c.paid)}</div><div className="bar"><span style={{ width: `${pct(c.paid, c.billed)}%` }} /></div><div className="muted sm">{pct(c.paid, c.billed)} % du facturé</div></div>
        <div className="card kpi"><span className="kico i-orange"><Icon name="clock" size={18} /></span><div className="lbl">Reste à encaisser</div><div className="v">{fMoney(c.rest)}</div></div>
        <div className="card kpi"><span className="kico i-red"><Icon name="flag" size={18} /></span><div className="lbl">En retard</div><div className="v">{fMoney(c.overdue)}</div><div className="muted sm">{c.overdueItems.length} échéance(s)</div></div>
        <div className="card kpi"><div className="lbl">Encaissé à temps</div><div className="v">{c.rate} %</div><div className="muted sm">Retard moyen {c.delay} j</div></div>
      </section>
      <section className="card pad24 stack12"><h2>Encaissé vs signé · 12 mois</h2><Bars data={series} aLabel="Encaissé" bLabel="Signé" format={fMoney} aColor="var(--green)" /></section>
      <div className="flexwrap">
        <section className="card pad24 grow1 stack12" style={{ minWidth: 280 }}>
          <h2>Modes de paiement</h2>
          {methods.map(([m, v]) => <div key={m} className="hbar"><span className="sm">{methodLabel(m)}</span><span className="track"><span style={{ width: `${(v / totalM) * 100}%` }} /></span><span className="sm" style={{ textAlign: 'right' }}>{pct(v, totalM)} %</span></div>)}
        </section>
        <section className="card grow2" style={{ minWidth: 0 }}>
          <div className="card-h" style={{ padding: '18px 20px 0' }}><h2>Échéances en retard</h2><Link to="/clients?tab=dues" className="sm b">Encaisser →</Link></div>
          <div className="table-wrap" style={{ maxHeight: 360 }}>
            <table className="t" style={{ minWidth: 560 }}>
              <thead><tr><th>Client</th><th>Échéance</th><th>Mode</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
              <tbody>{c.overdueItems.map((i) => <tr key={i.id}><td><Link to={`/contacts/${i.c.id}`} className="b">{i.c.org}</Link></td><td><span className="pill p-red">{fDate(i.due)}</span></td><td>{methodLabel(i.method)}</td><td style={{ textAlign: 'right' }}><b>{fMoney(i.amount)}</b></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

/* =================== Commercial : mes performances (sans argent ni volumes de l'entreprise) =================== */
function MyReports({ a }) {
  const { state } = useStore();
  const [days, setDays] = useState(30);
  const me = state.settings.currentUserId;
  const d = useMemo(() => {
    const now = Date.now(); const from = addDays(startOfDay(), -days + 1).getTime(); const prevFrom = addDays(startOfDay(), -2 * days + 1).getTime();
    const cur = personalStats(state, me, from, now + 1); const prev = personalStats(state, me, prevFrom, from);
    // Évolution mensuelle de mes taux sur 6 mois
    const months = Array.from({ length: 6 }, (_, i) => { const dd = new Date(); const f = new Date(dd.getFullYear(), dd.getMonth() - 5 + i, 1).getTime(); const t = new Date(dd.getFullYear(), dd.getMonth() - 4 + i, 1).getTime();
      const s = personalStats(state, me, f, t); return { label: new Date(f).toLocaleDateString('fr-FR', { month: 'short' }), a: s.reach, line: s.rdvRate }; });
    return { cur, prev, months };
  }, [state, me, days]);
  const outs = Object.entries(d.cur.outcomes).sort((x, y) => y[1] - x[1]);
  const totO = outs.reduce((s, [, v]) => s + v, 0) || 1;
  return (
    <>
      <div className="page-h">
        <div><h1>Mes performances</h1><p>Vos taux d'efficacité, vos créneaux et les conseils de l'IA pour progresser.</p></div>
        <div className="seg">{[[7, '7 jours'], [30, '30 jours'], [90, '90 jours']].map(([v, l]) => <button key={v} className={days === v ? 'on' : ''} onClick={() => setDays(v)}>{l}</button>)}</div>
      </div>
      <RateCards cur={d.cur} prev={d.prev} team={a.team} goal={a.goal} />
      <ActivityCharts a={a} />
      <div className="flexwrap">
        <section className="card pad24 grow2 stack12" style={{ minWidth: 0 }}>
          <div><h2>Évolution de mes taux · 6 mois</h2><div className="muted sm">Joignabilité (barres) et prise de RDV (courbe), en %</div></div>
          <Bars data={d.months} aLabel="Joignabilité" lineLabel="Prise de RDV" format={(x) => `${x} %`} height={200} />
        </section>
        <section className="card pad24 grow1 stack12" style={{ minWidth: 280 }}>
          <h2>Résultat de mes appels</h2>
          <div className="muted sm">Sur la période · {d.cur.callsPerDay} appels par jour en moyenne</div>
          {outs.map(([o, n]) => <div key={o} className="hbar" style={{ gridTemplateColumns: '150px 1fr 48px' }}><span className="sm">{outcomeLabel(o)}</span><span className="track"><span style={{ width: `${pct(n, totO)}%`, background: o === 'yes' ? 'var(--green)' : o === 'noanswer' ? 'var(--gray-ink)' : o === 'no' ? 'var(--red)' : 'var(--primary)' }} /></span><b className="sm" style={{ textAlign: 'right' }}>{pct(n, totO)} %</b></div>)}
        </section>
      </div>
      <div className="flexwrap">
        <section className="card pad24 grow1 stack12" style={{ minWidth: 300 }}>
          <div className="row gap8"><span className="ico i-violet"><Icon name="sparkle" size={18} /></span><h2>Coaching IA</h2></div>
          <InsightList items={a.coaching} />
        </section>
        <div className="grow1" style={{ minWidth: 300 }}><AIAssistant bundle={a} /></div>
      </div>
    </>
  );
}
