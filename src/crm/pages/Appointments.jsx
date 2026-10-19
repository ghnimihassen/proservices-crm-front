import { useMemo, useState } from 'react';
import { Link } from '../nav';
import { useStore } from '../store/Store';
import { useUI, Modal, Empty, StagePill } from '../components/UI';
import { RdvForm, RdvReportModal } from '../components/Forms';
import Icon from '../components/Icon';
import { contactById, userById } from '../store/selectors';
import { LABELS } from '../store/constants';
import { addDays, startOfDay, startOfWeek, sameDay, isToday, fTime, fDayLong, fShort, mapsHref } from '../utils';

const EVAL = { positive: ['Positive', 'p-green'], neutral: ['Neutre', 'p-gray'], negative: ['Négative', 'p-red'] };

function RdvDetail({ rdv, onClose, onEdit, onReport }) {
  const { state, updateRdv, deleteRdv } = useStore();
  const { toast, confirm } = useUI();
  const c = contactById(state, rdv.contactId);
  const owner = userById(state, rdv.ownerId);
  const past = new Date(rdv.start) < new Date();
  return (
    <Modal title={rdv.title || 'Rendez-vous'} subtitle={c?.org} onClose={onClose}
      footer={<>
        <button className="btn ghost" style={{ marginRight: 'auto', color: 'var(--red-ink)' }} onClick={async () => {
          if (await confirm({ title: 'Supprimer le RDV', message: 'Supprimer définitivement ce rendez-vous ?', ok: 'Supprimer', danger: true })) { deleteRdv(rdv.id); toast('RDV supprimé'); onClose(); }
        }}><Icon name="trash" size={16} />Supprimer</button>
        {rdv.status === 'planned' && <button className="btn ghost" onClick={async () => { if (await confirm({ title: 'Annuler le RDV', message: 'Marquer ce rendez-vous comme annulé ?', ok: 'Annuler le RDV', danger: true })) { updateRdv(rdv.id, { status: 'cancelled' }); toast('RDV annulé'); onClose(); } }}>Annuler le RDV</button>}
        {rdv.status === 'planned' && <button className="btn ghost" onClick={onEdit}>Modifier / reporter</button>}
        {rdv.status !== 'cancelled' && <button className="btn primary" onClick={onReport}>{rdv.status === 'done' ? 'Modifier le compte-rendu' : 'Compte-rendu'}</button>}
      </>}>
      <div className="stack12">
        <div className="row wrap gap8">
          <span className={`pill ${rdv.mode === 'online' ? 'p-blue' : 'p-orange'}`}>{rdv.mode === 'online' ? 'En ligne' : 'Présentiel'}</span>
          {rdv.status === 'cancelled' && <span className="pill p-gray">Annulé</span>}
          {rdv.status === 'done' && rdv.evaluation && <span className={`pill ${EVAL[rdv.evaluation][1]}`}>Évaluation : {EVAL[rdv.evaluation][0]}</span>}
          {rdv.status === 'planned' && past && <span className="pill p-orange">Compte-rendu à faire</span>}
          {c && <StagePill stage={c.stage} />}
        </div>
        <dl className="kv">
          <dt>Date</dt><dd>{fDayLong(rdv.start)} · {fTime(rdv.start)} ({rdv.duration} min)</dd>
          <dt>Contact</dt><dd>{c ? <Link to={`/contacts/${c.id}`} onClick={onClose}>{c.org}</Link> : '—'}{c?.name ? ` · ${c.name}` : ''}</dd>
          <dt>Téléphone</dt><dd>{c?.phone || '—'}</dd>
          <dt>{rdv.mode === 'online' ? 'Lien' : 'Adresse'}</dt>
          <dd>{rdv.mode === 'online'
            ? <a href={rdv.link || 'https://meet.google.com/new'} target="_blank" rel="noreferrer">{rdv.link || 'Créer un Google Meet'}</a>
            : <a href={mapsHref(rdv.location)} target="_blank" rel="noreferrer">{rdv.location || '—'}</a>}</dd>
          <dt>Commercial</dt><dd>{owner?.name}</dd>
          {rdv.report && <><dt>Compte-rendu</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{rdv.report}</dd></>}
        </dl>
      </div>
    </Modal>
  );
}

export default function Appointments() {
  const { state, can } = useStore();
  const [cursor, setCursor] = useState(() => new Date());
  const [mode, setMode] = useState('month');
  const [who, setWho] = useState('me');
  const [newAt, setNewAt] = useState(null);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const [report, setReport] = useState(null);

  const list = useMemo(() => state.appointments.filter((a) => who === 'all' || a.ownerId === (who === 'me' ? state.settings.currentUserId : who))
    .sort((a, b) => new Date(a.start) - new Date(b.start)), [state, who]);

  const sod = startOfDay();
  const upcoming = list.filter((a) => a.status === 'planned' && new Date(a.start) >= sod);
  const toReport = list.filter((a) => a.status === 'planned' && new Date(a.start) < new Date());
  const days7 = Array.from({ length: 7 }, (_, i) => addDays(sod, i));

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const weeks = mode === 'month' ? 6 : 1;
  const base = mode === 'month' ? gridStart : startOfWeek(cursor);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(base, i));
  const shift = (n) => setCursor((d) => (mode === 'month' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : addDays(d, 7 * n)));
  const title = mode === 'month'
    ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(cursor)
    : `Semaine du ${fShort(base)} au ${fShort(addDays(base, 6))}`;
  const openNew = (d) => { const x = new Date(d); x.setHours(10, 0, 0, 0); setNewAt(x); };

  return (
    <>
      <div className="page-h">
        <div><h1>{LABELS.rdvTitle}</h1><p>{LABELS.rdvSubtitle}</p></div>
        <div className="row wrap gap8">
          <label className="chip on"><span className="sr">Commercial</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="me">Mes RDV</option>{can('data.all') && <option value="all">Toute l'équipe</option>}
              {can('data.all') && state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></label>
          <button className="btn primary" onClick={() => openNew(new Date())}><Icon name="plus" stroke={2} />Nouveau RDV</button>
        </div>
      </div>

      <div className="flexwrap">
        <aside className="card pad stack16" style={{ flex: '1 1 300px', maxWidth: 380 }}>
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>7 prochains jours</div>
            <div className="row gap4">
              {days7.map((d) => {
                const n = list.filter((a) => a.status === 'planned' && sameDay(a.start, d)).length;
                return (
                  <button key={d.toISOString()} className={`slot${isToday(d) ? ' on' : ''}`} style={{ flex: 1, padding: 4, minWidth: 0, display: 'flex', flexDirection: 'column', height: 60, justifyContent: 'center' }}
                    onClick={() => { setCursor(d); setMode('week'); }} aria-label={`${fDayLong(d)} : ${n} RDV`}>
                    <span className="xs">{new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(d)}</span>
                    <b>{d.getDate()}</b>
                    {n > 0 && <span className="daydot" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="stack8 sm">
            <div className="row between"><span>Total à venir</span><b>{upcoming.length}</b></div>
            <div className="row between"><span>Aujourd'hui</span><b>{upcoming.filter((a) => isToday(a.start)).length}</b></div>
            <div className="row between"><span>Compte-rendu à faire</span><b style={{ color: toReport.length ? 'var(--orange-ink)' : undefined }}>{toReport.length}</b></div>
          </div>
          {toReport.length > 0 && (
            <div className="alert warn">{toReport.map((a) => (
              <button key={a.id} className="btn link sm" style={{ justifyContent: 'flex-start' }} onClick={() => setReport(a)}>Compte-rendu : {contactById(state, a.contactId)?.org} ({fShort(a.start)})</button>
            ))}</div>
          )}
          <div>
            <div className="lbl" style={{ marginBottom: 6 }}>Prochaines actions</div>
            {upcoming.length === 0 && <Empty icon="clock" title="Aucun rendez-vous à venir" />}
            {upcoming.slice(0, 6).map((a) => (
              <button key={a.id} className="li" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer', textAlign: 'left', borderTop: '1px solid var(--soft)' }} onClick={() => setDetail(a)}>
                <span className={`ico ${a.mode === 'online' ? 'i-blue' : 'i-orange'}`}><Icon name={a.mode === 'online' ? 'video' : 'map'} size={16} /></span>
                <span style={{ flex: 1, minWidth: 0 }}><b className="ell" style={{ display: 'block' }}>{contactById(state, a.contactId)?.org}</b><span className="muted xs">{isToday(a.start) ? "Aujourd'hui" : fShort(a.start)} · {fTime(a.start)}</span></span>
              </button>
            ))}
          </div>
        </aside>

        <section className="card pad grow3" style={{ flex: '3 1 560px' }}>
          <div className="card-h">
            <div className="row gap8 wrap">
              <button className="icon-btn sm" aria-label="Précédent" onClick={() => shift(-1)}><Icon name="left" size={16} /></button>
              <button className="icon-btn sm" aria-label="Suivant" onClick={() => shift(1)}><Icon name="right" size={16} /></button>
              <button className="btn small link" onClick={() => setCursor(new Date())}>Aujourd'hui</button>
              <h2 style={{ textTransform: 'capitalize' }}>{title}</h2>
            </div>
            <div className="seg">
              <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Mois</button>
              <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>Semaine</button>
              <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>Liste</button>
            </div>
          </div>
          {mode === 'list' ? (
            <div>
              {list.length === 0 && <Empty icon="calendar" title="Aucun rendez-vous" />}
              {list.map((a) => {
                const c = contactById(state, a.contactId);
                return (
                  <button key={a.id} className="li" style={{ width: '100%', border: 0, borderTop: '1px solid var(--soft)', background: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => setDetail(a)}>
                    <span style={{ width: 90 }} className="sm"><b>{fShort(a.start)}</b><br />{fTime(a.start)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}><b>{c?.org}</b><span className="muted sm" style={{ display: 'block' }}>{a.title}</span></span>
                    <span className={`pill ${a.mode === 'online' ? 'p-blue' : 'p-orange'}`}>{a.mode === 'online' ? 'En ligne' : 'Présentiel'}</span>
                    {a.status === 'done' && a.evaluation && <span className={`pill ${EVAL[a.evaluation][1]}`}>{EVAL[a.evaluation][0]}</span>}
                    {a.status === 'cancelled' && <span className="pill p-gray">Annulé</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="cal">
              {['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'].map((d) => <div key={d} className="dh">{d}</div>)}
              {cells.map((d) => {
                const evs = list.filter((a) => sameDay(a.start, d));
                const out = mode === 'month' && d.getMonth() !== cursor.getMonth();
                return (
                  <div key={d.toISOString()} className={`d${out ? ' out' : ''}${isToday(d) ? ' today' : ''}`} style={mode === 'week' ? { minHeight: 320 } : undefined}
                    role="button" tabIndex={0} aria-label={`${fDayLong(d)} — ajouter un RDV`}
                    onClick={() => openNew(d)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && openNew(d)}>
                    <span className="dn">{d.getDate()}</span>
                    {evs.map((a) => (
                      <button key={a.id} className={`ev ${a.status !== 'planned' ? 'done' : a.mode}`} onClick={(e) => { e.stopPropagation(); setDetail(a); }}>
                        {fTime(a.start)} {contactById(state, a.contactId)?.org}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {newAt && <RdvForm defaultStart={newAt} onClose={() => setNewAt(null)} />}
      {detail && <RdvDetail rdv={state.appointments.find((a) => a.id === detail.id) || detail} onClose={() => setDetail(null)}
        onEdit={() => { setEdit(detail); setDetail(null); }} onReport={() => { setReport(detail); setDetail(null); }} />}
      {edit && <RdvForm rdv={edit} onClose={() => setEdit(null)} />}
      {report && <RdvReportModal rdv={report} onClose={() => setReport(null)} />}
    </>
  );
}
