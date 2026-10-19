/*
 * Indicateurs personnels d'un commercial : uniquement des taux, de l'activité et du coaching.
 * Aucun montant, aucun volume global de prospects ou de clients de l'entreprise.
 */
import { useMemo } from 'react';
import { Link } from '../../nav';
import { useStore } from '../../store/Store';
import Icon from '../Icon';
import { Bars, Heatmap, Delta, Gauge } from '../Charts';
import AIAssistant, { InsightList } from '../AIAssistant';
import { personalStats } from '../../store/analytics';
import { courseById } from '../../store/selectors';
import { addDays, startOfDay } from '../../utils';

export function usePeriodCompare(days) {
  const { state } = useStore();
  const me = state.settings.currentUserId;
  return useMemo(() => {
    const now = Date.now(); const from = addDays(startOfDay(), -days + 1).getTime(); const prevFrom = addDays(startOfDay(), -2 * days + 1).getTime();
    return { cur: personalStats(state, me, from, now + 1), prev: personalStats(state, me, prevFrom, from) };
  }, [state, me, days]);
}

/** Score personnel 0–100, comparable d'un mois à l'autre (sans référence au CA) */
export const personalScore = (m, goal) => Math.round(100 * (
  0.25 * Math.min(1, m.reach / 70) + 0.2 * Math.min(1, m.callsPerDay / goal) + 0.2 * Math.min(1, m.rdvRate / 35)
  + 0.2 * Math.min(1, (m.winRate ?? 0) / 40) + 0.15 * (m.response === null ? 0.5 : Math.max(0, Math.min(1, 1 - (m.response - 2) / 46)))
));

export function RateCards({ cur, prev, team, goal }) {
  const pts = (a, b) => (a === null || b === null || a === undefined || b === undefined ? null : a - b);
  const card = (icon, cls, label, value, d, hint, teamVal) => (
    <div className="card kpi">
      <span className={`kico ${cls}`}><Icon name={icon} size={18} /></span>
      <div className="lbl">{label}</div>
      <div className="v">{value}</div>
      <div className="sm">vs période préc. <Delta value={d} suffix=" pts" /></div>
      {teamVal !== undefined && teamVal !== null && <div className="muted xs">Moyenne de l'équipe : {teamVal} %</div>}
      {hint && <div className="muted xs">{hint}</div>}
    </div>
  );
  return (
    <section className="kpis" aria-label="Mes indicateurs">
      <div className="card kpi dark">
        <div className="lbl">Mon score d'efficacité</div>
        <div className="row gap12" style={{ alignItems: 'center' }}><Gauge value={personalScore(cur, goal)} size={70} /><span className="sm">vs période préc. <Delta value={personalScore(cur, goal) - personalScore(prev, goal)} suffix=" pts" /></span></div>
      </div>
      {card('phone', 'i-green', 'Joignabilité', `${cur.reach} %`, pts(cur.reach, prev.reach), null, team?.reach)}
      {card('calendar', 'i-violet', 'Prise de RDV', `${cur.rdvRate} %`, pts(cur.rdvRate, prev.rdvRate), 'RDV obtenus / appels décrochés', team?.rdvRate)}
      {card('check', 'i-blue', 'RDV honorés', cur.showRate ? `${cur.showRate} %` : '—', pts(cur.showRate, prev.showRate), cur.rdvPositive ? `${cur.rdvPositive} % jugés positifs` : null, team?.showRate)}
      {card('target', 'i-orange', 'Taux de signature', cur.winRate === null ? '—' : `${cur.winRate} %`, pts(cur.winRate, prev.winRate), 'Sur vos dossiers clos', team?.winRate)}
      {card('zap', 'i-red', 'Rapidité 1er appel', cur.response === null ? '—' : cur.response < 1 ? '< 1 h' : `${Math.round(cur.response)} h`, cur.response !== null && prev.response !== null ? -Math.round(cur.response - prev.response) : null, cur.contacted24 !== null ? `${cur.contacted24} % des leads appelés en moins de 24 h` : null)}
    </section>
  );
}

export function ActivityCharts({ a }) {
  const data = a.daily.map((d) => ({ label: d.label.split(' ')[1], a: d.calls, line: d.reached, faded: d.sunday }));
  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return (
    <div className="flexwrap">
      <section className="card pad24 grow3 stack12" aria-label="Mon activité" style={{ minWidth: 0 }}>
        <div><h2>Mon activité · 30 derniers jours</h2><div className="muted sm">Objectif : {a.goal} appels par jour</div></div>
        <Bars data={data} aLabel="Appels" lineLabel="Décrochés" format={(x) => x} height={200} />
      </section>
      <section className="card pad24 grow1 stack12" aria-label="Meilleurs créneaux" style={{ minWidth: 300 }}>
        <div><h2>Quand mes prospects décrochent</h2><div className="muted sm">% de décroché par jour et créneau (4 derniers mois)</div></div>
        <Heatmap grid={a.slots.grid} rows={DAYS} cols={a.slots.slots.map(([x]) => `${x}h`)} />
      </section>
    </div>
  );
}

export default function SalesPanel({ a }) {
  const { state } = useStore();
  const { cur, prev } = usePeriodCompare(30);
  return (
    <>
      <div className="card-h" style={{ margin: '4px 0 -4px' }}><div><h2>Mes performances · 30 jours</h2><div className="muted sm">Vos taux comparés au mois précédent et à la moyenne de l'équipe</div></div><Link to="/rapports" className="sm b">Mes rapports →</Link></div>
      <RateCards cur={cur} prev={prev} team={a.team} goal={a.goal} />
      <ActivityCharts a={a} />
      <div className="flexwrap">
        <section className="card pad24 grow1 stack12" aria-label="Coaching IA" style={{ minWidth: 300 }}>
          <div className="row gap8"><span className="ico i-violet"><Icon name="sparkle" size={18} /></span><h2>Coaching IA</h2></div>
          <InsightList items={a.coaching} />
        </section>
        <section className="card pad24 grow1 stack12" aria-label="À appeler en priorité" style={{ minWidth: 300 }}>
          <div><h2>À appeler en priorité</h2><div className="muted sm">Vos prospects avec la plus forte chance de signer</div></div>
          {a.hot.length === 0 && <div className="muted sm">Aucun prospect ouvert.</div>}
          {a.hot.map((x) => (
            <Link key={x.c.id} to={`/contacts/${x.c.id}`} className="opp">
              <span className="opp-p" style={{ '--p': Math.round(x.p * 100) }}>{Math.round(x.p * 100)}%</span>
              <span style={{ minWidth: 0, flex: 1 }}><b className="ell" style={{ display: 'block' }}>{x.c.org}</b><span className="muted xs ell" style={{ display: 'block' }}>{courseById(state, x.c.courseId)?.name || '—'} · {x.why[x.why.length - 1]}</span></span>
              <Icon name="right" size={16} />
            </Link>
          ))}
        </section>
        <div className="grow1" style={{ minWidth: 300 }}><AIAssistant bundle={a} compact /></div>
      </div>
    </>
  );
}
