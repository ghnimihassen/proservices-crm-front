/*
 * Mode API : connexion, première installation, chargement des données depuis le serveur.
 * Utilisé automatiquement quand <ProservicesCRM apiUrl="https://…/api" /> est fourni.
 *  - token fourni par votre application (SSO) → pas d'écran de connexion ;
 *  - sinon écran de connexion du CRM (le jeton est gardé pour la session du navigateur).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApiClient } from './client';
import { SyncEngine } from './sync';
import Logo from '../components/Logo';

const KEY = (url, tenant) => `pcrm-token:${url}:${tenant || ''}`;
const readToken = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
const writeToken = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* stockage indisponible */ } };

export default function ApiGate({ apiUrl, token: tokenProp, tenantId, onLogout, onUnauthorized, children }) {
  const storageKey = KEY(apiUrl, tenantId);
  const [token, setToken] = useState(() => tokenProp || readToken(storageKey));
  const [phase, setPhase] = useState('loading'); // loading | login | setup | ready | error
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => { if (tokenProp) setToken(tokenProp); }, [tokenProp]);

  const logout = useCallback(() => {
    writeToken(storageKey, '');
    setToken(''); setData(null);
    onLogout?.();
  }, [storageKey, onLogout]);

  const client = useMemo(() => createApiClient({
    baseUrl: apiUrl,
    getToken: () => tokenRef.current,
    onUnauthorized: () => { if (tokenProp) onUnauthorized?.(); else logout(); },
  }), [apiUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const sync = useMemo(() => new SyncEngine(client), [client]);
  const reload = useCallback(async () => (await client.get('/bootstrap')).state, [client]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setError('');
      if (!token) {
        setPhase('loading');
        try { const s = await client.get(`/auth/setup${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`); if (alive) setPhase(s?.needed ? 'setup' : 'login'); } catch (e) { if (alive) { setError(e.message); setPhase('login'); } }
        return;
      }
      setPhase('loading');
      try {
        const b = await client.get('/bootstrap');
        if (alive) { setData(b); setPhase('ready'); }
      } catch (e) {
        if (!alive) return;
        if (e.status === 401 || e.status === 403) { if (!tokenProp) { writeToken(storageKey, ''); setToken(''); } setError(e.message); setPhase('login'); } else { setError(e.message); setPhase('error'); }
      }
    })();
    return () => { alive = false; };
  }, [token, client, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const signedIn = (r) => { writeToken(storageKey, r.token); setToken(r.token); };

  if (phase === 'ready' && data) {
    const remote = { client, sync, reload, logout: tokenProp ? null : logout, me: data.me };
    return children({ initialData: data.state, remote, key: data.me.id });
  }
  if (phase === 'login' || phase === 'setup') return <AuthScreen setup={phase === 'setup'} client={client} tenantId={tenantId} onDone={signedIn} initialError={error} />;
  return (
    <div className="auth-wrap">
      <div className="auth-card stack12" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Logo />
        {phase === 'error'
          ? <><b>Impossible de charger le CRM</b><div className="muted sm">{error}</div><button className="btn primary" onClick={() => setAttempt((n) => n + 1)}>Réessayer</button></>
          : <div className="muted">Chargement du CRM…</div>}
      </div>
    </div>
  );
}

function AuthScreen({ setup, client, tenantId, onDone, initialError }) {
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState(initialError || '');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = setup ? await client.post('/auth/setup', { ...f, tenantId }) : await client.post('/auth/login', { email: f.email, password: f.password, tenantId });
      onDone(r);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap">
      <form className="auth-card stack16" onSubmit={submit}>
        <div className="row gap12"><Logo /><div><h1 style={{ fontSize: 22 }}>{setup ? 'Installation du CRM' : 'Connexion'}</h1><div className="muted sm">{setup ? 'Créez le compte du Super admin' : 'Accédez à votre espace commercial'}</div></div></div>
        {setup && <label className="field"><span className="field-l">Nom complet</span><input value={f.name} onChange={set('name')} autoComplete="name" /></label>}
        <label className="field"><span className="field-l">Email</span><input type="email" value={f.email} onChange={set('email')} autoComplete="username" required /></label>
        <label className="field"><span className="field-l">Mot de passe</span><input type="password" value={f.password} onChange={set('password')} autoComplete={setup ? 'new-password' : 'current-password'} required minLength={setup ? 8 : undefined} />{setup && <span className="field-h">8 caractères minimum</span>}</label>
        {err && <div className="alert err">{err}</div>}
        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Patientez…' : setup ? 'Créer le compte et entrer' : 'Se connecter'}</button>
      </form>
    </div>
  );
}
