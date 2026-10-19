import { useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Modal, Field, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { fillClause } from '../store/selectors';
import { LABELS } from '../store/constants';

const VARS = [
  ['{client}', `Nom du ${LABELS.contact}`], ['{entreprise}', 'Votre entreprise'], ['{produit}', 'Produit choisi'], ['{montant}', 'Montant total'], ['{date}', 'Date du jour'],
];

function ClauseForm({ clause, onClose }) {
  const { state, addClause, updateClause } = useStore();
  const { toast } = useUI();
  const [title, setTitle] = useState(clause?.title || '');
  const [text, setText] = useState(clause?.text || '');
  const [active, setActive] = useState(clause ? clause.active !== false : true);
  const [typeIds, setTypeIds] = useState(clause?.typeIds || []);
  const [err, setErr] = useState('');
  const insert = (v) => setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${v}`);
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return setErr('Le titre et le texte sont obligatoires.');
    const data = { title: title.trim(), text: text.trim(), active, typeIds };
    if (clause) { updateClause(clause.id, data); toast('Condition modifiée'); } else { addClause(data); toast('Condition ajoutée'); }
    onClose();
  };
  const types = state.productTypes || [];
  return (
    <Modal title={clause ? 'Modifier la condition' : 'Nouvelle condition'} onClose={onClose} width={720}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" type="submit" form="clause-form">{clause ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <form id="clause-form" className="stack16" onSubmit={submit}>
        <Field label="Titre *"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Engagement de paiement intégral" /></Field>
        <div className="field">
          <label className="field-l" htmlFor="clause-text">Texte de la condition *</label>
          <textarea id="clause-text" className="inp" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Rédigez la clause telle qu'elle doit apparaître sur la fiche…" />
          <div className="row wrap gap4" style={{ marginTop: 4 }}>
            <span className="muted xs">Insérer :</span>
            {VARS.map(([v, l]) => <button key={v} type="button" className="slot" style={{ minHeight: 30, fontSize: 12 }} title={l} onClick={() => insert(v)}>{v}</button>)}
          </div>
          <span className="field-h">Ces mots sont remplacés automatiquement à l'impression (ex. {'{client}'} → le nom du {LABELS.contact}).</span>
        </div>
        {types.length > 0 && (
          <div className="field">
            <span className="field-l">S'applique à</span>
            <div className="row wrap gap8">
              <button type="button" className={`slot${typeIds.length === 0 ? ' on' : ''}`} onClick={() => setTypeIds([])}>Tous les produits</button>
              {types.map((t) => (
                <button key={t.id} type="button" aria-pressed={typeIds.includes(t.id)} className={`slot${typeIds.includes(t.id) ? ' on' : ''}`}
                  onClick={() => setTypeIds((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))}>{t.many}</button>
              ))}
            </div>
          </div>
        )}
        <label className="row gap8"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Afficher sur les fiches imprimées</label>
        {text && (
          <div className="stack8"><span className="lbl">Aperçu</span>
            <div className="bubble" style={{ marginTop: 0 }}><b>{title || 'Titre'}</b><br />{fillClause(text, { client: 'Mohamed Ali Sassi', company: state.company?.name, product: 'Anglais professionnel', amount: '650 DT' })}</div>
          </div>
        )}
        {err && <div className="alert err">{err}</div>}
      </form>
    </Modal>
  );
}

export default function Clauses() {
  const { state, updateClause, deleteClause, moveClause, addClause, can } = useStore();
  const M = can('clauses.manage');
  const { toast, confirm } = useUI();
  const [form, setForm] = useState(null);
  const list = state.clauses || [];
  const tname = (id) => (state.productTypes || []).find((t) => t.id === id)?.many;

  return (
    <>
      <div className="page-h">
        <div><h1>Conditions générales</h1><p>Les clauses imprimées sur chaque fiche (paiement intégral, échéancier, annulation…). Activez, désactivez, réordonnez ou limitez une clause à certains types de produits.</p></div>
        {M && <button className="btn primary" onClick={() => setForm({})}><Icon name="plus" stroke={2} />Nouvelle condition</button>}
      </div>
      {list.length === 0 && <div className="card"><Empty icon="file" title="Aucune condition" text="Ajoutez les clauses à faire figurer sur vos fiches." action={M ? <button className="btn primary" onClick={() => setForm({})}>Nouvelle condition</button> : null} /></div>}
      <div className="stack12">
        {list.map((c, i) => (
          <article key={c.id} className="card pad stack8" style={c.active === false ? { opacity: .7 } : undefined}>
            <div className="row between wrap gap8">
              <div className="row gap8 wrap" style={{ minWidth: 0 }}>
                <span className="ico i-violet b sm">{i + 1}</span>
                <h2 style={{ fontSize: 16 }}>{c.title}</h2>
                {c.typeIds?.length ? c.typeIds.map((id) => tname(id) && <span key={id} className="pill p-blue">{tname(id)}</span>) : <span className="pill p-gray">Tous les produits</span>}
              </div>
              <div className="row gap4">
                {M && <label className="chip" style={{ minHeight: 34 }}><input type="checkbox" checked={c.active !== false} onChange={(e) => { updateClause(c.id, { active: e.target.checked }); toast(e.target.checked ? 'Affichée sur les fiches' : 'Masquée des fiches'); }} />Sur la fiche</label>}
                {M && <button className="icon-btn sm plain" aria-label="Monter" disabled={i === 0} onClick={() => moveClause(c.id, -1)}><Icon name="left" size={14} style={{ transform: 'rotate(90deg)' }} /></button>}
                {M && <button className="icon-btn sm plain" aria-label="Descendre" disabled={i === list.length - 1} onClick={() => moveClause(c.id, 1)}><Icon name="right" size={14} style={{ transform: 'rotate(90deg)' }} /></button>}
                {M && <button className="icon-btn sm plain" aria-label={`Modifier ${c.title}`} onClick={() => setForm({ clause: c })}><Icon name="edit" size={16} /></button>}
                {M && <button className="icon-btn sm plain" aria-label={`Dupliquer ${c.title}`} title="Dupliquer" onClick={() => { addClause({ ...c, title: `${c.title} (copie)` }); toast('Condition dupliquée'); }}><Icon name="file" size={16} /></button>}
                {M && <button className="icon-btn sm plain" aria-label={`Supprimer ${c.title}`} onClick={async () => { if (await confirm({ title: 'Supprimer la condition', message: `Supprimer « ${c.title} » ?`, ok: 'Supprimer', danger: true })) { deleteClause(c.id); toast('Condition supprimée'); } }}><Icon name="trash" size={16} /></button>}
              </div>
            </div>
            <p className="sm" style={{ margin: 0, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>{c.text}</p>
          </article>
        ))}
      </div>
      {form && <ClauseForm clause={form.clause} onClose={() => setForm(null)} />}
    </>
  );
}
