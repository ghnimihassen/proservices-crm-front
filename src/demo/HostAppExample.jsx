/*
 * EXEMPLE D'INTÉGRATION dans votre application React existante (react-router v6).
 * Ce fichier n'est pas utilisé par la démo : copiez le modèle dans votre projet.
 */
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ProservicesCRM from '../crm';

function MonHeader() {
  return (
    <header style={{ height: 56, display: 'flex', alignItems: 'center', gap: 16, padding: '0 16px', background: '#111', color: '#fff', position: 'sticky', top: 0, zIndex: 40 }}>
      <b>Notre solution</b>
      <Link to="/" style={{ color: '#fff' }}>Accueil</Link>
      <Link to="/crm" style={{ color: '#fff' }}>CRM</Link>
    </header>
  );
}

export default function HostApp() {
  // roleId : 'admin' (Super admin), 'manager' (Responsable commercial), 'sales' (Commercial) ou l'id d'un rôle créé dans « Équipe & paramètres »
  const user = { id: 'u-123', name: 'Nour Ben Salah', role: 'Conseillère', email: 'nour@proservices.tn', roleId: 'admin' };
  return (
    <BrowserRouter>
      <MonHeader />
      <Routes>
        <Route path="/" element={<p style={{ padding: 24 }}>Page d'accueil de votre application</p>} />
        {/* Le "/*" est indispensable : le CRM gère ses sous-pages (/crm/contacts, /crm/pipeline…) */}
        <Route path="/crm/*" element={
          <ProservicesCRM
            basePath="/crm"
            topOffset={56}
            currentUser={user}
            storageKey={`crm-${user.id}`}
            onChange={(state) => {
              // Exemple : envoyer l'état à votre API (à limiter avec un debounce)
              // fetch('/api/crm/state', { method: 'PUT', body: JSON.stringify(state) });
            }}
          />
        } />
      </Routes>
    </BrowserRouter>
  );
}
