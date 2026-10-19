import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from '../nav';
import { useStore } from '../store/Store';
import { useUI, Modal, Field, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { fDate, fMoney, toLocalInput, fromLocalInput, uid } from '../utils';
import { guidesFor, typeById } from '../store/selectors';
import { LABELS } from '../store/constants';

/* ---------- Type de produit (ex. Formation / Formations) ---------- */
export function TypeModal({ type, onClose, onSaved }) {
  const { state, addProductType, updateProductType, deleteProductType } = useStore();
  const { toast, confirm } = useUI();
  const [one, setOne] = useState(type?.one || '');
  const [many, setMany] = useState(type?.many || '');
  const [touchedMany, setTouchedMany] = useState(!!type);
  const [err, setErr] = useState('');
  const count = type ? (state.catalog || []).filter((p) => p.typeId === type.id).length : 0;
  const onOne = (v) => { setOne(v); if (!touchedMany) setMany(v ? (/[sxz]$/i.test(v) ? v : `${v}s`) : ''); };
  const submit = (e) => {
    e.preventDefault();
    const o = one.trim(); const m = many.trim();
    if (!o || !m) return setErr('Renseignez le nom au singulier et au pluriel.');
    if ((state.productTypes || []).some((t) => t.id !== type?.id && t.one.toLowerCase() === o.toLowerCase())) return setErr('Ce type existe déjà.');
    if (type) { updateProductType(type.id, { one: o, many: m }); toast('Type renommé'); onSaved?.(type); }
    else { const t = addProductType({ one: o, many: m }); toast(`Type « ${m} » ajouté au menu`); onSaved?.(t); }
    onClose();
  };
  const remove = async () => {
    const others = (state.productTypes || []).filter((t) => t.id !== type.id);
    if (count > 0 && !others.length) { setErr('Créez d’abord un autre type pour y déplacer ses produits.'); return; }
    const msg = count ? `Supprimer « ${type.many} » ? Ses ${count} produit(s) seront déplacés dans « ${others[0].many} ».` : `Supprimer « ${type.many} » ?`;
    if (await confirm({ title: 'Supprimer le type', message: msg, ok: 'Supprimer', danger: true })) {
      deleteProductType(type.id, others[0]?.id); toast('Type supprimé'); onSaved?.(null); onClose();
    }
  };
  return (
    <Modal title={type ? `Modifier le type « ${type.many} »` : 'Nouveau type de produit'} subtitle="Chaque type apparaît dans le menu Produits, avec ses catégories" onClose={onClose} width={520}
      footer={<>
        {type && <button className="btn ghost" style={{ marginRight: 'auto', color: 'var(--red-ink)' }} onClick={remove}><Icon name="trash" size={16} />Supprimer</button>}
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" type="submit" form="type-form">{type ? 'Enregistrer' : 'Ajouter au menu'}</button>
      </>}>
      <form id="type-form" className="grid2" onSubmit={submit}>
        <Field label="Nom au singulier *" hint="Ex. Formation, Service, Matériel, Abonnement"><input value={one} onChange={(e) => onOne(e.target.value)} /></Field>
        <Field label="Nom au pluriel (menu) *"><input value={many} onChange={(e) => { setTouchedMany(true); setMany(e.target.value); }} /></Field>
        {err && <div className="alert err full">{err}</div>}
      </form>
    </Modal>
  );
}

/* ---------- Produit ---------- */
export function CourseForm({ course, defaultTypeId, onClose, onSaved }) {
  const { state, addCourse, updateCourse } = useStore();
  const { toast } = useUI();
  const [newType, setNewType] = useState(false);
  const [f, setF] = useState(() => ({
    name: '', category: '', duration: '', description: '', price: '', active: true, sessions: [],
    typeId: defaultTypeId || state.productTypes?.[0]?.id || '', ...(course || {}),
  }));
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setS = (id, k, v) => setF((x) => ({ ...x, sessions: x.sessions.map((s) => (s.id === id ? { ...s, [k]: v } : s)) }));
  const type = typeById(state, f.typeId);
  const cats = [...new Set((state.catalog || []).filter((p) => p.typeId === f.typeId).map((p) => p.category).filter(Boolean))].sort();
  const submit = (e) => {
    e.preventDefault();
    if (!f.typeId) return setErr('Choisissez ou créez un type de produit.');
    if (!f.name.trim()) return setErr('Le nom est obligatoire.');
    const data = { ...f, name: f.name.trim(), category: f.category.trim(), price: Number(f.price) || 0 };
    if (course) { updateCourse(course.id, data); toast('Modifications enregistrées'); } else { const p = addCourse(data); onSaved?.(p); toast(`« ${data.name} » ajouté dans ${type?.many || 'Produits'}`); }
    onClose();
  };
  return (
    <Modal title={course ? `Modifier : ${course.name}` : `Ajouter ${type ? `— ${type.one}` : 'un produit'}`} onClose={onClose} width={760}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button type="submit" form="course-form" className="btn primary">{course ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <form id="course-form" onSubmit={submit} className="stack16">
        <div className="grid2">
          <div className="field">
            <span className="field-l">Type de produit *</span>
            <div className="row gap8">
              <label className="sr" htmlFor="ptype">Type de produit</label>
              <select id="ptype" className="inp" value={f.typeId} onChange={set('typeId')} style={{ flex: 1 }}>
                <option value="">Choisir…</option>
                {(state.productTypes || []).map((t) => <option key={t.id} value={t.id}>{t.one}</option>)}
              </select>
              <button type="button" className="btn small soft" onClick={() => setNewType(true)}><Icon name="plus" size={16} />Type</button>
            </div>
          </div>
          <Field label="Catégorie" hint={cats.length ? `Existantes : ${cats.join(', ')}` : 'Nouvelle catégorie : elle apparaîtra en onglet'}>
            <input value={f.category} onChange={set('category')} list="cat-list" placeholder="Ex. Informatique, Langues…" />
          </Field>
          <datalist id="cat-list">{cats.map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="Nom *" full><input value={f.name} onChange={set('name')} placeholder="Ex. Développement web, Pack Premium…" /></Field>
          <Field label="Durée / détail" hint="Ex. 3 mois · 120 h, abonnement annuel, 1 unité"><input value={f.duration} onChange={set('duration')} /></Field>
          <Field label="Prix (DT)"><input type="number" min="0" step="10" value={f.price} onChange={set('price')} /></Field>
          <Field label="Description" full><textarea rows={3} value={f.description} onChange={set('description')} placeholder="Ce qui est inclus, pour qui, avantages…" /></Field>
          <label className="row gap8" style={{ minHeight: 44 }}><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />En vente actuellement</label>
        </div>
        <div className="stack8">
          <div className="row between"><span className="lbl">Sessions / dates (facultatif)</span>
            <button type="button" className="btn small soft" onClick={() => setF((x) => ({ ...x, sessions: [...x.sessions, { id: uid(), start: new Date(Date.now() + 14 * 864e5).toISOString(), schedule: '', mode: 'Présentiel', seats: 15 }] }))}><Icon name="plus" size={16} />Ajouter une date</button></div>
          {f.sessions.length === 0 && <div className="muted sm">Aucune date planifiée.</div>}
          {f.sessions.map((s) => (
            <div key={s.id} className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', padding: 12, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <Field label="Début"><input type="datetime-local" value={toLocalInput(s.start)} onChange={(e) => setS(s.id, 'start', fromLocalInput(e.target.value))} /></Field>
              <Field label="Horaire / précision"><input value={s.schedule} onChange={(e) => setS(s.id, 'schedule', e.target.value)} placeholder="Soir · 18h–21h" /></Field>
              <Field label="Mode"><select value={s.mode} onChange={(e) => setS(s.id, 'mode', e.target.value)}>{['Présentiel', 'En ligne', 'Hybride', 'Livraison', 'Sur site'].map((m) => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Places / quantité"><input type="number" min="1" value={s.seats} onChange={(e) => setS(s.id, 'seats', Number(e.target.value) || 1)} /></Field>
              <button type="button" className="btn small ghost" style={{ alignSelf: 'end' }} onClick={() => setF((x) => ({ ...x, sessions: x.sessions.filter((y) => y.id !== s.id) }))}>Retirer</button>
            </div>
          ))}
        </div>
        {err && <div className="alert err">{err}</div>}
      </form>
      {newType && <TypeModal onClose={() => setNewType(false)} onSaved={(t) => t && setF((x) => ({ ...x, typeId: t.id }))} />}
    </Modal>
  );
}

export default function Products() {
  const { state, deleteCourse, can } = useStore();
  const M = can('products.manage');
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const typeId = params.get('type') || '';
  const type = typeById(state, typeId);
  const cat = params.get('cat') || '';
  const [form, setForm] = useState(null);
  const [typeModal, setTypeModal] = useState(null);
  const go = (p) => setParams(Object.fromEntries(Object.entries(p).filter(([, v]) => v)));

  const inType = (state.catalog || []).filter((p) => !typeId || p.typeId === typeId);
  const cats = [...new Set(inType.map((c) => c.category).filter(Boolean))].sort();

  const rows = useMemo(() => inType.filter((c) => !cat || c.category === cat).map((c) => {
    const ps = state.contacts.filter((x) => x.courseId === c.id);
    const won = ps.filter((x) => x.stage === 'won');
    return { c, open: ps.filter((x) => !['won', 'lost'].includes(x.stage)).length, won: won.length, ca: won.reduce((s, x) => s + (x.value || 0), 0), conv: ps.length ? Math.round((won.length / ps.length) * 100) : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, typeId, cat]);

  const remove = async (c) => {
    if (await confirm({ title: 'Supprimer', message: `Supprimer « ${c.name} » ? Les ${LABELS.contacts.toLowerCase()} liés n'auront plus de produit choisi.`, ok: 'Supprimer', danger: true })) {
      deleteCourse(c.id); toast('Supprimé');
    }
  };

  if (typeId && !type) return <Empty icon="book" title="Type introuvable" text="Il a peut-être été supprimé." action={<button className="btn primary" onClick={() => navigate('/produits')}>Voir tous les produits</button>} />;

  return (
    <>
      <div className="page-h">
        <div>
          <div className="muted sm"><button className="btn link sm" style={{ minHeight: 0 }} onClick={() => navigate('/produits')}>Produits</button>{type ? ` / ${type.many}` : ''}</div>
          <h1>{type ? type.many : 'Tous les produits'} <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>{inType.length}</span></h1>
          <p>{type ? `Catégories, prix, dates et demande pour chaque ${type.one.toLowerCase()}. Le prix est repris sur la fiche du ${LABELS.contact}.` : 'Tout ce que vous vendez, par type. Ajoutez un type (Formations, Services, Matériel…) : il apparaît dans le menu Produits.'}</p>
        </div>
        <div className="row gap8 wrap">
          {M && (type ? <button className="btn ghost" onClick={() => setTypeModal({ type })}><Icon name="edit" size={16} />Modifier le type</button>
            : <button className="btn ghost" onClick={() => setTypeModal({})}><Icon name="plus" size={16} />Nouveau type</button>)}
          {M && <button className="btn primary" onClick={() => (state.productTypes || []).length ? setForm({}) : setTypeModal({})}><Icon name="plus" stroke={2} />{type ? `Ajouter — ${type.one}` : 'Ajouter un produit'}</button>}
        </div>
      </div>

      {!type && (state.productTypes || []).length > 0 && (
        <div className="tabs" role="tablist" aria-label="Types de produits">
          <button role="tab" aria-selected className="tab on">Tous <span className="n">{(state.catalog || []).length}</span></button>
          {(state.productTypes || []).map((t) => (
            <button key={t.id} role="tab" aria-selected={false} className="tab" onClick={() => go({ type: t.id })}>{t.many} <span className="n">{(state.catalog || []).filter((p) => p.typeId === t.id).length}</span></button>
          ))}
        </div>
      )}
      {cats.length > 0 && (
        <div className="tabs" role="tablist" aria-label="Catégories">
          <button role="tab" aria-selected={!cat} className={`tab${!cat ? ' on' : ''}`} onClick={() => go({ type: typeId })}>{type ? 'Toutes' : 'Toutes catégories'}</button>
          {cats.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={`tab${cat === c ? ' on' : ''}`} onClick={() => go({ type: typeId, cat: c })}>{c} <span className="n">{inType.filter((p) => p.category === c).length}</span></button>)}
        </div>
      )}

      {(state.productTypes || []).length === 0 && (
        <div className="card"><Empty icon="book" title="Commencez par créer un type de produit" text="Ex. Formations, Services, Matériel, Abonnements. Chaque type a son entrée dans le menu." action={M ? <button className="btn primary" onClick={() => setTypeModal({})}>Nouveau type</button> : null} /></div>
      )}
      {(state.productTypes || []).length > 0 && rows.length === 0 && (
        <div className="card"><Empty icon="book" title={cat ? `Aucun produit dans « ${cat} »` : 'Aucun produit'} text="Ajoutez votre premier produit dans ce type." action={M ? <button className="btn primary" onClick={() => setForm({})}>Ajouter</button> : null} /></div>
      )}
      <div className="courses">
        {rows.map(({ c, open, won, ca, conv }) => {
          const next = (c.sessions || []).filter((s) => new Date(s.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start));
          const t = typeById(state, c.typeId);
          return (
            <article key={c.id} className="card course" style={c.active === false ? { opacity: .65 } : undefined}>
              <div className="row between gap8 wrap">
                <span className="row gap4 wrap">
                  {!type && t && <span className="pill p-blue">{t.one}</span>}
                  <span className="pill p-violet">{c.category || 'Sans catégorie'}</span>
                </span>
                {c.active === false && <span className="pill p-gray">Plus en vente</span>}
              </div>
              <div><h2>{c.name}</h2><div className="muted sm">{c.duration}</div>{c.description && <p className="sm" style={{ margin: '8px 0 0', color: 'var(--ink-2)' }}>{c.description}</p>}</div>
              <div className="price">{fMoney(c.price)}</div>
              <div className="row wrap gap16 sm">
                <span><b className="num">{open}</b> <span className="muted">en cours</span></span>
                <span><b className="num">{won}</b> <span className="muted">{LABELS.clients.toLowerCase()}</span></span>
                <span><b className="num">{conv}%</b> <span className="muted">conversion</span></span>
                <span><b className="num">{fMoney(ca)}</b></span>
              </div>
              {next.length > 0 && (
                <div className="stack8">
                  {next.slice(0, 2).map((s) => (
                    <div key={s.id} className="sess"><Icon name="calendar" size={16} /><span style={{ flex: 1 }}><b>{fDate(s.start)}</b>{s.schedule ? ` · ${s.schedule}` : ''}</span><span className="pill p-gray">{s.mode}</span></div>
                  ))}
                </div>
              )}
              <div className="row gap8 wrap" style={{ marginTop: 'auto' }}>
                <button className="btn small soft" onClick={() => navigate(`/contacts?course=${c.id}`)}>Voir les {LABELS.contacts.toLowerCase()}</button>
                <button className="btn small ghost" onClick={() => navigate('/guides')} title="Guides d'appel utilisables pour ce produit">{guidesFor(state, c.id).length} guide{guidesFor(state, c.id).length > 1 ? 's' : ''}</button>
                {M && <button className="btn small ghost" onClick={() => setForm({ course: c })}><Icon name="edit" size={16} />Modifier</button>}
                {M && <button className="icon-btn sm plain" aria-label={`Supprimer ${c.name}`} onClick={() => remove(c)}><Icon name="trash" size={16} /></button>}
              </div>
            </article>
          );
        })}
      </div>
      {form && <CourseForm course={form.course} defaultTypeId={typeId} onClose={() => setForm(null)} />}
      {typeModal && <TypeModal type={typeModal.type} onClose={() => setTypeModal(null)} onSaved={(t) => { if (t === null) navigate('/produits'); else if (!typeModal.type && t) go({ type: t.id }); }} />}
    </>
  );
}
