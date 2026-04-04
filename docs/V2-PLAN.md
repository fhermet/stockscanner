# StockScanner V2 — Plan Produit & Technique

## 1. Analyse critique du MVP

### Ce qui fonctionne bien

| Aspect | Detail |
|--------|--------|
| **Typage** | Types `readonly`, interfaces propres, union types pour StrategyId |
| **Separation scoring** | 1 fichier par strategie, fonctions pures |
| **Structure UX** | Flux Home → Scanner → Detail clair et logique |
| **Immutabilite** | Aucune mutation, spread operators, readonly partout |
| **API Routes** | Separation propre UI / logique metier |
| **Composants** | Petits, focuses, reutilisables (ScoreBadge, ScoreGauge, MetricCard) |

### Problemes identifies

#### P1 — Architecture (bloquants pour la V2)

1. **Pas d'abstraction data** : `mock-data.ts` est importe directement dans les routes API et la page detail. Impossible de brancher une vraie API sans tout modifier.

2. **Scoring non extensible** : Ajouter une strategie oblige a modifier `scoring/index.ts` (map hardcodee). Les fonctions utilitaires (`scoreDebt`, `scoreMargin`) sont dupliquees entre fichiers.

3. **Pas de gestion d'erreur cote client** : `scanner/page.tsx` fait un `fetch` sans try/catch, sans etat d'erreur, sans retry.

4. **Format API inconsistant** : Les reponses succes et erreur n'ont pas le meme shape (`{ stocks, strategy }` vs `{ error }`).

#### P2 — Scoring (qualite des resultats)

5. **Seuils absolus non normalises** : Un ROE de 147% (Apple, equity negative) et de 29% (Google) obtiennent le meme score (100). Pas de clamp, pas de normalisation par percentile.

6. **Pas de gestion des donnees manquantes** : Si `dividendYield = 0`, le mode Dividend donne un score bas mais ne distingue pas "pas de dividende" de "donnee absente".

7. **Explications couplees au scoring** : La generation d'explications est melangee dans chaque fichier de strategie. Rend le code long et difficile a tester separement.

#### P3 — UX (experience utilisateur)

8. **`formatMarketCap` dupliquee** 3 fois (stock-table, stock-card, page detail).

9. **Pas de page d'erreur** ni de 404 custom.

10. **Pas de dark mode**, pas de persistance preferences.

11. **Pas de comparaison multi-strategies** : l'utilisateur doit naviguer manuellement pour comparer.

---

## 2. Plan V2 — Produit

### Nouvelles fonctionnalites

| Feature | Priorite | Impact utilisateur |
|---------|----------|-------------------|
| Donnees reelles (API financiere) | P0 | Credibilite du produit |
| Watchlist | P1 | Engagement, retention |
| Comparaison multi-strategies | P1 | Comprehension, decision |
| Explicabilite amelioree (resume) | P1 | Valeur pedagogique |
| Dark mode | P2 | Confort, perception pro |
| Graphiques simples | P2 | Lisibilite des tendances |
| Alertes score | P3 | Engagement retour |

### Modele freemium

| Tier | Features | Limite |
|------|----------|--------|
| **Free** | 4 strategies, 25 actions, scores, explications | Rafraichissement 1x/jour |
| **Pro** (9€/mois) | Univers complet (500+ actions), filtres avances, watchlist illimitee, alertes, export CSV, API access | Rafraichissement temps reel |
| **Team** (29€/mois) | Multi-utilisateur, strategies custom, historique des scores, API bulk | Illimite |

### Gating strategy

- Scanner : visible pour tous, mais resultats limites a 10 en free
- Detail action : complet en free
- Watchlist : 5 actions en free, illimitee en pro
- Alertes : pro uniquement
- Comparaison multi-strategies : pro uniquement pour >2 strategies

---

## 3. Architecture V2

### Vue d'ensemble

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home
│   ├── scanner/page.tsx          # Scanner
│   ├── stocks/[ticker]/page.tsx  # Detail + multi-strategy
│   ├── watchlist/page.tsx        # NEW: Watchlist
│   ├── compare/page.tsx          # NEW: Comparaison
│   ├── api/
│   │   ├── strategies/route.ts
│   │   ├── stocks/route.ts
│   │   └── stocks/[ticker]/route.ts
│   ├── layout.tsx
│   └── globals.css
│
├── lib/
│   ├── types/                    # REFACTOR: split par domaine
│   │   ├── stock.ts
│   │   ├── strategy.ts
│   │   ├── scoring.ts
│   │   └── api.ts
│   │
│   ├── data/                     # NEW: data provider pattern
│   │   ├── provider.ts           # Interface DataProvider
│   │   ├── mock-provider.ts      # Implementation mock
│   │   ├── fmp-provider.ts       # Implementation Financial Modeling Prep
│   │   ├── cache.ts              # Cache layer
│   │   └── index.ts              # Factory + singleton
│   │
│   ├── scoring/                  # REFACTOR: engine extensible
│   │   ├── engine.ts             # Strategy registry + scoring engine
│   │   ├── utils.ts              # Fonctions de scoring partagees
│   │   ├── normalize.ts          # Normalisation des metriques
│   │   ├── strategies/
│   │   │   ├── buffett.ts
│   │   │   ├── lynch.ts
│   │   │   ├── growth.ts
│   │   │   └── dividend.ts
│   │   └── explain.ts            # Generateur d'explications decouple
│   │
│   ├── strategies.ts             # Metadata des strategies
│   └── format.ts                 # NEW: utilitaires de formatage partages
│
├── hooks/                        # NEW: React hooks
│   ├── use-watchlist.ts
│   ├── use-theme.ts
│   └── use-stocks.ts
│
├── components/
│   ├── ui/                       # Composants generiques
│   ├── scanner/                  # Composants specifiques scanner
│   ├── stock-detail/             # Composants specifiques detail
│   ├── watchlist/                # NEW
│   ├── compare/                  # NEW
│   └── layout/
│
└── providers/                    # NEW: React context providers
    └── theme-provider.tsx
```

### Principes architecturaux

1. **Data Provider Pattern** : Interface abstraite pour les donnees. Changement de source = changement d'implementation, zero impact sur le scoring ou l'UI.

2. **Strategy Registry** : Les strategies s'enregistrent elles-memes. Ajouter une strategie = creer un fichier, zero modification ailleurs.

3. **Separation Scoring / Explications** : Le scoring produit des chiffres. L'explication les interprete. Deux preoccupations, deux modules.

4. **Hooks metier** : `useWatchlist`, `useStocks`, `useTheme` encapsulent la logique, les composants restent presentationnels.

5. **Normalisation** : Toutes les metriques passent par une couche de normalisation avant scoring. Permet de gerer les edge cases (ROE negatif, donnees aberrantes).

---

## 4. Choix techniques expliques

### Donnees reelles : Financial Modeling Prep (FMP)

**Pourquoi FMP plutot que Yahoo Finance ?**

| Critere | FMP | Yahoo Finance |
|---------|-----|---------------|
| API officielle | Oui, documentee | Pas d'API officielle stable |
| Plan gratuit | 250 req/jour | Scraping instable |
| Donnees fondamentales | Completes (ratios, FCF, historique) | Partielles |
| Fiabilite | Haute | Frequentes ruptures |
| Prix pro | 29$/mois | N/A |

**Alternative** : Alpha Vantage (gratuit mais 5 req/minute, donnees moins completes).

**Design** : L'interface `DataProvider` permet de basculer sans toucher au reste du code.

### Cache : In-memory + TTL

Pas besoin de Redis pour un MVP/V2. Un cache en memoire avec TTL (1h pour les fondamentaux, 15min pour les prix) suffit. Le cache est injectable via le provider, donc remplacable par Redis quand on scale.

### Stockage watchlist : localStorage → Supabase

V2 : `localStorage` (pas d'auth, zero friction).
V2.1 : Migration vers Supabase quand l'auth est ajoutee (sync cross-device).

### Dark mode : CSS variables + class strategy

Tailwind `darkMode: 'class'` + hook `useTheme` avec persistance `localStorage`. Leger, standard, pas de librairie supplementaire.

---

## 5. Scoring V2 — Ameliorations

### 5.1 Normalisation

Actuellement : `if (roe >= 20) return 100` — seuil absolu.

V2 : **Normalisation par interpolation lineaire** entre un min et un max configurable par metrique, avec clamp aux bornes.

```
score = clamp((value - min) / (max - min) * 100, 0, 100)
```

Avantages :
- Scores plus granulaires (pas de paliers de 20)
- Edge cases geres (ROE 147% → clamp a 100, pas d'inflation)
- Seuils configurables par strategie

### 5.2 Donnees manquantes

Chaque metrique recoit un flag `available: boolean`. Si une donnee est absente :
- Le sous-score concerne est calcule sans cette metrique
- Les poids sont redistribues proportionnellement
- Une explication "Donnee non disponible" est ajoutee

### 5.3 Strategy engine extensible

Chaque strategie implemente une interface :

```typescript
interface StrategyScorer {
  readonly id: StrategyId;
  readonly metadata: Strategy;
  score(stock: Stock): SubScore[];
}
```

Le registre decouvre automatiquement les strategies. Ajouter "Momentum" = creer `strategies/momentum.ts` et l'importer dans le registre.

### 5.4 Explicabilite amelioree

Ajout d'un **resume naturel** en plus des bullet points :

> "Microsoft est une excellente candidate Buffett : marges exceptionnelles (44.6%), endettement maitrise, cash flow solide. Seul bemol : la valorisation est un peu elevee (PER 35)."

Genere par un module dedie qui analyse le score et les metriques pour produire 1-2 phrases synthetiques.

---

## 6. V3 — Vision produit differenciante

### Matrice des idees

| # | Idee | Valeur utilisateur | Difficulte | Impact business | Priorite |
|---|------|-------------------|------------|-----------------|----------|
| 1 | **Assistant IA d'investissement** | Reponses personnalisees aux questions ("Est-ce que AAPL est un bon achat ?") | Elevee | Fort (differenciateur majeur) | P1 |
| 2 | **Portefeuille virtuel** | Simuler ses investissements, tracker la performance | Moyenne | Fort (engagement quotidien) | P1 |
| 3 | **Backtesting de strategies** | "Si j'avais suivi Buffett depuis 2020, combien aurais-je gagne ?" | Elevee | Fort (conviction + conversion) | P2 |
| 4 | **Scoring adaptatif** | Score ajuste au profil de risque et aux preferences de l'utilisateur | Moyenne | Moyen (personnalisation) | P2 |
| 5 | **Alertes intelligentes** | Notification quand un score change significativement | Faible | Moyen (retention) | P2 |
| 6 | **Insights automatiques** | "3 actions de votre watchlist ont ameliore leur score cette semaine" | Moyenne | Fort (raison de revenir) | P1 |
| 7 | **Comparateur d'actions** | Comparer 2-3 actions cote a cote sur toutes les metriques | Faible | Moyen | P3 |
| 8 | **Strategies custom** | L'utilisateur definit ses propres poids et seuils | Moyenne | Moyen (pro feature) | P3 |
| 9 | **Social / communaute** | Partager ses watchlists, voir les actions populaires | Elevee | Fort (viralite) | P3 |
| 10 | **API publique** | Permettre aux devs d'integrer le scoring | Faible | Moyen (B2B) | P3 |

### Detail des idees P1

#### 1. Assistant IA d'investissement

**Description** : Chat integre qui repond aux questions en contexte. L'utilisateur peut demander "Pourquoi NVDA est si bien note en Growth ?" ou "Compare-moi JNJ et PG pour du dividende".

**Implementation** :
- API Claude/OpenAI avec prompt systeme contenant les metriques et scores de l'action
- RAG leger : le contexte est structure (pas besoin de vector DB)
- Streaming pour UX fluide

**Valeur** : Transforme un outil passif en assistant actif. Differenciateur majeur vs Finviz/TradingView.

**Complexite** : Elevee (integration LLM, prompt engineering, cout API).

#### 2. Portefeuille virtuel

**Description** : L'utilisateur "achete" virtuellement des actions et suit la performance de son portefeuille. Chaque achat est tague avec la strategie utilisee.

**Implementation** :
- Table `positions` : ticker, qty, prix_achat, date, strategie
- Calcul P&L en temps reel avec donnees de prix
- Dashboard avec performance globale et par strategie

**Valeur** : Engagement quotidien. L'utilisateur revient voir sa performance.

**Complexite** : Moyenne (CRUD + calculs de performance).

#### 6. Insights automatiques

**Description** : Un fil d'actualites personnalise base sur la watchlist :
- "GOOG a gagne 5 points en score Lynch cette semaine (PEG ameliore)"
- "Votre watchlist a un score Buffett moyen de 72 (+3 vs semaine derniere)"
- "NVDA vient de depasser le seuil de 80 en Growth"

**Implementation** :
- Job CRON qui calcule les deltas de score quotidiennement
- Stockage des scores historiques (table `score_snapshots`)
- Feed personnalise dans le dashboard

**Valeur** : Raison concrete de revenir chaque jour.

**Complexite** : Moyenne.

---

## 7. Ameliorations V2 vs MVP — Resume

| Domaine | MVP | V2 |
|---------|-----|-----|
| **Donnees** | 25 actions mockees | API reelle (FMP), 500+ actions, cache |
| **Scoring** | Seuils absolus, paliers de 20 | Normalisation lineaire, donnees manquantes |
| **Extensibilite** | Map hardcodee | Strategy registry auto-decouverte |
| **Explicabilite** | Bullet points | Resume naturel + bullets + badges |
| **Data layer** | Import direct | Provider pattern (mock/FMP/cache) |
| **Watchlist** | Absente | localStorage, 5 actions free |
| **Comparaison** | Absente | Vue multi-strategies |
| **Dark mode** | Absent | Class strategy + persistance |
| **Erreurs** | Aucune gestion | Error boundaries, etats erreur, retry |
| **Formatage** | Duplique | Module partage `format.ts` |
| **API** | Shape inconsistant | Envelope standard `{ success, data, error }` |
