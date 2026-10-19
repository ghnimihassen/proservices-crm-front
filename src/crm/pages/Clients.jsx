import { useMemo, useState } from 'react';
import { Link, useSearchParams } from '../nav';
import * as XLSX from 'xlsx';
import { useStore } from '../store/Store';
import { Avatar, Empty } from '../components/UI';
import Icon from '../components/Icon';
import { PaymentModal } from './ContactDetail';
import { userById, courseById, productLabels, paymentSummary } from '../store/selectors';
import { LABELS, PAYMENT_STATUS, methodLabel } from '../store/constants';
import { installmentState } from '../components/Payments';
import { useUI } from '../components/UI';
import brand from '../brand';
import ProductOptions from '../components/ProductOptions';
import { fDate, fMoney, telHref } from '../utils';

export default function Clients() {
  const { state, toggleInstallment, can } = useStore();
  const { toast } = useUI();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [course, setCourse] = useState('');
  const [pay, setPay] = useState('');
  const [paying, setPaying] = useState(null);
  const catalog = brand.features.catalog;
  const P = productLabels(state);
  const tab = catalog && params.get('tab') === 'dues' ? 'dues' : 'list';
  const setTab = (t) => setParams(t === 'dues' ? { tab: 'dues' } : {});
  const [dueFilter, setDueFilter] = useState('soon');
  const dues = useMemo(() => state.contacts.flatMap((c) => (c.schedule || []).filter((i) => i.status !== 'paid').map((i) => ({ i, c })))
    .filter(({ i }) => dueFilter === 'all' || (dueFilter === 'late' ? new Date(i.due) < new Date(new Date().setHours(0, 0, 0, 0)) : new Date(i.due) < new Date(Date.now() + 30 * 864e5)))
    .sort((a, b) => new Date(a.i.due) - new Date(b.i.due)), [state.contacts, dueFilter]);

  const clients = useMemo(() => state.contacts.filter((c) => c.stage === 'won'
    && `${c.org} ${c.name} ${c.city}`.toLowerCase().includes(q.toLowerCase())
    && (!course || c.courseId === course)
    && (!pay || (c.payment?.status || 'none') === pay))
    .sort((a, b) => new Date(b.wonAt || 0) - new Date(a.wonAt || 0)), [state.contacts, q, course, pay]);
  const total = clients.reduce((s, c) => s + (c.value || 0), 0);
  const cashed = clients.reduce((s, c) => s + (c.payment?.paid || 0), 0);

  const exportX = () => {
    const ws = XLSX.utils.json_to_sheet(clients.map((c) => ({
      [LABELS.org]: c.org, Téléphone: c.phone, Email: c.email, Ville: c.city, Type: c.type,
      ...(catalog ? { [P.one]: courseById(state, c.courseId)?.name || '', 'Payé (DT)': c.payment?.paid || 0, Statut: PAYMENT_STATUS[c.payment?.status || 'none'].label } : { Interlocuteur: c.name }),
      'Montant (DT)': c.value || 0, 'Le': fDate(c.wonAt), Responsable: userById(state, c.ownerId)?.name, Source: c.source,
    })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, LABELS.clients); XLSX.writeFile(wb, `${LABELS.clients.toLowerCase()}-${brand.id}.xlsx`);
  };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{LABELS.clients} {can('reports.company') && <span className="muted" style={{ fontSize: 18, fontWeight: 600 }}>{clients.length}</span>}</h1>
          <p>{catalog ? 'Apprenants et entreprises inscrits, avec le suivi des paiements.' : 'Établissements convaincus et signés.'}</p>
        </div>
        {can('contacts.export') && <button className="btn ghost" onClick={exportX}><Icon name="download" />Exporter</button>}
      </div>
      {can('finance.view') && <div className="kpis">
        <div className="card kpi dark"><div className="lbl">{LABELS.revenue}</div><div className="v">{fMoney(total)}</div></div>
        {catalog ? (
          <>
            <div className="card kpi"><span className="kico i-green"><Icon name="wallet" size={18} /></span><div className="lbl">Encaissé</div><div className="v">{fMoney(cashed)}</div><div className="bar"><span style={{ width: `${total ? (cashed / total) * 100 : 0}%`, background: 'var(--green)' }} /></div></div>
            <div className="card kpi"><span className="kico i-orange"><Icon name="clock" size={18} /></span><div className="lbl">Reste à encaisser</div><div className="v">{fMoney(total - cashed)}</div><div className="muted sm">{clients.filter((c) => c.payment?.status !== 'paid').length} dossiers</div></div>
          </>
        ) : (
          <>
            <div className="card kpi"><div className="lbl">Panier moyen</div><div className="v">{fMoney(clients.length ? total / clients.length : 0)}</div></div>
            <div className="card kpi"><div className="lbl">{LABELS.clients}</div><div className="v">{clients.length}</div></div>
          </>
        )}
      </div>}
      {catalog && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'list'} className={`tab${tab === 'list' ? ' on' : ''}`} onClick={() => setTab('list')}>{LABELS.clients}</button>
          <button role="tab" aria-selected={tab === 'dues'} className={`tab${tab === 'dues' ? ' on' : ''}`} onClick={() => setTab('dues')}>Échéancier global
            {state.contacts.some((c) => paymentSummary(c).overdue.length) && <span className="pill p-red" style={{ padding: '0 8px' }}>{state.contacts.reduce((n, c) => n + paymentSummary(c).overdue.length, 0)}</span>}</button>
        </div>
      )}
      {tab === 'dues' && (
        <section className="card" style={{ overflow: 'hidden' }} aria-label="Échéancier global">
          <div className="row wrap gap8" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div className="seg">
              {[['late', 'En retard'], ['soon', '30 prochains jours'], ['all', 'Toutes']].map(([k, l]) => <button key={k} className={dueFilter === k ? 'on' : ''} aria-pressed={dueFilter === k} onClick={() => setDueFilter(k)}>{l}</button>)}
            </div>
            <span className="muted sm" style={{ marginLeft: 'auto' }}>{dues.length} échéance{dues.length > 1 ? 's' : ''}{can('finance.view') ? ` · ${fMoney(dues.reduce((x, d) => x + Number(d.i.amount || 0), 0))}` : ''}</span>
          </div>
          {dues.length === 0 ? <Empty icon="wallet" title="Aucune échéance" text="Rien à encaisser sur cette période." /> : (
            <div className="table-wrap">
              <table className="t" style={{ minWidth: 760 }}>
                <thead><tr><th>Date</th><th>{LABELS.org}</th><th>Mode</th><th>Référence</th><th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th><th /></tr></thead>
                <tbody>{dues.map(({ i, c }) => {
                  const st = installmentState(i);
                  return (
                    <tr key={i.id}>
                      <td><b>{fDate(i.due)}</b></td>
                      <td><Link to={`/contacts/${c.id}`} className="cell-org" style={{ minWidth: 180 }}><Avatar name={c.org} size={30} /><span><b>{c.org}</b><br /><span className="muted xs">{c.phone}</span></span></Link></td>
                      <td>{methodLabel(i.method)}{i.bank && <><br /><span className="muted xs">{i.bank}</span></>}</td>
                      <td>{i.ref || <span className="muted">—</span>}</td>
                      <td style={{ textAlign: 'right' }}><b>{fMoney(i.amount)}</b></td>
                      <td><span className={`pill ${st.cls}`}>{st.label}</span></td>
                      <td>{can('payments.collect') && <button className="btn small success" onClick={() => { toggleInstallment(c.id, i.id); toast('Échéance encaissée'); }}>Encaisser</button>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === 'list' && <section className="card" style={{ overflow: 'hidden' }}>
        <div className="row wrap gap8" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
          <label className="cmdk-trigger" style={{ flex: '1 1 220px', maxWidth: 320, height: 40, cursor: 'text' }}><Icon name="search" size={16} /><span className="sr">Rechercher</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, color: 'var(--ink)' }} /></label>
          {catalog && (
            <>
              <label className={`chip${course ? ' on' : ''}`}><span className="sr">{P.one}</span>
                <select value={course} onChange={(e) => setCourse(e.target.value)}><option value="">{P.many} : tous</option><ProductOptions state={state} withPrice={false} /></select></label>
              <label className={`chip${pay ? ' on' : ''}`}><span className="sr">Paiement</span>
                <select value={pay} onChange={(e) => setPay(e.target.value)}><option value="">Tous paiements</option>{Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            </>
          )}
        </div>
        {clients.length === 0 ? <Empty icon={catalog ? 'cap' : 'star'} title={`Aucun ${LABELS.client}`} text={catalog ? 'Inscrivez un prospect depuis sa fiche ou le pipeline.' : 'Convertissez un prospect depuis sa fiche ou le pipeline.'} /> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr>
                <th>{LABELS.org}</th>{catalog ? <th>{P.one}</th> : <th>Interlocuteur</th>}<th>Téléphone</th><th>Montant</th>
                {catalog && <th>Paiement</th>}<th>{catalog ? 'Inscrit le' : 'Signé le'}</th><th>Responsable</th>{catalog && <th />}
              </tr></thead>
              <tbody>
                {clients.map((c) => {
                  const co = courseById(state, c.courseId);
                  const st = PAYMENT_STATUS[c.payment?.status || 'none'];
                  return (
                    <tr key={c.id}>
                      <td><Link to={`/contacts/${c.id}`} className="cell-org"><Avatar name={c.org} /><span><b>{c.org}</b><br /><span className="muted sm">{[c.type, c.city].filter(Boolean).join(' · ')}</span></span></Link></td>
                      {catalog ? <td>{co ? <><b className="sm">{co.name}</b><br /><span className="muted xs">{co.duration}</span></> : <span className="muted">—</span>}</td>
                        : <td>{c.name}<br /><span className="muted xs">{c.role}</span></td>}
                      <td>{c.phone ? <a href={telHref(c.phone)}>{c.phone}</a> : '—'}</td>
                      <td><b style={{ color: 'var(--green-ink)' }}>{fMoney(c.value)}</b></td>
                      {catalog && <td><span className={`pill ${paymentSummary(c).overdue.length ? 'p-red' : st.cls}`}>{paymentSummary(c).overdue.length ? 'En retard' : st.label}</span><br /><span className="muted xs">{fMoney(c.payment?.paid || 0)} payé{paymentSummary(c).next ? ` · proch. ${fDate(paymentSummary(c).next.due)}` : ''}</span></td>}
                      <td>{fDate(c.wonAt)}</td>
                      <td>{userById(state, c.ownerId)?.name}</td>
                      {catalog && <td>{c.payment?.status !== 'paid' && can('payments.collect') && <button className="btn small soft" onClick={() => setPaying(c)}><Icon name="wallet" size={16} />Encaisser</button>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>}
      {paying && <PaymentModal contact={state.contacts.find((x) => x.id === paying.id)} onClose={() => setPaying(null)} />}
    </>
  );
}
