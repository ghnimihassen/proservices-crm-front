import { useEffect, useMemo, useState } from 'react';
import { Link } from '../nav';
import { useStore } from '../store/Store';
import { useUI, Modal, Field } from './UI';
import Icon from './Icon';
import { STAGES, entryStage, closingStage, hasStage, SOURCES, TYPES, LOST_REASONS, CALL_OUTCOMES, PRIORITIES, QUALIFICATION, LABELS } from '../store/constants';
import brand from '../brand';
import { fMoney } from '../utils';
import { productTypeLabel } from '../store/selectors';
import ProductPicker from './ProductPicker';
import { defaultTypeId, allowedTypeIds } from '../store/permissions';
import { toLocalInput, fromLocalInput, addDays, startOfDay, fDayLong, fTime } from '../utils';

const at = (days, h, m = 0) => { const d = addDays(startOfDay(), days); d.setHours(h, m, 0, 0); return d; };
const nextBusinessSlots = () => {
  const out = [];
  let d = 1;
  while (out.length < 6) {
    const day = addDays(startOfDay(), d);
    if (day.getDay() !== 0) {
      out.push(at(d, 10, 0));
      out.push(at(d, 15, 0));
    }
    d++;
  }
  return out.slice(0, 6);
};

export function ContactSelect({ value, onChange, required }) {
  const { state } = useStore();
  const list = useMemo(() => [...state.contacts].sort((a, b) => a.org.localeCompare(b.org)), [state.contacts]);
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{required ? 'Choisir un contact…' : 'Aucun'}</option>
      {list.map((c) => <option key={c.id} value={c.id}>{c.org}{c.name ? ` — ${c.name}` : ''}</option>)}
    </select>
  );
}

export function UserSelect({ value, onChange }) {
  const { state } = useStore();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

/* ============ Contact (création / modification) ============ */
export function ContactForm({ contact, onClose, onSaved, defaults = {} }) {
  const { state, addContact, updateContact, findDuplicate } = useStore();
  const { toast } = useUI();
  const [f, setF] = useState(() => ({
    org: '', name: '', role: '', phone: '', email: '', city: '', type: '', source: '',
    ownerId: state.settings.currentUserId, stage: entryStage(), value: '', tags: '', courseId: '', productTypeId: defaultTypeId(state),
    ...(contact || {}), ...defaults,
    tagsText: (contact?.tags || []).join(', '),
    q: { ...Object.fromEntries(QUALIFICATION.map((x) => [x.key, ''])), ...(contact?.qualification || {}) },
  }));
  const catalog = state.catalog || [];
  const pickCourse = (e, created) => {
    const id = e.target.value;
    const course = created || catalog.find((c) => c.id === id);
    setF((x) => {
      const prev = catalog.find((c) => c.id === x.courseId);
      const keepValue = x.value && (!prev || Number(x.value) !== prev.price);
      return { ...x, courseId: id, productTypeId: course?.typeId || x.productTypeId, value: keepValue ? x.value : (course ? course.price : x.value) };
    });
  };
  const restricted = !!allowedTypeIds(state);
  const [force, setForce] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setQ = (k) => (e) => setF((x) => ({ ...x, q: { ...x.q, [k]: e.target.value } }));

  const dup = f.org || f.phone || f.email ? findDuplicate(f, contact?.id) : null;

  const submit = (e) => {
    e.preventDefault();
    if (!f.org.trim()) return setErr(`Le champ « ${LABELS.org} » est obligatoire.`);
    if (!f.phone.trim() && !f.email.trim()) return setErr('Renseignez au moins un téléphone ou un email.');
    if (restricted && !f.productTypeId && !f.courseId) return setErr('Choisissez l’activité (type de produit) du prospect.');
    if (dup && !force) return setErr('Un contact similaire existe déjà. Cochez « Ajouter quand même » pour continuer.');
    const data = {
      org: f.org.trim(), name: f.name.trim(), role: f.role.trim(), phone: f.phone.trim(), email: f.email.trim(),
      city: f.city.trim(), type: f.type, source: f.source, ownerId: f.ownerId, stage: f.stage,
      value: Number(f.value) || 0, tags: f.tagsText.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      qualification: f.q, courseId: f.courseId || null, productTypeId: f.productTypeId || '',
    };
    if (contact) {
      updateContact(contact.id, data);
      toast('Contact mis à jour');
      onSaved?.(contact);
    } else {
      const c = addContact(data);
      toast('Contact ajouté');
      onSaved?.(c);
    }
    onClose();
  };

  return (
    <Modal title={contact ? `Modifier le ${LABELS.contact}` : LABELS.newContact} subtitle="Les champs marqués * sont obligatoires" onClose={onClose} width={760}
      footer={<>
        <button type="button" className="btn ghost" onClick={onClose}>Annuler</button>
        <button type="submit" form="contact-form" className="btn primary">{contact ? 'Enregistrer' : `Ajouter le ${LABELS.contact}`}</button>
      </>}>
      <form id="contact-form" onSubmit={submit} className="grid2">
        <Field label={`${LABELS.org} *`}><input value={f.org} onChange={set('org')} placeholder={LABELS.orgPlaceholder} /></Field>
        <Field label="Type"><select value={f.type} onChange={set('type')}><option value="">—</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        {brand.features.catalog && (
          <div className="field full">
            <span className="field-l">Activité et {f.courseId ? productTypeLabel(state, f.courseId).toLowerCase() : 'produit'}{restricted ? ' *' : ''}</span>
            <ProductPicker state={state} value={f.courseId} onlyActive idPrefix="cf" requireType={restricted}
              typeValue={f.productTypeId} onTypeChange={(t) => setF((x) => ({ ...x, productTypeId: t }))}
              onChange={(id, created) => pickCourse({ target: { value: id } }, created)} />
            <span className="field-h">Le montant est rempli avec le prix du catalogue (modifiable)</span>
          </div>
        )}
        <Field label={LABELS.person}><input value={f.name} onChange={set('name')} placeholder="Prénom Nom" /></Field>
        <Field label={LABELS.personRole}><input value={f.role} onChange={set('role')} placeholder="Directeur, RH, Gérant…" /></Field>
        <Field label="Téléphone"><input value={f.phone} onChange={set('phone')} type="tel" placeholder="+216 …" /></Field>
        <Field label="Email"><input value={f.email} onChange={set('email')} type="email" placeholder="nom@domaine.tn" /></Field>
        <Field label="Ville"><input value={f.city} onChange={set('city')} placeholder="Tunis, Sfax…" /></Field>
        <Field label="Source"><select value={f.source} onChange={set('source')}><option value="">—</option>{SOURCES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Commercial responsable"><UserSelect value={f.ownerId} onChange={(v) => setF((x) => ({ ...x, ownerId: v }))} /></Field>
        <Field label="Étape"><select value={f.stage} onChange={set('stage')}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label={LABELS.value}><input value={f.value} onChange={set('value')} type="number" min="0" step="10" /></Field>
        <Field label="Tags" hint="Séparés par des virgules"><input value={f.tagsText} onChange={set('tagsText')} placeholder="paiements, multi-sites" /></Field>
        <details className="full" open={!!contact}>
          <summary className="lbl" style={{ cursor: 'pointer', padding: '6px 0' }}>Qualification (facultatif)</summary>
          <div className="grid2" style={{ marginTop: 10 }}>
            {QUALIFICATION.map((x) => <Field key={x.key} label={x.label}><input value={f.q[x.key] || ''} onChange={setQ(x.key)} /></Field>)}
          </div>
        </details>
        {dup && (
          <div className="alert warn full">
            <div>Contact similaire déjà présent : <b>{dup.org}</b> ({dup.phone || dup.email}). <Link to={`/contacts/${dup.id}`} onClick={onClose}>Ouvrir</Link></div>
            <label className="row gap8 sm"><input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> Ajouter quand même</label>
          </div>
        )}
        {err && <div className="alert err full">{err}</div>}
      </form>
    </Modal>
  );
}

/* ============ Rendez-vous ============ */
export function RdvForm({ rdv, contactId, defaultStart, onClose, onSaved, inline }) {
  const { state, addRdv, updateRdv } = useStore();
  const { toast } = useUI();
  const contact = state.contacts.find((c) => c.id === (rdv?.contactId || contactId));
  const [f, setF] = useState(() => ({
    contactId: rdv?.contactId || contactId || '',
    title: rdv?.title || LABELS.meeting,
    mode: rdv?.mode || 'online',
    start: toLocalInput(rdv?.start || defaultStart || nextBusinessSlots()[0]),
    duration: rdv?.duration || 60,
    location: rdv?.location || (brand.features.catalog ? (state.settings.centerAddress || '') : [contact?.org, contact?.city].filter(Boolean).join(', ')),
    link: rdv?.link || '',
    ownerId: rdv?.ownerId || state.settings.currentUserId,
    invite: true,
  }));
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const slots = useMemo(nextBusinessSlots, []);

  const build = () => {
    if (!f.contactId) { setErr('Choisissez un contact.'); return null; }
    if (!f.start) { setErr('Choisissez une date et une heure.'); return null; }
    return {
      contactId: f.contactId, title: f.title.trim(), mode: f.mode, start: fromLocalInput(f.start), duration: Number(f.duration) || 60,
      location: f.mode === 'onsite' ? f.location.trim() : '', link: f.mode === 'online' ? (f.link.trim() || 'https://meet.google.com/new') : '',
      ownerId: f.ownerId,
    };
  };
  const submit = (e) => {
    e?.preventDefault();
    const data = build();
    if (!data) return;
    if (inline) { onSaved?.(data); return; }
    if (rdv) { updateRdv(rdv.id, data); toast('Rendez-vous mis à jour'); }
    else { addRdv(data); toast(f.invite ? 'Rendez-vous planifié · invitation à envoyer' : 'Rendez-vous planifié'); }
    onSaved?.(data);
    onClose?.();
  };

  const body = (
    <form id="rdv-form" onSubmit={submit} className="grid2">
      {!contactId && !rdv && <Field label="Contact *" full><ContactSelect value={f.contactId} onChange={(v) => setF((x) => ({ ...x, contactId: v }))} required /></Field>}
      <div className="field full">
        <span className="field-l">Type de rendez-vous</span>
        <div className="seg" role="group" aria-label="Type de rendez-vous">
          <button type="button" className={f.mode === 'online' ? 'on' : ''} onClick={() => setF((x) => ({ ...x, mode: 'online' }))}><Icon name="video" size={16} />En ligne</button>
          <button type="button" className={f.mode === 'onsite' ? 'on' : ''} onClick={() => setF((x) => ({ ...x, mode: 'onsite' }))}><Icon name="map" size={16} />Présentiel</button>
        </div>
      </div>
      <div className="field full">
        <span className="field-l">Créneaux rapides</span>
        <div className="row wrap gap8">
          {slots.map((s) => {
            const v = toLocalInput(s);
            return <button type="button" key={v} className={`slot${f.start === v ? ' on' : ''}`} onClick={() => setF((x) => ({ ...x, start: v }))}>
              {fDayLong(s).replace(/^\w/, (c) => c.toUpperCase()).split(' ').slice(0, 3).join(' ')} · {fTime(s)}
            </button>;
          })}
        </div>
      </div>
      <Field label="Date et heure *"><input type="datetime-local" value={f.start} onChange={set('start')} /></Field>
      <Field label="Durée"><select value={f.duration} onChange={set('duration')}>{[30, 45, 60, 90, 120].map((d) => <option key={d} value={d}>{d} min</option>)}</select></Field>
      <Field label="Objet" full><input value={f.title} onChange={set('title')} /></Field>
      {f.mode === 'onsite'
        ? <Field label="Adresse" full><input value={f.location} onChange={set('location')} placeholder="Adresse du rendez-vous" /></Field>
        : <Field label="Lien de visio" full hint="Laissez vide pour créer un lien Google Meet"><input value={f.link} onChange={set('link')} placeholder="https://meet.google.com/…" /></Field>}
      <Field label="Commercial"><UserSelect value={f.ownerId} onChange={(v) => setF((x) => ({ ...x, ownerId: v }))} /></Field>
      {!rdv && <label className="row gap8 sm" style={{ alignSelf: 'end', minHeight: 44 }}><input type="checkbox" checked={f.invite} onChange={(e) => setF((x) => ({ ...x, invite: e.target.checked }))} />Envoyer l'invitation au prospect</label>}
      {err && <div className="alert err full">{err}</div>}
      {inline && <div className="full row end"><button type="submit" className="btn primary">Confirmer le RDV</button></div>}
    </form>
  );
  if (inline) return body;
  return (
    <Modal title={rdv ? 'Modifier / reporter le rendez-vous' : 'Nouveau rendez-vous'} subtitle={contact ? contact.org : undefined} onClose={onClose} width={680}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button type="submit" form="rdv-form" className="btn primary">{rdv ? 'Enregistrer' : 'Planifier'}</button></>}>
      {body}
    </Modal>
  );
}

/* ============ Compte-rendu de RDV ============ */
export function RdvReportModal({ rdv, onClose }) {
  const { state, completeRdv, addTask } = useStore();
  const { toast } = useUI();
  const c = state.contacts.find((x) => x.id === rdv.contactId);
  const [ev, setEv] = useState(rdv.evaluation || 'positive');
  const [report, setReport] = useState(rdv.report || '');
  const suggested = { positive: closingStage() || c?.stage, neutral: c?.stage || entryStage(), negative: 'lost' };
  const [next, setNext] = useState(suggested[ev]);
  const [follow, setFollow] = useState(toLocalInput(at(2, 10)));
  const pick = (v) => { setEv(v); setNext(suggested[v]); };
  const submit = () => {
    completeRdv(rdv.id, ev, report.trim(), next);
    if (follow && next !== 'lost' && next !== 'won') addTask({ title: 'Relance après RDV', due: fromLocalInput(follow), contactId: rdv.contactId, type: 'call', priority: 'high' });
    toast('Compte-rendu enregistré');
    onClose();
  };
  return (
    <Modal title="Compte-rendu du rendez-vous" subtitle={c?.org} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" onClick={submit}>Enregistrer</button></>}>
      <div className="stack16">
        <div className="field"><span className="field-l">Évaluation</span>
          <div className="seg" role="radiogroup" aria-label="Évaluation">
            {[['positive', 'Positive'], ['neutral', 'Neutre'], ['negative', 'Négative']].map(([v, l]) => (
              <button key={v} type="button" role="radio" aria-checked={ev === v} className={ev === v ? `on ev-${v}` : ''} onClick={() => pick(v)}>{l}</button>
            ))}
          </div>
        </div>
        <Field label="Compte-rendu"><textarea rows={5} value={report} onChange={(e) => setReport(e.target.value)} placeholder="Ce qui a été présenté, objections, prochaines étapes…" /></Field>
        <div className="grid2">
          <Field label="Nouvelle étape du prospect"><select value={next} onChange={(e) => setNext(e.target.value)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Relance programmée" hint="Laissez vide pour ne pas créer de tâche"><input type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

/* ============ Tâche ============ */
export function TaskForm({ task, contactId, defaultDue, onClose }) {
  const { state, addTask, updateTask } = useStore();
  const { toast } = useUI();
  const [f, setF] = useState(() => ({
    title: task?.title || '', type: task?.type || 'call', contactId: task?.contactId || contactId || '',
    due: toLocalInput(task?.due || defaultDue || at(0, 17)), priority: task?.priority || 'medium',
    ownerId: task?.ownerId || state.settings.currentUserId,
  }));
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.title.trim()) return setErr('Donnez un titre à la tâche.');
    const data = { ...f, title: f.title.trim(), contactId: f.contactId || null, due: fromLocalInput(f.due) };
    if (task) { updateTask(task.id, data); toast('Tâche mise à jour'); } else { addTask(data); toast('Tâche ajoutée'); }
    onClose();
  };
  return (
    <Modal title={task ? 'Modifier la tâche' : 'Nouvelle tâche'} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button type="submit" form="task-form" className="btn primary">{task ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <form id="task-form" onSubmit={submit} className="grid2">
        <Field label="Titre *" full><input value={f.title} onChange={set('title')} placeholder="Ex. Relancer le devis" /></Field>
        <Field label="Type"><select value={f.type} onChange={set('type')}>
          <option value="call">Appel</option><option value="email">Email</option><option value="todo">À faire</option>
        </select></Field>
        <Field label="Priorité"><select value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
        {!contactId && <Field label="Contact lié" full><ContactSelect value={f.contactId} onChange={(v) => setF((x) => ({ ...x, contactId: v }))} /></Field>}
        <Field label="Échéance"><input type="datetime-local" value={f.due} onChange={set('due')} /></Field>
        <Field label="Responsable"><UserSelect value={f.ownerId} onChange={(v) => setF((x) => ({ ...x, ownerId: v }))} /></Field>
        {err && <div className="alert err full">{err}</div>}
      </form>
    </Modal>
  );
}

/* ============ Perdu (motif) ============ */
export function LostModal({ ids, onClose, onDone }) {
  const { bulkUpdate, addTask } = useStore();
  const { toast } = useUI();
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [recontact, setRecontact] = useState('');
  const submit = () => {
    bulkUpdate(ids, { stage: 'lost', lostReason: reason });
    if (recontact) ids.forEach((id) => addTask({ title: 'Recontacter (perdu)', due: fromLocalInput(recontact + 'T10:00'), contactId: id, type: 'call', priority: 'low' }));
    toast(ids.length > 1 ? `${ids.length} contacts marqués perdus` : 'Contact marqué perdu');
    onDone?.(); onClose();
  };
  return (
    <Modal title="Marquer comme perdu" subtitle={ids.length > 1 ? `${ids.length} contacts` : undefined} onClose={onClose} width={480}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn danger" onClick={submit}>Marquer perdu</button></>}>
      <div className="stack16">
        <Field label="Motif de perte"><select value={reason} onChange={(e) => setReason(e.target.value)}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <Field label="Recontacter le" hint="Optionnel — une tâche de rappel sera créée"><input type="date" value={recontact} onChange={(e) => setRecontact(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/* ============ Résultat d'appel (session + fiche) ============ */
export function OutcomePanel({ contactId, note, onSaved, saveLabel = 'Enregistrer', hotkeys = false }) {
  const { state, logCall } = useStore();
  const { toast } = useUI();
  const [outcome, setOutcome] = useState(null);
  useEffect(() => {
    if (!hotkeys) return undefined;
    const h = (e) => {
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
      const o = CALL_OUTCOMES.find((x) => x.key === e.key);
      if (o) { e.preventDefault(); setOutcome(o.id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [hotkeys]);
  const [laterAt, setLaterAt] = useState(toLocalInput(at(0, Math.min(new Date().getHours() + 2, 18))));
  const [retry, setRetry] = useState(true);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [recontact, setRecontact] = useState('');
  const [followAt, setFollowAt] = useState(toLocalInput(at(2, 10)));
  const c = state.contacts.find((x) => x.id === contactId);

  const save = (rdv) => {
    if (!outcome) return;
    const opts = {};
    if (outcome === 'noanswer' && retry) opts.retryAt = at(1, 10).toISOString();
    if (outcome === 'later') opts.laterAt = fromLocalInput(laterAt);
    if (outcome === 'no') { opts.lostReason = reason; if (recontact) opts.recontactAt = fromLocalInput(recontact + 'T10:00'); }
    if (outcome === 'interested') opts.followAt = fromLocalInput(followAt);
    if (outcome === 'yes') opts.rdv = rdv;
    logCall(contactId, outcome, note, opts);
    toast(outcome === 'yes' ? 'RDV fixé et appel enregistré' : 'Appel enregistré');
    setOutcome(null);
    onSaved?.(outcome);
  };

  const quickLater = [['Dans 2 h', () => new Date(Date.now() + 2 * 36e5)], ['Demain 10:00', () => at(1, 10)], ['Dans 3 jours', () => at(3, 10)], ['Dans 1 semaine', () => at(7, 10)]];

  return (
    <div className="stack12">
      <div className="outcomes">
        {CALL_OUTCOMES.map((o) => (
          <button key={o.id} type="button" className={`oc oc-${o.id}${outcome === o.id ? ' on' : ''}`} aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)}>
            <span className="kbd">{o.key}</span>{o.label}
          </button>
        ))}
      </div>

      {outcome === 'noanswer' && (
        <div className="sub sub-gray">
          <label className="row gap8 sm"><input type="checkbox" checked={retry} onChange={(e) => setRetry(e.target.checked)} />Programmer un nouvel essai demain 10:00</label>
          <div className="muted sm">Sans réponse : {(c?.noAnswerCount || 0) + 1} fois{(c?.noAnswerCount || 0) + 1 >= 3 ? ' — pensez à WhatsApp ou email' : ''}</div>
          <div className="row end"><button className="btn primary" onClick={() => save()}>{saveLabel}</button></div>
        </div>
      )}
      {outcome === 'later' && (
        <div className="sub sub-orange">
          <b>Programmer le rappel</b>
          <div className="row wrap gap8">
            {quickLater.map(([l, fn]) => { const v = toLocalInput(fn()); return <button key={l} type="button" className={`slot${laterAt === v ? ' on' : ''}`} onClick={() => setLaterAt(v)}>{l}</button>; })}
          </div>
          <Field label="Date et heure du rappel"><input type="datetime-local" value={laterAt} onChange={(e) => setLaterAt(e.target.value)} /></Field>
          <div className="row end"><button className="btn primary" onClick={() => save()}>{saveLabel}</button></div>
        </div>
      )}
      {outcome === 'no' && (
        <div className="sub sub-red">
          <div className="grid2">
            <Field label="Motif"><select value={reason} onChange={(e) => setReason(e.target.value)}>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select></Field>
            <Field label="Recontacter le (optionnel)"><input type="date" value={recontact} onChange={(e) => setRecontact(e.target.value)} /></Field>
          </div>
          <div className="row end"><button className="btn primary" onClick={() => save()}>{saveLabel}</button></div>
        </div>
      )}
      {outcome === 'interested' && (
        <div className="sub sub-orange">
          <b>Intéressé, mais pas encore de RDV</b>
          <Field label="Relance prévue le"><input type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} /></Field>
          <div className="row end"><button className="btn primary" onClick={() => save()}>{saveLabel}</button></div>
        </div>
      )}
      {outcome === 'yes' && (
        <div className="sub sub-violet">
          <div className="row between wrap gap8"><b>Fixer le rendez-vous</b><span className="muted sm">Le contact passe automatiquement en « RDV fixé »</span></div>
          <RdvForm inline contactId={contactId} onSaved={(rdv) => save(rdv)} key={contactId} />
        </div>
      )}
    </div>
  );
}
