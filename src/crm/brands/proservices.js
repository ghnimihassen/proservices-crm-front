import { at, makeKit } from '../store/seedKit';
import { uid } from '../utils';
import { makeHistory } from '../store/seedHistory';

const P = (method, amount, days, status = 'pending', ref = '', bank = '') => ({ id: uid(), method, amount, due: at(days, 10), ref, bank, status, paidAt: status === 'paid' ? at(days, 10) : null });

const qualification = [
  { key: 'level', label: 'Niveau / diplôme' },
  { key: 'goal', label: 'Objectif' },
  { key: 'availability', label: 'Disponibilité' },
  { key: 'funding', label: 'Financement' },
  { key: 'budget', label: 'Budget' },
  { key: 'startDate', label: 'Début souhaité' },
];

function seed() {
  const catalog = [
    { id: 'f1', name: 'Développement Web Full Stack', category: 'Informatique', duration: '6 mois · 360 h', price: 2400, active: true,
      sessions: [{ id: 's1', start: at(21, 18), schedule: 'Soir · 18h–21h', mode: 'Présentiel', seats: 16 }, { id: 's2', start: at(49, 9), schedule: 'Samedi · 9h–16h', mode: 'Présentiel', seats: 16 }] },
    { id: 'f2', name: 'Marketing digital & réseaux sociaux', category: 'Marketing', duration: '3 mois · 120 h', price: 1200, active: true,
      sessions: [{ id: 's3', start: at(14, 18), schedule: 'Soir · 18h–21h', mode: 'Hybride', seats: 20 }] },
    { id: 'f3', name: 'Comptabilité & paie', category: 'Gestion', duration: '2 mois · 80 h', price: 900, active: true,
      sessions: [{ id: 's4', start: at(10, 9), schedule: 'Matin · 9h–12h', mode: 'Présentiel', seats: 14 }] },
    { id: 'f4', name: 'Anglais professionnel (B1 → B2)', category: 'Langues', duration: '3 mois · 72 h', price: 650, active: true,
      sessions: [{ id: 's5', start: at(7, 18), schedule: 'Soir · 18h–20h', mode: 'En ligne', seats: 12 }] },
    { id: 'f5', name: 'Design graphique (Photoshop, Illustrator)', category: 'Design', duration: '2 mois · 90 h', price: 1100, active: true,
      sessions: [{ id: 's6', start: at(28, 14), schedule: 'Après-midi · 14h–17h', mode: 'Présentiel', seats: 12 }] },
    { id: 'f6', name: 'Bureautique Excel avancé', category: 'Informatique', duration: '1 mois · 30 h', price: 380, active: true,
      sessions: [{ id: 's7', start: at(5, 9), schedule: 'Samedi · 9h–13h', mode: 'Présentiel', seats: 15 }] },
  ].map((p) => ({ ...p, typeId: 't1' }));
  // 2e activité : vente du logiciel Erudaxis aux écoles et centres
  catalog.push(
    { id: 'e1', typeId: 't2', name: 'Erudaxis École — licence annuelle', category: 'Licences', duration: '12 mois · jusqu’à 500 élèves', price: 4800, active: true, sessions: [] },
    { id: 'e2', typeId: 't2', name: 'Erudaxis Centre de formation — licence annuelle', category: 'Licences', duration: '12 mois · illimité', price: 3600, active: true, sessions: [] },
    { id: 'e3', typeId: 't2', name: 'Mise en place & formation des équipes', category: 'Services', duration: '3 jours', price: 1500, active: true, sessions: [] },
  );

  const { C, A, T, R, contacts } = makeKit(qualification.map((q) => q.key));
  const users = [
    { id: 'u1', roleId: 'admin', name: 'Nour Ben Salah', role: 'Directrice commerciale', email: 'nour@proservices.tn', phone: '+216 21 100 200', active: true },
    { id: 'u2', roleId: 'manager', name: 'Aymen Toumi', role: 'Responsable commercial', email: 'aymen@proservices.tn', phone: '+216 21 300 400', active: true },
    { id: 'u3', roleId: 'sales', name: 'Salma Jebali', role: 'Conseillère formation', email: 'salma@proservices.tn', phone: '+216 21 500 600', active: true, productTypeIds: ['t1'] },
    { id: 'u4', roleId: 'sales', name: 'Karim Haddad', role: 'Commercial Erudaxis', email: 'karim@proservices.tn', phone: '+216 21 700 800', active: true, productTypeIds: ['t2'] },
    { id: 'u5', roleId: 'sales', name: 'Ines Mansour', role: 'Commerciale Formations & Erudaxis', email: 'ines@proservices.tn', phone: '+216 21 900 100', active: true, productTypeIds: ['t1', 't2'] },
  ];

  C({ org: 'Yassine Gharbi', phone: '+216 22 418 903', email: 'yassine.gharbi@gmail.com', type: 'Demandeur d’emploi', source: 'Facebook', stage: 'rdv', courseId: 'f1', value: 2400, probability: 60, createdAt: at(-5), lastContactAt: at(-1, 17),
    qualification: { level: 'Licence informatique', goal: 'Reconversion en développeur web', availability: 'Soir', funding: 'Personnel (paiement en 3 fois)', budget: '2 000 – 2 500 DT', startDate: 'Session de novembre' }, tags: ['facilités-paiement'] });
  C({ org: 'Imen Chaabane', phone: '+216 98 221 554', email: 'imen.chaabane@yahoo.fr', type: 'Particulier', source: 'Instagram', stage: 'contacted', courseId: 'f2', value: 1200, createdAt: at(-3), lastContactAt: at(-1, 10) });
  C({ org: 'Société Medina Logistics', name: 'Khaled Brahmi', role: 'Responsable RH', phone: '+216 71 845 120', email: 'rh@medina-logistics.tn', type: 'Entreprise', source: 'LinkedIn', stage: 'negotiation', courseId: 'f6', value: 3800, probability: 70, ownerId: 'u2', createdAt: at(-18), lastContactAt: at(-2, 11),
    qualification: { level: '10 salariés', goal: 'Former l’équipe administration sur Excel', availability: 'Samedi matin', funding: 'Entreprise (TFP)', budget: '~4 000 DT', startDate: 'Novembre' } });
  C({ org: 'Rania Mejri', phone: '+216 55 900 341', type: 'Étudiant', source: 'TikTok', stage: 'interested', courseId: 'f5', value: 1100, probability: 30, createdAt: at(-6), lastContactAt: at(-4, 15) });
  C({ org: 'Mohamed Ali Sassi', phone: '+216 29 330 712', email: 'ma.sassi@gmail.com', type: 'Particulier', source: 'Site web', stage: 'new', courseId: 'f4', value: 650, createdAt: at(0, 8) });
  C({ org: 'Oumayma Riahi', phone: '+216 50 412 668', type: 'Étudiant', source: 'Facebook', stage: 'new', courseId: 'f1', value: 2400, createdAt: at(-1, 19) });
  C({ org: 'Skander Belhaj', phone: '+216 23 118 450', email: 'skander.bh@outlook.com', type: 'Particulier', source: 'Bouche à oreille', stage: 'won', courseId: 'f2', value: 1200, probability: 100, createdAt: at(-20), lastContactAt: at(-6), wonAt: at(-6),
    schedule: [P('cash', 400, -6, 'paid'), P('cheque', 400, 14, 'pending', '0045821', 'BIAT'), P('cheque', 400, 44, 'pending', '0045822', 'BIAT')] });
  C({ org: 'Nesrine Kooli', phone: '+216 94 007 215', type: 'Demandeur d’emploi', source: 'Facebook', stage: 'won', courseId: 'f3', value: 900, probability: 100, ownerId: 'u3', createdAt: at(-25), lastContactAt: at(-9), wonAt: at(-9),
    schedule: [P('virement', 900, -9, 'paid', 'VIR-2210')] });
  C({ org: 'Clinique Les Oliviers', name: 'Sarra Ben Amor', role: 'Directrice administrative', phone: '+216 71 960 300', email: 'drh@clinique-oliviers.tn', type: 'Entreprise', source: 'Salon / forum', stage: 'interested', courseId: 'f4', value: 5200, probability: 35, ownerId: 'u2', createdAt: at(-9), lastContactAt: at(-8) });
  C({ org: 'Hamdi Zouari', phone: '+216 27 645 980', type: 'Particulier', source: 'Facebook', stage: 'lost', courseId: 'f1', lostReason: 'Prix trop élevé', ownerId: 'u3', createdAt: at(-14), lastContactAt: at(-10) });
  C({ org: 'Wiem Haddad', phone: '+216 52 708 133', type: 'Étudiant', source: 'Instagram', stage: 'contacted', courseId: 'f5', noAnswerCount: 2, createdAt: at(-4), lastContactAt: at(-1, 9) });
  C({ org: 'Fares Karray', phone: '+216 20 811 236', email: 'fares.karray@gmail.com', type: 'Particulier', source: 'WhatsApp', stage: 'rdv', courseId: 'f4', value: 650, probability: 50, ownerId: 'u3', createdAt: at(-3), lastContactAt: at(-1, 12) });
  C({ org: 'Amira Toumi', phone: '+216 58 302 774', type: 'Demandeur d’emploi', source: 'Facebook', stage: 'new', courseId: 'f3', value: 900, ownerId: 'u3', createdAt: at(-2) });
  C({ org: 'Ghassen Mabrouk', phone: '+216 97 115 640', type: 'Particulier', source: 'Google', stage: 'contacted', courseId: 'f6', noAnswerCount: 3, createdAt: at(-11), lastContactAt: at(-9) });
  C({ org: 'Lina Ferjani', phone: '+216 24 553 019', email: 'lina.ferjani@gmail.com', type: 'Étudiant', source: 'TikTok', stage: 'won', courseId: 'f1', value: 2400, probability: 100, createdAt: at(-30), lastContactAt: at(-15), wonAt: at(-15),
    schedule: [P('cash', 800, -15, 'paid'), P('traite', 800, -2, 'pending', 'TR-118', 'Attijari'), P('traite', 800, 28, 'pending', 'TR-119', 'Attijari')] });

  // Prospects Erudaxis (écoles, centres)
  C({ org: 'École Les Jasmins', name: 'Leila Trabelsi', role: 'Directrice', phone: '+216 71 222 333', email: 'direction@lesjasmins.tn', type: 'Établissement', source: 'Salon / forum', stage: 'rdv', courseId: 'e1', value: 4800, probability: 50, ownerId: 'u4', createdAt: at(-8), lastContactAt: at(-2, 11) });
  C({ org: 'Centre Excellence Sfax', name: 'Walid Ayadi', role: 'Gérant', phone: '+216 74 455 120', email: 'contact@excellence-sfax.tn', type: 'Établissement', source: 'LinkedIn', stage: 'negotiation', courseId: 'e2', value: 3600, probability: 70, ownerId: 'u4', createdAt: at(-15), lastContactAt: at(-1, 15) });
  C({ org: 'Collège Pilote El Manar', name: 'Hichem Saidi', role: 'Responsable administratif', phone: '+216 71 880 441', type: 'Établissement', source: 'Site web', stage: 'new', courseId: 'e1', value: 4800, ownerId: 'u4', createdAt: at(-1, 10) });
  C({ org: 'Institut Avenir Sousse', name: 'Mouna Kefi', role: 'Directrice pédagogique', phone: '+216 73 210 908', email: 'mouna.kefi@avenir.tn', type: 'Établissement', source: 'Bouche à oreille', stage: 'contacted', courseId: 'e2', value: 3600, ownerId: 'u5', createdAt: at(-4), lastContactAt: at(-2, 9) });
  C({ org: 'École Internationale Carthage', name: 'Sami Gharbi', role: 'DAF', phone: '+216 71 300 777', email: 'daf@eic.tn', type: 'Établissement', source: 'LinkedIn', stage: 'won', courseId: 'e1', value: 4800, probability: 100, ownerId: 'u4', createdAt: at(-40), lastContactAt: at(-12), wonAt: at(-12),
    schedule: [P('virement', 2400, -12, 'paid', 'VIR-3301'), P('cheque', 2400, 18, 'pending', '0078120', 'STB')] });
  C({ org: 'Hana Belkadhi', phone: '+216 26 554 201', type: 'Particulier', source: 'Facebook', stage: 'interested', courseId: 'f2', value: 1200, probability: 40, ownerId: 'u5', createdAt: at(-3), lastContactAt: at(-1, 16) });

  const activities = [
    A('Yassine Gharbi', 'created', 'Lead Facebook (formulaire publicité « Devenez développeur web »)', -5, 9),
    A('Yassine Gharbi', 'call', 'Licence info, au chômage depuis 6 mois. Veut se reconvertir. Demande s’il y a des facilités de paiement.', -3, 11, 0, 'u1', 'interested'),
    A('Yassine Gharbi', 'call', 'OK pour passer au centre visiter et faire le test de niveau.', -1, 17, 0, 'u1', 'yes'),
    A('Imen Chaabane', 'call', 'En réunion, rappeler après 18h.', -1, 10, 0, 'u1', 'later'),
    A('Société Medina Logistics', 'email', 'Devis 10 participants Excel avancé envoyé (3 800 DT).', -2, 11, 0, 'u2'),
    A('Rania Mejri', 'call', 'Hésite entre design et marketing. Envoyer le programme des deux.', -4, 15, 0, 'u1', 'interested'),
    A('Skander Belhaj', 'stage', 'Étape : Pré-inscription → Inscrit', -6, 12, 0, 'u1'),
    A('Nesrine Kooli', 'stage', 'Étape : Pré-inscription → Inscrit', -9, 12, 0, 'u3'),
    A('Hamdi Zouari', 'call', 'Trouve le prix trop élevé, a choisi une formation en ligne.', -10, 11, 0, 'u3', 'no'),
    A('Wiem Haddad', 'call', '', -1, 9, 0, 'u1', 'noanswer'),
    A('Fares Karray', 'call', 'Veut un test de niveau en ligne avant de s’inscrire.', -1, 12, 0, 'u3', 'yes'),
    A('Ghassen Mabrouk', 'call', '', -9, 10, 0, 'u1', 'noanswer'),
    A('Wiem Haddad', 'call', '', 0, 9, 20, 'u1', 'noanswer'),
    A('Clinique Les Oliviers', 'call', 'Attend validation budget formation 2027.', 0, 10, 0, 'u2', 'later'),
  ];
  const appointments = [
    R('Yassine Gharbi', { title: 'Visite du centre + test de niveau', mode: 'onsite', start: at(1, 16, 0), location: 'Centre Proservices' }),
    R('Fares Karray', { title: 'Test de niveau anglais', mode: 'online', start: at(0, 18, 30), duration: 30, link: 'https://meet.google.com/', ownerId: 'u3' }),
    R('Société Medina Logistics', { title: 'Présentation programme au RH', mode: 'onsite', start: at(-5, 10, 0), location: 'Medina Logistics, Charguia', ownerId: 'u2', status: 'done', evaluation: 'positive', report: 'Validé sur le principe, attend le bon de commande.' }),
  ];
  appointments.push(R('École Les Jasmins', { title: 'Démo Erudaxis à la direction', mode: 'onsite', start: at(2, 10, 0), location: 'École Les Jasmins, Ennasr', ownerId: 'u4' }));
  activities.push(
    A('École Les Jasmins', 'call', 'Utilise Excel pour les notes et les paiements. Intéressée par le module parents.', -2, 11, 0, 'u4', 'interested'),
    A('Centre Excellence Sfax', 'email', 'Devis licence centre + mise en place envoyé.', -1, 15, 0, 'u4'),
  );
  const tasks = [
    T('Rappeler après 18h', 0, 18, 0, 'Imen Chaabane', 'u1', 'call', 'high'),
    T('Envoyer programmes design + marketing', -1, 10, 0, 'Rania Mejri', 'u1', 'email', 'high'),
    T('Relancer le bon de commande', 0, 11, 0, 'Société Medina Logistics', 'u2', 'call', 'high'),
    T('Préparer le test de niveau', 1, 14, 0, 'Yassine Gharbi', 'u1', 'todo'),
    T('Encaisser le solde (800 DT)', 2, 10, 0, 'Skander Belhaj', 'u1', 'todo'),
    T('1er appel', 0, 12, 0, 'Mohamed Ali Sassi', 'u1', 'call'),
    T('Relancer le devis Erudaxis', 0, 15, 0, 'Centre Excellence Sfax', 'u4', 'call', 'high'),
    T('1er appel — présenter Erudaxis', 0, 11, 0, 'Collège Pilote El Manar', 'u4', 'call'),
  ];
  const guides = [
    { id: 'g0', name: 'Guide général — premier appel', productIds: [], questions: [
      'Se présenter et rappeler d\u2019où vient la demande (pub, site…)',
      'Quel est votre objectif : emploi, reconversion, montée en compétences ?',
      'Niveau actuel et diplôme',
      'Disponibilité : matin, soir, week-end, en ligne ?',
      'Financement : personnel, entreprise, facilités de paiement',
      'Proposer une visite du centre ou un test de niveau',
    ] },
    { id: 'g1', name: 'Développement Web — qualification', productIds: ['f1'], questions: [
      'A-t-il déjà codé (HTML, JavaScript, un autre langage) ?',
      'Ordinateur personnel disponible pour les cours ?',
      'Objectif : premier emploi, freelance ou reconversion ?',
      'Disponible le soir 3 fois par semaine pendant 6 mois ?',
      'Présenter le projet final et l\u2019accompagnement au stage',
      'Proposer le paiement en 3 fois (chèques ou traites)',
    ] },
    { id: 'g2', name: 'Entreprises — formation des équipes', productIds: ['f6', 'f4'], questions: [
      'Combien de salariés à former, et quels postes ?',
      'Formation dans vos locaux ou au centre ?',
      'Prise en charge TFP / budget formation de l\u2019année ?',
      'Qui valide le bon de commande ?',
      'Proposer un rendez-vous de présentation avec le RH',
    ] },
  ];
  guides.push({ id: 'g3', name: 'Erudaxis — découverte école / centre', productIds: ['e1', 'e2'], questions: [
    'Combien d’élèves / apprenants et d’enseignants ?',
    'Comment gérez-vous aujourd’hui notes, absences et paiements (Excel, papier, autre logiciel) ?',
    'Qui décide de l’achat (direction, DAF, propriétaire) ?',
    'Besoins prioritaires : scolarité, paiements, communication parents, emplois du temps ?',
    'Proposer une démo de 30 minutes sur site ou en ligne',
  ] });
  const productTypes = [{ id: 't1', one: 'Formation', many: 'Formations' }, { id: 't2', one: 'Erudaxis', many: 'Erudaxis' }];
  // ≈ 20 mois d'historique (ventes, pertes, appels, RDV, encaissements) pour les tendances et prévisions
  const h = makeHistory({ catalog, qualificationKeys: qualification.map((q) => q.key) });
  return {
    users, contacts: [...contacts, ...h.contacts], activities: [...activities, ...h.activities], appointments: [...appointments, ...h.appointments],
    tasks, catalog, guides, productTypes,
  };
}

export default {
  id: 'proservices',
  name: 'Proservices',
  product: 'Formation',
  tagline: 'Centre de formation — prospects, inscriptions et paiements',
  fontLink: 'https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap',
  // Charte graphique Erudaxis (violet / orange), police Figtree
  theme: {
    light: {
      '--font': "'Figtree', system-ui, sans-serif",
      '--primary': '#6D28D9', '--primary-h': '#5B21B6', '--primary-ink': '#5B21B6', '--primary-t': '#F1EBFE', '--primary-t2': '#E4D9FC',
      '--accent': '#EA580C', '--accent-ink': '#9A3412', '--accent-t': '#FFEDD5',
      '--side': '#160F2E', '--side-2': '#241A47', '--side-ink': '#EEEAFB', '--side-muted': '#A49BC6', '--side-act': '#8B5CF6',
      '--bg': '#F6F5FB', '--surface': '#FFFFFF', '--surface-2': '#FAF9FE', '--ink': '#17132A', '--ink-2': '#453E5D', '--muted': '#68627F',
      '--line': '#ECE9F4', '--line-2': '#DDD8EA', '--soft': '#F2EFF8', '--ring': '#C4B5FD',
      '--hero-a': '#2A1A5E', '--hero-b': '#6D28D9',
    },
    dark: {
      '--primary': '#8B5CF6', '--primary-h': '#7C3AED', '--primary-ink': '#C4B5FD', '--primary-t': '#2A1F4D', '--primary-t2': '#372A66',
      '--accent': '#FB923C', '--accent-ink': '#FDBA74', '--accent-t': '#3A2414',
      '--side': '#0B0816', '--side-2': '#1B1533', '--side-ink': '#EEEAFB', '--side-muted': '#958CB5', '--side-act': '#A78BFA',
      '--bg': '#0F0C1C', '--surface': '#17132A', '--surface-2': '#1C1733', '--ink': '#F1EEFA', '--ink-2': '#CAC3DF', '--muted': '#9B94B4',
      '--line': '#2A2442', '--line-2': '#382F55', '--soft': '#211B39', '--ring': '#7C3AED',
      '--hero-a': '#1E1340', '--hero-b': '#4C1D95',
    },
  },
  logo: 'proservices',
  labels: {
    contacts: 'Prospects', contact: 'prospect', contactsTitle: 'Prospects',
    contactsSubtitle: 'Leads des publicités, du site, de WhatsApp et des forums — particuliers et entreprises.',
    newContact: 'Nouveau prospect', org: 'Nom complet ou entreprise', orgPlaceholder: 'Ex. Yassine Gharbi ou Société X', person: 'Contact (entreprise)', personRole: 'Fonction',
    clients: 'Inscrits', client: 'inscrit', convert: 'Inscrire', wonMonth: 'Inscriptions ce mois',
    value: 'Montant (DT)', revenue: 'Chiffre des inscriptions', meeting: 'Entretien d’orientation',
    rdvTitle: 'Rendez-vous', rdvSubtitle: 'Entretiens d’orientation, visites du centre et tests de niveau.',
    pipelineSub: 'Du lead à l’inscription — glissez une carte pour changer d’étape.',
    team: 'Conseillers',
  },
  stages: { new: 'Nouveau lead', contacted: 'Contacté', interested: 'Intéressé', rdv: 'RDV / visite', negotiation: 'Pré-inscription', won: 'Inscrit', lost: 'Perdu' },
  types: ['Particulier', 'Étudiant', 'Demandeur d’emploi', 'Entreprise', 'Établissement', 'Autre'],
  sources: ['Facebook', 'Instagram', 'TikTok', 'Google', 'Site web', 'WhatsApp', 'Bouche à oreille', 'Salon / forum', 'LinkedIn', 'Autre'],
  lostReasons: ['Prix trop élevé', 'Horaires incompatibles', 'A choisi un autre centre', 'Pas le bon moment', 'Formation non disponible', 'Injoignable', 'Autre'],
  qualification,
  callGuide: [
    'Se présenter et rappeler d’où vient la demande (pub, site…)',
    'Quel est votre objectif : emploi, reconversion, montée en compétences ?',
    'Niveau actuel et diplôme',
    'Disponibilité : matin, soir, week-end, en ligne ?',
    'Financement : personnel, entreprise, facilités de paiement',
    'Proposer une visite du centre ou un test de niveau',
  ],
  features: { catalog: true },
  storageKey: 'proservices-crm-v2',
  settings: { dailyCallGoal: 50, weeklyRdvGoal: 10, centerAddress: 'Centre Proservices' },
  seed,
};
