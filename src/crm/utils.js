// Couleurs d'avatar : tokens définis dans styles.css (clair + sombre)
const AVATAR_COLORS = [1, 2, 3, 4, 5, 6, 7].map((i) => [`var(--av${i}-bg)`, `var(--av${i}-fg)`]);

export const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export const initials = (s = '') =>
  s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const colorFor = (s = '') => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const normPhone = (p = '') => p.replace(/\D/g, '').replace(/^216/, '');

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d = new Date()) => { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; return addDays(x, -day); };
export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const isToday = (d) => d && sameDay(new Date(d), new Date());

const fmt = (o) => new Intl.DateTimeFormat('fr-FR', o);
export const fDate = (d) => (d ? fmt({ day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d)) : '—');
export const fShort = (d) => (d ? fmt({ day: '2-digit', month: '2-digit' }).format(new Date(d)) : '—');
export const fTime = (d) => (d ? fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(d)) : '');
export const fDayLong = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
export const fDateTime = (d) => (d ? `${fShort(d)} ${fTime(d)}` : '—');
export const fMoney = (n) => `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))} DT`;

export function fRelative(d) {
  if (!d) return 'Jamais';
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.round(diff / 60000);
  if (Math.abs(min) < 1) return "à l'instant";
  if (min > 0) {
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const days = Math.round(h / 24);
    if (days === 1) return 'hier';
    return `il y a ${days} j`;
  }
  const f = -min;
  if (f < 60) return `dans ${f} min`;
  const h = Math.round(f / 60);
  if (h < 24) return `dans ${h} h`;
  return `dans ${Math.round(h / 24)} j`;
}

// Valeur pour <input type="datetime-local"> / "date"
export const toLocalInput = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export function downloadBlob(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const telHref = (p) => `tel:${(p || '').replace(/[^\d+]/g, '')}`;
export const waHref = (p) => {
  let n = (p || '').replace(/\D/g, '');
  if (n.length === 8) n = '216' + n;
  return `https://wa.me/${n}`;
};
export const mapsHref = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || '')}`;
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
