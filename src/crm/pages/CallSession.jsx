import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '../nav';
import { useStore } from '../store/Store';
import { useUI, Avatar, StagePill, Empty } from '../components/UI';
import { OutcomePanel, ContactForm } from '../components/Forms';
import Icon from '../components/Icon';
import { VIEWS, defaultCallQueue, contactById } from '../store/selectors';
import { ACTIVITY_TYPES, CALL_OUTCOMES, outcomeLabel, LABELS } from '../store/constants';
import { courseById, guidesFor } from '../store/selectors';
import brand from '../brand';
import { fDateTime, telHref, waHref } from '../utils';

const GUIDE = brand.callGuide;

function Timer({ since }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((Date.now() - new Date(since)) / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return <>{p(Math.floor(s / 3600))}:{p(Math.floor((s % 3600) / 60))}:{p(s % 60)}</>;
}

function StartScreen() {
  const { state, startSession } = useStore();
  const navigate = useNavigate();
  const me = state.settings.currentUserId;
  const queues = [
    { id: 'today', label: 'À appeler aujourd’hui', desc: 'Nouveaux contacts et rappels prévus jusqu’à ce soir', ids: defaultCallQueue(state) },
    ...['followup', 'interested', 'noanswer'].map((vid) => {
      const v = VIEWS.find((x) => x.id === vid);
      return {
        id: vid, label: v.label,
        desc: { followup: 'Prospects sans échange depuis plus de 7 jours', interested: 'Intéressés à transformer en RDV', noanswer: 'Contacts injoignables à retenter' }[vid],
        ids: state.contacts.filter((c) => c.ownerId === me && v.test(c, state)).map((c) => c.id),
      };
    }),
  ];
  return (
    <div className="content" style={{ maxWidth: 980, margin: '0 auto' }}>
      <div className="page-h"><div><h1>Session d'appels</h1><p>Appelez vos contacts un par un, notez le résultat, fixez le RDV — sans quitter l'écran.</p></div>
        <Link to="/contacts" className="btn ghost">Choisir dans les {LABELS.contacts.toLowerCase()}</Link></div>
      <div className="grid2">
        {queues.map((q) => (
          <div key={q.id} className="card pad24 stack12">
            <div className="row between"><h2>{q.label}</h2><span className="pill p-violet">{q.ids.length}</span></div>
            <div className="muted sm">{q.desc}</div>
            <button className="btn primary" disabled={!q.ids.length} onClick={() => { startSession(q.ids, q.label); navigate('/appels'); }}>
              <Icon name="phone" />Démarrer
            </button>
          </div>
        ))}
      </div>
      <div className="alert info">Astuce : dans la base de contacts, sélectionnez des lignes puis « Lancer une session d'appels » pour une file sur mesure.</div>
    </div>
  );
}

export default function CallSession() {
  const { state, updateSession, endSession, updateContact } = useStore();
  const { toast } = useUI();
  const navigate = useNavigate();
  const session = state.session;
  const [note, setNote] = useState('');
  const [guide, setGuide] = useState([]);
  const [guideId, setGuideId] = useState('');
  const [tag, setTag] = useState('');
  const [editing, setEditing] = useState(false);

  const ids = useMemo(() => (session?.ids || []).filter((id) => contactById(state, id)), [session, state]);
  const index = session ? Math.min(session.index, ids.length) : 0;
  const contact = ids[index] ? contactById(state, ids[index]) : null;
  const results = session?.results || {};

  useEffect(() => { setNote(''); setGuide([]); setTag(''); setGuideId(''); }, [contact?.id]);

  const go = (i) => updateSession({ index: Math.max(0, Math.min(ids.length, i)) });
  const next = () => go(index + 1);

  useEffect(() => {
    if (!session) return undefined;
    const h = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  if (!session) return <StartScreen />;

  const done = Object.keys(results).length;
  const reached = Object.values(results).filter((o) => o !== 'noanswer').length;
  const rdv = Object.values(results).filter((o) => o === 'yes').length;
  const quit = () => { endSession(); navigate('/'); };

  if (!contact) {
    return (
      <div className="content" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="card pad24 stack16" style={{ textAlign: 'center', alignItems: 'center' }}>
          <span className="empty-i" style={{ background: 'var(--green-t)', color: 'var(--green-ink)' }}><Icon name="trophy" size={24} /></span>
          <h1>Session terminée</h1>
          <div className="muted">{session.name} · durée <Timer since={session.startedAt} /></div>
          <div className="kpis" style={{ width: '100%' }}>
            <div className="card kpi"><div className="lbl">Appels passés</div><div className="v">{done}</div></div>
            <div className="card kpi"><div className="lbl">Décrochés</div><div className="v">{reached}</div></div>
            <div className="card kpi dark"><div className="lbl">RDV fixés</div><div className="v">{rdv}</div></div>
          </div>
          <div className="stack8" style={{ width: '100%', textAlign: 'left' }}>
            {ids.map((id) => { const c = contactById(state, id); return (
              <div key={id} className="li"><Avatar name={c.org} size={30} /><Link to={`/contacts/${id}`} className="b" style={{ flex: 1 }}>{c.org}</Link>
                <span className={`pill ${results[id] === 'yes' ? 'p-violet' : results[id] === 'no' ? 'p-red' : results[id] ? 'p-gray' : 'p-orange'}`}>{results[id] ? outcomeLabel(results[id]) : 'Passé'}</span></div>
            ); })}
          </div>
          <div className="row gap8 wrap">
            <button className="btn ghost" onClick={() => go(0)}>Revoir la file</button>
            <button className="btn primary" onClick={quit}>Terminer et revenir au tableau de bord</button>
          </div>
        </div>
      </div>
    );
  }

  const guides = brand.features.catalog ? guidesFor(state, contact.courseId) : [];
  const activeGuide = guides.find((g) => g.id === guideId) || guides[0];
  const guideQs = activeGuide ? activeGuide.questions : GUIDE;
  const history = state.activities.filter((a) => a.contactId === contact.id).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5);
  const upcoming = ids.slice(index + 1, index + 6);

  return (
    <>
      <header className="call-top">
        <button className="btn ghost" style={{ background: 'transparent' }} onClick={quit}>← Quitter la session</button>
        <div className="stack8" style={{ flex: '1 1 280px', minWidth: 0, gap: 6 }}>
          <div className="row between wrap gap8 sm">
            <span><b>{session.name}</b> · contact {index + 1} sur {ids.length}</span>
            <span className="meta">{reached} décroché{reached > 1 ? 's' : ''} · {rdv} RDV · <Timer since={session.startedAt} /></span>
          </div>
          <div className="prog" role="progressbar" aria-valuenow={index} aria-valuemax={ids.length} aria-label="Progression de la session"><span style={{ width: `${(index / ids.length) * 100}%` }} /></div>
        </div>
        <button className="btn ghost" style={{ background: 'transparent' }} disabled={index === 0} onClick={() => go(index - 1)}>← Précédent</button>
        <button className="btn ghost" style={{ background: 'transparent' }} onClick={next}>Passer <Icon name="skip" size={16} /></button>
      </header>

      <div className="call-body">
        <div className="grow3 stack16" style={{ flex: '999 1 600px' }}>
          <section className="card pad24 row wrap gap16" aria-label="Contact en cours">
            <Avatar name={contact.org} size={64} />
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div className="row wrap gap8"><h1 style={{ fontSize: 24 }}>{contact.org}</h1><StagePill stage={contact.stage} />
                {results[contact.id] && <span className="pill p-green">Déjà traité : {outcomeLabel(results[contact.id])}</span>}</div>
              <div className="muted" style={{ marginTop: 4 }}>{[contact.name, contact.role, contact.city, contact.source && `Source : ${contact.source}`].filter(Boolean).join(' · ')}</div>
              {courseById(state, contact.courseId) && <div className="row gap8" style={{ marginTop: 8 }}><span className="pill p-violet"><Icon name="book" size={14} />{courseById(state, contact.courseId).name}</span><span className="muted sm">{courseById(state, contact.courseId).price} DT</span></div>}
              <div className="row wrap gap4" style={{ marginTop: 10 }}>
                {contact.type && <span className="pill p-gray">{contact.type}</span>}
                {contact.noAnswerCount > 0 && <span className="pill p-orange">{contact.noAnswerCount}× sans réponse</span>}
                {(contact.tags || []).map((t) => <span key={t} className="pill p-violet">#{t}</span>)}
              </div>
            </div>
            <div className="stack8">
              {contact.phone
                ? <a className="btn big-call" href={telHref(contact.phone)}><Icon name="phone" size={20} stroke={2} />{contact.phone}</a>
                : <button className="btn ghost" onClick={() => setEditing(true)}>Ajouter un numéro</button>}
              <div className="row gap8">
                <a className="btn small ghost" style={{ flex: 1 }} href={waHref(contact.phone)} target="_blank" rel="noreferrer"><Icon name="chat" size={16} />WhatsApp</a>
                <a className={`btn small ghost${contact.email ? '' : ' disabled'}`} style={{ flex: 1 }} href={contact.email ? `mailto:${contact.email}` : undefined} aria-disabled={!contact.email}><Icon name="mail" size={16} />Email</a>
                <button className="icon-btn sm" aria-label="Modifier le contact" onClick={() => setEditing(true)}><Icon name="edit" size={16} /></button>
              </div>
            </div>
          </section>

          <div className="flexwrap">
            <section className="card pad grow1" aria-label="Guide d'appel">
              <div className="row between wrap gap8" style={{ marginBottom: 6 }}>
                <span className="lbl">Guide d'appel</span>
                {guides.length > 1 ? (
                  <label className="chip on" style={{ minHeight: 34 }}><span className="sr">Choisir le guide</span>
                    <select value={activeGuide?.id} onChange={(e) => { setGuideId(e.target.value); setGuide([]); }}>
                      {guides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select></label>
                ) : activeGuide ? <span className="muted xs">{activeGuide.name}</span> : null}
              </div>
              {guideQs.map((g, i) => (
                <label key={`${activeGuide?.id}-${i}`} className="row gap8" style={{ padding: '8px 0', alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={guide.includes(i)} onChange={() => setGuide((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))} style={{ marginTop: 2 }} />
                  <span style={{ textDecoration: guide.includes(i) ? 'line-through' : 'none', color: guide.includes(i) ? 'var(--muted)' : undefined }}>{g}</span>
                </label>
              ))}
            </section>
            <section className="card pad grow1 stack8" aria-label="Remarques">
              <label className="lbl" htmlFor="callnote">Remarques de l'appel</label>
              <textarea id="callnote" className="inp" rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder={brand.features.catalog ? 'Objectif, niveau, disponibilité, financement, objections…' : 'Besoin, outil actuel, objections, décideur…'} />
              <form className="row gap8" onSubmit={(e) => { e.preventDefault(); const t = tag.trim().replace(/^#/, ''); if (!t) return; updateContact(contact.id, { tags: [...new Set([...(contact.tags || []), t])] }); setTag(''); toast(`#${t} ajouté`); }}>
                <label className="sr" htmlFor="ctag">Ajouter un tag</label>
                <input id="ctag" className="inp" style={{ minHeight: 38 }} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="+ tag (ex. paiements)" />
                <button className="btn small ghost" type="submit">Ajouter</button>
              </form>
            </section>
          </div>

          <section className="card pad stack12" aria-label="Résultat de l'appel">
            <div className="lbl">Résultat de l'appel</div>
            <OutcomePanel key={contact.id} contactId={contact.id} note={note} hotkeys saveLabel="Enregistrer et contact suivant →"
              onSaved={(o) => { updateSession({ results: { ...results, [contact.id]: o }, index: index + 1 }); }} />
          </section>
        </div>

        <aside className="grow1 stack16">
          <section className="card pad" aria-label="Historique">
            <div className="lbl" style={{ marginBottom: 10 }}>Historique</div>
            {history.length === 0 && <div className="muted sm">Aucun échange pour l'instant.</div>}
            <div className="stack12 sm">
              {history.map((a) => (
                <div key={a.id}>
                  <b>{fDateTime(a.at)} · {ACTIVITY_TYPES[a.type]}{a.outcome && a.type === 'call' ? ` — ${outcomeLabel(a.outcome)}` : ''}</b>
                  {a.text && <div className="muted">{a.text}</div>}
                </div>
              ))}
            </div>
            <Link to={`/contacts/${contact.id}`} className="sm b" style={{ display: 'inline-block', marginTop: 12 }}>Ouvrir la fiche complète →</Link>
          </section>
          <section className="card pad" aria-label="File d'appels">
            <div className="row between" style={{ marginBottom: 6 }}><span className="lbl">À suivre</span><span className="muted sm">{ids.length - index - 1} restant{ids.length - index - 1 > 1 ? 's' : ''}</span></div>
            {upcoming.length === 0 && <Empty icon="check" title="Dernier contact de la file" />}
            {upcoming.map((id, i) => { const c = contactById(state, id); return (
              <button key={id} className="li" style={{ width: '100%', background: 'none', border: 0, borderTop: i ? '1px solid var(--soft)' : 0, cursor: 'pointer', textAlign: 'left' }} onClick={() => go(index + 1 + i)}>
                <span className="ico i-gray xs b">{index + 2 + i}</span>
                <span style={{ flex: 1, minWidth: 0 }}><span className="b ell" style={{ display: 'block' }}>{c.org}</span><span className="muted xs">{c.noAnswerCount ? `${c.noAnswerCount}× sans réponse` : c.source || ''}</span></span>
                <StagePill stage={c.stage} />
              </button>
            ); })}
          </section>
          <div className="alert info"><b>Raccourcis clavier</b>{CALL_OUTCOMES.map((o) => `${o.key} ${o.label}`).join(' · ')} · N contact suivant</div>
        </aside>
      </div>
      {editing && <ContactForm contact={contact} onClose={() => setEditing(false)} />}
    </>
  );
}
