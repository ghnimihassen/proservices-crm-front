import { useMemo, useState } from 'react';
import { useStore } from '../store/Store';
import { useUI, Modal, Field, Empty } from './UI';
import Icon from './Icon';
import { PAYMENT_METHODS, PAYMENT_STATUS, methodLabel } from '../store/constants';
import { paymentSummary } from '../store/selectors';
import { fDate, fMoney, startOfDay, addDays } from '../utils';

const dateInput = (d) => { const x = new Date(d); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const fromDate = (v) => { const d = new Date(`${v}T10:00`); return d.toISOString(); };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const INTERVALS = [
  { id: 'month', label: 'Tous les mois', next: (d, i) => addMonths(d, i) },
  { id: '2weeks', label: 'Toutes les 2 semaines', next: (d, i) => addDays(d, 14 * i) },
  { id: 'week', label: 'Toutes les semaines', next: (d, i) => addDays(d, 7 * i) },
  { id: 'quarter', label: 'Tous les 3 mois', next: (d, i) => addMonths(d, 3 * i) },
];

export function installmentState(i) {
  if (i.status === 'paid') return { label: 'Encaissé', cls: 'p-green' };
  if (new Date(i.due) < startOfDay()) return { label: 'En retard', cls: 'p-red' };
  if (new Date(i.due) < addDays(startOfDay(), 7)) return { label: 'Cette semaine', cls: 'p-orange' };
  return { label: 'À venir', cls: 'p-gray' };
}

/* ---------- Une échéance (ajout / modification) ---------- */
export function InstallmentModal({ contact, item, onClose }) {
  const { upsertInstallment } = useStore();
  const { toast } = useUI();
  const sum = paymentSummary(contact);
  const others = (contact.schedule || []).filter((i) => i.id !== item?.id).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const max = Math.max(0, sum.total - others);
  const [f, setF] = useState(() => ({
    method: 'cheque', ref: '', bank: '', status: 'pending', ...(item || {}),
    amount: item ? item.amount : (max || ''), due: dateInput(item?.due || addMonths(new Date(), 1)),
  }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const m = PAYMENT_METHODS.find((x) => x.id === f.method);
  const amt = Number(f.amount) || 0;
  const over = amt > max;
  const submit = (e) => {
    e.preventDefault();
    if (!(amt > 0) || over) return;
    upsertInstallment(contact.id, { ...f, amount: Number(f.amount), due: fromDate(f.due) });
    toast(item ? 'Échéance modifiée' : 'Échéance ajoutée');
    onClose();
  };
  return (
    <Modal title={item ? 'Modifier l’échéance' : 'Ajouter une échéance'} subtitle={contact.org} onClose={onClose} width={560}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button type="submit" form="inst-form" className="btn primary" disabled={!(amt > 0) || over}>Enregistrer</button></>}>
      <form id="inst-form" className="grid2" onSubmit={submit}>
        <div className="field full"><span className="field-l">Mode de paiement</span>
          <div className="row wrap gap8">{PAYMENT_METHODS.map((x) => <button type="button" key={x.id} className={`slot${f.method === x.id ? ' on' : ''}`} aria-pressed={f.method === x.id} onClick={() => setF((y) => ({ ...y, method: x.id }))}>{x.label}</button>)}</div>
        </div>
        <Field label="Montant (DT) *" hint={`Maximum ${fMoney(max)} (total ${fMoney(sum.total)} − ${fMoney(others)} déjà planifiés)`}><input type="number" min="0" max={max} step="10" value={f.amount} onChange={set('amount')} aria-invalid={over} /></Field>
        <Field label="Date d'échéance *"><input type="date" value={f.due} onChange={set('due')} /></Field>
        {m?.ref && <Field label={m.ref}><input value={f.ref} onChange={set('ref')} /></Field>}
        {['cheque', 'traite', 'prelevement', 'virement'].includes(f.method) && <Field label="Banque"><input value={f.bank} onChange={set('bank')} placeholder="Ex. BIAT, STB, Attijari…" /></Field>}
        {over && <div className="alert err full">Ce montant dépasse le total : les échéances atteindraient {fMoney(others + amt)} pour un total de {fMoney(sum.total)}. Saisissez au maximum {fMoney(max)}, ou augmentez le montant total sur la fiche.</div>}
      </form>
    </Modal>
  );
}

/* ---------- Générer un échéancier (facilités de paiement) ---------- */
export function PlanGenerator({ contact, onClose }) {
  const { setSchedule, updateContact } = useStore();
  const { toast } = useUI();
  const paidItems = (contact.schedule || []).filter((i) => i.status === 'paid');
  const paid = paidItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const [total, setTotal] = useState(contact.value || 0);
  const [deposit, setDeposit] = useState(paid ? 0 : Math.round((contact.value || 0) * 0.3));
  const [depositMethod, setDepositMethod] = useState('cash');
  const [n, setN] = useState(3);
  const [method, setMethod] = useState('cheque');
  const [first, setFirst] = useState(dateInput(addMonths(new Date(), 1)));
  const [interval, setFreq] = useState('month');
  const [bank, setBank] = useState('');
  const [refStart, setRefStart] = useState('');

  const preview = useMemo(() => {
    const rest = Math.max(0, Number(total) - paid - Number(deposit || 0));
    const count = Math.max(1, Math.min(36, Number(n) || 1));
    const base = Math.floor(rest / count);
    const it = INTERVALS.find((x) => x.id === interval);
    const start = new Date(`${first}T10:00`);
    const num = refStart.match(/^(.*?)(\d+)$/);
    return Array.from({ length: count }, (_, i) => ({
      method, bank, status: 'pending',
      amount: i === count - 1 ? rest - base * (count - 1) : base,
      due: it.next(start, i).toISOString(),
      ref: refStart ? (num ? `${num[1]}${String(Number(num[2]) + i).padStart(num[2].length, '0')}` : `${refStart}-${i + 1}`) : '',
    }));
  }, [total, paid, deposit, n, method, first, interval, bank, refStart]);

  const errors = [];
  if (!(Number(total) > 0)) errors.push('Saisissez un montant total.');
  if (Number(total) < paid) errors.push(`Le total ne peut pas être inférieur à ce qui est déjà encaissé (${fMoney(paid)}).`);
  if (Number(deposit) < 0 || Number(deposit) > Number(total) - paid) errors.push(`L'acompte ne peut pas dépasser ${fMoney(Math.max(0, Number(total) - paid))}.`);
  const planned = paid + Number(deposit || 0) + preview.reduce((s, p) => s + p.amount, 0);
  const submit = () => {
    if (errors.length) return;
    if (Number(total) !== Number(contact.value)) updateContact(contact.id, { value: Number(total) });
    const items = [...paidItems.map(({ id, ...x }) => x)];
    if (Number(deposit) > 0) items.push({ method: depositMethod, amount: Number(deposit), due: new Date().toISOString(), status: 'paid', paidAt: new Date().toISOString(), ref: '', bank: '' });
    items.push(...preview.filter((p) => p.amount > 0));
    setSchedule(contact.id, items);
    toast('Échéancier enregistré');
    onClose();
  };
  const m = PAYMENT_METHODS.find((x) => x.id === method);

  return (
    <Modal title="Planifier les facilités de paiement" subtitle={`${contact.org} · total ${fMoney(total)}${paid ? ` · déjà payé ${fMoney(paid)}` : ''}`} onClose={onClose} width={820}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn primary" onClick={submit} disabled={errors.length > 0}>Enregistrer l'échéancier</button></>}>
      <div className="stack16">
        {(contact.schedule || []).some((i) => i.status !== 'paid') && <div className="alert warn">Les échéances non encaissées actuelles seront remplacées. Les paiements déjà encaissés sont conservés.</div>}
        <div className="grid2">
          <Field label="Montant total (DT)"><input type="number" min="0" step="10" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
          <Field label="Acompte encaissé aujourd'hui (DT)" hint="0 si pas d'acompte"><input type="number" min="0" step="10" value={deposit} onChange={(e) => setDeposit(e.target.value)} /></Field>
          {Number(deposit) > 0 && <Field label="Mode de l'acompte"><select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>{PAYMENT_METHODS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>}
        </div>
        <div className="field"><span className="field-l">Mode de paiement des échéances</span>
          <div className="row wrap gap8">{PAYMENT_METHODS.map((x) => <button type="button" key={x.id} className={`slot${method === x.id ? ' on' : ''}`} aria-pressed={method === x.id} onClick={() => setMethod(x.id)}>{x.label}</button>)}</div>
        </div>
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <Field label="Nombre d'échéances"><select value={n} onChange={(e) => setN(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6, 8, 10, 12].map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
          <Field label="Première échéance"><input type="date" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label="Fréquence"><select value={interval} onChange={(e) => setFreq(e.target.value)}>{INTERVALS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
          {['cheque', 'traite', 'prelevement', 'virement'].includes(method) && <Field label="Banque"><input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="BIAT, STB…" /></Field>}
          {m?.ref && <Field label={`${m.ref} (1er)`} hint="Numérotation automatique"><input value={refStart} onChange={(e) => setRefStart(e.target.value)} placeholder="Ex. 0045821" /></Field>}
        </div>
        <div className="table-wrap card">
          <table className="t" style={{ minWidth: 520 }}>
            <thead><tr><th>#</th><th>Date</th><th>Mode</th><th>Référence</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
            <tbody>
              {Number(deposit) > 0 && <tr><td>Acompte</td><td>{fDate(new Date())}</td><td>{methodLabel(depositMethod)}</td><td>—</td><td style={{ textAlign: 'right' }}><b>{fMoney(deposit)}</b></td></tr>}
              {preview.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{fDate(p.due)}</td><td>{methodLabel(p.method)}{p.bank ? ` · ${p.bank}` : ''}</td><td>{p.ref || '—'}</td><td style={{ textAlign: 'right' }}><b>{fMoney(p.amount)}</b></td></tr>)}
            </tbody>
            <tfoot><tr><td colSpan={4}><b>Total{paid ? ' (avec le déjà encaissé)' : ''}</b></td><td style={{ textAlign: 'right' }}><b>{fMoney(planned)}</b> / {fMoney(total)}</td></tr></tfoot>
          </table>
        </div>
        {errors.map((e) => <div key={e} className="alert err">{e}</div>)}
      </div>
    </Modal>
  );
}

/* ---------- Encaisser ---------- */
export function PaymentModal({ contact, onClose }) {
  const { toggleInstallment, recordPayment } = useStore();
  const { toast } = useUI();
  const pending = (contact.schedule || []).filter((i) => i.status !== 'paid').sort((a, b) => new Date(a.due) - new Date(b.due));
  const [pick, setPick] = useState(pending[0]?.id || 'free');
  const sum = paymentSummary(contact);
  const [amount, setAmount] = useState(sum.unplanned || '');
  const [method, setMethod] = useState('cash');
  const [ref, setRef] = useState('');
  const freeMax = sum.unplanned;
  const freeOver = pick === 'free' && Number(amount) > freeMax;
  const submit = () => {
    if (pick === 'free') { if (!(Number(amount) > 0) || freeOver) return; recordPayment(contact.id, Number(amount), method, ref); }
    else toggleInstallment(contact.id, pick);
    toast('Paiement enregistré');
    onClose();
  };
  return (
    <Modal title="Encaisser un paiement" subtitle={`${contact.org} · reste ${fMoney(sum.rest)}`} onClose={onClose} width={520}
      footer={<><button className="btn ghost" onClick={onClose}>Annuler</button><button className="btn success" onClick={submit} disabled={freeOver || (pick === 'free' && !(Number(amount) > 0))}>Encaisser</button></>}>
      <div className="stack12" role="radiogroup" aria-label="Échéance à encaisser">
        {pending.map((i) => {
          const st = installmentState(i);
          return (
            <label key={i.id} className={`chip${pick === i.id ? ' on' : ''}`} style={{ minHeight: 52, padding: '0 14px', gap: 12 }}>
              <input type="radio" name="pick" checked={pick === i.id} onChange={() => setPick(i.id)} />
              <span style={{ flex: 1 }}><b>{fMoney(i.amount)}</b> · {methodLabel(i.method)}{i.ref ? ` n° ${i.ref}` : ''}<br /><span className="xs">Échéance du {fDate(i.due)}</span></span>
              <span className={`pill ${st.cls}`}>{st.label}</span>
            </label>
          );
        })}
        <label className={`chip${pick === 'free' ? ' on' : ''}`} aria-disabled={freeMax <= 0} style={{ minHeight: 52, padding: '0 14px', gap: 12 }}>
          <input type="radio" name="pick" checked={pick === 'free'} onChange={() => setPick('free')} /><b>Autre montant</b>
        </label>
        {pick === 'free' && (
          <div className="grid2">
            <Field label="Montant (DT)"><input type="number" min="0" step="10" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Mode"><select value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></Field>
            {PAYMENT_METHODS.find((x) => x.id === method)?.ref && <Field label={PAYMENT_METHODS.find((x) => x.id === method).ref}><input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>}
          </div>
        )}
        {pick === 'free' && freeMax <= 0 && <div className="alert warn">Tout le montant est déjà couvert par l'échéancier : encaissez une des échéances ci-dessus.</div>}
        {freeOver && freeMax > 0 && <div className="alert err">Ce montant dépasse ce qui reste hors échéancier ({fMoney(freeMax)}). Encaissez plutôt une échéance prévue.</div>}
      </div>
    </Modal>
  );
}

/* ---------- Bloc échéancier sur la fiche ---------- */
export function PaymentPlan({ contact }) {
  const { toggleInstallment, deleteInstallment, can } = useStore();
  const canPlan = can('payments.plan'), canCollect = can('payments.collect');
  const { toast, confirm } = useUI();
  const [modal, setModal] = useState(null);
  const sum = paymentSummary(contact);
  const items = [...(contact.schedule || [])].sort((a, b) => new Date(a.due) - new Date(b.due));
  const st = PAYMENT_STATUS[contact.payment?.status || 'none'];

  return (
    <section className="card pad24 stack16" aria-label="Échéancier de paiement">
      <div className="row between wrap gap12">
        <div>
          <h2>Paiement et facilités</h2>
          <div className="muted sm">Chèques, traites, prélèvements, espèces… avec une date pour chaque échéance.</div>
        </div>
        <div className="row wrap gap8">
          {canPlan && <button className="btn small ghost" onClick={() => setModal({ t: 'add' })} disabled={sum.unplanned <= 0} title={sum.unplanned <= 0 ? 'Le total est déjà entièrement planifié' : undefined}><Icon name="plus" size={16} />Ajouter une échéance</button>}
          {canPlan && <button className="btn small primary" onClick={() => setModal({ t: 'plan' })} disabled={!contact.value}><Icon name="calendar" size={16} />{items.length ? 'Replanifier' : 'Planifier les facilités'}</button>}
        </div>
      </div>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div className="stack8" style={{ gap: 2 }}><span className="lbl">Total</span><b className="num" style={{ fontSize: 20 }}>{fMoney(sum.total)}</b></div>
        <div className="stack8" style={{ gap: 2 }}><span className="lbl">Encaissé</span><b className="num" style={{ fontSize: 20, color: 'var(--green-ink)' }}>{fMoney(sum.paid)}</b></div>
        <div className="stack8" style={{ gap: 2 }}><span className="lbl">Reste</span><b className="num" style={{ fontSize: 20 }}>{fMoney(sum.rest)}</b></div>
        <div className="stack8" style={{ gap: 2 }}><span className="lbl">Prochaine échéance</span><b className="sm">{sum.next ? `${fDate(sum.next.due)} · ${fMoney(sum.next.amount)}` : '—'}</b></div>
      </div>
      <div className="row gap8">
        <div className="bar" style={{ flex: 1 }}><span style={{ width: `${sum.total ? Math.min(100, (sum.paid / sum.total) * 100) : 0}%`, background: 'var(--green)' }} /></div>
        <span className={`pill ${st.cls}`}>{st.label}</span>
      </div>
      {sum.overdue.length > 0 && <div className="alert err"><b>{sum.overdue.length} échéance{sum.overdue.length > 1 ? 's' : ''} en retard</b> pour {fMoney(sum.overdue.reduce((s, i) => s + Number(i.amount), 0))}.</div>}
      {sum.planned + sum.paid > sum.total && <div className="alert err"><b>Les échéances dépassent le total</b> de {fMoney(sum.planned + sum.paid - sum.total)}. Modifiez ou supprimez une échéance, ou cliquez sur « Replanifier ».</div>}
      {sum.unplanned <= 0 && items.length > 0 && sum.planned + sum.paid === sum.total && sum.rest > 0 && <div className="muted sm">Le total est entièrement planifié.</div>}
      {sum.unplanned > 0 && items.length > 0 && <div className="alert warn">{fMoney(sum.unplanned)} ne sont pas encore planifiés dans l'échéancier.</div>}
      {items.length === 0 ? (
        <Empty icon="wallet" title="Aucune échéance" text={contact.value ? 'Planifiez le paiement en une ou plusieurs fois.' : 'Choisissez d’abord un produit ou saisissez un montant.'} />
      ) : (
        <div className="table-wrap">
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {items.map((i) => {
                const s = installmentState(i);
                return (
                  <tr key={i.id}>
                    <td><b>{fDate(i.due)}</b>{i.status === 'paid' && i.paidAt && !sameDayIso(i.paidAt, i.due) && <><br /><span className="muted xs">encaissé le {fDate(i.paidAt)}</span></>}</td>
                    <td>{methodLabel(i.method)}{i.bank && <><br /><span className="muted xs">{i.bank}</span></>}</td>
                    <td>{i.ref || <span className="muted">—</span>}</td>
                    <td style={{ textAlign: 'right' }}><b>{fMoney(i.amount)}</b></td>
                    <td><span className={`pill ${s.cls}`}>{s.label}</span></td>
                    <td>
                      <div className="row gap4 end">
                        {canCollect && <button className={`btn small ${i.status === 'paid' ? 'ghost' : 'success'}`} onClick={async () => {
                          if (i.status === 'paid' && !(await confirm({ title: 'Annuler l’encaissement', message: `Remettre l'échéance de ${fMoney(i.amount)} en « à encaisser » ?`, ok: 'Annuler l’encaissement', danger: true }))) return;
                          toggleInstallment(contact.id, i.id); toast(i.status === 'paid' ? 'Encaissement annulé' : 'Échéance encaissée');
                        }}>{i.status === 'paid' ? 'Annuler' : 'Encaisser'}</button>}
                        {canPlan && <><button className="icon-btn sm plain" aria-label="Modifier l'échéance" onClick={() => setModal({ t: 'edit', item: i })}><Icon name="edit" size={16} /></button>
                        <button className="icon-btn sm plain" aria-label="Supprimer l'échéance" onClick={async () => { if (await confirm({ title: 'Supprimer l’échéance', message: `Supprimer l'échéance du ${fDate(i.due)} (${fMoney(i.amount)}) ?`, ok: 'Supprimer', danger: true })) { deleteInstallment(contact.id, i.id); toast('Échéance supprimée'); } }}><Icon name="trash" size={16} /></button></>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal?.t === 'plan' && <PlanGenerator contact={contact} onClose={() => setModal(null)} />}
      {modal?.t === 'add' && <InstallmentModal contact={contact} onClose={() => setModal(null)} />}
      {modal?.t === 'edit' && <InstallmentModal contact={contact} item={modal.item} onClose={() => setModal(null)} />}
    </section>
  );
}

const sameDayIso = (a, b) => startOfDay(new Date(a)).getTime() === startOfDay(new Date(b)).getTime();
