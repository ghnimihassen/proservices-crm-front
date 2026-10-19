/*
 * Navigation interne du CRM.
 * Toutes les pages importent Link / NavLink / useNavigate / useLocation depuis ce fichier
 * (et non directement depuis react-router-dom) : les chemins « /contacts », « /pipeline »…
 * sont automatiquement préfixés par le `basePath` où le CRM est monté dans votre application
 * (ex. « /crm » → « /crm/contacts »).
 */
import { createContext, forwardRef, useCallback, useContext, useMemo } from 'react';
import {
  Link as RRLink, NavLink as RRNavLink, Navigate as RRNavigate,
  useNavigate as useRRNavigate, useLocation as useRRLocation,
} from 'react-router-dom';

export { useParams, useSearchParams, Outlet, Routes, Route } from 'react-router-dom';

const BaseCtx = createContext('');
export const CrmBaseProvider = BaseCtx.Provider;

const clean = (b) => (b && b !== '/' ? `/${b.replace(/^\/+|\/+$/g, '')}` : '');

export function useCrmPath() {
  const base = clean(useContext(BaseCtx));
  return useCallback((to) => {
    if (typeof to !== 'string' || !to.startsWith('/') || !base) return to;
    if (to === base || to.startsWith(`${base}/`) || to.startsWith(`${base}?`)) return to;
    return to === '/' ? base : `${base}${to}`;
  }, [base]);
}

export function useNavigate() {
  const nav = useRRNavigate();
  const p = useCrmPath();
  return useCallback((to, opts) => (typeof to === 'number' ? nav(to) : nav(p(to), opts)), [nav, p]);
}

/** Comme useLocation, mais le pathname est relatif au CRM (sans le basePath) */
export function useLocation() {
  const loc = useRRLocation();
  const base = clean(useContext(BaseCtx));
  return useMemo(() => {
    if (!base || !loc.pathname.startsWith(base)) return loc;
    return { ...loc, pathname: loc.pathname.slice(base.length) || '/' };
  }, [loc, base]);
}

export const Link = forwardRef(function Link({ to, ...rest }, ref) {
  const p = useCrmPath();
  return <RRLink ref={ref} to={p(to)} {...rest} />;
});

export const NavLink = forwardRef(function NavLink({ to, ...rest }, ref) {
  const p = useCrmPath();
  return <RRNavLink ref={ref} to={p(to)} {...rest} />;
});

export function Navigate({ to, ...rest }) {
  const p = useCrmPath();
  return <RRNavigate to={p(to)} {...rest} />;
}
