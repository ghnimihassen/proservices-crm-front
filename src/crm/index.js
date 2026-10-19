/**
 * Point d'entrée du module CRM Proservices.
 *
 *   import ProservicesCRM from './crm';
 *   <Route path="/crm/*" element={<ProservicesCRM basePath="/crm" />} />
 */
export { default, default as ProservicesCRM } from './App';
export { createSeed } from './store/Store';
