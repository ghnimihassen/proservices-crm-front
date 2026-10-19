import { can } from '../store/permissions';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCrmRoot } from '../brand';
import Icon from './Icon';
import { CourseForm } from '../pages/Products';
import { courseById } from '../store/selectors';
import { fMoney } from '../utils';

/**
 * Choix du produit en 2 étapes : type (Formations, Services…) puis produit du type.
 * Bouton « + Nouveau produit » pour l'ajouter au catalogue sans quitter la fiche.
 */
export default function ProductPicker({ state, value, onChange, onlyActive = false, idPrefix = 'pp', disabled = false, typeValue, onTypeChange, requireType = false }) {
  const types = state.productTypes || [];
  const current = courseById(state, value);
  const [ownType, setOwnType] = useState(current?.typeId || (types.length === 1 ? types[0].id : ''));
  // Type contrôlé par le parent (activité du prospect) ou interne
  const controlled = typeof onTypeChange === 'function';
  const typeId = controlled ? (typeValue || current?.typeId || (types.length === 1 ? types[0].id : '')) : ownType;
  const setTypeId = (t) => (controlled ? onTypeChange(t) : setOwnType(t));
  const [creating, setCreating] = useState(false);
  useEffect(() => { if (current && !controlled) setOwnType(current.typeId || ''); }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const products = (state.catalog || []).filter((p) => (!typeId || p.typeId === typeId) && (!onlyActive || p.active !== false || p.id === value));
  const typeName = (id) => types.find((t) => t.id === id)?.one;

  return (
    <div className="ppick">
      {types.length > 1 && (
        <>
          <label className="sr" htmlFor={`${idPrefix}-type`}>Type de produit</label>
          <select id={`${idPrefix}-type`} className="inp" disabled={disabled} value={typeId} onChange={(e) => { const t = e.target.value; if (current && t && current.typeId !== t) onChange(''); setTypeId(t); }}>
            {requireType ? (!typeId && <option value="" disabled>— Choisir l’activité —</option>) : <option value="">Tous les types</option>}
            {types.map((t) => <option key={t.id} value={t.id}>{t.many} ({(state.catalog || []).filter((p) => p.typeId === t.id).length})</option>)}
          </select>
        </>
      )}
      <label className="sr" htmlFor={`${idPrefix}-prod`}>Produit</label>
      <select id={`${idPrefix}-prod`} className="inp" disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{products.length ? '— Choisir un produit —' : '— Aucun produit dans ce type —'}</option>
        {products.map((p) => <option key={p.id} value={p.id}>{!typeId && types.length > 1 ? `${typeName(p.typeId) || ''} · ` : ''}{p.name} · {fMoney(p.price)}</option>)}
      </select>
      {!disabled && can(state, 'products.manage') && <button type="button" className="btn small soft" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Nouveau produit</button>}
      {/* rendu hors du formulaire parent (pas de <form> imbriqués) */}
      {creating && createPortal(<CourseForm defaultTypeId={typeId} onClose={() => setCreating(false)} onSaved={(p) => { setTypeId(p.typeId || ''); onChange(p.id, p); }} />, getCrmRoot())}
    </div>
  );
}
