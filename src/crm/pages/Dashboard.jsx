import { useMemo, useState } from 'react';
import { Link, useNavigate } from '../nav';
import { useStore } from '../store/Store';
import { PIPELINE_STAGES, LABELS, reachedIndex, isOpen, isEntry, closingStage, stageById } from '../store/constants';
import { contactById, isReached, userById, defaultCallQueue, courseById, productLabels, paymentSummary } from '../store/selectors';
import { Avatar, Empty } from '../components/UI';
import { RdvForm, RdvReportModal } from '../components/Forms';
import Icon from '../components/Icon';
import Cockpit from '../components/exec/Cockpit';
import SalesPanel from '../components/sales/SalesPanel';
import { useAnalytics } from '../components/AIAssistant';
import brand from '../brand';
import { startOfDay, endOfDay, startOfWeek, startOfMonth, fTime, fShort, fDayLong, fMoney, pct, mapsHref, isToday } from '../utils';

const taskIcon = { call: ['phone', 'i-orange'], email: ['mail', 'i-blue'], todo: ['check', 'i-violet'] };
const hello = () => { const h = new Date().getHours(); return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'; };

export default function Dashboard() {
  const { state, toggleTask, startSession } = useStore();
  const an = useAnalytics();
  const navigate = useNavigate();
  const [rdvEdit, setRdvEdit] = useState(null);
  const [report, setReport] = useState(null);
  const meId = state.settings.currentUserId;
  const me = userById(state, meId);

  const d = useMemo(() => {
    const sod = startOfDay(); const sow = startOfWeek(); const som = startOfMonth();
    const callsToday = state.activities.filter((a) => a.type === 'call' && a.userId === meId && new Date(a.at) >= sod);
    const reached = callsToday.filter(isReached).length;
    const rdvWeek = state.appointments.filter((a) => a.ownerId === meId && a.status !== 'cancelled' && new Date(a.start) >= sow && new Date(a.start) < new Date(sow.getTime() + 7 * 864e5));
    const wonMonth = state.contacts.filter((c) => c.stage === 'won' && c.wonAt && new Date(c.wonAt) >= som);
    const rdvDone = state.appointments.filter((a) => a.status === 'done').length;
    const wonAll = state.contacts.filter((c) => c.stage === 'won');
    const cashed = wonAll.reduce((s, c) => s + (c.payment?.paid || 0), 0);
    const due = wonAll.reduce((s, c) => s + Math.max(0, (c.value || 0) - (c.payment?.paid || 0)), 0);
    const funnel = PIPELINE_STAGES.map((s, i) => ({ ...s, n: state.contacts.filter((c) => reachedIndex(c) >= i).length }));
    const tasks = state.tasks.filter((t) => !t.done && t.ownerId === meId && new Date(t.due) <= endOfDay()).sort((a, b) => new Date(a.due) - new Date(b.due));
    const upcoming = state.appointments.filter((a) => a.ownerId === meId && a.status === 'planned' && new Date(a.start) >= sod).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 4);
    const toReport = state.appointments.filter((a) => a.ownerId === meId && a.status === 'planned' && new Date(a.start) < sod);
    const stale = state.contacts.filter((c) => isOpen(c.stage) && !isEntry(c.stage) && !state.appointments.some((a) => a.contactId === c.id && a.status === 'planned') && (!c.lastContactAt || Date.now() - new Date(c.lastContactAt) > 7 * 864e5)).length;
    const team = state.users.map((u) => ({
      u,
      calls: state.activities.filter((a) => a.type === 'call' && a.userId === u.id && new Date(a.at) >= sow).length,
      rdv: state.appointments.filter((a) => a.ownerId === u.id && new Date(a.start) >= sow).length,
      won: state.contacts.filter((c) => c.ownerId === u.id && c.stage === 'won' && c.wonAt && new Date(c.wonAt) >= som).length,
    })).sort((a, b) => b.won - a.won || b.rdv - a.rdv || b.calls - a.calls);
    const demand = (state.catalog || []).map((c) => ({
      c,
      open: state.contacts.filter((x) => x.courseId === c.id && !['won', 'lost'].includes(x.stage)).length,
      won: state.contacts.filter((x) => x.courseId === c.id && x.stage === 'won').length,
    })).sort((a, b) => b.open - a.open).slice(0, 5);
    const overdueAmt = state.contacts.reduce((s, c) => s + paymentSummary(c).overdue.reduce((x, i) => x + Number(i.amount || 0), 0), 0);
    return { overdueAmt, callsToday: callsToday.length, reached, rdvWeek, wonMonth, rdvDone, wonAll: wonAll.length, cashed, due, funnel, tasks, upcoming, toReport, stale, team, demand, queue: defaultCallQueue(state).length };
  }, [state, meId]);

  const goal = state.settings.dailyCallGoal || 40;
  const rdvGoal = state.settings.weeklyRdvGoal || 8;
  const tasksOverdue = d.tasks.filter((t) => new Date(t.due) < startOfDay()).length;
  const progress = Math.min(100, pct(d.callsToday, goal));
  const launch = () => { startSession(defaultCallQueue(state), 'À appeler aujourd’hui'); navigate('/appels'); };

  return (
    <>
      {an.exec && <Cockpit a={an} />}
      {an.exec && <div className="card-h" style={{ margin: '10px 0 -4px' }}><h2>Ma journée</h2></div>}
      <section className="focus" aria-label="Ma journée">
        <div className="ring" style={{ '--p': progress }} role="img" aria-label={`${d.callsToday} appels sur ${goal}`}>
          <div><b>{d.callsToday}</b><span>/ {goal} appels</span></div>
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 0 }} className="stack8">
          <h1>{hello()} {me?.name.split(' ')[0]}</h1>
          <div className="sub">{fDayLong(new Date()).replace(/^\w/, (c) => c.toUpperCase())} · voici votre journée</div>
          <div className="row wrap gap16" style={{ marginTop: 6 }}>
            <div className="stat"><b>{d.queue}</b><span>à appeler</span></div>
            <div className="stat"><b>{d.upcoming.filter((a) => isToday(a.start)).length}</b><span>RDV aujourd'hui</span></div>
            <div className="stat"><b>{d.tasks.length}</b><span>tâches dues</span></div>
            {tasksOverdue > 0 && <div className="stat"><b style={{ color: '#FCA5A5' }}>{tasksOverdue}</b><span>en retard</span></div>}
          </div>
        </div>
        <div className="row wrap gap8">
          <button className="btn orange" onClick={launch} disabled={!d.queue}><Icon name="zap" />Lancer ma session ({d.queue})</button>
          <Link to="/taches" className="btn ghost">Mes tâches</Link>
        </div>
      </section>

      {d.toReport.length > 0 && (
        <div className="alert warn" style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Icon name="flag" /><span style={{ flex: 1 }}><b>{d.toReport.length} rendez-vous</b> passé{d.toReport.length > 1 ? 's' : ''} sans compte-rendu. L'évaluation alimente vos statistiques.</span>
          <button className="btn small ghost" onClick={() => setReport(d.toReport[0])}>Faire le compte-rendu</button>
        </div>
      )}

      <div className="flexwrap">
        <section className="card pad24 grow1" aria-label="À faire maintenant">
          <div className="card-h">
            <h2>À faire maintenant</h2>
            {tasksOverdue > 0 ? <span className="pill p-red dotpill">{tasksOverdue} en retard</span> : <Link to="/taches" className="sm b">Toutes les tâches</Link>}
          </div>
          {d.tasks.length === 0 && <Empty icon="check" title="Tout est à jour" text="Aucune tâche pour aujourd'hui." />}
          <div>
            {d.tasks.slice(0, 6).map((t) => {
              const c = contactById(state, t.contactId);
              const late = new Date(t.due) < startOfDay();
              const [ic, cls] = taskIcon[t.type] || taskIcon.todo;
              return (
                <div className="li" key={t.id}>
                  <input type="checkbox" aria-label={`Terminer : ${t.title}`} checked={t.done} onChange={() => toggleTask(t.id)} />
                  <span className={`ico ${late ? 'i-red' : cls}`}><Icon name={ic} size={16} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="b ell">{t.title}</div>
                    {c ? <Link to={`/contacts/${c.id}`} className="muted sm">{c.org}</Link> : <span className="muted sm">Sans {LABELS.contact}</span>}
                  </div>
                  <span className="xs b num" style={{ color: late ? 'var(--red-ink)' : 'var(--ink)' }}>{late ? fShort(t.due) : fTime(t.due)}</span>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card pad24 grow3" aria-label="Prochains rendez-vous">
          <div className="card-h"><h2>Prochains rendez-vous</h2><Link to="/rendez-vous" className="b">Calendrier →</Link></div>
          {d.upcoming.length === 0 && <Empty icon="calendar" title="Aucun rendez-vous à venir" text="Lancez une session d'appels pour en fixer." />}
          <div className="grid2">
            {d.upcoming.map((a) => {
              const c = contactById(state, a.contactId);
              const course = courseById(state, c?.courseId);
              return (
                <div key={a.id} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16, background: 'var(--surface-2)' }} className="stack8">
                  <div className="row between">
                    <span><b className="num" style={{ fontSize: 22 }}>{fTime(a.start)}</b> <span className="muted sm">{isToday(a.start) ? "aujourd'hui" : fShort(a.start)}</span></span>
                    <span className={`pill ${a.mode === 'online' ? 'p-blue' : 'p-orange'}`}>{a.mode === 'online' ? 'En ligne' : 'Présentiel'}</span>
                  </div>
                  <div><div className="b">{c?.org}</div><div className="muted sm">{course ? course.name : [c?.name, c?.role].filter(Boolean).join(' · ')}</div></div>
                  <div className="muted sm">{a.title}{a.mode === 'onsite' && a.location ? ` · ${a.location}` : ''}</div>
                  <div className="row gap8 wrap">
                    {a.mode === 'online'
                      ? <a className="btn small primary" href={a.link || 'https://meet.google.com/new'} target="_blank" rel="noreferrer"><Icon name="video" size={16} />Rejoindre</a>
                      : <a className="btn small ghost" href={mapsHref(a.location)} target="_blank" rel="noreferrer"><Icon name="map" size={16} />Itinéraire</a>}
                    <Link className="btn small ghost" to={`/contacts/${a.contactId}`}>Ouvrir la fiche</Link>
                    <button className="btn small ghost" onClick={() => setRdvEdit(a)}>Reporter</button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {!an.exec && <SalesPanel a={an} />}

      {rdvEdit && <RdvForm rdv={rdvEdit} onClose={() => setRdvEdit(null)} />}
      {report && <RdvReportModal rdv={report} onClose={() => setReport(null)} />}
    </>
  );
}
