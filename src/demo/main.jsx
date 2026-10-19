import React from 'react';
import ReactDOM from 'react-dom/client';
import ProservicesCRM from '../crm';

/*
 * Démo autonome.
 * - Sans backend : données dans le navigateur.
 * - Avec le backend Node.js : VITE_API_URL=http://localhost:4000/api dans frontend/.env (ou ?api=… dans l'URL).
 */
const apiUrl = new URLSearchParams(window.location.search).get('api') || import.meta.env.VITE_API_URL || '';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ProservicesCRM apiUrl={apiUrl || undefined} />
  </React.StrictMode>,
);
