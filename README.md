# CRM Proservices — module React (frontend)

CRM complet (prospects, sessions d'appels, pipeline configurable, rendez-vous, tâches, produits par type,
guides d'appel, échéanciers de paiement, conditions générales, fiche imprimable) livré comme **un composant React**
à intégrer dans votre application.

- React 18, react-router-dom 6.4+, JavaScript (JSX), sans TypeScript ni framework CSS
- Une seule dépendance en plus : `xlsx` (import / export Excel)
- Styles **isolés** : tous les sélecteurs sont préfixés par `.pcrm`, rien ne déborde sur votre application

## 1. Lancer la démo

```bash
npm install
npm run dev        # http://localhost:5173
```

## 2. Intégrer dans votre application

### a) Copier le module

Copiez le dossier `src/crm/` dans votre projet (par exemple `src/modules/crm/`), puis :

```bash
npm install xlsx react-router-dom
```

Le CSS est importé par le module lui-même (`import './styles.css'` dans `App.jsx`) : Vite, CRA et Webpack le prennent en charge sans configuration.

### b) Monter le CRM dans vos routes

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProservicesCRM from './modules/crm';

<BrowserRouter>
  <MonHeader />
  <Routes>
    <Route path="/" element={<Accueil />} />
    {/* le "/*" est obligatoire : le CRM gère ses sous-pages */}
    <Route path="/crm/*" element={<ProservicesCRM basePath="/crm" topOffset={56} currentUser={user} />} />
  </Routes>
</BrowserRouter>
```

Exemple complet : `src/demo/HostAppExample.jsx`.

- **Dans votre router** : le CRM détecte qu'il est déjà dans un router et utilise le vôtre. Les URL deviennent `/crm/contacts`, `/crm/pipeline`, `/crm/contacts/:id`… Liens profonds et bouton « Retour » du navigateur fonctionnent.
- **Sans router** (page isolée) : il crée le sien (`router="hash"` par défaut, ou `"memory"` / `"browser"`).

### c) Propriétés

| Prop | Défaut | Rôle |
|---|---|---|
| `basePath` | `''` | Chemin de montage dans votre router (ex. `"/crm"`) |
| `router` | `'hash'` | Router utilisé seulement si votre app n'en a pas |
| `currentUser` | — | `{ id, name, role, email, roleId, productTypeIds }` de l'utilisateur connecté ; il est ajouté à l'équipe s'il n'existe pas. `roleId` fixe ses droits (voir § Rôles) |
| `initialData` | — | État de départ (ex. chargé depuis votre API) |
| `onChange` | — | `(state) => …` appelé à chaque modification, pour sauvegarder côté serveur |
| `persist` | `true` | Sauvegarde automatique dans le navigateur (`localStorage`) |
| `storageKey` | `'proservices-crm-v2'` | Clé de sauvegarde ; utilisez-en une par entreprise / tenant |
| `demoData` | `true` | Charger les données de démonstration quand il n'y a rien ; `false` = base vide |
| `topOffset` | `0` | Hauteur (px) de votre barre fixe au-dessus du CRM, pour que son menu reste visible |
| `theme` | choix utilisateur | Forcer `'light'`, `'dark'` ou `'system'` |
| `ai` | — | `async ({ question, context, role }) => 'réponse'` : branche votre modèle d'IA sur l'assistant (voir § f) |
| `className` | — | Classe CSS ajoutée au conteneur `.pcrm` |

### d) Brancher le backend Node.js / MongoDB (dossier `../backend`)

Le CRM est livré avec son API (voir `backend/README.md`). Pour l'utiliser, passez simplement son adresse :

```jsx
<ProservicesCRM basePath="/crm" apiUrl="https://crm.votre-domaine.tn/api" />
```

- **Connexion** : sans `token`, le CRM affiche son écran de connexion (et l'écran d'installation du 1er Super admin).
  Avec votre propre authentification : votre backend obtient un jeton via `POST /api/auth/sso` et vous le passez en `token={...}`.
- **Données** : chargées au démarrage (`GET /api/bootstrap`, déjà filtrées par le serveur selon le rôle et les
  activités), puis chaque modification est envoyée automatiquement (`POST /api/sync`, regroupée toutes les 300 ms,
  nouvel essai si le réseau coupe). L'indicateur « Enregistré » en haut de l'écran montre l'état.
- **Droits** : contrôlés par le serveur. Si une action est refusée, un message s'affiche et les données sont rechargées.
- **IA** : l'assistant appelle `POST /api/ai` (Claude si `ANTHROPIC_API_KEY` est configurée côté serveur, sinon analyse locale).

| Prop (mode API) | Rôle |
|---|---|
| `apiUrl` | Adresse de l'API, ex. `https://…/api` (active le mode serveur ; `persist`, `initialData`, `currentUser` sont alors ignorés) |
| `token` | Jeton fourni par votre application (SSO) |
| `tenantId` | Entreprise (multi-entreprises), si vous en gérez plusieurs |
| `onLogout` | Appelé après « Se déconnecter » |
| `onUnauthorized` | Avec `token` : appelé si le jeton a expiré |

Sans `apiUrl`, le CRM garde son fonctionnement autonome (navigateur) ; `initialData` / `onChange` restent disponibles
pour un backend maison.

**Modèle de données** (un objet `state`) :

- `contacts[]` : org, name, productTypeId, role, phone, email, city, type, source, stage, maxStageId, ownerId, tags[], value, probability, lostReason, courseId, qualification{}, people[], files[], schedule[] (échéances : method, amount, due, ref, bank, status, paidAt), payment{status, paid}
- `activities[]` : contactId, type (call, note, email, whatsapp, rdv, stage, report, payment, file, created), outcome, text, userId, at
- `appointments[]` : contactId, title, mode (online/onsite), start, duration, location, link, ownerId, status, evaluation, report
- `tasks[]` : title, type, due, priority, contactId, ownerId, done
- `catalog[]` (produits) : name, typeId, category, duration, description, price, active, sessions[]
- `productTypes[]` : one, many (ex. Formation / Formations)
- `guides[]` : name, productIds[], questions[]
- `stages[]` : id, label, color (colonnes du pipeline ; `won` et `lost` obligatoires)
- `clauses[]` : title, text, active, typeIds[] (conditions générales, variables {client} {entreprise} {produit} {montant} {date})
- `company` : name, logo (data URL), address, phone, email, website, taxId, footer
- `users[]` (name, email, roleId, active, productTypeIds, activeTypeId)
- Données de démonstration : ≈ 22 mois d'historique générés (`src/crm/store/seedHistory.js`) pour les tendances ; rien n'est généré avec `demoData={false}`, `roles[]` (name, description, permissions{clé: booléen}, locked), `settings` (currentUserId, objectifs…)

### e) Rôles et droits d'accès

Le menu **Équipe & paramètres → Rôles et accès** (réservé au Super admin) permet de créer des rôles et de cocher, pour chacun :

- **Menus visibles** : chaque entrée du menu de gauche (Prospects, Pipeline, Produits, Rapports, Mon entreprise…). Une page non cochée disparaît du menu et son URL affiche « Accès non autorisé ».
- **Périmètre des données** : `data.all` = voir toute l'équipe ; sans ce droit, le commercial ne voit que **ses** prospects, RDV, tâches et activités (tableau de bord, pipeline et rapports compris).
- **Actions** : ajouter / modifier / supprimer / importer / exporter / réassigner des prospects, encaisser, planifier l'échéancier, gérer produits, guides, colonnes du pipeline, conditions générales, entreprise, équipe.

Rôles fournis : `admin` (Super admin, tous les droits, non modifiable), `manager` (Responsable commercial), `sales` (Commercial).
En ajoutant un membre, on choisit son rôle ; un compte décoché « actif » n'a plus accès à rien. Il reste toujours au moins un Super admin.

Quand vous passez `currentUser`, c'est **votre** authentification qui décide qui est connecté : le sélecteur de démonstration « se connecter en tant que » est masqué. Passez `roleId` depuis votre backend :

```jsx
<ProservicesCRM currentUser={{ id: user.id, name: user.fullName, email: user.email, roleId: user.isAdmin ? 'admin' : 'sales' }} />
```

#### Activités (types de produits)

Chaque membre peut être limité à une ou plusieurs **activités** = types de produits (ex. « Formations », « Erudaxis ») :
fiche du membre → « Activités (types de produits) accessibles ». Il ne voit alors que les prospects, produits, guides,
RDV, tâches, inscrits et statistiques de ces activités. S'il en a plusieurs, il bascule entre elles avec le sélecteur
« Activité » du menu de gauche ou les onglets du pipeline. Un nouveau prospect prend l'activité affichée ; sinon il doit la choisir.

- `users[].productTypeIds` : `[]` = toutes les activités, `['t2']` = seulement le type `t2`
- `users[].activeTypeId` : activité affichée en ce moment (`''` = toutes celles autorisées)
- `contacts[].productTypeId` : activité du prospect (suit automatiquement le type du produit choisi)

Depuis votre application : `currentUser={{ id, name, roleId: 'sales', productTypeIds: ['t2'] }}`.

Dans le code, les droits se testent avec `can(state, 'contacts.delete')` (`src/crm/store/permissions.js`), le hook `useStore().can('…')` ou les composants `<Can perm="…">` / `<Guard perm="…">` (`src/crm/components/Can.jsx`).
**Important** : ces contrôles sont côté interface. Si vous branchez une API, appliquez les mêmes règles côté serveur (les rôles sont dans `state.roles`, le rôle de chaque membre dans `users[].roleId`).

### f) Tableau de bord, rapports et IA

Deux expériences selon les droits « Pilotage et chiffres » du rôle :

| | Direction (`reports.company`) | Commercial |
|---|---|---|
| Tableau de bord | Cockpit : CA à date vs M-1 / N-1, prévision IA, encaissements, pipeline pondéré, efficacité de l'équipe, produits à garder / éliminer, affaires probables / en danger | Ma journée + mes taux (joignabilité, prise de RDV, RDV honorés, signature, rapidité), activité 30 j, meilleurs créneaux, coaching IA |
| Rapports | Vue d'ensemble N vs N-1 mois par mois, Prévisions IA, Équipe, Produits & types, Sources & pertes, Encaissements — chaque ligne / barre ouvre son détail | Mes performances : évolution de mes taux, résultats d'appels, coaching |
| Montants | Seulement avec `finance.view` | Jamais (ni CA, ni totaux, ni volumes de prospects / clients de l'entreprise) |

Le moteur est dans `src/crm/store/analytics.js` (séries, comparaisons, prévisions, scores) et `src/crm/store/insights.js`
(constats rédigés, coaching, réponses de l'assistant). Prévision = tendance sur 12 mois corrigée de la saisonnalité
+ pipeline pondéré par les taux de signature réellement observés à chaque étape ; fourchette à 80 %.

**Assistant IA** : sans configuration, il répond localement à partir de ces analyses (aucune donnée ne sort).
Pour un vrai modèle de langage, passez `ai` : le CRM vous donne la question et un résumé chiffré **déjà filtré selon
les droits** (pas de montants pour un commercial). Appelez votre modèle **depuis votre backend** (ne mettez jamais de clé d'API dans le front) :

```jsx
<ProservicesCRM
  ai={async ({ question, context, role }) => {
    const r = await fetch('/api/crm/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context, role }) });
    return (await r.json()).answer; // texte affiché dans l'assistant
  }}
/>
```

Côté serveur, envoyez par exemple à l'API Claude un message système « Tu es l'analyste commercial de l'entreprise… réponds en français »
suivi de `JSON.stringify(context)` et de la question. En cas d'erreur, l'assistant revient automatiquement à l'analyse locale.

## 3. Personnaliser

| Quoi | Où |
|---|---|
| Couleurs (charte Erudaxis), police, vocabulaire, sources, motifs de perte, données de démo | `src/crm/brands/proservices.js` |
| Logo par défaut du menu | `src/crm/components/Logo.jsx` (le logo importé dans « Mon entreprise » le remplace) |
| Styles des composants | `src/crm/styles.css` (garder le préfixe `.pcrm`) |
| Pages | `src/crm/pages/` (un fichier par écran) |
| Navigation interne | `src/crm/nav.jsx` — les pages importent `Link`, `useNavigate`… depuis ce fichier pour gérer `basePath` |

## 4. Structure

```
src/
  crm/                 ← le module à copier
    index.js           point d'entrée : export default ProservicesCRM
    App.jsx            composant ProservicesCRM + routes internes
    nav.jsx            navigation compatible basePath
    brand.js           thème et racine .pcrm
    brands/proservices.js
    store/             état, actions, migrations, sélecteurs
    components/        menu, formulaires, paiements, impression…
    pages/             écrans
    styles.css         styles isolés .pcrm
  demo/
    main.jsx           démo autonome
    HostAppExample.jsx exemple d'intégration dans une app existante
```

## 5. À savoir

- **Une seule instance du CRM par page** : l'état des colonnes et la racine du thème sont partagés au niveau du module.
- **Impression** : seule la fiche est imprimée, même si le CRM est entouré de votre interface.
- **Données** : sans backend, chaque navigateur a sa propre base (`localStorage`). En équipe, branchez `onChange` / `initialData` sur votre API.
- **Mobile** : le menu devient un tiroir sous 960 px ; le CRM est utilisable sur téléphone.
