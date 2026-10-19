import { useEffect, useRef } from 'react';
import { HashRouter, MemoryRouter, BrowserRouter, Routes, Route, useInRouterContext } from 'react-router-dom';
import { StoreProvider } from './store/Store';
import { UIProvider } from './components/UI';
import { AIProvider } from './components/AIAssistant';
import ApiGate from './api/ApiGate';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import CallSession from './pages/CallSession';
import Pipeline from './pages/Pipeline';
import Appointments from './pages/Appointments';
import Tasks from './pages/Tasks';
import Clients from './pages/Clients';
import Reports from './pages/Reports';
import Team from './pages/Team';
import Products from './pages/Products';
import Guides from './pages/Guides';
import Company from './pages/Company';
import Clauses from './pages/Clauses';
import { CrmBaseProvider, Navigate } from './nav';
import { Guard } from './components/Can';
import { useStore } from './store/Store';
import { can, homeRoute } from './store/permissions';
import { applyBrand, setCrmRoot, savedTheme } from './brand';
import './styles.css';

function Home() {
  const { state } = useStore();
  if (can(state, 'nav.dashboard')) return <Dashboard />;
  const home = homeRoute(state);
  return home ? <Navigate to={home} replace /> : <Guard perm="nav.dashboard"><Dashboard /></Guard>;
}
const G = (perm, el) => <Guard perm={perm}>{el}</Guard>;

function CrmRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="contacts" element={G('nav.contacts', <Contacts />)} />
        <Route path="contacts/:id" element={G('nav.contacts', <ContactDetail />)} />
        <Route path="appels" element={G('nav.calls', <CallSession />)} />
        <Route path="pipeline" element={G('nav.pipeline', <Pipeline />)} />
        <Route path="rendez-vous" element={G('nav.rdv', <Appointments />)} />
        <Route path="taches" element={G('nav.tasks', <Tasks />)} />
        <Route path="clients" element={G('nav.clients', <Clients />)} />
        <Route path="produits" element={G('nav.products', <Products />)} />
        <Route path="formations" element={<Navigate to="/produits" replace />} />
        <Route path="guides" element={G('nav.guides', <Guides />)} />
        <Route path="rapports" element={G('nav.reports', <Reports />)} />
        <Route path="equipe" element={G('nav.team', <Team />)} />
        <Route path="entreprise" element={G('nav.company', <Company />)} />
        <Route path="conditions" element={G('nav.clauses', <Clauses />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

const StoreKeyed = ({ children }) => children;
/** IA par défaut en mode API : POST /api/ai (si le serveur n'a pas de clé, l'assistant reste en analyse locale) */
const serverAI = (remote) => async ({ question, context, role }) => (await remote.client.post('/ai', { question, context, role })).answer;

const ROUTERS = { hash: HashRouter, memory: MemoryRouter, browser: BrowserRouter };

/**
 * Certains aperçus (iframe « srcdoc », bac à sable) n'ont pas d'adresse exploitable :
 * react-router y échoue avec « Failed to construct 'URL' ». On passe alors en mémoire.
 */
function urlRoutingWorks() {
  try {
    if (typeof window === 'undefined') return false;
    const { origin, href } = window.location;
    new URL('/x#/y', origin && origin !== 'null' ? origin : href); // eslint-disable-line no-new
    return true;
  } catch { return false; }
}

/**
 * CRM Proservices, prêt à intégrer dans une application React.
 *
 * @param {object}   props
 * @param {string}   [props.basePath='']    Chemin où le CRM est monté dans votre router (ex. "/crm").
 * @param {'hash'|'memory'|'browser'} [props.router='hash']
 *                   Router utilisé UNIQUEMENT si votre application n'en a pas déjà un.
 *                   Si le CRM est rendu dans un <BrowserRouter> existant, il utilise le vôtre.
 * @param {string}   [props.storageKey]     Clé localStorage (une par entreprise / tenant).
 * @param {boolean}  [props.persist=true]   Sauvegarder dans le navigateur.
 * @param {object}   [props.initialData]    Données de départ (ex. venant de votre API).
 * @param {function} [props.onChange]       Appelé à chaque modification avec l'état complet (pour l'envoyer à votre API).
 * @param {boolean}  [props.demoData=true]  Charger les données de démonstration quand il n'y a rien.
 * @param {object}   [props.currentUser]    { id, name, role, email } de l'utilisateur connecté chez vous.
 * @param {number}   [props.topOffset=0]    Hauteur (px) de votre propre barre fixe au-dessus du CRM.
 * @param {'light'|'dark'|'system'} [props.theme] Thème imposé (sinon choix de l'utilisateur).
 * @param {function} [props.ai]           Optionnel : async ({ question, context, role }) => réponse texte de votre modèle d'IA
 *                   (appelé par l'assistant IA du tableau de bord et des rapports). Sans ça : analyse locale.
 * @param {string}   [props.apiUrl]       Mode API : adresse du backend (ex. "https://crm.exemple.tn/api"). Les données
 *                   viennent alors du serveur Node.js / MongoDB (dossier /backend) au lieu du navigateur.
 * @param {string}   [props.token]        Mode API : jeton fourni par votre application (SSO). Sans jeton : écran de connexion.
 * @param {string}   [props.tenantId]     Mode API : identifiant de l'entreprise (multi-entreprises).
 * @param {function} [props.onLogout]     Mode API : appelé après « Se déconnecter ».
 * @param {function} [props.onUnauthorized] Mode API avec `token` : appelé si le jeton expire (à vous d'en fournir un nouveau).
 * @param {string}   [props.className]
 */
export default function ProservicesCRM({
  basePath = '', router = 'hash', storageKey, persist = true, initialData, onChange, demoData = true,
  currentUser, topOffset = 0, theme, className = '', ai, apiUrl, token, tenantId, onLogout, onUnauthorized,
}) {
  const inRouter = useInRouterContext();
  const rootRef = useRef(null);
  applyBrand();

  useEffect(() => {
    setCrmRoot(rootRef.current);
    const t = theme && theme !== 'system' ? theme : (theme === 'system' ? undefined : savedTheme());
    if (t) rootRef.current.dataset.theme = t; else delete rootRef.current.dataset.theme;
    return () => setCrmRoot(null);
  }, [theme]);

  const tree = (store) => (
    <StoreProvider {...store}>
      <UIProvider>
        <AIProvider value={store.ai || null}>
          <CrmRoutes />
        </AIProvider>
      </UIProvider>
    </StoreProvider>
  );
  const content = (
    <CrmBaseProvider value={inRouter ? basePath : ''}>
      {apiUrl ? (
        <ApiGate apiUrl={apiUrl} token={token} tenantId={tenantId} onLogout={onLogout} onUnauthorized={onUnauthorized}>
          {({ initialData: data, remote, key }) => (
            <StoreKeyed key={key}>{tree({ initialData: data, remote, onChange, persist: false, ai: ai || serverAI(remote) })}</StoreKeyed>
          )}
        </ApiGate>
      ) : tree({ storageKey, persist, initialData, onChange, demoData, currentUser, ai })}
    </CrmBaseProvider>
  );
  const R = router !== 'memory' && !urlRoutingWorks() ? MemoryRouter : (ROUTERS[router] || HashRouter);

  return (
    <div ref={(el) => { rootRef.current = el; if (el) setCrmRoot(el); }} className={`pcrm ${className}`} style={{ '--pcrm-top': `${topOffset}px` }}>
      {inRouter ? content : <R>{content}</R>}
    </div>
  );
}
