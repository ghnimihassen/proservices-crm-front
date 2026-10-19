import { uid, startOfDay, addDays } from '../utils';

// Outils partagés pour générer des données de démonstration (dates relatives à aujourd'hui)
export const at = (days, h = 10, m = 0) => {
  const d = addDays(startOfDay(), days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const REACHED = { lost: 'contacted' };

export function makeKit(qualificationKeys) {
  const emptyQ = Object.fromEntries(qualificationKeys.map((k) => [k, '']));
  const contacts = [];

  const C = (o) => {
    const stage = o.stage || 'new';
    const c = {
      id: uid(), name: '', role: '', email: '', city: 'Tunis', type: '', source: 'Facebook',
      ownerId: 'u1', tags: [], value: 0, probability: 0, lostReason: '', noAnswerCount: 0,
      people: [], files: [], createdAt: at(-10), lastContactAt: null, wonAt: null,
      courseId: null, payment: { status: 'none', paid: 0 },
      ...o, qualification: { ...emptyQ, ...(o.qualification || {}) },
      stage, maxStageId: REACHED[stage] || stage,
    };
    contacts.push(c);
    return c;
  };
  const id = (org) => contacts.find((c) => c.org === org)?.id;
  const A = (org, type, text, days, h, m, userId = 'u1', outcome) => ({ id: uid(), contactId: id(org), type, text, at: at(days, h, m), userId, outcome });
  const T = (title, days, h, m, org, ownerId = 'u1', type = 'call', priority = 'medium', done = false) => ({
    id: uid(), title, due: at(days, h, m), contactId: org ? id(org) : null, ownerId, type, priority, done, createdAt: at(-1),
  });
  const R = (org, o) => ({ id: uid(), contactId: id(org), status: 'planned', evaluation: null, report: '', duration: 60, location: '', link: '', ownerId: 'u1', ...o });

  return { C, A, T, R, id, contacts };
}
