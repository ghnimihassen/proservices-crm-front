import { useMemo, useState } from 'react';
import { useNavigate } from '../nav';
import ActivitySwitch from '../components/ActivitySwitch';
import { useStore } from '../store/Store';
import { useUI, Avatar, Modal, Menu } from '../components/UI';
import { StagesModal, StageModal, DeleteStageModal } from '../components/StagesConfig';
import { ContactForm, LostModal, RdvForm } from '../components/Forms';
import Icon from '../components/Icon';
import { PIPELINE_STAGES, TYPES, stageById, LABELS, closingStage, isEntry, hasStage } from '../store/constants';
import brand from '../brand';
import { nextAction, userById, courseById } from '../store/selectors';
import { fMoney, fDateTime, startOfDay, isToday, fTime, fShort } from '../utils';

const LIMIT = 30;

export function WonModal({ contact, onClose }) {
  const { state, updateContact, recordPayment } = useStore();
  const { toast } = useUI();
  const [value, setValue] = useState(contact.value || courseById(state, contact.courseId)?.price || '');
  const [deposit, setDeposit] = useState('');
  const catalog = brand.features.catalog;
  const submit = () => {
    updateContact(contact.id, { stage: 'won', value: Number(value) || 0 });
    if (catalog && Number(deposit) > 0) recordPayment(contact.id, Number(deposit), 'cash');
    toast(catalog ? `${contact.org} est inscrit` : `${contact.org} est maintenant client`);
    onClose();
  };
  return (
    <Modal title={LABELS.convert} subtitle={[contact.org, courseById(state, contact.courseId)?.name].filter(Boolean).join(' · ')} onClose={onClose} width={460}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn success" onClick={submit}>Confirmer</button></>}>
      <div className="stack12">
        <label className="field"><span className="field-l">{catalog ? 'Montant (DT)' : 'Montant signé (DT / an)'}</span><input type="number" min="0" step="10" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        {catalog && <label className="field"><span className="field-l">Acompte encaissé maintenant (DT)</span><input type="number" min="0" step="10" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" /><span className="field-h">Espèces. Les facilités de paiement se planifient ensuite sur la fiche.</span></label>}
      </div>
    </Modal>
  );
}

export default function Pipeline() {
  const { state, updateContact } = useStore();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [owner, setOwner] = useState('me');
  const [type, setType] = useState('');
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [creating, setCreating] = useState(false);
  const [lost, setLost] = useState(null);
  const [won, setWon] = useState(null);
  const [rdvFor, setRdvFor] = useState(null);
  const [cfg, setCfg] = useState(null);
  const { moveStage, can } = useStore();
  const money = can('finance.view');
  const canCfg = can('pipeline.configure'), canEdit = can('contacts.edit'), all = can('data.all');

  const list = useMemo(() => state.contacts.filter((c) =>
    (owner === 'all' || c.ownerId === (owner === 'me' ? state.settings.currentUserId : owner)) && (!type || c.type === type)), [state, owner, type]);

  const stats = useMemo(() => {
    const active = list.filter((c) => !['won', 'lost'].includes(c.stage));
    const nego = list.filter((c) => c.stage === closingStage()).reduce((s, c) => s + (c.value || 0), 0);
    const weighted = active.reduce((s, c) => s + (c.value || 0) * ((c.probability || 0) / 100), 0);
    const wonList = list.filter((c) => c.stage === 'won' && c.wonAt);
    const avg = wonList.length ? Math.round(wonList.reduce((s, c) => s + (new Date(c.wonAt) - new Date(c.createdAt)) / 864e5, 0) / wonList.length) : 0;
    return { active: active.length, nego, weighted, avg, lost: list.filter((c) => c.stage === 'lost').length };
  }, [list]);

  const drop = (stage) => {
    const c = state.contacts.find((x) => x.id === dragId);
    setOver(null); setDragId(null);
    if (!c || c.stage === stage) return;
    if (stage === 'lost') return setLost([c.id]);
    if (stage === 'won') return setWon(c);
    if (stage === 'rdv' && hasStage('rdv') && !state.appointments.some((a) => a.contactId === c.id && a.status === 'planned')) return setRdvFor(c);
    updateContact(c.id, { stage });
    toast(`${c.org} → ${stageById(stage).label}`);
  };
  const dz = (stage) => ({
    onDragOver: (e) => { e.preventDefault(); if (over !== stage) setOver(stage); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(null); },
    onDrop: (e) => { e.preventDefault(); if (canEdit) drop(stage); },
  });

  return (
    <>
      <div className="page-h">
        <div><h1>Pipeline</h1><p>{LABELS.pipelineSub}</p></div>
        <div className="row gap8 wrap">
          {all && <label className="chip on"><span className="sr">Commercial</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="me">Mes {LABELS.contacts.toLowerCase()}</option>{all && <option value="all">Toute l'équipe</option>}
              {all && state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></label>}
          <label className={`chip${type ? ' on' : ''}`}><span className="sr">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Tous types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          {canCfg && <button className="btn ghost" onClick={() => setCfg({ t: 'all' })}><Icon name="settings" size={16} />Configurer les colonnes</button>}
          {can('contacts.create') && <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" stroke={2} />{LABELS.newContact}</button>}
        </div>
      </div>

      <ActivitySwitch variant="tabs" />

      <div className="card row wrap gap16" style={{ padding: '14px 18px' }}>
        <span><b>{stats.active}</b> <span className="muted">prospects actifs</span></span>
        {money && closingStage() && <span><b>{fMoney(stats.nego)}</b> <span className="muted">en « {stageById(closingStage()).label} »</span></span>}
        {money && <span><b>{fMoney(stats.weighted)}</b> <span className="muted">pondéré (probabilité)</span></span>}
        <span><b>{stats.avg} j</b> <span className="muted">délai moyen contact → client</span></span>
      </div>

      <div className="board">
        {PIPELINE_STAGES.map((s, si) => {
          const cards = list.filter((c) => c.stage === s.id).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
          const shown = expanded[s.id] ? cards : cards.slice(0, LIMIT);
          const total = cards.reduce((sum, c) => sum + (c.value || 0), 0);
          return (
            <section key={s.id} className={`col${s.id === 'won' ? ' won' : ''}${over === s.id ? ' over' : ''}`} aria-label={s.label} {...dz(s.id)}>
              <div className="col-h">
                <span className="dot" style={{ background: s.color }} /><span className="lbl-t" title={s.label}>{s.label}</span>
                <span className="muted" style={{ marginLeft: 'auto', fontWeight: 500 }}>{cards.length}</span>
                {canCfg && <Menu fixed align="right" className="icon-btn plain" label={<><span aria-hidden="true" style={{ fontWeight: 800, letterSpacing: 1 }}>⋯</span><span className="sr">Options de la colonne {s.label}</span></>}>
                  <div className="menu-t">{s.label}</div>
                  <button role="menuitem" onClick={() => setCfg({ t: 'edit', stage: s })}><Icon name="edit" size={16} />Renommer / couleur</button>
                  {s.id !== 'won' && <button role="menuitem" onClick={() => setCfg({ t: 'add', after: s.id })}><Icon name="plus" size={16} />Ajouter une colonne à droite</button>}
                  {s.id !== 'won' && si > 0 && <button role="menuitem" onClick={() => moveStage(s.id, -1)}><Icon name="left" size={16} />Déplacer à gauche</button>}
                  {s.id !== 'won' && si < PIPELINE_STAGES.length - 2 && <button role="menuitem" onClick={() => moveStage(s.id, 1)}><Icon name="right" size={16} />Déplacer à droite</button>}
                  {s.id !== 'won' && <button role="menuitem" style={{ color: 'var(--red-ink)' }} onClick={() => setCfg({ t: 'del', stage: s })}><Icon name="trash" size={16} />Supprimer la colonne</button>}
                  <button role="menuitem" onClick={() => setCfg({ t: 'all' })}><Icon name="settings" size={16} />Toutes les colonnes…</button>
                </Menu>}
              </div>
              {money && total > 0 && <div className="muted xs" style={{ marginTop: -6, paddingLeft: 4 }}>{fMoney(total)}</div>}
              {shown.map((c) => {
                const n = nextAction(state, c.id);
                const late = n && new Date(n.at) < startOfDay();
                const rdv = state.appointments.find((a) => a.contactId === c.id && a.status === 'planned');
                const ownerU = userById(state, c.ownerId);
                return (
                  <div key={c.id} className={`kc${dragId === c.id ? ' dragging' : ''}`} draggable={canEdit} tabIndex={0} role="link" aria-label={`${c.org}, ${s.label}`}
                    onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.id); }}
                    onDragEnd={() => { setDragId(null); setOver(null); }}
                    onClick={() => navigate(`/contacts/${c.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/contacts/${c.id}`)}>
                    <div className="b">{c.org}</div>
                    <div className="muted xs">{courseById(state, c.courseId)?.name || [c.name, c.role].filter(Boolean).join(' · ') || c.source}</div>
                    {brand.features.catalog && c.stage === 'won' && c.payment && <span className={`pill ${c.payment.status === 'paid' ? 'p-green' : 'p-orange'}`} style={{ padding: '1px 8px', marginTop: 6 }}>{c.payment.status === 'paid' ? 'Payé' : `Reste ${fMoney((c.value || 0) - (c.payment.paid || 0))}`}</span>}
                    {rdv && (
                      <div className="row gap4 wrap" style={{ marginTop: 8 }}>
                        <span className={`pill ${rdv.mode === 'online' ? 'p-blue' : 'p-orange'}`} style={{ padding: '1px 8px' }}>{rdv.mode === 'online' ? 'En ligne' : 'Présentiel'}</span>
                        <span className="pill p-violet" style={{ padding: '1px 8px' }}>{isToday(rdv.start) ? `Auj. ${fTime(rdv.start)}` : `${fShort(rdv.start)} ${fTime(rdv.start)}`}</span>
                      </div>
                    )}
                    <div className="row between" style={{ marginTop: 10, gap: 8 }}>
                      <span className="xs" style={{ color: late ? 'var(--red-ink)' : 'var(--ink2)', fontWeight: late ? 600 : 500 }}>
                        {c.stage === 'won' ? `Signé ${fShort(c.wonAt)}` : n ? `${late ? 'En retard · ' : ''}${n.label}` : isEntry(c.stage) ? '1er appel' : 'Aucune action prévue'}
                      </span>
                      <span className="row gap4">{c.value > 0 && <b className="xs">{fMoney(c.value)}</b>}<Avatar name={ownerU?.name || '?'} size={22} round /></span>
                    </div>
                    {c.stage === closingStage() && (
                      <><div className="bar" style={{ height: 4, marginTop: 8 }}><span style={{ width: `${c.probability || 0}%`, background: s.color }} /></div>
                        <div className="muted xs" style={{ marginTop: 2 }}>Probabilité {c.probability || 0}%</div></>
                    )}
                    {n && !late && n.kind === 'task' && <div className="muted xs" style={{ marginTop: 2 }}>{fDateTime(n.at)}</div>}
                  </div>
                );
              })}
              {cards.length > LIMIT && (
                <button className="btn small" onClick={() => setExpanded((x) => ({ ...x, [s.id]: !x[s.id] }))}>
                  {expanded[s.id] ? 'Réduire' : `Voir les ${cards.length - LIMIT} autres`}
                </button>
              )}
              {cards.length === 0 && <div className="muted xs" style={{ textAlign: 'center', padding: 16 }}>Déposez une carte ici</div>}
            </section>
          );
        })}
        {canCfg && <button className="col-add" onClick={() => setCfg({ t: 'add' })}><Icon name="plus" />Ajouter une colonne</button>}
      </div>

      <div className={`lost-zone${over === 'lost' ? ' over' : ''}`} {...dz('lost')}>
        <Icon name="x" /><b>{stageById('lost').label} ({stats.lost})</b>
        <span>Déposez ici une carte : le motif de perte est demandé et une date de recontact peut être planifiée.</span>
        <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => navigate('/contacts?stage=lost')}>Voir les perdus dans la base</button>
      </div>

      {creating && <ContactForm onClose={() => setCreating(false)} />}
      {lost && <LostModal ids={lost} onClose={() => setLost(null)} />}
      {won && <WonModal contact={won} onClose={() => setWon(null)} />}
      {rdvFor && <RdvForm contactId={rdvFor.id} onClose={() => setRdvFor(null)} />}
      {cfg?.t === 'all' && <StagesModal onClose={() => setCfg(null)} />}
      {cfg?.t === 'edit' && <StageModal stage={cfg.stage} onClose={() => setCfg(null)} />}
      {cfg?.t === 'add' && <StageModal afterId={cfg.after} onClose={() => setCfg(null)} />}
      {cfg?.t === 'del' && <DeleteStageModal stage={cfg.stage} onClose={() => setCfg(null)} />}
    </>
  );
}
