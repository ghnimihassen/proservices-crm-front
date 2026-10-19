import { useMemo, useState } from 'react';
import { Link } from '../nav';
import { useStore } from '../store/Store';
import { useUI, Empty, Avatar } from '../components/UI';
import { TaskForm } from '../components/Forms';
import Icon from '../components/Icon';
import { PRIORITIES } from '../store/constants';
import { contactById, userById } from '../store/selectors';
import { startOfDay, endOfDay, fDateTime, fTime, telHref } from '../utils';

const TYPE = { call: ['phone', 'Appel'], email: ['mail', 'Email'], todo: ['check', 'À faire'] };
const PRIO = { high: 'p-red', medium: 'p-orange', low: 'p-gray' };

export default function Tasks() {
  const { state, toggleTask, deleteTask, updateTask, can } = useStore();
  const { toast, confirm } = useUI();
  const [who, setWho] = useState('me');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState(null);

  const groups = useMemo(() => {
    const sod = startOfDay(); const eod = endOfDay();
    const s = q.toLowerCase();
    const list = state.tasks.filter((t) =>
      (who === 'all' || t.ownerId === (who === 'me' ? state.settings.currentUserId : who)) &&
      (!type || t.type === type) &&
      (!s || `${t.title} ${contactById(state, t.contactId)?.org || ''}`.toLowerCase().includes(s)))
      .sort((a, b) => new Date(a.due) - new Date(b.due));
    const open = list.filter((t) => !t.done);
    return [
      { id: 'late', title: 'En retard', tone: 'var(--red-ink)', items: open.filter((t) => new Date(t.due) < sod) },
      { id: 'today', title: "Aujourd'hui", tone: 'var(--ink)', items: open.filter((t) => new Date(t.due) >= sod && new Date(t.due) <= eod) },
      { id: 'next', title: 'À venir', tone: 'var(--ink)', items: open.filter((t) => new Date(t.due) > eod) },
      ...(showDone ? [{ id: 'done', title: 'Terminées', tone: 'var(--muted)', items: list.filter((t) => t.done).reverse() }] : []),
    ];
  }, [state, who, type, q, showDone]);

  const postpone = (t) => {
    const d = new Date(Math.max(Date.now(), new Date(t.due).getTime()));
    d.setDate(d.getDate() + 1);
    updateTask(t.id, { due: d.toISOString() });
    toast('Reportée d’un jour');
  };

  return (
    <>
      <div className="page-h">
        <div><h1>Tâches & relances</h1><p>Créées automatiquement après chaque appel (rappels, relances, préparation de RDV) ou à la main.</p></div>
        <button className="btn primary" onClick={() => setForm({})}><Icon name="plus" stroke={2} />Ajouter une tâche</button>
      </div>

      <div className="card row wrap gap8" style={{ padding: '12px 16px' }}>
        <label className="cmdk-trigger" style={{ flex: '1 1 220px', maxWidth: 320, height: 40, cursor: 'text' }}><Icon name="search" size={16} /><span className="sr">Rechercher</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une tâche" style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, color: 'var(--ink)' }} /></label>
        <label className="chip on"><span className="sr">Responsable</span>
          <select value={who} onChange={(e) => setWho(e.target.value)}><option value="me">Mes tâches</option>{can('data.all') && <option value="all">Toute l'équipe</option>}
            {can('data.all') && state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label className={`chip${type ? ' on' : ''}`}><span className="sr">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Tous types</option><option value="call">Appels</option><option value="email">Emails</option><option value="todo">À faire</option></select></label>
        <label className="chip" style={{ paddingRight: 12 }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Afficher les terminées</label>
      </div>

      {groups.every((g) => g.items.length === 0) && <div className="card"><Empty icon="check" title="Aucune tâche" text="Tout est à jour." /></div>}

      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.id} className="card pad" aria-label={g.title}>
          <div className="row between" style={{ marginBottom: 4 }}><h2 style={{ color: g.tone }}>{g.title}</h2><span className="pill p-gray">{g.items.length}</span></div>
          {g.items.map((t) => {
            const c = contactById(state, t.contactId);
            const u = userById(state, t.ownerId);
            const [ic, tl] = TYPE[t.type] || TYPE.todo;
            return (
              <div className="li" key={t.id}>
                <input type="checkbox" checked={t.done} onChange={() => { toggleTask(t.id); if (!t.done) toast('Tâche terminée'); }} aria-label={`Terminer : ${t.title}`} />
                <span className={`ico ${g.id === 'late' ? 'i-red' : 'i-violet'}`} title={tl}><Icon name={ic} size={16} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button className="btn link" style={{ minHeight: 0, color: 'var(--ink)', fontWeight: 600, textDecoration: t.done ? 'line-through' : 'none', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setForm({ task: t })}>{t.title}</button>
                  <div className="muted sm">{c ? <Link to={`/contacts/${c.id}`}>{c.org}</Link> : 'Sans contact'} · {g.id === 'today' ? fTime(t.due) : fDateTime(t.due)}</div>
                </div>
                <span className={`pill ${PRIO[t.priority]}`}>{PRIORITIES.find((p) => p.id === t.priority)?.label}</span>
                <Avatar name={u?.name || '?'} size={26} round />
                <div className="row gap4">
                  {t.type === 'call' && c?.phone && !t.done && <a className="icon-btn sm" href={telHref(c.phone)} aria-label={`Appeler ${c.org}`}><Icon name="phone" size={16} /></a>}
                  {!t.done && <button className="btn small ghost" onClick={() => postpone(t)}>+1 jour</button>}
                  <button className="icon-btn sm plain" aria-label="Supprimer" onClick={async () => { if (await confirm({ title: 'Supprimer la tâche', message: `Supprimer « ${t.title} » ?`, ok: 'Supprimer', danger: true })) { deleteTask(t.id); toast('Tâche supprimée'); } }}><Icon name="trash" size={16} /></button>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      {form && <TaskForm task={form.task} onClose={() => setForm(null)} />}
    </>
  );
}
