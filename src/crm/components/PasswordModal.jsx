/* Mode API : changer son propre mot de passe */
import { useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Modal, Field } from './UI';

export default function PasswordModal({ onClose }) {
  const { remote } = useStore();
  const { toast } = useUI();
  const [f, setF] = useState({ current: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.password.length < 8) return setErr('8 caractères minimum.');
    if (f.password !== f.confirm) return setErr('Les deux mots de passe ne correspondent pas.');
    try { await remote.client.post('/auth/password', { current: f.current, password: f.password }); toast('Mot de passe modifié'); onClose(); } catch (x) { setErr(x.message); }
  };
  return (
    <Modal title="Changer mon mot de passe" onClose={onClose} width={440}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" type="submit" form="pwd-form">Enregistrer</button></>}>
      <form id="pwd-form" className="stack12" onSubmit={submit}>
        <Field label="Mot de passe actuel"><input type="password" value={f.current} onChange={set('current')} autoComplete="current-password" /></Field>
        <Field label="Nouveau mot de passe" hint="8 caractères minimum"><input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Field label="Confirmer"><input type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        {err && <div className="alert err">{err}</div>}
      </form>
    </Modal>
  );
}
