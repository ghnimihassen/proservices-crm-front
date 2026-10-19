import { useStore } from '../store/Store';
import { switchableTypes, activeTypeId, allowedTypeIds, contactTypeId, can } from '../store/permissions';

/** Nombre de prospects par activité, dans le périmètre de l'utilisateur (ses prospects ou toute l'équipe) */
function useTypeCounts() {
  const { fullState: s } = useStore();
  const all = can(s, 'data.all');
  const me = s.settings.currentUserId;
  const counts = {};
  s.contacts.forEach((c) => {
    if (!all && c.ownerId !== me) return;
    const t = contactTypeId(s, c) || '';
    counts[t] = (counts[t] || 0) + 1;
  });
  return counts;
}

/**
 * Bascule entre les activités (types de produits) autorisées : « Formations », « Erudaxis »…
 * variant="side" : dans le menu de gauche · variant="tabs" : onglets (pipeline)
 */
export default function ActivitySwitch({ variant = 'side' }) {
  const { fullState: s, setActiveType } = useStore();
  const types = switchableTypes(s);
  const active = activeTypeId(s);
  const counts = useTypeCounts();
  // Les commerciaux ne voient pas de volumes de prospects
  const showN = can(s, 'reports.company');
  const n = (x) => (showN ? ` (${x})` : '');
  if (!types.length || ((s.productTypes || []).length < 2 && !allowedTypeIds(s))) return null;
  const restricted = !!allowedTypeIds(s);
  const totalLabel = restricted ? 'Mes activités' : 'Toutes';
  const total = types.reduce((n, t) => n + (counts[t.id] || 0), 0) + (restricted ? 0 : counts[''] || 0);

  if (variant === 'tabs') {
    if (types.length < 2) return null;
    return (
      <div className="tabs" role="tablist" aria-label="Activité">
        <button role="tab" aria-selected={!active} className={`tab${!active ? ' on' : ''}`} onClick={() => setActiveType('')}>{totalLabel} {showN && <span className="n">{total}</span>}</button>
        {types.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} className={`tab${active === t.id ? ' on' : ''}`} onClick={() => setActiveType(t.id)}>{t.many} {showN && <span className="n">{counts[t.id] || 0}</span>}</button>
        ))}
      </div>
    );
  }

  return (
    <div className="act-sw">
      <label className="navl" htmlFor="pcrm-activity" style={{ padding: '0 0 6px' }}>Activité</label>
      {types.length === 1
        ? <div className="act-one" title="Votre accès est limité à cette activité">{types[0].many}</div>
        : (
          <select id="pcrm-activity" value={active} onChange={(e) => setActiveType(e.target.value)}>
            <option value="">{totalLabel}{n(total)}</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.many}{n(counts[t.id] || 0)}</option>)}
          </select>
        )}
    </div>
  );
}
