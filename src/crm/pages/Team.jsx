import { useRef, useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Avatar, Modal, Field, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { downloadBlob } from '../utils';
import { LABELS } from '../store/constants';
import { PERMISSION_GROUPS, ALL_PERMISSIONS, ADMIN_ROLE_ID, can, isSuperAdmin, roleOf } from '../store/permissions';
import brand from '../brand';

/* ---------- Membre de l'équipe ---------- */
function UserForm({ user, onClose }) {
  const { state, fullState, addUser, updateUser, remote } = useStore();
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useUI();
  const admin = isSuperAdmin(state);
  const types = fullState.productTypes || [];
  const [f, setF] = useState({ name: '', role: 'Conseiller commercial', email: '', phone: '', roleId: 'sales', active: true, productTypeIds: [], ...(user || {}) });
  const tIds = (f.productTypeIds || []).filter((id) => types.some((t) => t.id === id));
  const toggleType = (id) => setF((x) => {
    const cur = (x.productTypeIds || []).filter((y) => types.some((t) => t.id === y));
    const next = cur.includes(id) ? cur.filter((y) => y !== id) : [...cur, id];
    return { ...x, productTypeIds: next.length === types.length ? [] : next };
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const lastAdmin = user?.roleId === ADMIN_ROLE_ID && state.users.filter((u) => u.roleId === ADMIN_ROLE_ID).length === 1;
  const roles = (state.roles || []).filter((r) => admin || r.id !== ADMIN_ROLE_ID || r.id === user?.roleId);
  const selected = state.roles.find((r) => r.id === f.roleId);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Le nom est obligatoire.');
    if (remote && !f.email.trim()) return setErr('L’email est obligatoire : il sert d’identifiant de connexion.');
    if (remote && !user && pwd.length < 8) return setErr('Mot de passe initial : 8 caractères minimum.');
    if (remote && user && pwd && pwd.length < 8) return setErr('Nouveau mot de passe : 8 caractères minimum.');
    if (lastAdmin && f.roleId !== ADMIN_ROLE_ID) return setErr('C’est le dernier Super admin : gardez ce rôle ou nommez d’abord un autre Super admin.');
    const data = { ...f, name: f.name.trim(), productTypeIds: f.roleId === ADMIN_ROLE_ID ? [] : tIds };
    const { hasPassword, ...clean } = data;
    const saved = user ? (updateUser(user.id, clean), user) : addUser(clean);
    if (remote && pwd) {
      // le membre doit exister sur le serveur avant de recevoir son mot de passe
      setBusy(true);
      try { await remote.sync.flush(); await remote.client.put(`/users/${saved.id}/password`, { password: pwd }); } catch (x) { setBusy(false); return setErr(`Membre enregistré, mais mot de passe refusé : ${x.message}`); }
      setBusy(false);
    }
    toast(user ? 'Membre mis à jour' : 'Membre ajouté');
    onClose();
  };
  return (
    <Modal title={user ? 'Modifier le membre' : 'Ajouter un membre de l’équipe'} onClose={onClose} width={640}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" type="submit" form="user-form" disabled={busy}>{busy ? 'Enregistrement…' : user ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <form id="user-form" className="grid2" onSubmit={submit}>
        <Field label="Nom complet *"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Fonction (affichée)"><input value={f.role} onChange={set('role')} placeholder="Ex. Conseillère formation" /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Téléphone"><input value={f.phone} onChange={set('phone')} /></Field>
        {remote && <Field label={user ? 'Nouveau mot de passe' : 'Mot de passe initial *'} hint={user ? (user.hasPassword ? 'Laisser vide pour ne pas le changer' : 'Ce membre n’a pas encore de mot de passe') : '8 caractères minimum, à communiquer au membre'}><input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" /></Field>}
        <div className="field full">
          <span className="field-l">Rôle et accès *</span>
          <div className="role-pick">
            {roles.map((r) => (
              <button key={r.id} type="button" className={`role-opt${f.roleId === r.id ? ' on' : ''}`} aria-pressed={f.roleId === r.id} disabled={lastAdmin && r.id !== ADMIN_ROLE_ID}
                onClick={() => setF((x) => ({ ...x, roleId: r.id }))}>
                <b>{r.name}</b><span className="muted xs">{r.description || `${ALL_PERMISSIONS.filter((k) => r.permissions?.[k]).length} droits`}</span>
              </button>
            ))}
          </div>
          {selected && selected.id !== ADMIN_ROLE_ID && (
            <span className="field-h">Menus visibles : {PERMISSION_GROUPS[0].items.filter((i) => selected.permissions?.[i.key]).map((i) => i.label).join(', ') || 'aucun'} · {selected.permissions?.['data.all'] ? 'voit toute l’équipe' : 'voit seulement ses prospects'}</span>
          )}
        </div>
        {types.length > 0 && f.roleId !== ADMIN_ROLE_ID && (
          <div className="field full">
            <span className="field-l">Activités (types de produits) accessibles</span>
            <div className="type-pick">
              <button type="button" className={`slot${tIds.length === 0 ? ' on' : ''}`} aria-pressed={tIds.length === 0} onClick={() => setF((x) => ({ ...x, productTypeIds: [] }))}>Toutes les activités</button>
              {types.map((t) => (
                <button key={t.id} type="button" className={`slot${tIds.includes(t.id) ? ' on' : ''}`} aria-pressed={tIds.includes(t.id)} onClick={() => toggleType(t.id)}>{t.many}</button>
              ))}
            </div>
            <span className="field-h">{tIds.length === 0
              ? 'Voit les prospects, produits, guides et le pipeline de toutes les activités.'
              : `Voit et gère seulement : ${types.filter((t) => tIds.includes(t.id)).map((t) => t.many).join(', ')}.${tIds.length > 1 ? ' Il bascule entre elles depuis le menu ou le pipeline.' : ''}`}</span>
          </div>
        )}
        <label className="row gap8 full"><input type="checkbox" checked={f.active !== false} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} disabled={lastAdmin} />Compte actif (un compte désactivé ne peut plus se connecter)</label>
        {err && <div className="alert err full">{err}</div>}
      </form>
    </Modal>
  );
}

/* ---------- Rôle : matrice des droits ---------- */
function RoleModal({ role, base, onClose }) {
  const { state, addRole, updateRole } = useStore();
  const { toast } = useUI();
  const src = role || base;
  const [name, setName] = useState(role ? role.name : base ? `${base.name} (copie)` : '');
  const [description, setDescription] = useState(src?.description || '');
  const [perms, setPerms] = useState(() => Object.fromEntries(ALL_PERMISSIONS.map((k) => [k, !!src?.permissions?.[k]])));
  const [err, setErr] = useState('');
  const toggle = (k) => setPerms((p) => ({ ...p, [k]: !p[k] }));
  const setGroup = (g, v) => setPerms((p) => ({ ...p, ...Object.fromEntries(g.items.map((i) => [i.key, v])) }));
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setErr('Donnez un nom au rôle.');
    if ((state.roles || []).some((r) => r.id !== role?.id && r.name.toLowerCase() === name.trim().toLowerCase())) return setErr('Un rôle porte déjà ce nom.');
    if (!PERMISSION_GROUPS[0].items.some((i) => perms[i.key])) return setErr('Cochez au moins un menu visible.');
    const data = { name: name.trim(), description: description.trim(), permissions: perms };
    if (role) { updateRole(role.id, data); toast('Rôle mis à jour'); } else { addRole(data); toast('Rôle créé'); }
    onClose();
  };
  const count = ALL_PERMISSIONS.filter((k) => perms[k]).length;
  return (
    <Modal title={role ? `Rôle « ${role.name} »` : 'Nouveau rôle'} subtitle={`${count} / ${ALL_PERMISSIONS.length} droits accordés`} onClose={onClose} width={820}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" type="submit" form="role-form">{role ? 'Enregistrer' : 'Créer le rôle'}</button></>}>
      <form id="role-form" className="stack16" onSubmit={submit}>
        <div className="grid2">
          <Field label="Nom du rôle *"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Commercial terrain, Assistante…" /></Field>
          <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="À quoi sert ce rôle" /></Field>
        </div>
        {PERMISSION_GROUPS.map((g) => {
          const all = g.items.every((i) => perms[i.key]);
          return (
            <fieldset key={g.id} className="perm-group">
              <legend className="row between gap8" style={{ width: '100%' }}>
                <span><b>{g.title}</b>{g.hint && <span className="muted xs" style={{ display: 'block' }}>{g.hint}</span>}</span>
                {g.items.length > 1 && <button type="button" className="btn link sm" onClick={() => setGroup(g, !all)}>{all ? 'Tout décocher' : 'Tout cocher'}</button>}
              </legend>
              <div className="perm-grid">
                {g.items.map((i) => (
                  <label key={i.key} className={`perm${perms[i.key] ? ' on' : ''}`}>
                    <input type="checkbox" checked={perms[i.key]} onChange={() => toggle(i.key)} />
                    <span>{i.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
        {perms['team.manage'] && <div className="alert warn">« Ajouter / modifier les membres » permet de créer des comptes. Seul un Super admin peut modifier les rôles.</div>}
        {err && <div className="alert err">{err}</div>}
      </form>
    </Modal>
  );
}

function DeleteRoleModal({ role, onClose }) {
  const { state, deleteRole } = useStore();
  const { toast } = useUI();
  const others = state.roles.filter((r) => r.id !== role.id && r.id !== ADMIN_ROLE_ID);
  const n = state.users.filter((u) => u.roleId === role.id).length;
  const [to, setTo] = useState(others[0]?.id || ADMIN_ROLE_ID);
  return (
    <Modal title={`Supprimer le rôle « ${role.name} »`} onClose={onClose} width={460}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn danger" onClick={() => { deleteRole(role.id, to); toast('Rôle supprimé'); onClose(); }}>Supprimer</button></>}>
      <div className="stack12">
        <p style={{ margin: 0 }}>{n ? `${n} membre${n > 1 ? 's ont' : ' a'} ce rôle. Quel rôle leur donner ?` : 'Aucun membre n’a ce rôle.'}</p>
        {n > 0 && <Field label="Nouveau rôle"><select value={to} onChange={(e) => setTo(e.target.value)}>{state.roles.filter((r) => r.id !== role.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>}
      </div>
    </Modal>
  );
}

export default function Team() {
  const { state, fullState, updateSettings, deleteUser, resetDemo, clearAll, restore, remote } = useStore();
  const { toast, confirm } = useUI();
  const [form, setForm] = useState(null);
  const [roleModal, setRoleModal] = useState(null);
  const fileRef = useRef(null);
  const s = state.settings;
  const admin = isSuperAdmin(state);
  const manage = can(state, 'team.manage');

  const removeUser = async (u) => {
    if (state.users.length <= 1) return toast('Il faut au moins un membre dans l’équipe', 'err');
    if (u.roleId === ADMIN_ROLE_ID && state.users.filter((x) => x.roleId === ADMIN_ROLE_ID).length === 1) return toast('Impossible : c’est le dernier Super admin', 'err');
    const to = state.users.find((x) => x.id !== u.id);
    if (await confirm({ title: 'Supprimer le membre', message: `Supprimer ${u.name} ? Ses contacts, tâches et RDV seront réassignés à ${to.name}.`, ok: 'Supprimer', danger: true })) {
      deleteUser(u.id, to.id);
      if (s.currentUserId === u.id) updateSettings({ currentUserId: to.id });
      toast('Membre supprimé');
    }
  };

  const backup = () => downloadBlob(JSON.stringify(fullState, null, 2), `${brand.id}-crm-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  const onRestore = async (file) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data.contacts || !data.users || !data.settings) throw new Error();
      if (await confirm({ title: 'Restaurer la sauvegarde', message: `Remplacer toutes les données actuelles par cette sauvegarde (${data.contacts.length} contacts) ?`, ok: 'Restaurer', danger: true })) {
        await restore(data); toast('Sauvegarde restaurée');
      }
    } catch { toast('Fichier de sauvegarde invalide', 'err'); }
  };

  return (
    <>
      <div className="page-h">
        <div><h1>Équipe & paramètres</h1><p>{LABELS.team}, rôles et accès, objectifs et données de l'application.</p></div>
        {manage && <button className="btn primary" onClick={() => setForm({})}><Icon name="plus" stroke={2} />Ajouter un membre</button>}
      </div>

      <section className="card" aria-label="Membres">
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 820 }}>
            <thead><tr><th>Membre</th><th>Rôle</th><th>Activités</th><th>Email</th><th>{LABELS.contacts}</th><th>{LABELS.clients}</th><th></th></tr></thead>
            <tbody>
              {state.users.map((u) => {
                const r = roleOf(state, u);
                return (
                  <tr key={u.id} className={u.id === s.currentUserId ? 'sel' : ''} style={u.active === false ? { opacity: .55 } : undefined}>
                    <td><span className="row gap8"><Avatar name={u.name} round /><span><b>{u.name}</b>{u.id === s.currentUserId && <span className="pill p-violet" style={{ marginLeft: 6 }}>Connecté</span>}{u.active === false && <span className="pill p-gray" style={{ marginLeft: 6 }}>Désactivé</span>}<br /><span className="muted sm">{u.role}</span></span></span></td>
                    <td><span className={`pill ${r?.id === ADMIN_ROLE_ID ? 'p-red' : r?.permissions?.['data.all'] ? 'p-orange' : 'p-blue'}`}>{r?.name || '—'}</span></td>
                    <td>{(() => {
                      const ids = u.roleId === ADMIN_ROLE_ID ? [] : (u.productTypeIds || []).filter((id) => (fullState.productTypes || []).some((t) => t.id === id));
                      return ids.length ? <span className="row wrap gap4">{ids.map((id) => <span key={id} className="pill p-violet">{fullState.productTypes.find((t) => t.id === id).many}</span>)}</span> : <span className="muted sm">Toutes</span>;
                    })()}</td>
                    <td>{u.email || '—'}</td>
                    <td>{fullState.contacts.filter((c) => c.ownerId === u.id).length}</td>
                    <td>{fullState.contacts.filter((c) => c.ownerId === u.id && c.stage === 'won').length}</td>
                    <td>
                      <div className="row gap4 end">
                        {u.id !== s.currentUserId && u.active !== false && admin && !s.authManaged && <button className="btn small ghost" title="Voir le CRM avec les droits de ce membre" onClick={() => { updateSettings({ currentUserId: u.id }); toast(`Connecté en tant que ${u.name}`); }}>Se connecter</button>}
                        {manage && (admin || u.roleId !== ADMIN_ROLE_ID) && <button className="icon-btn sm plain" aria-label={`Modifier ${u.name}`} onClick={() => setForm({ user: u })}><Icon name="edit" size={16} /></button>}
                        {manage && (admin || u.roleId !== ADMIN_ROLE_ID) && u.id !== s.currentUserId && <button className="icon-btn sm plain" aria-label={`Supprimer ${u.name}`} onClick={() => removeUser(u)}><Icon name="trash" size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {admin ? (
        <section className="card pad24 stack16" aria-label="Rôles et accès">
          <div className="row between wrap gap12">
            <div><h2>Rôles et accès</h2><div className="muted sm">Définissez ce que chaque rôle voit dans le menu et ce qu'il a le droit de faire. Réservé aux Super admins.</div></div>
            <button className="btn primary" onClick={() => setRoleModal({})}><Icon name="plus" size={16} />Nouveau rôle</button>
          </div>
          <div className="courses">
            {(state.roles || []).map((r) => {
              const members = state.users.filter((u) => u.roleId === r.id);
              const navs = PERMISSION_GROUPS[0].items.filter((i) => r.id === ADMIN_ROLE_ID || r.permissions?.[i.key]);
              const n = r.id === ADMIN_ROLE_ID ? ALL_PERMISSIONS.length : ALL_PERMISSIONS.filter((k) => r.permissions?.[k]).length;
              return (
                <article key={r.id} className="card course" style={{ boxShadow: 'none' }}>
                  <div className="row between gap8"><h2 style={{ fontSize: 16 }}>{r.name}</h2>{r.locked ? <span className="pill p-red">Tous les droits</span> : <span className="pill p-gray">{n}/{ALL_PERMISSIONS.length} droits</span>}</div>
                  {r.description && <div className="muted sm">{r.description}</div>}
                  <div className="xs" style={{ color: 'var(--ink-2)' }}><b>Menus :</b> {navs.map((i) => i.label).join(', ')}</div>
                  <div className="xs" style={{ color: 'var(--ink-2)' }}><b>Données :</b> {r.id === ADMIN_ROLE_ID || r.permissions?.['data.all'] ? 'toute l’équipe' : 'ses propres prospects'}</div>
                  <div className="row gap4 wrap">{members.length ? members.map((u) => <span key={u.id} className="row gap4 xs"><Avatar name={u.name} size={22} round />{u.name.split(' ')[0]}</span>) : <span className="muted xs">Aucun membre</span>}</div>
                  <div className="row gap8 wrap" style={{ marginTop: 'auto' }}>
                    {!r.locked && <button className="btn small ghost" onClick={() => setRoleModal({ role: r })}><Icon name="edit" size={16} />Modifier les droits</button>}
                    <button className="btn small ghost" onClick={() => setRoleModal({ base: r })}>Dupliquer</button>
                    {!r.locked && <button className="icon-btn sm plain" aria-label={`Supprimer le rôle ${r.name}`} onClick={() => setRoleModal({ del: r })}><Icon name="trash" size={16} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="card pad24 stack8" aria-label="Mon rôle">
          <h2>Mon rôle : {roleOf(state, state.users.find((u) => u.id === s.currentUserId))?.name}</h2>
          <div className="muted sm">Les rôles et accès sont gérés par un Super admin.</div>
        </section>
      )}

      {admin && (
        <div className="flexwrap">
          <section className="card pad24 grow1 stack16" aria-label="Objectifs">
            <h2>Objectifs</h2>
            <Field label="Appels par jour et par personne"><input type="number" min="1" value={s.dailyCallGoal} onChange={(e) => updateSettings({ dailyCallGoal: Number(e.target.value) || 1 })} /></Field>
            <Field label="RDV par semaine et par personne"><input type="number" min="1" value={s.weeklyRdvGoal} onChange={(e) => updateSettings({ weeklyRdvGoal: Number(e.target.value) || 1 })} /></Field>
            {brand.features.catalog && <Field label="Adresse de l'établissement (RDV présentiels et fiche imprimée)"><input value={s.centerAddress || ''} onChange={(e) => updateSettings({ centerAddress: e.target.value })} placeholder="Adresse du centre" /></Field>}
          </section>
          <section className="card pad24 grow1 stack12" aria-label="Données">
            <h2>Données</h2>
            <div className="muted sm">{remote ? 'Les données sont enregistrées sur le serveur (MongoDB). « Restaurer » et « Recharger la démo » remplacent les données de l’entreprise (les comptes sont conservés ; les membres de la démo reçoivent le mot de passe de démo du serveur).' : 'Cette version enregistre les données dans votre navigateur. Faites une sauvegarde régulière, ou branchez l’application sur l’API (dossier backend, voir README).'}</div>
            <div className="row wrap gap8">
              <button className="btn ghost" onClick={backup}><Icon name="download" />Sauvegarder (JSON)</button>
              <button className="btn ghost" onClick={() => fileRef.current?.click()}><Icon name="upload" />Restaurer</button>
              <input ref={fileRef} type="file" accept=".json" className="sr" onChange={(e) => { if (e.target.files[0]) onRestore(e.target.files[0]); e.target.value = ''; }} />
            </div>
            <div className="row wrap gap8" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              <button className="btn ghost" onClick={async () => { if (await confirm({ title: 'Recharger la démo', message: 'Remplacer toutes les données par les données de démonstration ?', ok: 'Recharger', danger: true })) { await resetDemo(); toast('Données de démo rechargées'); } }}>Recharger les données de démo</button>
              <button className="btn ghost" style={{ color: 'var(--red-ink)' }} onClick={async () => { if (await confirm({ title: 'Vider la base', message: 'Supprimer tous les contacts, RDV, tâches et historiques ? L’équipe est conservée.', ok: 'Tout supprimer', danger: true })) { await clearAll(); toast('Base vidée'); } }}>Vider la base</button>
            </div>
          </section>
        </div>
      )}
      {state.users.length === 0 && <Empty icon="users" title="Aucun membre" />}
      {form && <UserForm user={form.user} onClose={() => setForm(null)} />}
      {roleModal && !roleModal.del && <RoleModal role={roleModal.role} base={roleModal.base} onClose={() => setRoleModal(null)} />}
      {roleModal?.del && <DeleteRoleModal role={roleModal.del} onClose={() => setRoleModal(null)} />}
    </>
  );
}
