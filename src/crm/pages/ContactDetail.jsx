import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from '../nav';
import { useStore } from '../store/Store';
import { useUI, Avatar, StagePill, Empty, Modal, Menu, Field } from '../components/UI';
import { ContactForm, LostModal, OutcomePanel, RdvForm, RdvReportModal, TaskForm } from '../components/Forms';
import { WonModal } from './Pipeline';
import Icon from '../components/Icon';
import { PIPELINE_STAGES, ACTIVITY_TYPES, stageIndex, entryStage, hasStage, outcomeLabel, LABELS, QUALIFICATION, PAYMENT_STATUS } from '../store/constants';
import { userById, courseById, productLabels, paymentSummary, productTypeLabel } from '../store/selectors';
import { PaymentPlan, PaymentModal } from '../components/Payments';
import { can, allowedTypeIds, contactTypeId } from '../store/permissions';
import PrintSheet from '../components/PrintSheet';

export { PaymentModal };
import brand from '../brand';
import ProductPicker from '../components/ProductPicker';
import { fDateTime, fRelative, fMoney, startOfDay, addDays, toLocalInput, fromLocalInput, telHref, waHref, mapsHref, uid, fShort, fTime, isToday, fDate } from '../utils';

const ACT_ICON = {
  call: ['phone', 'i-green'], note: ['note', 'i-orange'], email: ['mail', 'i-blue'], whatsapp: ['chat', 'i-green'],
  rdv: ['calendar', 'i-violet'], stage: ['flag', 'i-gray'], created: ['plus', 'i-gray'], report: ['check', 'i-violet'], file: ['file', 'i-gray'], payment: ['wallet', 'i-green'],
};
const OUT_CLS = { noanswer: 'p-gray', later: 'p-orange', no: 'p-red', interested: 'p-orange', yes: 'p-green', positive: 'p-green', neutral: 'p-gray', negative: 'p-red' };
const EVAL = { positive: 'Positive', neutral: 'Neutre', negative: 'Négative' };

function score(state, c) {
  if (c.stage === 'won') return 100;
  if (c.stage === 'lost') return 0;
  const n = Math.max(1, PIPELINE_STAGES.length - 1);
  let s = Math.round(10 + 70 * (Math.max(0, stageIndex(c.stage)) / n));
  if (c.lastContactAt && Date.now() - new Date(c.lastContactAt) < 3 * 864e5) s += 8;
  if (c.lastContactAt && Date.now() - new Date(c.lastContactAt) > 10 * 864e5) s -= 15;
  if (state.appointments.some((a) => a.contactId === c.id && a.evaluation === 'positive')) s += 10;
  s -= (c.noAnswerCount || 0) * 4;
  return Math.max(0, Math.min(99, s));
}

function PersonModal({ contact, onClose }) {
  const { updateContact } = useStore();
  const [p, setP] = useState({ name: '', role: '', phone: '', email: '' });
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal title="Ajouter un interlocuteur" subtitle={contact.org} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={!p.name.trim()} onClick={() => { updateContact(contact.id, { people: [...(contact.people || []), { ...p, id: uid() }] }); onClose(); }}>Ajouter</button></>}>
      <div className="grid2">
        <Field label="Nom *"><input value={p.name} onChange={set('name')} /></Field>
        <Field label="Fonction"><input value={p.role} onChange={set('role')} /></Field>
        <Field label="Téléphone"><input value={p.phone} onChange={set('phone')} /></Field>
        <Field label="Email"><input value={p.email} onChange={set('email')} /></Field>
      </div>
    </Modal>
  );
}

function CallModal({ contact, onClose }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Résultat de l'appel" subtitle={`${contact.org} · ${contact.phone}`} onClose={onClose} width={760}>
      <div className="stack12">
        <label className="field"><span className="field-l">Remarques</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce qui s'est dit…" /></label>
        <OutcomePanel contactId={contact.id} note={note} onSaved={onClose} />
      </div>
    </Modal>
  );
}

function Composer({ contact }) {
  const { addActivity, addTask } = useStore();
  const { toast } = useUI();
  const [tab, setTab] = useState('note');
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState(toLocalInput((() => { const d = addDays(startOfDay(), 1); d.setHours(10); return d; })()));

  const tabs = [['note', 'Note'], ['call', 'Appel'], ['rdv', 'Rendez-vous'], ['email', 'Email'], ['task', 'Tâche']];
  return (
    <div className="composer">
      <div className="seg" role="tablist" style={{ alignSelf: 'flex-start' }}>
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'note' && (
        <form className="stack8" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; addActivity({ contactId: contact.id, type: 'note', text: text.trim() }); setText(''); toast('Note ajoutée'); }}>
          <label className="sr" htmlFor="note-in">Nouvelle note</label>
          <textarea id="note-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une remarque… (@Prénom pour mentionner un collègue)" />
          <div className="row between wrap gap8"><span className="muted xs">Visible par toute l'équipe</span><button className="btn small primary" type="submit" disabled={!text.trim()}>Enregistrer</button></div>
        </form>
      )}
      {tab === 'call' && (
        <div className="stack12">
          <label className="sr" htmlFor="call-in">Remarques de l'appel</label>
          <textarea id="call-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Remarques de l'appel…" />
          <OutcomePanel contactId={contact.id} note={text} onSaved={() => setText('')} />
        </div>
      )}
      {tab === 'rdv' && <RdvFormInline contact={contact} onDone={() => setTab('note')} />}
      {tab === 'email' && (
        <form className="stack8" onSubmit={(e) => {
          e.preventDefault();
          if (!subject.trim() && !text.trim()) return;
          addActivity({ contactId: contact.id, type: 'email', text: [subject.trim() && `Objet : ${subject.trim()}`, text.trim()].filter(Boolean).join('\n') });
          toast('Email consigné dans l’historique');
          setSubject(''); setText('');
        }}>
          <label className="sr" htmlFor="em-s">Objet</label>
          <input id="em-s" className="inp" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet" />
          <label className="sr" htmlFor="em-b">Message</label>
          <textarea id="em-b" value={text} onChange={(e) => setText(e.target.value)} placeholder="Contenu de l'email ou résumé…" />
          <div className="row end gap8 wrap">
            {contact.email && <a className="btn small ghost" href={`mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}><Icon name="mail" size={16} />Ouvrir dans ma messagerie</a>}
            <button className="btn small primary" type="submit">Consigner l'email</button>
          </div>
        </form>
      )}
      {tab === 'task' && (
        <form className="grid2" onSubmit={(e) => {
          e.preventDefault();
          if (!taskTitle.trim()) return;
          addTask({ title: taskTitle.trim(), due: fromLocalInput(taskDue), contactId: contact.id, type: 'todo' });
          toast('Tâche ajoutée'); setTaskTitle('');
        }}>
          <Field label="Tâche"><input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Ex. Envoyer le devis" /></Field>
          <Field label="Échéance"><input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} /></Field>
          <div className="full row end"><button className="btn small primary" type="submit" disabled={!taskTitle.trim()}>Ajouter la tâche</button></div>
        </form>
      )}
    </div>
  );
}

function RdvFormInline({ contact, onDone }) {
  const { addRdv } = useStore();
  const { toast } = useUI();
  return <RdvForm inline contactId={contact.id} onSaved={(data) => { addRdv(data); toast('Rendez-vous planifié'); onDone(); }} />;
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, updateContact, deleteContacts, toggleTask, deleteTask, updateRdv, addTask, addActivity, deleteActivity } = useStore();
  const { toast, confirm } = useUI();
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('all');
  const P = productLabels(state);
  const ok = (k) => can(state, k);
  const c = state.contacts.find((x) => x.id === id);

  const acts = useMemo(() => state.activities.filter((a) => a.contactId === id).sort((a, b) => new Date(b.at) - new Date(a.at)), [state.activities, id]);
  if (!c) return <Empty icon="users" title="Fiche introuvable" text="Il a peut-être été supprimé." action={<Link to="/contacts" className="btn primary">Retour aux contacts</Link>} />;

  const shown = acts.filter((a) => filter === 'all' || (filter === 'call' ? a.type === 'call' : filter === 'note' ? a.type === 'note' : filter === 'rdv' ? ['rdv', 'report'].includes(a.type) : filter === 'email' ? ['email', 'whatsapp'].includes(a.type) : true));
  const tasks = state.tasks.filter((t) => t.contactId === id).sort((a, b) => a.done - b.done || new Date(a.due) - new Date(b.due));
  const rdvs = state.appointments.filter((a) => a.contactId === id).sort((a, b) => new Date(a.start) - new Date(b.start));
  const nextRdv = rdvs.find((a) => a.status === 'planned');
  const pastRdvs = rdvs.filter((a) => a.status !== 'planned').reverse();
  const owner = userById(state, c.ownerId);
  const sc = score(state, c);
  const cur = stageIndex(c.stage);
  const q = c.qualification || {};

  const goStage = (s) => {
    if (s === c.stage) return;
    if (s === 'won') return setModal({ type: 'won' });
    if (s === 'rdv' && !nextRdv) return setModal({ type: 'rdv' });
    if (s === 'lost') return setModal({ type: 'lost' });
    updateContact(c.id, { stage: s });
    toast(`Étape : ${PIPELINE_STAGES.find((x) => x.id === s).label}`);
  };
  const remove = async () => {
    if (await confirm({ title: 'Supprimer le contact', message: `Supprimer « ${c.org} » et tout son historique ?`, ok: 'Supprimer', danger: true })) {
      deleteContacts([c.id]); toast('Contact supprimé'); navigate('/contacts');
    }
  };
  const onFiles = (files) => {
    [...files].forEach((f) => {
      const meta = { id: uid(), name: f.name, size: f.size, at: new Date().toISOString(), data: null };
      const finish = (m) => {
        updateContact(c.id, (cc) => ({ files: [...(cc.files || []), m] }));
        addActivity({ contactId: c.id, type: 'file', text: `Document ajouté : ${f.name}` });
      };
      if (f.size <= 700 * 1024) {
        const r = new FileReader();
        r.onload = () => finish({ ...meta, data: r.result });
        r.readAsDataURL(f);
      } else {
        finish(meta);
        toast('Fichier volumineux : seul le nom est conservé dans cette version', 'err');
      }
    });
  };
  const scoreTone = sc >= 70 ? 'p-red' : sc >= 40 ? 'p-orange' : 'p-blue';
  const scoreLabel = sc >= 70 ? 'Chaud' : sc >= 40 ? 'Tiède' : 'Froid';

  return (
    <>
      <div className="muted sm"><Link to="/contacts">Contacts</Link> / {c.org}</div>

      <section className="card pad24 stack20" aria-label="En-tête">
        <div className="row wrap gap16">
          <Avatar name={c.org} size={64} />
          <div style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div className="row wrap gap8"><h1>{c.org}</h1><StagePill stage={c.stage} />
              {!['won', 'lost'].includes(c.stage) && <span className={`pill ${scoreTone}`} title="Score calculé : étape, récence des échanges, évaluation des RDV">{scoreLabel} · {sc}/100</span>}
              {c.stage === 'lost' && c.lostReason && <span className="pill p-gray">Motif : {c.lostReason}</span>}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              {[c.type, c.city, c.source && `Source : ${c.source}`].filter(Boolean).join(' · ')} · Responsable :{' '}
              <label className="sr" htmlFor="own">Responsable</label>
              <select id="own" value={c.ownerId} disabled={!ok('contacts.assign')} onChange={(e) => { updateContact(c.id, { ownerId: e.target.value }); toast('Responsable mis à jour'); }}
                style={{ border: 0, background: 'transparent', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer' }}>
                {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {' '}· Ajouté le {fDate(c.createdAt)}
            </div>
          </div>
          <div className="row wrap gap8">
            {c.phone && <a className="btn ghost" href={telHref(c.phone)} onClick={() => setModal({ type: 'call' })}><Icon name="phone" size={16} />Appeler</a>}
            {c.phone && <a className="btn ghost" href={waHref(c.phone)} target="_blank" rel="noreferrer" onClick={() => addActivity({ contactId: c.id, type: 'whatsapp', text: 'Message WhatsApp envoyé' })}><Icon name="chat" size={16} />WhatsApp</a>}
            {c.email && <a className="btn ghost" href={`mailto:${c.email}`}><Icon name="mail" size={16} />Email</a>}
            {ok('contacts.edit') && c.stage !== 'won' && <button className="btn success" onClick={() => setModal({ type: 'won' })}>{LABELS.convert}</button>}
            {brand.features.catalog && ok('payments.collect') && (c.stage === 'won' || (c.schedule || []).length > 0) && paymentSummary(c).rest > 0 && <button className="btn success" onClick={() => setModal({ type: 'pay' })}><Icon name="wallet" size={16} />Encaisser</button>}
            <button className="btn ghost" onClick={() => setModal({ type: 'print' })}><Icon name="file" size={16} />Imprimer</button>
            <Menu align="right" className="icon-btn" label={<><span aria-hidden="true" style={{ fontWeight: 700, letterSpacing: 1 }}>⋯</span><span className="sr">Plus d'actions</span></>}>
              {ok('contacts.edit') && <button role="menuitem" onClick={() => setModal({ type: 'edit' })}><Icon name="edit" size={16} />Modifier</button>}
              <button role="menuitem" onClick={() => setModal({ type: 'call' })}><Icon name="phone" size={16} />Consigner un appel</button>
              {ok('contacts.edit') && c.stage !== 'lost' && <button role="menuitem" onClick={() => setModal({ type: 'lost' })}><Icon name="x" size={16} />Marquer perdu</button>}
              {ok('contacts.edit') && c.stage === 'lost' && <button role="menuitem" onClick={() => { updateContact(c.id, { stage: hasStage('contacted') ? 'contacted' : entryStage(), lostReason: '' }); toast('Prospect réactivé'); }}><Icon name="flag" size={16} />Réactiver le prospect</button>}
              {ok('contacts.delete') && <button role="menuitem" onClick={remove} style={{ color: 'var(--red-ink)' }}><Icon name="trash" size={16} />Supprimer</button>}
            </Menu>
          </div>
        </div>
        <div className="stepper" aria-label="Étapes du prospect">
          {PIPELINE_STAGES.map((s, i) => (
            <button key={s.id} disabled={!ok('contacts.edit')} className={`step${c.stage === 'lost' ? '' : i < cur ? ' done' : i === cur ? ' cur' : ''}`} onClick={() => goStage(s.id)} aria-current={i === cur ? 'step' : undefined}>
              <span className="sbar" />{s.label}{i === cur ? ' · en cours' : ''}
            </button>
          ))}
        </div>
      </section>

      {brand.features.catalog && <PaymentPlan contact={c} />}

      <div className="flexwrap">
        <div className="grow1 stack16">
          <section className="card pad stack12" aria-label="Interlocuteurs">
            <div className="lbl">Interlocuteurs</div>
            <div className="row gap8" style={{ alignItems: 'flex-start' }}>
              <Avatar name={c.name || c.org} size={36} round />
              <div className="sm" style={{ minWidth: 0 }}>
                <b>{c.name || 'Contact principal'}</b> <span className="pill p-orange" style={{ padding: '0 8px' }}>Principal</span>
                <div className="muted">{c.role}</div>
                {c.phone && <a href={telHref(c.phone)} style={{ display: 'block' }}>{c.phone}</a>}
                {c.email && <a href={`mailto:${c.email}`} className="ell" style={{ display: 'block' }}>{c.email}</a>}
              </div>
            </div>
            {(c.people || []).map((p) => (
              <div key={p.id} className="row gap8" style={{ alignItems: 'flex-start' }}>
                <Avatar name={p.name} size={36} round />
                <div className="sm" style={{ flex: 1, minWidth: 0 }}>
                  <b>{p.name}</b><div className="muted">{p.role}</div>
                  {p.phone && <a href={telHref(p.phone)} style={{ display: 'block' }}>{p.phone}</a>}
                  {p.email && <a href={`mailto:${p.email}`} className="ell" style={{ display: 'block' }}>{p.email}</a>}
                </div>
                {ok('contacts.edit') && <button className="icon-btn sm plain" aria-label={`Retirer ${p.name}`} onClick={() => updateContact(c.id, { people: c.people.filter((x) => x.id !== p.id) })}><Icon name="x" size={14} /></button>}
              </div>
            ))}
            {ok('contacts.edit') && <button className="btn link sm" style={{ alignSelf: 'flex-start' }} onClick={() => setModal({ type: 'person' })}>+ Ajouter un interlocuteur</button>}
          </section>

          <section className="card pad stack12" aria-label="Qualification">
            <div className="row between"><span className="lbl">Qualification</span>{ok('contacts.edit') && <button className="btn link sm" onClick={() => setModal({ type: 'edit' })}>Modifier</button>}</div>
            <dl className="kv sm">
              {QUALIFICATION.map((x) => <Fragment key={x.key}><dt>{x.label}</dt><dd>{q[x.key] || '—'}</dd></Fragment>)}
            </dl>
            {(c.tags || []).length > 0 && <div className="row wrap gap4">{c.tags.map((t) => (
              <span key={t} className="pill p-violet">#{t}{ok('contacts.edit') && <button className="btn link" style={{ minHeight: 0, color: 'inherit' }} aria-label={`Retirer le tag ${t}`} onClick={() => updateContact(c.id, { tags: c.tags.filter((x) => x !== t) })}>×</button>}</span>
            ))}</div>}
          </section>

          <section className="card pad stack12" aria-label="Opportunité">
            <div className="lbl">{brand.features.catalog ? `${P.one} & montant` : 'Opportunité'}</div>
            {brand.features.catalog && (
              <>
                <div className="field"><span className="field-l">{productTypeLabel(state, c.courseId)}</span>
                  <ProductPicker state={state} disabled={!ok('contacts.edit')} value={c.courseId} idPrefix={`cd-${c.id}`} requireType={!!allowedTypeIds(state)} typeValue={contactTypeId(state, c)} onTypeChange={(t) => { updateContact(c.id, { productTypeId: t }); const tt = (state.productTypes || []).find((x) => x.id === t); if (tt) toast(`Activité : ${tt.many}`); }} onChange={(id, created) => { const co = created || courseById(state, id); updateContact(c.id, { courseId: id || null, ...(co ? { value: co.price } : {}) }); toast(co ? `${P.one} : ${co.name}` : 'Produit retiré'); }} /></div>
                {courseById(state, c.courseId) && (
                  <div className="muted sm">{[courseById(state, c.courseId).duration, (() => { const ss = (courseById(state, c.courseId).sessions || []).filter((x) => new Date(x.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start))[0]; return ss ? `prochaine session : ${fDate(ss.start)} (${ss.schedule})` : ''; })()].filter(Boolean).join(' · ')}</div>
                )}
              </>
            )}
            <label className="field"><span className="field-l">{LABELS.value}</span>
              <input type="number" min="0" step="100" disabled={!ok('contacts.edit')} defaultValue={c.value || ''} key={`v${c.value}`} onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== c.value) { updateContact(c.id, { value: v }); toast('Valeur mise à jour'); } }} /></label>
            <label className="field"><span className="field-l">Probabilité de signature : {c.probability || 0}%</span>
              <input type="range" disabled={!ok('contacts.edit')} min="0" max="100" step="5" value={c.probability || 0} onChange={(e) => updateContact(c.id, { probability: Number(e.target.value) })} style={{ accentColor: 'var(--primary)' }} /></label>
            <div className="muted sm">Pondéré : <b>{fMoney((c.value || 0) * (c.probability || 0) / 100)}</b></div>
          </section>
        </div>

        <section className="card pad grow2" aria-label="Activité">
          <Composer contact={c} />
          <div className="row between wrap gap8" style={{ margin: '20px 0 4px' }}>
            <b>Historique ({acts.length})</b>
            <div className="seg">
              {[['all', 'Tout'], ['call', 'Appels'], ['note', 'Notes'], ['rdv', 'RDV'], ['email', 'Messages']].map(([k, l]) => (
                <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} aria-pressed={filter === k}>{l}</button>
              ))}
            </div>
          </div>
          {shown.length === 0 && <Empty icon="note" title="Aucune activité" text="Utilisez le bloc ci-dessus pour consigner un appel, une note ou un RDV." />}
          {shown.map((a) => {
            const [ic, cls] = ACT_ICON[a.type] || ACT_ICON.note;
            const u = userById(state, a.userId);
            return (
              <div className="tl" key={a.id}>
                <span className={`ico ${cls}`}><Icon name={ic} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row wrap gap8">
                    <b>{ACTIVITY_TYPES[a.type] || a.type}</b>
                    {a.outcome && <span className={`pill ${OUT_CLS[a.outcome] || 'p-gray'}`} style={{ padding: '0 8px' }}>{a.type === 'report' ? EVAL[a.outcome] : outcomeLabel(a.outcome)}</span>}
                    <span className="muted sm">— {u?.name.split(' ')[0] || '?'} · {fDateTime(a.at)} ({fRelative(a.at)})</span>
                    {a.type === 'note' && a.userId === state.settings.currentUserId && (
                      <button className="icon-btn sm plain" style={{ marginLeft: 'auto' }} aria-label="Supprimer la note" onClick={async () => { if (await confirm({ title: 'Supprimer la note', message: 'Supprimer cette note ?', ok: 'Supprimer', danger: true })) deleteActivity(a.id); }}><Icon name="trash" size={14} /></button>
                    )}
                  </div>
                  {a.text && (a.type === 'note' || a.type === 'call' || a.type === 'email' || a.type === 'report' ? <div className="bubble">{a.text}</div> : <div className="muted sm">{a.text}</div>)}
                </div>
              </div>
            );
          })}
        </section>

        <div className="grow1 stack16">
          {nextRdv ? (
            <section className="rdv-card" aria-label="Prochain rendez-vous">
              <div className="lbl">Prochain rendez-vous</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{isToday(nextRdv.start) ? "Aujourd'hui" : fShort(nextRdv.start)} · {fTime(nextRdv.start)}</div>
              <div className="sm soft-t">{nextRdv.mode === 'online' ? 'En ligne' : `Présentiel · ${nextRdv.location}`}<br />{nextRdv.title} · {nextRdv.duration} min</div>
              <div className="row wrap gap8">
                {nextRdv.mode === 'online'
                  ? <a className="btn small ghost" href={nextRdv.link || 'https://meet.google.com/new'} target="_blank" rel="noreferrer">Rejoindre</a>
                  : <a className="btn small ghost" href={mapsHref(nextRdv.location)} target="_blank" rel="noreferrer">Itinéraire</a>}
                <button className="btn small outline" onClick={() => { addTask({ title: `Préparer le RDV (${nextRdv.title || 'démo'})`, due: new Date(new Date(nextRdv.start).getTime() - 3 * 36e5).toISOString(), contactId: c.id, type: 'todo', priority: 'high' }); toast('Tâche de préparation ajoutée'); }}>Préparer</button>
                <button className="btn small outline" onClick={() => setModal({ type: 'rdvEdit', rdv: nextRdv })}>Reporter</button>
              </div>
              <div className="row wrap gap8 sep">
                <button className="btn small outline" onClick={() => setModal({ type: 'report', rdv: nextRdv })}>Faire le compte-rendu</button>
                <button className="btn small outline" onClick={async () => { if (await confirm({ title: 'Annuler le RDV', message: 'Annuler ce rendez-vous ?', ok: 'Annuler le RDV', danger: true })) { updateRdv(nextRdv.id, { status: 'cancelled' }); toast('RDV annulé'); } }}>Annuler</button>
              </div>
            </section>
          ) : (
            <section className="card pad stack8" aria-label="Rendez-vous">
              <div className="lbl">Rendez-vous</div>
              <div className="muted sm">Aucun rendez-vous planifié.</div>
              <button className="btn primary" onClick={() => setModal({ type: 'rdv' })}><Icon name="calendar" size={16} />Planifier un RDV</button>
            </section>
          )}
          {pastRdvs.length > 0 && (
            <section className="card pad stack8" aria-label="RDV passés">
              <div className="lbl">RDV passés</div>
              {pastRdvs.map((r) => (
                <div key={r.id} className="sm">
                  <b>{fDate(r.start)}</b> · {r.mode === 'online' ? 'En ligne' : 'Présentiel'} {r.status === 'cancelled' ? <span className="pill p-gray">Annulé</span> : r.evaluation && <span className={`pill ${OUT_CLS[r.evaluation]}`}>{EVAL[r.evaluation]}</span>}
                  {r.report && <div className="muted">{r.report}</div>}
                </div>
              ))}
            </section>
          )}
          <section className="card pad stack8" aria-label="Tâches">
            <div className="row between"><span className="lbl">Tâches</span><button className="btn link sm" onClick={() => setModal({ type: 'task' })}>+ Ajouter</button></div>
            {tasks.length === 0 && <div className="muted sm">Aucune tâche.</div>}
            {tasks.map((t) => {
              const late = !t.done && new Date(t.due) < startOfDay();
              return (
                <div key={t.id} className="row gap8 sm" style={{ alignItems: 'flex-start' }}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} aria-label={`Terminer : ${t.title}`} style={{ marginTop: 2 }} />
                  <button className="btn link" style={{ flex: 1, minHeight: 0, justifyContent: 'flex-start', whiteSpace: 'normal', textAlign: 'left', color: t.done ? 'var(--muted)' : 'var(--ink)', fontWeight: 500, textDecoration: t.done ? 'line-through' : 'none' }} onClick={() => setModal({ type: 'taskEdit', task: t })}>{t.title}</button>
                  <span className="xs" style={{ color: late ? 'var(--red-ink)' : 'var(--muted)', fontWeight: late ? 600 : 400, whiteSpace: 'nowrap' }}>{fShort(t.due)}</span>
                  <button className="icon-btn sm plain" style={{ width: 28, height: 28 }} aria-label="Supprimer la tâche" onClick={() => deleteTask(t.id)}><Icon name="x" size={14} /></button>
                </div>
              );
            })}
          </section>
          <section className="card pad stack8" aria-label="Documents">
            <div className="row between"><span className="lbl">Documents</span>
              {ok('contacts.edit') && <label className="btn link sm" style={{ cursor: 'pointer' }}>+ Ajouter<input type="file" multiple className="sr" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} /></label>}</div>
            {(c.files || []).length === 0 && <div className="muted sm">Aucun document (devis, brochure, contrat…).</div>}
            {(c.files || []).map((f) => (
              <div key={f.id} className="row gap8 sm">
                <Icon name="file" size={16} />
                {f.data ? <a href={f.data} download={f.name} className="ell" style={{ flex: 1 }}>{f.name}</a> : <span className="ell" style={{ flex: 1 }}>{f.name}</span>}
                <span className="muted xs">{Math.ceil(f.size / 1024)} Ko</span>
                {ok('contacts.edit') && <button className="icon-btn sm plain" style={{ width: 28, height: 28 }} aria-label={`Supprimer ${f.name}`} onClick={() => updateContact(c.id, { files: c.files.filter((x) => x.id !== f.id) })}><Icon name="x" size={14} /></button>}
              </div>
            ))}
          </section>
        </div>
      </div>

      {modal?.type === 'edit' && <ContactForm contact={c} onClose={() => setModal(null)} />}
      {modal?.type === 'call' && <CallModal contact={c} onClose={() => setModal(null)} />}
      {modal?.type === 'lost' && <LostModal ids={[c.id]} onClose={() => setModal(null)} />}
      {modal?.type === 'won' && <WonModal contact={c} onClose={() => setModal(null)} />}
      {modal?.type === 'rdv' && <RdvForm contactId={c.id} onClose={() => setModal(null)} />}
      {modal?.type === 'rdvEdit' && <RdvForm rdv={modal.rdv} onClose={() => setModal(null)} />}
      {modal?.type === 'report' && <RdvReportModal rdv={modal.rdv} onClose={() => setModal(null)} />}
      {modal?.type === 'task' && <TaskForm contactId={c.id} onClose={() => setModal(null)} />}
      {modal?.type === 'taskEdit' && <TaskForm task={modal.task} contactId={c.id} onClose={() => setModal(null)} />}
      {modal?.type === 'person' && <PersonModal contact={c} onClose={() => setModal(null)} />}
      {modal?.type === 'pay' && <PaymentModal contact={c} onClose={() => setModal(null)} />}
      {modal?.type === 'print' && <PrintSheet contact={c} onClose={() => setModal(null)} />}
    </>
  );
}
