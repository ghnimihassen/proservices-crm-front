import brand from '../brand';

// Étapes du pipeline : configurables par l'utilisateur (ajout, suppression, nom, couleur, ordre).
// Deux étapes système existent toujours : « won » (gagné, dernière colonne) et « lost » (perdu, hors colonnes).
// Les autres identifiants connus (contacted, interested, rdv, negotiation) déclenchent des automatismes
// s'ils existent encore ; une étape ajoutée par l'utilisateur n'en déclenche aucun.
export const STAGE_COLORS = ['#8A90A3', '#3B82F6', '#06B6D4', '#14B8A6', '#F59E0B', '#F97316', '#7C3AED', '#DB2777', '#16A34A', '#DC2626', '#64748B', '#A16207'];
const L = brand.stages;
const DEFAULT_COLORS = { new: '#8A90A3', contacted: '#3B82F6', interested: '#F59E0B', rdv: '#7C3AED', negotiation: '#DB2777', won: '#16A34A', lost: '#DC2626' };
export const DEFAULT_STAGE_IDS = ['new', 'contacted', 'interested', 'rdv', 'negotiation', 'won'];
export const defaultStages = () => [...DEFAULT_STAGE_IDS, 'lost'].map((id) => ({ id, label: L[id], color: DEFAULT_COLORS[id] }));

/* Registre vivant (mis à jour par le Store à chaque rendu) — les imports voient la valeur courante */
export let STAGES = defaultStages();
export let PIPELINE_STAGES = STAGES.filter((x) => x.id !== 'lost');
export function setStages(list) {
  if (!list || list === STAGES) return;
  STAGES = list;
  PIPELINE_STAGES = list.filter((x) => x.id !== 'lost');
}
export const stageIndex = (id) => PIPELINE_STAGES.findIndex((x) => x.id === id);
export const stageById = (id) => STAGES.find((x) => x.id === id) || { id, label: id || '—', color: '#8A90A3' };
export const hasStage = (id) => STAGES.some((x) => x.id === id);
/** Première colonne : là où arrivent les nouveaux contacts */
export const entryStage = () => PIPELINE_STAGES[0]?.id || 'won';
export const isEntry = (id) => id === entryStage();
export const isOpen = (id) => id !== 'won' && id !== 'lost';
/** Étape la plus avancée atteinte (index dans le pipeline actuel) */
export const reachedIndex = (c) => (c.stage === 'won' ? PIPELINE_STAGES.length - 1 : Math.max(stageIndex(c.stage), stageIndex(c.maxStageId)));
/** Avance vers `id` seulement si l'étape existe et qu'elle est plus loin que l'étape actuelle */
export const shouldAdvanceTo = (c, id) => hasStage(id) && isOpen(c.stage) && stageIndex(c.stage) < stageIndex(id);
/** Étape « juste avant la signature » (ex. Négociation / Pré-inscription) */
export const closingStage = () => (hasStage('negotiation') ? 'negotiation' : PIPELINE_STAGES[PIPELINE_STAGES.length - 2]?.id || null);
export const stageStyle = (id) => {
  const c = stageById(id).color;
  return { background: `color-mix(in srgb, ${c} 16%, var(--surface))`, color: `color-mix(in srgb, ${c} 72%, var(--ink))` };
};

export const SOURCES = brand.sources;
export const TYPES = brand.types;
export const LOST_REASONS = brand.lostReasons;
export const QUALIFICATION = brand.qualification;
export const LABELS = brand.labels;

export const CALL_OUTCOMES = [
  { id: 'noanswer', label: 'Pas de réponse', key: '1' },
  { id: 'later', label: 'Rappeler plus tard', key: '2' },
  { id: 'no', label: 'Pas intéressé', key: '3' },
  { id: 'interested', label: 'Intéressé (sans RDV)', key: '4' },
  { id: 'yes', label: 'Intéressé → RDV', key: '5' },
];
export const outcomeLabel = (id) => CALL_OUTCOMES.find((o) => o.id === id)?.label || id;

export const ACTIVITY_TYPES = {
  note: 'Note', call: 'Appel', email: 'Email', whatsapp: 'WhatsApp', rdv: 'Rendez-vous',
  stage: 'Changement d’étape', created: 'Ajout', report: 'Compte-rendu RDV', file: 'Document', payment: 'Paiement',
};

export const PRIORITIES = [
  { id: 'high', label: 'Haute' }, { id: 'medium', label: 'Moyenne' }, { id: 'low', label: 'Basse' },
];

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Espèces', ref: false },
  { id: 'cheque', label: 'Chèque', ref: 'N° de chèque' },
  { id: 'traite', label: 'Traite', ref: 'N° de traite' },
  { id: 'prelevement', label: 'Prélèvement bancaire', ref: 'Référence mandat' },
  { id: 'virement', label: 'Virement', ref: 'Référence' },
  { id: 'carte', label: 'Carte bancaire', ref: false },
  { id: 'other', label: 'Autre', ref: 'Précision' },
];
export const methodLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label || id;

export const PAYMENT_STATUS = {
  none: { label: 'À payer', cls: 'p-red' },
  deposit: { label: 'Acompte', cls: 'p-orange' },
  paid: { label: 'Payé', cls: 'p-green' },
};
