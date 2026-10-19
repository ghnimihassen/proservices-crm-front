import { useStore } from '../store/Store';
import { can, homeRoute, currentUser } from '../store/permissions';
import { Link } from '../nav';
import Icon from './Icon';

/** Hook : const allowed = useCan(); allowed('contacts.delete') */
export function useCan() {
  const { state } = useStore();
  return (key) => can(state, key);
}

/** Affiche les enfants seulement si le droit est accordé */
export function Can({ perm, children, fallback = null }) {
  const allowed = useCan();
  return allowed(perm) ? children : fallback;
}

/** Protège une page entière */
export function Guard({ perm, children }) {
  const { state } = useStore();
  if (can(state, perm)) return children;
  const home = homeRoute(state);
  return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <span className="empty-i" style={{ background: 'var(--red-t)', color: 'var(--red-ink)' }}><Icon name="x" size={22} /></span>
      <b>Accès non autorisé</b>
      <div className="muted sm">{currentUser(state)?.active === false ? 'Votre compte est désactivé. Contactez un Super admin.' : 'Votre rôle ne donne pas accès à cette page. Demandez à un Super admin de modifier vos droits.'}</div>
      {home && <Link to={home} className="btn primary">Aller à ma page d'accueil</Link>}
    </div>
  );
}
