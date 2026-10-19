import { useRef, useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Field } from '../components/UI';
import Icon from '../components/Icon';

/** Réduit l'image du logo (max 480 px) pour la garder légère dans les données */
function resizeImage(file, max = 480) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      if (file.type === 'image/svg+xml') { resolve(r.result); return; }
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/png'));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

export default function Company() {
  const { state, updateCompany, can } = useStore();
  const M = can('company.manage');
  const { toast } = useUI();
  const c = state.company || {};
  const [f, setF] = useState(() => ({ name: '', address: '', phone: '', email: '', website: '', taxId: '', footer: '', ...c }));
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const dirty = ['name', 'address', 'phone', 'email', 'website', 'taxId', 'footer'].some((k) => (f[k] || '') !== (c[k] || ''));

  const onLogo = async (file) => {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|svg\+xml|gif)$/.test(file.type)) { setErr('Format accepté : PNG, JPG, WEBP, SVG.'); return; }
    if (file.size > 5 * 1024 * 1024) { setErr('Image trop lourde (5 Mo maximum).'); return; }
    try { const data = await resizeImage(file); updateCompany({ logo: data }); toast('Logo enregistré'); } catch { setErr('Impossible de lire cette image.'); }
  };
  const save = (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('Le nom de l’entreprise est obligatoire.'); return; }
    updateCompany({ ...f, name: f.name.trim(), logo: c.logo });
    toast('Profil de l’entreprise enregistré');
  };

  return (
    <>
      <div className="page-h">
        <div><h1>Mon entreprise</h1><p>Le nom, le logo et les coordonnées de l'entreprise qui utilise ce CRM. Ils apparaissent dans le menu et en en-tête de chaque fiche imprimée ou PDF.</p></div>
      </div>
      <div className="flexwrap">
        <section className="card pad24 grow1 stack16" aria-label="Logo" style={{ maxWidth: 420 }}>
          <h2>Logo</h2>
          <div className="logo-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (M) onLogo(e.dataTransfer.files[0]); }}>
            {c.logo ? <img src={c.logo} alt={`Logo ${c.name || ''}`} /> : <span className="muted sm">Aucun logo — glissez une image ici</span>}
          </div>
          {M && <div className="row gap8 wrap">
            <button className="btn primary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={16} />{c.logo ? 'Changer le logo' : 'Importer un logo'}</button>
            {c.logo && <button className="btn ghost" onClick={() => { updateCompany({ logo: '' }); toast('Logo retiré'); }}>Retirer</button>}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" className="sr" onChange={(e) => { onLogo(e.target.files[0]); e.target.value = ''; }} />
          </div>}
          <div className="muted xs">PNG avec fond transparent conseillé. L'image est réduite automatiquement.</div>
        </section>

        <form className="card pad24 grow2 stack16" onSubmit={save} aria-label="Coordonnées">
          <h2>Coordonnées</h2>
          {!M && <div className="alert">Lecture seule : votre rôle ne permet pas de modifier le profil de l’entreprise.</div>}
          <fieldset disabled={!M} className="grid2" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <Field label="Nom de l'entreprise *" full><input value={f.name} onChange={set('name')} placeholder="Ex. Proservices" /></Field>
            <Field label="Adresse" full><input value={f.address} onChange={set('address')} placeholder="Rue, ville, code postal" /></Field>
            <Field label="Téléphone"><input value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>
            <Field label="Site web"><input value={f.website} onChange={set('website')} /></Field>
            <Field label="Matricule fiscale"><input value={f.taxId} onChange={set('taxId')} /></Field>
            <Field label="Pied de page de la fiche" full hint="Ex. RIB, numéro d'agrément, mentions légales"><textarea rows={2} value={f.footer} onChange={set('footer')} /></Field>
          </fieldset>
          {err && <div className="alert err">{err}</div>}
          {M && <div className="row end gap8"><button type="submit" className="btn primary" disabled={!dirty}>Enregistrer</button></div>}
        </form>
      </div>

      <section className="card pad24 stack12" aria-label="Aperçu de l'en-tête">
        <div className="lbl">Aperçu de l'en-tête de la fiche</div>
        <div className="sheet" style={{ boxShadow: 'none', border: '1px solid var(--line)', padding: 24, maxWidth: 'none' }}>
          <CompanyHeader company={{ ...c, ...f, logo: c.logo }} title="Fiche prospect" />
        </div>
      </section>
    </>
  );
}

/** En-tête réutilisé sur la fiche imprimée */
export function CompanyHeader({ company: c, title, sub }) {
  return (
    <header className="sheet-h">
      <div className="row gap12" style={{ alignItems: 'center' }}>
        {c.logo && <img src={c.logo} alt="" className="sheet-logo" />}
        <div>
          <div className="sheet-brand">{c.name || 'Votre entreprise'}</div>
          <div className="sheet-muted">{[c.address, c.phone, c.email, c.website].filter(Boolean).join(' · ')}</div>
          {c.taxId && <div className="sheet-muted">Matricule fiscale : {c.taxId}</div>}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="sheet-title">{title}</div>
        {sub && <div className="sheet-muted">{sub}</div>}
      </div>
    </header>
  );
}
