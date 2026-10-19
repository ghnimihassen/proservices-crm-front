import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from '../nav';
import Icon from './Icon';
import Logo from './Logo';
import { Avatar, Menu, StagePill } from './UI';
import { ContactForm, RdvForm, TaskForm } from './Forms';
import { TypeModal } from '../pages/Products';
import { useStore } from '../store/Store';
import { defaultCallQueue, contactById, productLabels, paymentSummary } from '../store/selectors';
import { startOfDay, endOfDay, fTime, fShort, isToday, normPhone } from '../utils';
import brand, { getCrmRoot } from '../brand';
import { can, visibleContacts, roleOf } from '../store/permissions';
import ActivitySwitch from './ActivitySwitch';
import SyncStatus from './SyncStatus';
import PasswordModal from './PasswordModal';
import { LABELS } from '../store/constants';

function NavItem({ to, icon, label, count, tone, end, onClick }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `ni${isActive ? ' act' : ''}`} onClick={onClick} title={label}>
      <Icon name={icon} /><span className="t">{label}</span>
      {count != null && count > 0 && <span className={`cnt${tone ? ` ${tone}` : ''}`}>{count}</span>}
    </NavLink>
  );
}

/* ---------- Menu Produits dépliable : une entrée par type de produit ---------- */
function ProductsNav({ state, onNavigate, onAddType }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const onProducts = loc.pathname === '/produits';
  const curType = onProducts ? new URLSearchParams(loc.search).get('type') : null;
  const [open, setOpen] = useState(onProducts);
  useEffect(() => { if (onProducts) setOpen(true); }, [onProducts]);
  const types = state.productTypes || [];
  const go = (to) => { navigate(to); onNavigate(); };
  return (
    <div className="ngroup">
      <div className={`ni${onProducts && !curType ? ' act' : ''}`} style={{ paddingRight: 4 }}>
        <button className="ni-main" onClick={() => go('/produits')} title="Produits"><Icon name="box" /><span className="t">Produits</span></button>
        <span className="cnt">{(state.catalog || []).length}</span>
        <button className="ni-tog" aria-expanded={open} aria-label={open ? 'Replier Produits' : 'Déplier Produits'} onClick={() => setOpen((o) => !o)}>
          <Icon name="right" size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      </div>
      {open && (
        <div className="nsub">
          {types.map((t) => (
            <button key={t.id} className={`nsub-i${curType === t.id ? ' act' : ''}`} onClick={() => go(`/produits?type=${t.id}`)}>
              <span className="ell">{t.many}</span><span className="cnt">{(state.catalog || []).filter((p) => p.typeId === t.id).length}</span>
            </button>
          ))}
          {onAddType && <button className="nsub-i add" onClick={onAddType}><Icon name="plus" size={14} /><span>Nouveau type</span></button>}
        </div>
      )}
    </div>
  );
}

/* ---------- Thème clair / sombre / système ---------- */
function useTheme() {
  const key = `${brand.id}-theme`;
  const [theme, setTheme] = useState(() => getCrmRoot().dataset.theme || 'system');
  const set = (t) => {
    setTheme(t);
    if (t === 'system') delete getCrmRoot().dataset.theme;
    else getCrmRoot().dataset.theme = t;
    try { localStorage.setItem(key, t); } catch { /* stockage indisponible */ }
  };
  return [theme, set];
}

/* ---------- Palette de commandes (Ctrl + K) ---------- */
function CommandPalette({ onClose, actions }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    const sp = normPhone(q);
    const acts = actions.filter((a) => !s || a.label.toLowerCase().includes(s)).map((a) => ({ ...a, group: 'Actions' }));
    const contacts = (s ? visibleContacts(state).filter((c) => `${c.org} ${c.name} ${c.email} ${c.city}`.toLowerCase().includes(s) || (sp.length >= 3 && normPhone(c.phone).includes(sp))) : [])
      .slice(0, 8).map((c) => ({ id: c.id, group: LABELS.contacts, label: c.org, sub: [c.name, c.phone].filter(Boolean).join(' · '), contact: c, run: () => navigate(`/contacts/${c.id}`) }));
    return [...contacts, ...acts];
  }, [q, state.contacts, actions, navigate]);

  useEffect(() => { setI(0); }, [q]);
  const run = (it) => { onClose(); it.run(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(items.length - 1, x + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    if (e.key === 'Enter' && items[i]) { e.preventDefault(); run(items[i]); }
    if (e.key === 'Escape') onClose();
  };
  let lastGroup = null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal cmdk" role="dialog" aria-modal="true" aria-label="Recherche et actions rapides" onKeyDown={onKey}>
        <div className="cmdk-in">
          <Icon name="search" />
          <label className="sr" htmlFor="cmdk-q">Rechercher</label>
          <input id="cmdk-q" ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Rechercher un ${LABELS.contact}, un numéro, une action…`} autoComplete="off" />
          <span className="kbd">Échap</span>
        </div>
        <div className="cmdk-list" role="listbox">
          {items.length === 0 && <div className="muted sm" style={{ padding: 16 }}>Aucun résultat pour « {q} ».</div>}
          {items.map((it, idx) => {
            const head = it.group !== lastGroup ? <div className="cmdk-g">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={`${it.group}-${it.id}`}>
                {head}
                <button className={`cmdk-item${idx === i ? ' on' : ''}`} role="option" aria-selected={idx === i} onMouseEnter={() => setI(idx)} onClick={() => run(it)}>
                  {it.contact ? <Avatar name={it.label} size={32} /> : <span className="ico i-violet"><Icon name={it.icon} size={16} /></span>}
                  <span style={{ flex: 1, minWidth: 0 }}><b className="ell" style={{ display: 'block' }}>{it.label}</b>{it.sub && <span className="muted xs">{it.sub}</span>}</span>
                  {it.contact && <StagePill stage={it.contact.stage} />}
                  {it.hint && <span className="kbd">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const { state, startSession, updateSettings, remote } = useStore();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(`${brand.id}-sb`) === '1'; } catch { return false; } });
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useTheme();
  const me = state.users.find((u) => u.id === state.settings.currentUserId) || state.users[0];
  const P = productLabels(state);
  const ok = (k) => can(state, k);

  useEffect(() => { try { localStorage.setItem(`${brand.id}-sb`, collapsed ? '1' : '0'); } catch { /* */ } }, [collapsed]);
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal('cmdk'); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const counts = useMemo(() => {
    const tocall = defaultCallQueue(state).length;
    const rdvToday = state.appointments.filter((a) => a.status === 'planned' && a.ownerId === me?.id && isToday(a.start)).length;
    const tasksDue = state.tasks.filter((t) => !t.done && t.ownerId === me?.id && new Date(t.due) <= endOfDay()).length;
    const unpaid = state.contacts.filter((c) => paymentSummary(c).overdue.length > 0).length;
    return { tocall, rdvToday, tasksDue, unpaid };
  }, [state, me]);

  const notifications = useMemo(() => {
    const overdue = state.tasks.filter((t) => !t.done && t.ownerId === me?.id && new Date(t.due) < startOfDay())
      .map((t) => ({ id: t.id, tone: 'red', text: `En retard : ${t.title}`, sub: contactById(state, t.contactId)?.org, to: t.contactId ? `/contacts/${t.contactId}` : '/taches' }));
    const today = state.appointments.filter((a) => a.status === 'planned' && a.ownerId === me?.id && isToday(a.start))
      .map((a) => ({ id: a.id, tone: 'violet', text: `RDV ${fTime(a.start)} · ${contactById(state, a.contactId)?.org || ''}`, sub: a.mode === 'online' ? 'En ligne' : 'Présentiel', to: `/contacts/${a.contactId}` }));
    const toReport = state.appointments.filter((a) => a.status === 'planned' && a.ownerId === me?.id && new Date(a.start) < startOfDay())
      .map((a) => ({ id: 'r' + a.id, tone: 'orange', text: `Compte-rendu manquant · ${contactById(state, a.contactId)?.org || ''}`, sub: `RDV du ${fShort(a.start)}`, to: `/contacts/${a.contactId}` }));
    const dues = brand.features.catalog ? state.contacts.filter((c) => c.ownerId === me?.id).flatMap((c) => paymentSummary(c).overdue.map((i) => ({
      id: 'p' + i.id, tone: 'red', text: `Échéance en retard : ${c.org}`, sub: `${i.amount} DT · prévue le ${fShort(i.due)}`, to: `/contacts/${c.id}`,
    }))) : [];
    return [...dues, ...toReport, ...overdue, ...today];
  }, [state, me]);

  const launchSession = () => {
    startSession(defaultCallQueue(state), 'À appeler aujourd’hui');
    setOpen(false);
    navigate('/appels');
  };

  const actions = useMemo(() => [
    { id: 'new-contact', perm: 'contacts.create', label: LABELS.newContact, icon: 'plus', run: () => setModal('contact') },
    { id: 'session', perm: 'nav.calls', label: 'Lancer ma session d’appels', icon: 'phone', run: launchSession },
    { id: 'new-rdv', perm: 'nav.rdv', label: 'Planifier un rendez-vous', icon: 'calendar', run: () => setModal('rdv') },
    { id: 'new-task', perm: 'nav.tasks', label: 'Ajouter une tâche', icon: 'check', run: () => setModal('task') },
    { id: 'go-dash', perm: 'nav.dashboard', label: 'Aller au tableau de bord', icon: 'home', run: () => navigate('/') },
    { id: 'go-contacts', perm: 'nav.contacts', label: `Aller aux ${LABELS.contacts.toLowerCase()}`, icon: 'users', run: () => navigate('/contacts') },
    { id: 'go-pipe', perm: 'nav.pipeline', label: 'Aller au pipeline', icon: 'pipeline', run: () => navigate('/pipeline') },
    ...(brand.features.catalog ? [
      { id: 'go-cat', perm: 'nav.products', label: 'Aller aux produits', icon: 'box', run: () => navigate('/produits') },
      ...(state.productTypes || []).map((t) => ({ id: `go-t-${t.id}`, perm: 'nav.products', label: `Aller aux ${t.many.toLowerCase()}`, icon: 'book', run: () => navigate(`/produits?type=${t.id}`) })),
      { id: 'new-type', perm: 'products.manage', label: 'Nouveau type de produit', icon: 'plus', run: () => setModal('type') },
      { id: 'go-guides', perm: 'nav.guides', label: 'Aller aux guides d\u2019appel', icon: 'note', run: () => navigate('/guides') },
    ] : []),
    { id: 'go-company', perm: 'nav.company', label: 'Mon entreprise (logo, coordonnées)', icon: 'building', run: () => navigate('/entreprise') },
    { id: 'go-clauses', perm: 'nav.clauses', label: 'Conditions générales', icon: 'file', run: () => navigate('/conditions') },
    { id: 'theme', label: 'Basculer thème clair / sombre', icon: 'moon', run: () => setTheme(getCrmRoot().dataset.theme === 'dark' ? 'light' : 'dark') },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [state]);

  const close = () => setOpen(false);
  const isCallPage = loc.pathname.startsWith('/appels');
  const themeIcon = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor';
  const nextTheme = { system: 'light', light: 'dark', dark: 'system' }[theme];
  const themeLabel = { system: 'Thème : système', light: 'Thème : clair', dark: 'Thème : sombre' }[theme];

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}`}>
      <aside className={`sb${open ? ' open' : ''}`} aria-label="Navigation principale">
        <div className="brandmark">
          {state.company?.logo ? <img src={state.company.logo} alt="" className="clogo" /> : <Logo />}
          <span className="txt"><span className="name ell" style={{ display: 'block', maxWidth: 170 }}>{state.company?.name || brand.name}</span><span className="prod">CRM commercial</span></span>
        </div>
        <ActivitySwitch />
        <nav className="nav">
          {ok('nav.dashboard') && <NavItem to="/" end icon="home" label="Tableau de bord" onClick={close} />}
          {ok('nav.contacts') && <NavItem to="/contacts" icon="users" label={LABELS.contacts} count={ok('reports.company') ? visibleContacts(state).length : undefined} onClick={close} />}
          {ok('nav.calls') && <NavItem to="/appels" icon="phone" label="Session d'appels" count={counts.tocall} tone="orange" onClick={close} />}
          {ok('nav.pipeline') && <NavItem to="/pipeline" icon="pipeline" label="Pipeline" onClick={close} />}
          {ok('nav.rdv') && <NavItem to="/rendez-vous" icon="calendar" label="Rendez-vous" count={counts.rdvToday} onClick={close} />}
          {ok('nav.tasks') && <NavItem to="/taches" icon="check" label="Tâches & relances" count={counts.tasksDue} tone="red" onClick={close} />}
          {['nav.products', 'nav.guides', 'nav.clients', 'nav.reports'].some(ok) && <div className="navl">{brand.features.catalog ? 'Ventes' : 'Clients'}</div>}
          {brand.features.catalog && ok('nav.products') && <ProductsNav state={state} onNavigate={close} onAddType={ok('products.manage') ? () => setModal('type') : null} />}
          {brand.features.catalog && ok('nav.guides') && <NavItem to="/guides" icon="note" label="Guides d'appel" count={(state.guides || []).length} onClick={close} />}
          {ok('nav.clients') && <NavItem to="/clients" icon={brand.features.catalog ? 'cap' : 'star'} label={LABELS.clients} count={brand.features.catalog ? counts.unpaid : state.contacts.filter((c) => c.stage === 'won').length} tone={brand.features.catalog && counts.unpaid ? 'orange' : undefined} onClick={close} />}
          {ok('nav.reports') && <NavItem to="/rapports" icon="chart" label="Rapports" onClick={close} />}
          {['nav.company', 'nav.clauses', 'nav.team'].some(ok) && <div className="navl">Gestion</div>}
          {ok('nav.company') && <NavItem to="/entreprise" icon="building" label="Mon entreprise" onClick={close} />}
          {ok('nav.clauses') && <NavItem to="/conditions" icon="file" label="Conditions générales" count={(state.clauses || []).filter((c) => c.active !== false).length} onClick={close} />}
          {ok('nav.team') && <NavItem to="/equipe" icon="settings" label="Équipe & paramètres" onClick={close} />}
        </nav>
        {ok('nav.calls') && <button className="side-cta" onClick={launchSession} title="Lancer ma session d'appels"><Icon name="zap" /><span className="t">Session d'appels</span></button>}
        <Menu align="up" className="me" label={<>
          <Avatar name={me?.name} round size={34} />
          <span className="txt" style={{ textAlign: 'left', minWidth: 0, flex: 1 }}><b className="ell" style={{ display: 'block' }}>{me?.name}</b><span className="muted xs">{roleOf(state, me)?.name}</span></span>
        </>}>
          <div className="menu-t">{me?.role}</div>
          {remote && <button role="menuitem" onClick={() => setModal('password')}><Icon name="settings" size={16} /><span style={{ flex: 1 }}>Changer mon mot de passe</span></button>}
          {remote?.logout && <button role="menuitem" onClick={() => remote.logout()}><Icon name="logout" size={16} /><span style={{ flex: 1 }}>Se déconnecter</span></button>}
          {!state.settings.authManaged && <div className="menu-t">Démo — se connecter en tant que</div>}
          {!state.settings.authManaged && state.users.filter((u) => u.active !== false).map((u) => (
            <button key={u.id} role="menuitem" className={u.id === me?.id ? 'on' : ''} onClick={() => updateSettings({ currentUserId: u.id })}>
              <Avatar name={u.name} size={24} round /><span style={{ flex: 1 }}>{u.name}</span><span className="muted xs">{roleOf(state, u)?.name}</span>
            </button>
          ))}
        </Menu>
        <button className="collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}>
          <Icon name="sidebar" size={16} /><span className="t">Replier le menu</span>
        </button>
      </aside>
      {open && <div className="scrim" onClick={close} />}

      <div className="main-col">
        {!isCallPage && (
          <header className="topbar">
            <button className="icon-btn mobile-only" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}><Icon name="menu" /></button>
            <button className="cmdk-trigger" onClick={() => setModal('cmdk')}>
              <Icon name="search" /><span style={{ flex: 1 }} className="ell">Rechercher ou lancer une action…</span><span className="kbd hide-sm">Ctrl K</span>
            </button>
            <div className="row gap8 tools">
              <SyncStatus />
              <button className="icon-btn" onClick={() => setTheme(nextTheme)} aria-label={themeLabel} title={themeLabel}><Icon name={themeIcon} /></button>
              <Menu align="right" className="icon-btn" label={<>
                <Icon name="bell" /><span className="sr">Notifications</span>
                {notifications.length > 0 && <span className="dot-badge">{notifications.length}</span>}
              </>}>
                <div className="menu-t">Notifications</div>
                {notifications.length === 0 && <div className="muted sm" style={{ padding: 12 }}>Rien à signaler.</div>}
                {notifications.map((n) => (
                  <button key={n.id} role="menuitem" onClick={() => navigate(n.to)}>
                    <span className={`ndot ${n.tone}`} /><span style={{ textAlign: 'left' }}>{n.text}{n.sub && <span className="muted sm" style={{ display: 'block' }}>{n.sub}</span>}</span>
                  </button>
                ))}
              </Menu>
              {ok('contacts.create') && <button className="btn primary" onClick={() => setModal('contact')}><Icon name="plus" stroke={2.2} /><span className="hide-sm">{LABELS.newContact}</span></button>}
            </div>
          </header>
        )}
        <main className={isCallPage ? '' : 'content'}>
          <Outlet />
        </main>
      </div>
      {modal === 'cmdk' && <CommandPalette onClose={() => setModal(null)} actions={actions.filter((a) => !a.perm || ok(a.perm))} />}
      {modal === 'contact' && <ContactForm onClose={() => setModal(null)} onSaved={(c) => navigate(`/contacts/${c.id}`)} />}
      {modal === 'rdv' && <RdvForm onClose={() => setModal(null)} />}
      {modal === 'task' && <TaskForm onClose={() => setModal(null)} />}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
      {modal === 'type' && <TypeModal onClose={() => setModal(null)} onSaved={(t) => t && navigate(`/produits?type=${t.id}`)} />}
    </div>
  );
}
