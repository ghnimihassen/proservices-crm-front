import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { stageById, stageStyle } from '../store/constants';
import { colorFor, initials } from '../utils';

/* ---------- Toasts + confirmations ---------- */
const UICtx = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirm] = useState(null);

  const toast = useCallback((msg, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const confirm = useCallback((opts) => new Promise((resolve) => setConfirm({ ...opts, resolve })), []);

  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <Icon name={t.tone === 'err' ? 'x' : 'tick'} size={16} stroke={2.4} />{t.msg}
          </div>
        ))}
      </div>
      {confirmState && (
        <Modal title={confirmState.title || 'Confirmer'} onClose={() => { confirmState.resolve(false); setConfirm(null); }} width={440}
          footer={<>
            <button className="btn ghost" onClick={() => { confirmState.resolve(false); setConfirm(null); }}>Annuler</button>
            <button className={`btn ${confirmState.danger ? 'danger' : 'primary'}`} autoFocus
              onClick={() => { confirmState.resolve(true); setConfirm(null); }}>{confirmState.ok || 'Confirmer'}</button>
          </>}>
          <p style={{ margin: 0 }}>{confirmState.message}</p>
        </Modal>
      )}
    </UICtx.Provider>
  );
}
export const useUI = () => useContext(UICtx);

/* ---------- Modale ---------- */
export function Modal({ title, subtitle, children, footer, onClose, width = 560 }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current?.querySelector('input:not([type=hidden]),select,textarea,button.primary');
    el?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }} ref={ref}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="modal-h">
          <div><h2>{title}</h2>{subtitle && <div className="muted sm">{subtitle}</div>}</div>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Petits composants ---------- */
export const StagePill = ({ stage }) => {
  const s = stageById(stage);
  return <span className="pill" style={stageStyle(stage)}>{s.label}</span>;
};

export function Avatar({ name, size = 36, round = false, title }) {
  const [bg, fg] = colorFor(name);
  return (
    <span className="avatar" title={title || name}
      style={{ width: size, height: size, background: bg, color: fg, borderRadius: round ? '50%' : size * 0.3, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Field({ label, children, hint, full }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span className="field-l">{label}</span>
      {children}
      {hint && <span className="field-h">{hint}</span>}
    </label>
  );
}

export function Empty({ icon = 'note', title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-i"><Icon name={icon} size={22} /></div>
      <b>{title}</b>
      {text && <div className="muted sm">{text}</div>}
      {action}
    </div>
  );
}

export function Menu({ label, children, align = 'left', className = 'btn ghost', fixed = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', h);
    if (fixed) { window.addEventListener('scroll', close, true); window.addEventListener('resize', close); }
    return () => { document.removeEventListener('mousedown', h); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open, fixed]);
  const toggle = (e) => {
    if (fixed && !open) {
      const r = e.currentTarget.getBoundingClientRect();
      const w = 250;
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, align === 'right' ? r.right - w : r.left));
      setPos({ position: 'fixed', top: r.bottom + 6, left, right: 'auto', zIndex: 90 });
    }
    setOpen((o) => !o);
  };
  return (
    <div className="menu-wrap" ref={ref}>
      <button className={className} aria-haspopup="true" aria-expanded={open} onClick={toggle}>{label}</button>
      {open && (
        <div className={`menu ${align}`} role="menu" style={fixed ? pos : undefined} onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>{children}</div>
      )}
    </div>
  );
}
