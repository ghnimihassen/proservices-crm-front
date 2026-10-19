/*
 * Assistant IA du tableau de bord et des rapports.
 * - Sans configuration : réponses calculées localement à partir des analyses du CRM (aucune donnée ne sort du navigateur).
 * - Avec la prop `ai` de <ProservicesCRM ai={...}> : la question et un résumé chiffré sont envoyés à votre modèle
 *   (via votre backend), ex. Claude. Le résumé respecte les droits : pas de montants si l'utilisateur ne peut pas les voir.
 */
import { createContext, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/Store';
import { can, currentUser } from '../store/permissions';
import { addDays, startOfDay } from '../utils';
import {
  comparisons, forecast, teamStats, productStats, collections, sourceStats, opportunityRadar,
  personalStats, timeSlots, dailyActivity, monthlySeries,
} from '../store/analytics';
import { executiveInsights, salesCoaching, answerLocally, aiContext } from '../store/insights';
import Icon from './Icon';

const AICtx = createContext(null);
export const AIProvider = AICtx.Provider;
export const useAIProvider = () => useContext(AICtx);

/** Toutes les analyses de la page, recalculées seulement quand les données changent */
export function useAnalytics() {
  const { state, fullState } = useStore();
  const exec = can(state, 'reports.company');
  const money = can(state, 'finance.view');
  const meId = state.settings.currentUserId;
  return useMemo(() => {
    const now = Date.now();
    const from90 = addDays(startOfDay(), -90).getTime();
    if (exec) {
      const cmp = comparisons(state);
      const fc = forecast(state);
      const team = teamStats(state, from90, now + 1);
      const prod = productStats(state);
      const col = collections(state);
      const src = sourceStats(state);
      const radar = opportunityRadar(state);
      const series = fc.series || monthlySeries(state, 25);
      const insights = executiveInsights({ cmp, fc, team, prod, col, src, radar, money });
      return { exec, money, cmp, fc, team, prod, col, src, radar, series, insights };
    }
    const me = personalStats(state, meId, from90, now + 1);
    const goal = state.settings.dailyCallGoal || 40;
    // Moyennes de l'équipe : uniquement des taux, jamais de volumes ni de montants
    const others = fullState.users.filter((u) => u.active !== false).map((u) => personalStats(fullState, u.id, from90, now + 1)).filter((x) => x.calls > 10);
    const avgOf = (k) => (others.length ? Math.round(others.reduce((x, o) => x + (o[k] || 0), 0) / others.length) : 0);
    const team = { reach: avgOf('reach'), rdvRate: avgOf('rdvRate'), showRate: avgOf('showRate'), winRate: avgOf('winRate'), contacted24: avgOf('contacted24') };
    const slots = timeSlots(state, meId);
    const daily = dailyActivity(state, meId, 30);
    const coaching = salesCoaching({ me, team, slots, daily, goal });
    const hot = opportunityRadar(state, 6).hot;
    return { exec, money: false, me, team, slots, daily, coaching, hot, goal, user: currentUser(state) };
  }, [state, fullState, exec, money, meId]);
}

const EXEC_Q = ['Quelle prévision pour les prochains mois ?', 'Quels produits garder ou éliminer ?', 'Qui est le commercial le plus efficace ?', 'Compare ce mois avec le mois dernier et l’an dernier', 'Où en sont les encaissements ?', 'Quelles sources de leads sont les plus rentables ?'];
const EXEC_Q_NOMONEY = ['Quels produits garder ou éliminer ?', 'Qui est le commercial le plus efficace ?', 'Compare ce mois avec le mois dernier', 'Quelles sources de leads convertissent le mieux ?'];
const SALES_Q = ['Comment améliorer mes résultats ?', 'Quel est mon meilleur créneau d’appel ?', 'Qui dois-je appeler en priorité ?'];

export default function AIAssistant({ bundle, compact = false }) {
  const ai = useAIProvider();
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const suggestions = bundle.exec ? (bundle.money ? EXEC_Q : EXEC_Q_NOMONEY) : SALES_Q;

  const ask = async (question) => {
    const text = (question || '').trim();
    if (!text || busy) return;
    setQ('');
    setMsgs((m) => [...m, { me: true, text }]);
    setBusy(true);
    let answer; let source = 'local';
    if (ai) {
      try {
        const r = await ai({ question: text, context: aiContext(bundle), role: bundle.exec ? 'direction' : 'commercial' });
        answer = typeof r === 'string' ? r : r?.answer || r?.text;
        source = 'ai';
      } catch { /* repli sur l'analyse locale */ }
    }
    if (!answer) answer = answerLocally(text, bundle);
    setMsgs((m) => [...m, { text: answer, source }]);
    setBusy(false);
    setTimeout(() => { const log = endRef.current?.parentElement; if (log) log.scrollTop = log.scrollHeight; }, 30);
  };

  return (
    <section className="card pad24 stack12 ai-box" aria-label="Assistant IA">
      <div className="row between wrap gap8">
        <div className="row gap8"><span className="ico i-violet"><Icon name="sparkle" size={18} /></span><div><h2>Assistant IA</h2><div className="muted xs">{ai ? 'Modèle d’IA connecté' : 'Analyse locale de vos données'}{bundle.exec && !bundle.money ? ' · sans montants' : ''}</div></div></div>
        {msgs.length > 0 && <button className="btn link sm" onClick={() => setMsgs([])}>Effacer</button>}
      </div>
      {msgs.length > 0 && (
        <div className="ai-log" aria-live="polite">
          {msgs.map((m, i) => <div key={i} className={`ai-msg${m.me ? ' me' : ''}`}>{m.text}{!m.me && m.source === 'ai' && <span className="muted xs" style={{ display: 'block', marginTop: 6 }}>Réponse du modèle d’IA</span>}</div>)}
          {busy && <div className="ai-msg muted">Analyse en cours…</div>}
          <div ref={endRef} />
        </div>
      )}
      {(!compact || msgs.length === 0) && <div className="row wrap gap8">{suggestions.map((s) => <button key={s} className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}</div>}
      <form className="ai-in" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <label className="sr" htmlFor={`ai-q-${bundle.exec ? 'x' : 's'}`}>Votre question</label>
        <input id={`ai-q-${bundle.exec ? 'x' : 's'}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={bundle.exec ? 'Posez une question sur vos chiffres…' : 'Posez une question sur vos performances…'} />
        <button className="btn primary" type="submit" disabled={!q.trim() || busy} aria-label="Envoyer"><Icon name="send" size={16} /></button>
      </form>
    </section>
  );
}

/** Liste de constats / recommandations rédigés par l'IA */
export function InsightList({ items, limit, onNavigate }) {
  const tone = { good: 'i-green', bad: 'i-red', warn: 'i-orange', info: 'i-violet' };
  return (
    <div className="ins-list">
      {(limit ? items.slice(0, limit) : items).map((x, i) => (
        <div key={i} className="ins">
          <span className={`ico sm ${tone[x.tone] || 'i-gray'}`}><Icon name={x.icon || 'sparkle'} size={16} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="b">{x.title}</div>
            <div className="muted sm">{x.text}</div>
            {x.link && onNavigate && <button className="btn link sm" style={{ minHeight: 0, padding: 0 }} onClick={() => onNavigate(x.link)}>Voir le détail →</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
