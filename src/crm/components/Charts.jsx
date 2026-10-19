/*
 * Petits graphiques SVG sans dépendance (barres groupées, prévision, sparkline, heatmap).
 * Les couleurs viennent des variables du thème (clair / sombre).
 */
import { useEffect, useRef, useState } from 'react';

/** Largeur réelle du conteneur : le SVG est dessiné en pixels, le texte garde sa taille */
function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const set = () => setW(Math.max(280, Math.floor(el.clientWidth || fallback)));
    set();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= v) || v;
};
const short = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.0', '')} M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.0', '')} k` : Math.abs(n) < 10 ? `${Math.round(n * 10) / 10}`.replace('.', ',') : `${Math.round(n)}`);

/**
 * Barres groupées : série A (ex. année en cours) et B (année précédente), ligne optionnelle.
 * data = [{ label, a, b?, line?, faded? }]
 */
export function Bars({ data, aLabel, bLabel, lineLabel, format = short, height = 220, onSelect, selected, aColor = 'var(--primary)', bColor = 'var(--line-2)', lineColor = 'var(--accent)' }) {
  const [hover, setHover] = useState(null);
  const [box, cw] = useWidth();
  const W = Math.max(cw, data.length * 34); const H = height; const pad = { l: 44, r: 10, t: 14, b: 28 };
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.a || 0, d.b || 0, d.line || 0, d.high || 0])));
  const iw = W - pad.l - pad.r; const ih = H - pad.t - pad.b;
  const step = iw / data.length; const hasB = data.some((d) => d.b !== undefined);
  const bw = Math.min(26, step * (hasB ? 0.36 : 0.62));
  const y = (v) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const linePts = data.map((d, i) => (d.line !== undefined && d.line !== null ? `${pad.l + step * i + step / 2},${y(d.line)}` : null)).filter(Boolean);
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="chart">
      <div className="chart-scroll" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }} role="img" aria-label={`${aLabel}${bLabel ? ` et ${bLabel}` : ''}`}>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--line)' }} strokeDasharray={v ? '3 4' : ''} />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" style={{ fill: 'var(--muted)', fontSize: 10.5 }}>{short(v)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = pad.l + step * i + step / 2;
            const on = selected === i || hover === i;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <rect x={pad.l + step * i} y={pad.t} width={step} height={ih} style={{ fill: on ? 'var(--soft)' : 'transparent' }} />
                {d.low !== undefined && <rect x={x0 - bw / 2 - 3} y={y(d.high)} width={bw + 6} height={Math.max(1, y(d.low) - y(d.high))} rx={4} style={{ fill: 'var(--accent-t)' }} />}
                {hasB && <rect x={x0 - bw - 1} y={y(d.b || 0)} width={bw} height={Math.max(0, pad.t + ih - y(d.b || 0))} rx={3} style={{ fill: bColor }} />}
                <rect x={hasB ? x0 + 1 : x0 - bw / 2} y={y(d.a || 0)} width={bw} height={Math.max(0, pad.t + ih - y(d.a || 0))} rx={3}
                  style={{ fill: d.forecast ? 'var(--accent)' : aColor, opacity: d.faded ? 0.35 : 1 }} strokeDasharray={d.forecast ? '4 3' : ''} />
                <text x={x0} y={H - 9} textAnchor="middle" style={{ fill: on ? 'var(--ink)' : 'var(--muted)', fontSize: 10.5, fontWeight: on ? 700 : 500 }}>{d.label}</text>
              </g>
            );
          })}
          {linePts.length > 1 && <polyline points={linePts.join(' ')} fill="none" style={{ stroke: lineColor }} strokeWidth="2.5" strokeLinejoin="round" />}
          {data.map((d, i) => d.line !== undefined && d.line !== null && <circle key={`c${i}`} cx={pad.l + step * i + step / 2} cy={y(d.line)} r="3.5" style={{ fill: 'var(--surface)', stroke: lineColor }} strokeWidth="2" />)}
        </svg>
      </div>
      <div className="chart-foot">
        <span className="lg"><i style={{ background: aColor }} />{aLabel}</span>
        {hasB && <span className="lg"><i style={{ background: bColor }} />{bLabel}</span>}
        {lineLabel && <span className="lg"><i style={{ background: lineColor, height: 3 }} />{lineLabel}</span>}
        {data.some((d) => d.forecast) && <span className="lg"><i style={{ background: 'var(--accent)' }} />Prévision IA</span>}
        <span className="tip">{h ? <><b>{h.label}</b> · {aLabel} : {format(h.a || 0)}{hasB ? ` · ${bLabel} : ${format(h.b || 0)}` : ''}{h.line !== undefined && h.line !== null && lineLabel ? ` · ${lineLabel} : ${format(h.line)}` : ''}{h.low !== undefined ? ` · fourchette ${format(h.low)} – ${format(h.high)}` : ''}</> : onSelect ? 'Cliquez sur une barre pour voir le détail' : ''}</span>
      </div>
    </div>
  );
}

/** Mini-courbe */
export function Spark({ values, width = 90, height = 26, color = 'var(--primary)' }) {
  const max = Math.max(1, ...values); const n = values.length;
  const pts = values.map((v, i) => `${(i / Math.max(1, n - 1)) * (width - 4) + 2},${height - 3 - (v / max) * (height - 6)}`).join(' ');
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"><polyline points={pts} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/** Heatmap jours × créneaux (taux de décroché) */
export function Heatmap({ grid, rows, cols }) {
  return (
    <div className="heat" style={{ gridTemplateColumns: `52px repeat(${cols.length}, 1fr)` }}>
      <span />
      {cols.map((c) => <span key={c} className="hc">{c}</span>)}
      {grid.map((row, ri) => (
        <div key={ri} style={{ display: 'contents' }}>
          <span className="hr">{rows[ri]}</span>
          {row.map((cell, ci) => {
            const rate = cell.n ? cell.r / cell.n : null;
            return (
              <span key={ci} className="hcell" title={cell.n ? `${rows[ri]} ${cols[ci]} : ${Math.round(rate * 100)} % de décroché (${cell.n} appels)` : 'Pas d’appels'}
                style={{ background: rate === null ? 'var(--soft)' : `color-mix(in srgb, var(--green) ${Math.round(15 + rate * 85)}%, var(--surface))`, color: rate !== null && rate > 0.55 ? '#fff' : 'var(--ink-2)' }}>
                {rate === null ? '' : `${Math.round(rate * 100)}`}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Variation colorée (+12 %) */
export function Delta({ value, suffix = ' %', invert = false, label }) {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="delta">—</span>;
  const good = invert ? value < 0 : value > 0;
  return <span className={`delta ${value === 0 ? '' : good ? 'up' : 'down'}`} title={label}>{value > 0 ? '▲' : value < 0 ? '▼' : '='} {value > 0 ? '+' : ''}{value}{suffix}</span>;
}

/** Jauge circulaire 0–100 */
export function Gauge({ value, size = 64, label }) {
  const r = (size - 8) / 2; const c = 2 * Math.PI * r;
  const col = value >= 70 ? 'var(--green)' : value >= 45 ? 'var(--accent)' : 'var(--red)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label || 'Score'} ${value} sur 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--soft)' }} strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: col }} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" style={{ fill: 'currentColor', fontSize: size / 3.6, fontWeight: 800 }}>{value}</text>
    </svg>
  );
}
