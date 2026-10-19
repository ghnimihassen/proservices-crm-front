import { fMoney } from '../utils';

/** Options d'un <select> de produits, regroupées par type (Formations, Services…) */
export default function ProductOptions({ state, withPrice = true, onlyActive = false, keepId }) {
  const types = state.productTypes || [];
  const list = (state.catalog || []).filter((p) => !onlyActive || p.active !== false || p.id === keepId);
  const label = (p) => (withPrice ? `${p.name} · ${fMoney(p.price)}` : p.name);
  const orphans = list.filter((p) => !types.some((t) => t.id === p.typeId));
  if (types.length <= 1 && !orphans.length) return list.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>);
  return (
    <>
      {types.map((t) => {
        const ps = list.filter((p) => p.typeId === t.id);
        return ps.length ? <optgroup key={t.id} label={t.many}>{ps.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}</optgroup> : null;
      })}
      {orphans.length > 0 && <optgroup label="Autres">{orphans.map((p) => <option key={p.id} value={p.id}>{label(p)}</option>)}</optgroup>}
    </>
  );
}
