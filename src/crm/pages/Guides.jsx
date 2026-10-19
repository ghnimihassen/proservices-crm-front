import { useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Modal, Field, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { productLabels } from '../store/selectors';

function GuideForm({ guide, onClose }) {
  const { state, addGuide, updateGuide } = useStore();
  const { toast } = useUI();
  const P = productLabels(state);
  const [name, setName] = useState(guide?.name || '');
  const [productIds, setProductIds] = useState(guide?.productIds || []);
  const [questions, setQuestions] = useState(guide?.questions?.length ? guide.questions : ['']);
  const [err, setErr] = useState('');
  const setQ = (i, v) => setQuestions((q) => q.map((x, j) => (j === i ? v : x)));
  const move = (i, d) => setQuestions((q) => { const n = [...q]; const j = i + d; if (j < 0 || j >= n.length) return q; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const toggleP = (id) => setProductIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const submit = (e) => {
    e.preventDefault();
    const qs = questions.map((q) => q.trim()).filter(Boolean);
    if (!name.trim()) return setErr('Donnez un nom au guide.');
    if (!qs.length) return setErr('Ajoutez au moins une question ou une étape.');
    const data = { name: name.trim(), productIds, questions: qs };
    if (guide) { updateGuide(guide.id, data); toast('Guide mis à jour'); } else { addGuide(data); toast('Guide ajouté'); }
    onClose();
  };
  return (
    <Modal title={guide ? 'Modifier le guide' : 'Nouveau guide d’appel'} onClose={onClose} width={720}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" type="submit" form="guide-form">{guide ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <form id="guide-form" className="stack16" onSubmit={submit}>
        <Field label="Nom du guide *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Qualification — Développement web" /></Field>
        <div className="field">
          <span className="field-l">Utilisé pour</span>
          <div className="row wrap gap8">
            <button type="button" className={`slot${productIds.length === 0 ? ' on' : ''}`} onClick={() => setProductIds([])}>Tous les {P.many.toLowerCase()} (guide général)</button>
            {(state.catalog || []).map((p) => (
              <button type="button" key={p.id} className={`slot${productIds.includes(p.id) ? ' on' : ''}`} aria-pressed={productIds.includes(p.id)} onClick={() => toggleP(p.id)}>{p.name}</button>
            ))}
          </div>
          <span className="field-h">Pendant l'appel, le guide lié au {P.one.toLowerCase()} du prospect s'affiche en premier.</span>
        </div>
        <div className="stack8">
          <span className="field-l">Questions / étapes de l'appel *</span>
          {questions.map((q, i) => (
            <div key={i} className="row gap8">
              <span className="ico i-violet xs b" style={{ width: 30, height: 30 }}>{i + 1}</span>
              <label className="sr" htmlFor={`gq-${i}`}>Question {i + 1}</label>
              <input id={`gq-${i}`} className="inp" value={q} onChange={(e) => setQ(i, e.target.value)} placeholder="Ex. Quel est votre budget ?"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setQuestions((x) => [...x.slice(0, i + 1), '', ...x.slice(i + 1)]); setTimeout(() => document.getElementById(`gq-${i + 1}`)?.focus(), 0); } }} />
              <button type="button" className="icon-btn sm plain" aria-label="Monter" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="left" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
              <button type="button" className="icon-btn sm plain" aria-label="Descendre" disabled={i === questions.length - 1} onClick={() => move(i, 1)}><Icon name="right" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
              <button type="button" className="icon-btn sm plain" aria-label="Retirer" onClick={() => setQuestions((x) => (x.length > 1 ? x.filter((_, j) => j !== i) : ['']))}><Icon name="x" size={14} /></button>
            </div>
          ))}
          <button type="button" className="btn small soft" style={{ alignSelf: 'flex-start' }} onClick={() => setQuestions((x) => [...x, ''])}><Icon name="plus" size={16} />Ajouter une question</button>
        </div>
        {err && <div className="alert err">{err}</div>}
      </form>
    </Modal>
  );
}

export default function Guides() {
  const { state, deleteGuide, addGuide, can } = useStore();
  const M = can('guides.manage');
  const { toast, confirm } = useUI();
  const P = productLabels(state);
  const [form, setForm] = useState(null);
  const guides = state.guides || [];
  const pname = (id) => (state.catalog || []).find((p) => p.id === id)?.name;

  return (
    <>
      <div className="page-h">
        <div><h1>Guides d'appel</h1><p>Les questions à poser pendant l'appel. Créez un guide général et des guides par {P.one.toLowerCase()} : la session d'appels affiche automatiquement le bon.</p></div>
        {M && <button className="btn primary" onClick={() => setForm({})}><Icon name="plus" stroke={2} />Nouveau guide</button>}
      </div>
      {guides.length === 0 && <div className="card"><Empty icon="note" title="Aucun guide" text="Créez votre premier guide d'appel." action={M ? <button className="btn primary" onClick={() => setForm({})}>Nouveau guide</button> : null} /></div>}
      <div className="courses">
        {guides.map((g) => (
          <article key={g.id} className="card course">
            <div className="row wrap gap4">
              {g.productIds?.length ? g.productIds.map((id) => pname(id) && <span key={id} className="pill p-violet">{pname(id)}</span>) : <span className="pill p-gray">Général · tous les {P.many.toLowerCase()}</span>}
            </div>
            <h2>{g.name}</h2>
            <ol className="sm" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink-2)' }}>
              {g.questions.slice(0, 6).map((q, i) => <li key={i}>{q}</li>)}
              {g.questions.length > 6 && <li className="muted" style={{ listStyle: 'none' }}>+ {g.questions.length - 6} autres</li>}
            </ol>
            <div className="row gap8 wrap" style={{ marginTop: 'auto' }}>
              {M && <button className="btn small ghost" onClick={() => setForm({ guide: g })}><Icon name="edit" size={16} />Modifier</button>}
              {M && <button className="btn small ghost" onClick={() => { addGuide({ ...g, id: undefined, name: `${g.name} (copie)` }); toast('Guide dupliqué'); }}>Dupliquer</button>}
              {M && <button className="icon-btn sm plain" aria-label={`Supprimer ${g.name}`} onClick={async () => { if (await confirm({ title: 'Supprimer le guide', message: `Supprimer « ${g.name} » ?`, ok: 'Supprimer', danger: true })) { deleteGuide(g.id); toast('Guide supprimé'); } }}><Icon name="trash" size={16} /></button>}
            </div>
          </article>
        ))}
      </div>
      {form && <GuideForm guide={form.guide} onClose={() => setForm(null)} />}
    </>
  );
}
