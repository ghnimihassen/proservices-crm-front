import proservices from './brands/proservices';

/*
 * Configuration de la marque (couleurs, vocabulaire, étapes, données de démo) :
 * voir src/crm/brands/proservices.js.
 */
const brand = proservices;

/* Élément racine du CRM (div.pcrm) — le thème clair/sombre et les fenêtres d'impression s'y attachent */
let rootEl = null;
export const setCrmRoot = (el) => { rootEl = el; };
export const getCrmRoot = () => rootEl || document.body;

/** Injecte une seule fois les couleurs de la marque (scopées à .pcrm) et la police */
export function applyBrand() {
  if (document.getElementById('pcrm-theme')) return;
  const style = document.createElement('style');
  style.id = 'pcrm-theme';
  const toCss = (o) => Object.entries(o).map(([k, v]) => `${k}:${v};`).join('');
  const { light, dark } = brand.theme;
  style.textContent = `
    .pcrm{${toCss(light)}}
    @media (prefers-color-scheme: dark){.pcrm:not([data-theme="light"]){${toCss(dark)}}}
    .pcrm[data-theme="dark"]{${toCss(dark)}}
  `;
  document.head.appendChild(style);
  if (brand.fontLink && !document.querySelector(`link[href="${brand.fontLink}"]`)) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = brand.fontLink;
    document.head.appendChild(l);
  }
}

/** Thème mémorisé (« light », « dark » ou absent = système) */
export function savedTheme() {
  try { const t = localStorage.getItem(`${brand.id}-theme`); return t === 'light' || t === 'dark' ? t : undefined; } catch { return undefined; }
}

export default brand;
