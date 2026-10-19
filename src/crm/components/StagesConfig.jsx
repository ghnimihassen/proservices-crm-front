import { useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Modal, Field } from './UI';
import Icon from './Icon';
import { STAGE_COLORS, PIPELINE_STAGES, stageById, stageStyle } from '../store/constants';

const AUTO = {
  contacted: 'Automatique : après le 1er appel',
  interested: 'Automatique : appel « Intéressé »',
  rdv: 'Automatique : quand un RDV est fixé',
  negotiation: 'Suggérée après un RDV positif',
  won: 'Colonne finale (gagné) — obligatoire',
  lost: 'Zone « Perdu » sous le pipeline — obligatoire',
};
export const stageHint = (id, index) => (index === 0 ? 'Les nouveaux contacts arrivent ici' : AUTO[id] || 'Colonne personnalisée');

export function ColorPicker({ value, onChange }) {
  return (
    <div className="row wrap gap4" role="radiogroup" aria-label="Couleur">
      {STAGE_COLORS.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} onClick={() => onChange(c)}
          style={{ width: 28, height: 28, borderRadius: 8, border: value === c ? '3px solid var(--ink)' : '1px solid var(--line-2)', background: c, cursor: 'pointer' }} />
      ))}
      <label className="sr" htmlFor="stage-color">Autre couleur</label>
      <input id="stage-color" type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 36, height: 28, border: 0, background: 'none', padding: 0, cursor: 'pointer' }} />
    </div>
  );
}

/** Créer ou modifier une colonne */
export function StageModal({ stage, afterId, onClose }) {
  const { addStage, updateStage } = useStore();
  const { toast } = useUI();
  const [label, setLabel] = useState(stage?.label || '');
  const [color, setColor] = useState(stage?.color || STAGE_COLORS[6]);
  const [err, setErr] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const l = label.trim();
    if (!l) return setErr('Donnez un nom à la colonne.');
    if (stage) { updateStage(stage.id, { label: l, color }); toast('Colonne modifiée'); }
    else { addStage({ label: l, color }, afterId); toast(`Colonne « ${l} » ajoutée`); }
    onClose();
  };
  const after = afterId ? stageById(afterId) : null;
  return (
    <Modal title={stage ? `Modifier « ${stage.label} »` : 'Nouvelle colonne'} subtitle={!stage ? (after && after.id !== 'won' ? `Placée après « ${after.label} »` : 'Placée avant la colonne finale') : undefined} onClose={onClose} width={500}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" type="submit" form="stage-form">{stage ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <form id="stage-form" className="stack16" onSubmit={submit}>
        <Field label="Nom de la colonne *"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Devis envoyé, Test de niveau, Relance…" /></Field>
        <div className="field"><span className="field-l">Couleur</span><ColorPicker value={color} onChange={setColor} /></div>
        <div className="row gap8"><span className="muted sm">Aperçu :</span><span className="pill" style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface))`, color: `color-mix(in srgb, ${color} 72%, var(--ink))` }}>{label || 'Nom'}</span></div>
        {err && <div className="alert err">{err}</div>}
      </form>
    </Modal>
  );
}

/** Supprimer une colonne en déplaçant ses contacts */
export function DeleteStageModal({ stage, onClose }) {
  const { state, deleteStage } = useStore();
  const { toast } = useUI();
  const n = state.contacts.filter((c) => c.stage === stage.id).length;
  const targets = PIPELINE_STAGES.filter((s) => s.id !== stage.id);
  const idx = PIPELINE_STAGES.findIndex((s) => s.id === stage.id);
  const [to, setTo] = useState((PIPELINE_STAGES[idx - 1] || targets[0])?.id);
  const openCount = PIPELINE_STAGES.filter((s) => s.id !== 'won').length;
  const blocked = openCount <= 1;
  return (
    <Modal title={`Supprimer la colonne « ${stage.label} »`} onClose={onClose} width={480}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn danger" disabled={blocked} onClick={() => { deleteStage(stage.id, to); toast('Colonne supprimée'); onClose(); }}>Supprimer</button></>}>
      <div className="stack12">
        {blocked ? <div className="alert err">Le pipeline doit garder au moins une colonne en plus de la colonne finale.</div> : (
          <>
            <p style={{ margin: 0 }}>{n ? `${n} contact${n > 1 ? 's' : ''} ${n > 1 ? 'sont' : 'est'} dans cette colonne. Où les déplacer ?` : 'Cette colonne est vide.'}</p>
            {n > 0 && <Field label="Déplacer les contacts vers"><select value={to} onChange={(e) => setTo(e.target.value)}>{targets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>}
            {['contacted', 'interested', 'rdv'].includes(stage.id) && <div className="alert warn">{AUTO[stage.id]} : cet automatisme ne déplacera plus les contacts.</div>}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Configurer toutes les colonnes */
export function StagesModal({ onClose }) {
  const { state, updateStage, moveStage, resetStages } = useStore();
  const { confirm, toast } = useUI();
  const [sub, setSub] = useState(null);
  const stages = state.stages || [];
  const lost = stages.find((s) => s.id === 'lost');
  const pipe = stages.filter((s) => s.id !== 'lost');
  const row = (s, i) => {
    const sys = s.id === 'won' || s.id === 'lost';
    const n = state.contacts.filter((c) => c.stage === s.id).length;
    return (
      <div key={s.id} className="stage-row">
        <button type="button" className="stage-sw" style={{ background: s.color }} aria-label={`Couleur de ${s.label}`} onClick={() => setSub({ t: 'edit', stage: s })} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="sr" htmlFor={`stl-${s.id}`}>Nom de la colonne</label>
          <input id={`stl-${s.id}`} className="inp" style={{ minHeight: 38 }} defaultValue={s.label} key={s.label}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.label) { updateStage(s.id, { label: v }); toast('Nom enregistré'); } else e.target.value = s.label; }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          <div className="muted xs" style={{ marginTop: 3 }}>{stageHint(s.id, s.id === 'lost' ? -1 : i)} · {n} contact{n > 1 ? 's' : ''}</div>
        </div>
        {s.id !== 'lost' && (
          <div className="row gap4">
            <button type="button" className="icon-btn sm plain" aria-label="Monter" disabled={sys || i === 0} onClick={() => moveStage(s.id, -1)}><Icon name="left" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
            <button type="button" className="icon-btn sm plain" aria-label="Descendre" disabled={sys || i >= pipe.length - 2} onClick={() => moveStage(s.id, 1)}><Icon name="right" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
          </div>
        )}
        <button type="button" className="icon-btn sm plain" aria-label={`Supprimer ${s.label}`} disabled={sys} title={sys ? 'Colonne obligatoire : renommable mais pas supprimable' : undefined} onClick={() => setSub({ t: 'del', stage: s })}><Icon name="trash" size={16} /></button>
      </div>
    );
  };
  return (
    <Modal title="Configurer le pipeline" subtitle="Renommez, colorez, réordonnez, ajoutez ou supprimez des colonnes" onClose={onClose} width={640}
      footer={<>
        <button className="btn ghost" style={{ marginRight: 'auto' }} onClick={async () => { if (await confirm({ title: 'Réinitialiser', message: 'Revenir aux colonnes par défaut ? Les contacts des colonnes personnalisées iront dans la première colonne.', ok: 'Réinitialiser', danger: true })) { resetStages(); toast('Colonnes réinitialisées'); } }}>Colonnes par défaut</button>
        <button className="btn soft" onClick={() => setSub({ t: 'add' })}><Icon name="plus" size={16} />Ajouter une colonne</button>
        <button className="btn primary" onClick={onClose}>Terminé</button>
      </>}>
      <div className="stack8">
        {pipe.map(row)}
        {lost && <><div className="lbl" style={{ marginTop: 10 }}>Hors colonnes</div>{row(lost, -1)}</>}
        <div className="muted xs">Aperçu : {pipe.map((s) => <span key={s.id} className="pill" style={{ ...stageStyle(s.id), margin: '4px 4px 0 0' }}>{s.label}</span>)}</div>
      </div>
      {sub?.t === 'edit' && <StageModal stage={sub.stage} onClose={() => setSub(null)} />}
      {sub?.t === 'add' && <StageModal onClose={() => setSub(null)} />}
      {sub?.t === 'del' && <DeleteStageModal stage={sub.stage} onClose={() => setSub(null)} />}
    </Modal>
  );
}
