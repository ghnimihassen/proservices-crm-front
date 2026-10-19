/* Indicateur d'enregistrement (mode API) + gestion des refus du serveur */
import { useEffect, useState } from 'react';
import { useStore } from '../store/Store';
import { useUI } from './UI';
import Icon from './Icon';

export default function SyncStatus() {
  const { remote, reloadRemote } = useStore();
  const { toast } = useUI();
  const [st, setSt] = useState({ status: 'saved' });
  useEffect(() => {
    if (!remote) return undefined;
    return remote.sync.on((ev) => {
      if (ev.type === 'status') setSt(ev);
      if (ev.type === 'rejected') {
        toast(`Non enregistré : ${ev.errors[0]?.error || 'refusé par le serveur'}`, 'err');
        reloadRemote().catch(() => {});
      }
    });
  }, [remote]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!remote) return undefined;
    const warn = (e) => { if (remote.sync.queue.length || remote.sync.inflight) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [remote]);
  if (!remote) return null;
  const map = {
    saved: ['tick', 'Enregistré', 'var(--green-ink)'], idle: ['tick', 'Enregistré', 'var(--green-ink)'],
    pending: ['clock', 'Modifications en attente…', 'var(--muted)'], saving: ['clock', 'Enregistrement…', 'var(--muted)'],
    offline: ['flag', 'Hors ligne : nouvel essai automatique', 'var(--accent-ink)'], error: ['flag', 'Erreur d’enregistrement', 'var(--red-ink)'],
  };
  const [icon, label, color] = map[st.status] || map.saved;
  return <span className="sync-st" role="status" title={st.error || label} style={{ color }}><Icon name={icon} size={16} /><span className="hide-sm">{label}</span></span>;
}
