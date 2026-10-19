import { Fragment, useEffect, useState } from 'react';
import { CompanyHeader } from '../pages/Company';
import { createPortal } from 'react-dom';
import { useStore } from '../store/Store';
import Icon from './Icon';
import brand, { getCrmRoot } from '../brand';
import { LABELS, QUALIFICATION, ACTIVITY_TYPES, PAYMENT_STATUS, methodLabel, outcomeLabel, stageById } from '../store/constants';
import { courseById, paymentSummary, productLabels, userById, clausesFor, fillClause } from '../store/selectors';
import { installmentState } from './Payments';
import { fDate, fDateTime, fMoney, fTime } from '../utils';

/**
 * Fiche imprimable : coordonnées, produit, qualification, échéancier, RDV, historique.
 * Le bouton « Imprimer » ouvre la boîte d'impression du navigateur (choisir « Enregistrer en PDF » pour un PDF).
 */
export default function PrintSheet({ contact: c, onClose }) {
  const { state } = useStore();
  const P = productLabels(state);
  const co = state.company || { name: brand.name };
  const clauses = clausesFor(state, c);
  const [withClauses, setWithClauses] = useState(true);
  const product = courseById(state, c.courseId);
  const sum = paymentSummary(c);
  const items = [...(c.schedule || [])].sort((a, b) => new Date(a.due) - new Date(b.due));
  const rdvs = state.appointments.filter((a) => a.contactId === c.id && a.status !== 'cancelled').sort((a, b) => new Date(a.start) - new Date(b.start));
  const acts = state.activities.filter((a) => a.contactId === c.id && a.type !== 'stage').sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
  const owner = userById(state, c.ownerId);
  const q = c.qualification || {};
  const qRows = QUALIFICATION.filter((x) => q[x.key]);
  const nextSession = product ? (product.sessions || []).filter((s) => new Date(s.start) >= new Date()).sort((a, b) => new Date(a.start) - new Date(b.start))[0] : null;

  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.classList.add('pcrm-printing');
    return () => { window.removeEventListener('keydown', h); document.body.classList.remove('pcrm-printing'); };
  }, [onClose]);

  const print = () => { try { window.print(); } catch { /* impression indisponible */ } };

  return createPortal(
    <div className="print-root" role="dialog" aria-modal="true" aria-label="Aperçu avant impression">
      <div className="print-toolbar">
        <b>Aperçu avant impression</b>
        <span className="muted sm" style={{ flex: 1 }}>Pour un PDF, choisissez « Enregistrer en PDF » dans la fenêtre d'impression.</span>
        {clauses.length > 0 && <label className="chip"><input type="checkbox" checked={withClauses} onChange={(e) => setWithClauses(e.target.checked)} />Conditions générales ({clauses.length})</label>}
        <button className="btn ghost" onClick={onClose}>Fermer</button>
        <button className="btn primary" onClick={print} autoFocus><Icon name="file" size={16} />Imprimer</button>
      </div>
      <article className="sheet">
        <CompanyHeader company={co} title={`Fiche ${LABELS.contact}`} sub={`Éditée le ${fDate(new Date())} à ${fTime(new Date())}`} />

        <section className="sheet-sec">
          <h3>{c.org}</h3>
          <dl className="sheet-kv">
            {c.name && <><dt>{LABELS.person}</dt><dd>{c.name}{c.role ? ` — ${c.role}` : ''}</dd></>}
            <dt>Téléphone</dt><dd>{c.phone || '—'}</dd>
            <dt>Email</dt><dd>{c.email || '—'}</dd>
            <dt>Ville</dt><dd>{c.city || '—'}</dd>
            <dt>Type</dt><dd>{c.type || '—'}</dd>
            <dt>Source</dt><dd>{c.source || '—'}</dd>
            <dt>Étape</dt><dd>{stageById(c.stage).label}{c.lostReason ? ` (motif : ${c.lostReason})` : ''}</dd>
            <dt>Responsable</dt><dd>{owner?.name || '—'}</dd>
            <dt>Ajouté le</dt><dd>{fDate(c.createdAt)}</dd>
          </dl>
        </section>

        {(product || c.value > 0) && (
          <section className="sheet-sec">
            <h4>{P.one}</h4>
            <dl className="sheet-kv">
              <dt>{P.one}</dt><dd>{product?.name || '—'}</dd>
              {product?.duration && <><dt>Détail</dt><dd>{product.duration}</dd></>}
              {nextSession && <><dt>Prochaine session</dt><dd>{fDate(nextSession.start)} · {nextSession.schedule} · {nextSession.mode}</dd></>}
              <dt>Montant</dt><dd><b>{fMoney(c.value)}</b></dd>
            </dl>
            {product?.description && <p className="sheet-p">{product.description}</p>}
          </section>
        )}

        {qRows.length > 0 && (
          <section className="sheet-sec">
            <h4>Qualification</h4>
            <dl className="sheet-kv">{qRows.map((x) => <Fragment key={x.key}><dt>{x.label}</dt><dd>{q[x.key]}</dd></Fragment>)}</dl>
          </section>
        )}

        {(items.length > 0 || c.value > 0) && (
          <section className="sheet-sec">
            <h4>Paiement et facilités</h4>
            <div className="sheet-sum">
              <span>Total <b>{fMoney(sum.total)}</b></span>
              <span>Encaissé <b>{fMoney(sum.paid)}</b></span>
              <span>Reste à payer <b>{fMoney(sum.rest)}</b></span>
              <span>Statut <b>{PAYMENT_STATUS[c.payment?.status || 'none'].label}</b></span>
            </div>
            {items.length > 0 ? (
              <table className="sheet-t">
                <thead><tr><th>#</th><th>Date d'échéance</th><th>Mode</th><th>Banque</th><th>Référence</th><th className="r">Montant</th><th>Statut</th></tr></thead>
                <tbody>
                  {items.map((i, n) => (
                    <tr key={i.id}>
                      <td>{n + 1}</td><td>{fDate(i.due)}</td><td>{methodLabel(i.method)}</td><td>{i.bank || '—'}</td><td>{i.ref || '—'}</td>
                      <td className="r">{fMoney(i.amount)}</td><td>{installmentState(i).label}{i.status === 'paid' && i.paidAt ? ` le ${fDate(i.paidAt)}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td colSpan={5}>Total planifié</td><td className="r">{fMoney(items.reduce((s, i) => s + Number(i.amount || 0), 0))}</td><td /></tr></tfoot>
              </table>
            ) : <p className="sheet-p">Aucune échéance planifiée.</p>}
          </section>
        )}

        {rdvs.length > 0 && (
          <section className="sheet-sec">
            <h4>Rendez-vous</h4>
            <table className="sheet-t">
              <thead><tr><th>Date</th><th>Objet</th><th>Type</th><th>Évaluation / compte-rendu</th></tr></thead>
              <tbody>{rdvs.map((r) => (
                <tr key={r.id}><td>{fDateTime(r.start)}</td><td>{r.title}</td><td>{r.mode === 'online' ? 'En ligne' : `Présentiel${r.location ? ` · ${r.location}` : ''}`}</td>
                  <td>{r.status === 'done' ? `${{ positive: 'Positive', neutral: 'Neutre', negative: 'Négative' }[r.evaluation] || ''}${r.report ? ` — ${r.report}` : ''}` : 'Planifié'}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}

        {acts.length > 0 && (
          <section className="sheet-sec">
            <h4>Historique et remarques (12 derniers)</h4>
            <table className="sheet-t">
              <tbody>{acts.map((a) => (
                <tr key={a.id}><td style={{ width: 120 }}>{fDateTime(a.at)}</td><td style={{ width: 150 }}>{ACTIVITY_TYPES[a.type] || a.type}{a.type === 'call' && a.outcome ? ` · ${outcomeLabel(a.outcome)}` : ''}</td><td>{a.text || '—'}</td></tr>
              ))}</tbody>
            </table>
          </section>
        )}

        {withClauses && clauses.length > 0 && (
          <section className="sheet-sec sheet-clauses">
            <h4>Conditions générales</h4>
            <ol>
              {clauses.map((cl) => (
                <li key={cl.id}><b>{cl.title}.</b> {fillClause(cl.text, { client: c.org, company: co.name, product: product?.name, amount: c.value ? fMoney(c.value) : '' })}</li>
              ))}
            </ol>
          </section>
        )}

        <section className="sheet-sign">
          <div><span>Signature du {LABELS.contact}{withClauses && clauses.length ? ', précédée de la mention « Lu et approuvé »' : ''}</span></div>
          <div><span>Signature et cachet — {co.name}</span></div>
        </section>
        {(co.footer || co.taxId) && <footer className="sheet-foot">{[co.name, co.taxId && `MF ${co.taxId}`, co.footer].filter(Boolean).join(' · ')}</footer>}
      </article>
    </div>,
    getCrmRoot(),
  );
}
