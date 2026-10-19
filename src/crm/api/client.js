/*
 * Client HTTP de l'API du CRM (backend Node.js : dossier /backend).
 * Toutes les requêtes portent le jeton : Authorization: Bearer <token>.
 */
export class ApiError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

export function createApiClient({ baseUrl, getToken, onUnauthorized }) {
  const root = String(baseUrl || '').replace(/\/+$/, '');
  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(`${root}${path}`, {
        method,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(getToken?.() ? { Authorization: `Bearer ${getToken()}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Serveur injoignable : vérifiez votre connexion', 'network');
    }
    if (res.status === 204) return null;
    let data = null;
    try { data = await res.json(); } catch { /* réponse vide */ }
    if (!res.ok) {
      if (res.status === 401) onUnauthorized?.();
      throw new ApiError(res.status, data?.error || `Erreur ${res.status}`, data?.code);
    }
    return data;
  }
  return {
    baseUrl: root,
    get: (p) => request('GET', p),
    post: (p, b = {}) => request('POST', p, b),
    put: (p, b = {}) => request('PUT', p, b),
    patch: (p, b = {}) => request('PATCH', p, b),
    del: (p) => request('DELETE', p),
  };
}
