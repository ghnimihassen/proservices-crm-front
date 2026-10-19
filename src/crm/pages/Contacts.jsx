import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from '../nav';
import * as XLSX from 'xlsx';
import { useStore } from '../store/Store';
import { useUI, Avatar, Empty, Modal } from '../components/UI';
import { ContactForm, LostModal } from '../components/Forms';
import Icon from '../components/Icon';
import { STAGES, SOURCES, TYPES, stageById, stageStyle, isEntry, LABELS } from '../store/constants';
import brand from '../brand';
import ProductOptions from '../components/ProductOptions';
import { can } from '../store/permissions';
import { VIEWS, nextAction, lastActivity, userById, courseById, productLabels } from '../store/selectors';
import { fRelative, fDateTime, startOfDay, normPhone, telHref, addDays, fDate } from '../utils';

const PAGE = 25;
const strip = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const FIELD_ALIASES = {
  org: ['organisation', 'organization', 'entreprise', 'societe', 'ecole', 'etablissement', 'company', 'org', 'nom entreprise', 'nom de l’entreprise', 'raison sociale', 'centre'],
  name: ['nom', 'contact', 'interlocuteur', 'nom prenom', 'nom et prenom', 'name', 'responsable', 'prenom nom', 'nom prenom agent'],
  role: ['fonction', 'poste', 'role', 'titre'],
  phone: ['telephone', 'tel', 'mobile', 'gsm', 'phone', 'numero', 'tel mobile', 'portable'],
  email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email'],
  city: ['ville', 'city', 'gouvernorat', 'adresse', 'region'],
  source: ['source', 'canal', 'reseau', 'origine'],
  type: ['type', 'categorie', 'secteur'],
  course: ['produit', 'service', 'offre', 'formation', 'formation souhaitee', 'cours', 'programme', 'specialite', 'article'],
  _note: ['remarque', 'remarques', 'note', 'notes', 'commentaire', 'commentaires', 'observation'],
};
const FIELD_LABELS = { org: LABELS.org, name: LABELS.person, ...(brand.features.catalog ? { course: 'Produit / formation' } : {}), role: 'Fonction', phone: 'Téléphone', email: 'Email', city: 'Ville', source: 'Source', type: 'Type', _note: 'Remarque', '': '— Ignorer —' };
const guessField = (h) => {
  const s = strip(h);
  const entries = Object.entries(FIELD_ALIASES).filter(([k]) => k in FIELD_LABELS);
  for (const [k, list] of entries) if (list.some((a) => strip(a) === s)) return k;
  for (const [k, list] of entries) if (list.some((a) => s.includes(strip(a)))) return k;
  return '';
};

/* ---------- Import Excel / CSV / Google Sheets (export .xlsx/.csv) ---------- */
function ImportModal({ onClose }) {
  const { state, importContacts } = useStore();
  const { toast } = useUI();
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [map, setMap] = useState({});
  const [skipDup, setSkipDup] = useState(true);
  const [ownerId, setOwnerId] = useState(state.settings.currentUserId);
  const [source, setSource] = useState('');
  const [err, setErr] = useState('');

  const onFile = async (file) => {
    setErr('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      if (!data.length) { setErr('Le fichier ne contient aucune ligne.'); return; }
      const hs = Object.keys(data[0]);
      setHeaders(hs);
      setMap(Object.fromEntries(hs.map((h) => [h, guessField(h)])));
      setRows(data);
    } catch {
      setErr('Impossible de lire ce fichier. Formats acceptés : .xlsx, .xls, .csv');
    }
  };

  const parsed = useMemo(() => {
    if (!rows) return [];
    const phones = new Set(state.contacts.map((c) => normPhone(c.phone)).filter((p) => p.length >= 6));
    const orgs = new Set(state.contacts.map((c) => strip(c.org)));
    const seen = new Set();
    return rows.map((r) => {
      const d = {};
      for (const h of headers) {
        const k = map[h];
        if (!k) continue;
        const v = String(r[h] ?? '').trim();
        if (v) d[k] = d[k] ? `${d[k]} ${v}` : v;
      }
      if (!d.org && d.name) d.org = d.name;
      if (d.course) {
        const cn = strip(d.course);
        const course = (state.catalog || []).find((c) => strip(c.name).includes(cn) || cn.includes(strip(c.name)));
        if (course) { d.courseId = course.id; d.value = course.price; }
        d._note = [d._note, `Demande : ${d.course}`].filter(Boolean).join(' · ');
        delete d.course;
      }
      const p = normPhone(d.phone);
      const key = (p.length >= 6 ? p : '') || strip(d.org);
      const dup = (p.length >= 6 && phones.has(p)) || (d.org && orgs.has(strip(d.org))) || (key && seen.has(key));
      if (key) seen.add(key);
      return { d, dup, invalid: !d.org };
    });
  }, [rows, headers, map, state.contacts]);

  const toImport = parsed.filter((r) => !r.invalid && !(skipDup && r.dup));
  const doImport = () => {
    importContacts(toImport.map((r) => ({ ...r.d, ownerId, source: r.d.source || source || 'Import' })));
    toast(`${toImport.length} contact${toImport.length > 1 ? 's' : ''} importé${toImport.length > 1 ? 's' : ''}`);
    onClose();
  };

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      brand.features.catalog
        ? ['Nom complet', 'Téléphone', 'Email', 'Ville', 'Source', 'Type', 'Produit', 'Remarque']
        : ['Organisation', 'Interlocuteur', 'Fonction', 'Téléphone', 'Email', 'Ville', 'Source', 'Type', 'Remarque'],
      brand.features.catalog
        ? ['Prénom Nom', '+216 20 000 000', 'nom@exemple.tn', 'Tunis', 'Facebook', 'Particulier', 'Marketing digital', 'A vu la pub, dispo le soir']
        : ['École Les Pionniers', 'Prénom Nom', 'Directeur', '+216 20 000 000', 'contact@exemple.tn', 'Tunis', 'LinkedIn', 'École privée', 'Vu sur LinkedIn, 300 élèves'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'modele-import-contacts.xlsx');
  };

  return (
    <Modal title="Importer des contacts" subtitle="Excel (.xlsx, .xls), CSV, ou Google Sheets exporté (Fichier › Télécharger)" onClose={onClose} width={860}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={!toImport.length} onClick={doImport}>Importer {toImport.length || ''} contact{toImport.length > 1 ? 's' : ''}</button>
      </>}>
      {!rows ? (
        <div className="stack16">
          <label className="empty" style={{ border: '2px dashed var(--line-2)', borderRadius: 16, cursor: 'pointer' }}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
            <span className="empty-i"><Icon name="upload" size={22} /></span>
            <b>Glissez votre fichier ici ou cliquez pour choisir</b>
            <span className="muted sm">La première ligne doit contenir les titres des colonnes</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="sr" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
          <button className="btn link" onClick={template}><Icon name="download" size={16} />Télécharger le modèle Excel</button>
          {err && <div className="alert err">{err}</div>}
        </div>
      ) : (
        <div className="stack16">
          <div className="alert info">{rows.length} lignes détectées · <b>{toImport.length}</b> à importer · {parsed.filter((r) => r.dup).length} doublons · {parsed.filter((r) => r.invalid).length} sans organisation</div>
          <div>
            <div className="lbl" style={{ marginBottom: 8 }}>Correspondance des colonnes</div>
            <div className="grid2">
              {headers.map((h) => (
                <label key={h} className="field">
                  <span className="field-l ell">Colonne « {h} »</span>
                  <select value={map[h]} onChange={(e) => setMap((m) => ({ ...m, [h]: e.target.value }))}>
                    {Object.entries(FIELD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <div className="grid2">
            <label className="field"><span className="field-l">Attribuer à</span>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            <label className="field"><span className="field-l">Source par défaut</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}><option value="">Import</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <label className="row gap8"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} />Ignorer les doublons (même téléphone ou même organisation)</label>
          <div className="table-wrap card" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table className="t" style={{ minWidth: 640 }}>
              <thead><tr><th>Organisation</th><th>Interlocuteur</th><th>Téléphone</th><th>Email</th><th>Statut</th></tr></thead>
              <tbody>
                {parsed.slice(0, 50).map((r, i) => (
                  <tr key={i} className={r.dup || r.invalid ? 'dup' : ''}>
                    <td>{r.d.org || <span className="muted">—</span>}</td><td>{r.d.name}</td><td>{r.d.phone}</td><td>{r.d.email}</td>
                    <td>{r.invalid ? <span className="pill p-red">Sans organisation</span> : r.dup ? <span className="pill p-orange">Doublon</span> : <span className="pill p-green">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn link" style={{ alignSelf: 'flex-start' }} onClick={() => setRows(null)}>← Choisir un autre fichier</button>
        </div>
      )}
    </Modal>
  );
}

/* ---------- Ligne de saisie rapide ---------- */
function QuickAdd() {
  const { addContact, findDuplicate, state } = useStore();
  const { toast } = useUI();
  const empty = { org: '', name: '', phone: '', email: '', source: '', type: '', courseId: '' };
  const [f, setF] = useState(empty);
  const first = useRef(null);
  const dup = (f.org || f.phone) ? findDuplicate(f) : null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = () => {
    if (!f.org.trim()) { toast(`Saisissez au moins : ${LABELS.org}`, 'err'); first.current?.focus(); return; }
    if (dup) { toast(`Doublon : ${dup.org} existe déjà`, 'err'); return; }
    const course = (state.catalog || []).find((c) => c.id === f.courseId);
    addContact({ ...f, org: f.org.trim(), courseId: f.courseId || null, value: course ? course.price : 0, ownerId: state.settings.currentUserId });
    toast(`${f.org} ajouté`);
    setF(empty);
    first.current?.focus();
  };
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
  return (
    <tr className={`quick${dup ? ' dup' : ''}`} onKeyDown={onKey}>
      <td><Icon name="plus" style={{ color: 'var(--primary)' }} /></td>
      <td><input ref={first} aria-label={LABELS.org} placeholder={`Saisie rapide : ${LABELS.org.toLowerCase()} *`} value={f.org} onChange={set('org')} /></td>
      <td>{brand.features.catalog
        ? <select aria-label={productLabels(state).one} value={f.courseId} onChange={set('courseId')}><option value="">{productLabels(state).one}…</option><ProductOptions state={state} withPrice={false} /></select>
        : <input aria-label={LABELS.person} placeholder={LABELS.person} value={f.name} onChange={set('name')} />}</td>
      <td><input aria-label="Téléphone" placeholder="Téléphone" value={f.phone} onChange={set('phone')} /></td>
      <td><select aria-label="Source" value={f.source} onChange={set('source')}><option value="">Source…</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></td>
      <td><input aria-label="Email" placeholder="Email" value={f.email} onChange={set('email')} /></td>
      <td colSpan={2}>
        {dup ? <span className="sm" style={{ color: 'var(--orange-ink)' }}>Doublon : <Link to={`/contacts/${dup.id}`}>{dup.org}</Link></span>
          : <span className="muted xs">Entrée ↵ pour ajouter · Tab pour changer de champ</span>}
      </td>
      <td><button className="btn small primary" onClick={submit}>Ajouter</button></td>
    </tr>
  );
}

export default function Contacts() {
  const { state, updateContact, bulkUpdate, deleteContacts, startSession } = useStore();
  const ok = (k) => can(state, k);
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'all';
  const [q, setQ] = useState(params.get('q') || '');
  const [flt, setFlt] = useState({ stage: params.get('stage') || '', course: params.get('course') || '', source: '', type: '', city: '', owner: '', stale: false });
  const [sort, setSort] = useState({ key: 'createdAt', dir: -1 });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState([]);
  const [edit, setEdit] = useState(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lostIds, setLostIds] = useState(null);
  const [tagModal, setTagModal] = useState(false);
  const [tag, setTag] = useState('');

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  useEffect(() => { setPage(0); }, [q, view, flt]);

  const cities = useMemo(() => [...new Set(state.contacts.map((c) => c.city).filter(Boolean))].sort(), [state.contacts]);

  const rows = useMemo(() => {
    const v = VIEWS.find((x) => x.id === view) || VIEWS[0];
    const s = strip(q);
    const sp = normPhone(q);
    let list = state.contacts.filter((c) => v.test(c, state));
    if (s) list = list.filter((c) => strip(`${c.org} ${c.name} ${c.email} ${c.city} ${(c.tags || []).join(' ')}`).includes(s) || (sp.length >= 3 && normPhone(c.phone).includes(sp)));
    if (flt.stage) list = list.filter((c) => c.stage === flt.stage);
    if (flt.course) list = list.filter((c) => c.courseId === flt.course);
    if (flt.source) list = list.filter((c) => c.source === flt.source);
    if (flt.type) list = list.filter((c) => c.type === flt.type);
    if (flt.city) list = list.filter((c) => c.city === flt.city);
    if (flt.owner) list = list.filter((c) => c.ownerId === flt.owner);
    if (flt.stale) list = list.filter((c) => !c.lastContactAt || new Date(c.lastContactAt) < addDays(new Date(), -7));
    const withMeta = list.map((c) => ({ c, next: nextAction(state, c.id), last: lastActivity(state, c.id) }));
    const val = (r) => {
      switch (sort.key) {
        case 'org': return strip(r.c.org);
        case 'stage': return STAGES.findIndex((x) => x.id === r.c.stage);
        case 'last': return r.c.lastContactAt ? new Date(r.c.lastContactAt).getTime() : 0;
        case 'next': return r.next ? new Date(r.next.at).getTime() : 9e15;
        case 'source': return strip(r.c.source);
        case 'owner': return strip(userById(state, r.c.ownerId)?.name);
        default: return new Date(r.c.createdAt).getTime();
      }
    };
    return withMeta.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [state, view, q, flt, sort]);

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => sel.includes(r.c.id));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSel((s) => (allOnPage ? s.filter((id) => !pageRows.some((r) => r.c.id === id)) : [...new Set([...s, ...pageRows.map((r) => r.c.id)])]));
  const setView = (id) => { const p = new URLSearchParams(params); if (id === 'all') p.delete('view'); else p.set('view', id); setParams(p); };
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const SortTh = ({ k, children }) => (
    <th aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => sortBy(k)}>{children}{sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button>
    </th>
  );
  const activeFilters = Object.values(flt).filter(Boolean).length;

  const exportFile = (fmt) => {
    const list = (sel.length ? rows.filter((r) => sel.includes(r.c.id)) : rows).map(({ c, next }) => ({
      [LABELS.org]: c.org, ...(brand.features.catalog ? { [productLabels(state).one]: courseById(state, c.courseId)?.name || '' } : {}), [LABELS.person]: c.name, Fonction: c.role, Téléphone: c.phone, Email: c.email, Ville: c.city,
      Type: c.type, Source: c.source, Étape: stageById(c.stage).label, Responsable: userById(state, c.ownerId)?.name || '',
      'Valeur (DT)': c.value || 0, 'Dernier contact': c.lastContactAt ? fDate(c.lastContactAt) : '',
      'Prochaine action': next ? `${next.label} — ${fDateTime(next.at)}` : '', Tags: (c.tags || []).join(', '), 'Motif perte': c.lostReason || '',
    }));
    const ws = XLSX.utils.json_to_sheet(list);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, `${LABELS.contacts.toLowerCase()}-${brand.id}.${fmt}`, fmt === 'csv' ? { bookType: 'csv' } : undefined);
    toast(`${list.length} contacts exportés`);
  };

  const removeOne = async (c) => {
    if (await confirm({ title: 'Supprimer le contact', message: `Supprimer « ${c.org} » et tout son historique ? Cette action est définitive.`, ok: 'Supprimer', danger: true })) {
      deleteContacts([c.id]); setSel((s) => s.filter((x) => x !== c.id)); toast('Contact supprimé');
    }
  };
  const removeSel = async () => {
    if (await confirm({ title: 'Supprimer les contacts', message: `Supprimer ${sel.length} contact(s) et leur historique ? Cette action est définitive.`, ok: 'Supprimer', danger: true })) {
      deleteContacts(sel); toast(`${sel.length} contacts supprimés`); setSel([]);
    }
  };
  const launch = () => {
    const ids = rows.filter((r) => sel.includes(r.c.id)).map((r) => r.c.id);
    startSession(ids, `Sélection (${ids.length})`);
    navigate('/appels');
  };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{LABELS.contactsTitle} {ok('reports.company') && <span className="muted" style={{ fontSize: 18, fontWeight: 500 }}>{state.contacts.length}</span>}</h1>
          <p>{LABELS.contactsSubtitle}</p>
        </div>
        <div className="row gap8 wrap">
          {ok('contacts.import') && <button className="btn ghost" onClick={() => setImporting(true)}><Icon name="upload" />Importer Excel / Sheets</button>}
          {ok('contacts.export') && <button className="btn ghost" onClick={() => exportFile('xlsx')}><Icon name="download" />Exporter{sel.length ? ` (${sel.length})` : ''}</button>}
          {ok('contacts.create') && <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" stroke={2} />{LABELS.newContact}</button>}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Vues enregistrées">
        {VIEWS.map((v) => {
          const n = state.contacts.filter((c) => v.test(c, state)).length;
          return (
            <button key={v.id} role="tab" aria-selected={view === v.id} className={`tab${view === v.id ? ' on' : ''}`} onClick={() => setView(v.id)}>
              {v.label} {v.tone && view !== v.id && n > 0 ? <span className={`pill ${v.tone === 'red' ? 'p-red' : 'p-orange'}`} style={{ padding: '0 8px' }}>{n}</span> : <span className="n">{n}</span>}
            </button>
          );
        })}
      </div>

      <section className="card" style={{ overflow: 'visible' }} aria-label="Liste des contacts">
        <div className="row wrap gap8" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <label className="cmdk-trigger" style={{ flex: '1 1 220px', maxWidth: 320, height: 40, cursor: 'text' }}>
            <Icon name="search" size={16} /><span className="sr">Rechercher</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, ville, tag…" style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, color: 'var(--ink)' }} />
          </label>
          <label className={`chip${flt.stage ? ' on' : ''}`}><span className="sr">Étape</span>
            <select value={flt.stage} onChange={(e) => setFlt((f) => ({ ...f, stage: e.target.value }))}><option value="">Étape</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          {brand.features.catalog && <label className={`chip${flt.course ? ' on' : ''}`}><span className="sr">{productLabels(state).one}</span>
            <select value={flt.course} onChange={(e) => setFlt((f) => ({ ...f, course: e.target.value }))}><option value="">{productLabels(state).one}</option><ProductOptions state={state} withPrice={false} /></select></label>}
          <label className={`chip${flt.source ? ' on' : ''}`}><span className="sr">Source</span>
            <select value={flt.source} onChange={(e) => setFlt((f) => ({ ...f, source: e.target.value }))}><option value="">Source</option>{[...SOURCES, 'Import'].map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className={`chip${flt.type ? ' on' : ''}`}><span className="sr">Type</span>
            <select value={flt.type} onChange={(e) => setFlt((f) => ({ ...f, type: e.target.value }))}><option value="">Type</option>{TYPES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className={`chip${flt.city ? ' on' : ''}`}><span className="sr">Ville</span>
            <select value={flt.city} onChange={(e) => setFlt((f) => ({ ...f, city: e.target.value }))}><option value="">Ville</option>{cities.map((s) => <option key={s}>{s}</option>)}</select></label>
          {ok('data.all') && <label className={`chip${flt.owner ? ' on' : ''}`}><span className="sr">Commercial</span>
            <select value={flt.owner} onChange={(e) => setFlt((f) => ({ ...f, owner: e.target.value }))}><option value="">Commercial</option>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
          <label className={`chip${flt.stale ? ' on' : ''}`} style={{ paddingRight: 12 }}><input type="checkbox" checked={flt.stale} onChange={(e) => setFlt((f) => ({ ...f, stale: e.target.checked }))} />Sans échange &gt; 7 j</label>
          {activeFilters > 0 && <button className="btn small link" onClick={() => setFlt({ stage: '', course: '', source: '', type: '', city: '', owner: '', stale: false })}>Effacer les filtres</button>}
          <span className="muted sm" style={{ marginLeft: 'auto' }}>{rows.length} résultat{rows.length > 1 ? 's' : ''}</span>
        </div>

        {sel.length > 0 && (
          <div className="bulk">
            <b>{sel.length} sélectionné{sel.length > 1 ? 's' : ''}</b>
            <button className="btn small orange" style={{ borderColor: 'transparent' }} onClick={launch}><Icon name="phone" size={16} />Lancer une session d'appels</button>
            {ok('contacts.assign') && <label><span className="sr">Assigner à</span>
              <select value="" onChange={(e) => { if (e.target.value) { bulkUpdate(sel, { ownerId: e.target.value }); toast('Contacts réassignés'); } }}>
                <option value="">Assigner à…</option>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></label>}
            {ok('contacts.edit') && <label><span className="sr">Changer d'étape</span>
              <select value="" onChange={(e) => { const v = e.target.value; if (!v) return; if (v === 'lost') setLostIds(sel); else { bulkUpdate(sel, { stage: v }); toast('Étape mise à jour'); } }}>
                <option value="">Changer d'étape…</option>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select></label>}
            {ok('contacts.edit') && <button className="btn small" onClick={() => setTagModal(true)}><Icon name="tag" size={16} />Ajouter un tag</button>}
            {ok('contacts.export') && <button className="btn small" onClick={() => exportFile('xlsx')}>Exporter</button>}
            {ok('contacts.delete') && <button className="btn small" onClick={removeSel}><Icon name="trash" size={16} />Supprimer</button>}
            <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setSel([])}>Désélectionner</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 44 }}><input type="checkbox" aria-label="Tout sélectionner sur la page" checked={allOnPage} onChange={toggleAll} /></th>
                <SortTh k="org">{LABELS.org}</SortTh>
                <th>{brand.features.catalog ? productLabels(state).one : LABELS.person}</th>
                <th>Téléphone</th>
                <SortTh k="source">Source</SortTh>
                <SortTh k="stage">Étape</SortTh>
                <SortTh k="last">Dernier échange</SortTh>
                <SortTh k="next">Prochaine action</SortTh>
                <SortTh k="owner">Resp.</SortTh>
              </tr>
            </thead>
            <tbody>
              {ok('contacts.create') && <QuickAdd />}
              {pageRows.map(({ c, next, last }) => {
                const owner = userById(state, c.ownerId);
                const late = next && new Date(next.at) < startOfDay();
                return (
                  <tr key={c.id} className={sel.includes(c.id) ? 'sel' : ''}>
                    <td><input type="checkbox" aria-label={`Sélectionner ${c.org}`} checked={sel.includes(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td>
                      <Link to={`/contacts/${c.id}`} className="cell-org">
                        <Avatar name={c.org} />
                        <span style={{ minWidth: 0 }}><b>{c.org}</b><br /><span className="muted sm">{[c.type, c.city].filter(Boolean).join(' · ') || '—'}</span></span>
                      </Link>
                    </td>
                    <td>{brand.features.catalog
                      ? (courseById(state, c.courseId) ? <span className="sm b">{courseById(state, c.courseId).name}</span> : <span className="muted sm">À définir</span>)
                      : <><span className="sm">{c.name || '—'}</span><br /><span className="muted xs">{c.role}</span></>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {c.phone ? <a href={telHref(c.phone)} className="row gap4" style={{ color: 'var(--ink)' }}><Icon name="phone" size={14} />{c.phone}</a> : <span className="muted">—</span>}
                      {c.noAnswerCount > 0 && <span className="muted xs">{c.noAnswerCount}× sans réponse</span>}
                    </td>
                    <td className="muted">{c.source || '—'}</td>
                    <td>
                      <label className="sr" htmlFor={`st-${c.id}`}>Étape de {c.org}</label>
                      <select id={`st-${c.id}`} className="stage-sel" style={stageStyle(c.stage)} value={c.stage} disabled={!ok('contacts.edit')}
                        onChange={(e) => { if (e.target.value === 'lost') setLostIds([c.id]); else { updateContact(c.id, { stage: e.target.value }); toast(`${c.org} → ${stageById(e.target.value).label}`); } }}>
                        {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className="sm">{c.lastContactAt ? fRelative(c.lastContactAt) : <span className="muted">Jamais contacté</span>}</span>
                      {last?.text && <><br /><span className="muted xs ell" style={{ display: 'inline-block', maxWidth: 220 }}>« {last.text} »</span></>}
                    </td>
                    <td>
                      {next ? <span className="sm b" style={{ color: late ? 'var(--red-ink)' : undefined }}>{next.label}<br /><span className="xs" style={{ fontWeight: 500 }}>{late ? 'En retard · ' : ''}{fDateTime(next.at)}</span></span>
                        : isEntry(c.stage) ? <span className="sm b" style={{ color: 'var(--accent-ink)' }}>1er appel</span> : <span className="muted sm">—</span>}
                    </td>
                    <td>
                      <div className="row gap4">
                        <Avatar name={owner?.name || '?'} size={28} round title={owner?.name} />
                        {ok('contacts.edit') && <button className="icon-btn sm plain" aria-label={`Modifier ${c.org}`} onClick={() => setEdit(c)}><Icon name="edit" size={16} /></button>}
                        {ok('contacts.delete') && <button className="icon-btn sm plain" aria-label={`Supprimer ${c.org}`} onClick={() => removeOne(c)}><Icon name="trash" size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty icon="users" title="Aucun résultat" text="Modifiez la recherche ou les filtres, ou ajoutez un contact avec la ligne de saisie rapide." />}
        <div className="pager muted sm">
          <span>{rows.length ? `${page * PAGE + 1}–${Math.min(rows.length, (page + 1) * PAGE)} sur ${rows.length}` : '0 contact'}</span>
          <div className="row gap8">
            <button className="icon-btn sm" aria-label="Page précédente" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><Icon name="left" size={16} /></button>
            <span>Page {page + 1} / {pages}</span>
            <button className="icon-btn sm" aria-label="Page suivante" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><Icon name="right" size={16} /></button>
          </div>
        </div>
      </section>

      {creating && <ContactForm onClose={() => setCreating(false)} />}
      {edit && <ContactForm contact={edit} onClose={() => setEdit(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {lostIds && <LostModal ids={lostIds} onClose={() => setLostIds(null)} onDone={() => setSel([])} />}
      {tagModal && (
        <Modal title="Ajouter un tag" subtitle={`${sel.length} contact(s)`} onClose={() => setTagModal(false)} width={420}
          footer={<><button className="btn ghost" onClick={() => setTagModal(false)}>Annuler</button>
            <button className="btn primary" onClick={() => {
              const t = tag.trim().replace(/^#/, '');
              if (!t) return;
              bulkUpdate(sel, (c) => ({ tags: [...new Set([...(c.tags || []), t])] }));
              toast(`Tag #${t} ajouté`); setTag(''); setTagModal(false);
            }}>Ajouter</button></>}>
          <label className="field"><span className="field-l">Tag</span><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="ex. salon-2026" /></label>
        </Modal>
      )}
    </>
  );
}
