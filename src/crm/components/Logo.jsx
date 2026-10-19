import brand from '../brand';

// Marques : remplacez ces SVG par vos logos officiels si besoin (src/components/Logo.jsx)
export default function Logo({ size = 36 }) {
  if (brand.logo === 'proservices') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill="var(--side-act)" />
        <path d="M13 30V10h8.5a6.5 6.5 0 0 1 0 13H13" fill="none" stroke="var(--side)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="29" cy="29" r="3.5" fill="var(--accent)" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="var(--side-2)" />
      <path d="M8 12l9 16 4-7" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 21l5 7 8-16" fill="none" stroke="var(--side-act)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
