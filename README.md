# StockScanner

Application web de **stock screener oriente strategies d'investissement**.

> "Choisis une strategie d'investissement, on te montre les actions qui y correspondent le mieux."

## Strategies disponibles

| Strategie | Philosophie | Metriques cles |
|-----------|-------------|----------------|
| **Buffett** | Qualite & valeur | ROE, marge, FCF, dette, PER |
| **Peter Lynch** | Croissance a prix raisonnable | PEG, EPS growth, CA growth |
| **Growth** | Croissance agressive | CA growth, EPS growth, marges, potentiel |
| **Dividende** | Rendement & stabilite | Yield, payout ratio, FCF coverage, dette |

## Stack technique

- **Next.js 15** (App Router) + **TypeScript** strict + **React 19**
- **Tailwind CSS** (dark mode support)
- **Vitest** (47 tests unitaires)
- **yahoo-finance2** (donnees reelles gratuites, optionnel)

## Installation

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 47 tests
npm run build        # production
```

## Sources de donnees

| Mode | Activation | Description |
|------|-----------|-------------|
| **Mock** (defaut) | Aucune config | 25 actions, donnees statiques |
| **Yahoo** | `YAHOO_ENABLED=true` dans `.env` | Donnees reelles, gratuit, sans cle API |

```bash
cp .env.example .env
# Editer .env → YAHOO_ENABLED=true
```

Le systeme utilise un **CompositeProvider avec fallback automatique** :
Cache → Yahoo → Mock. Si Yahoo echoue, les donnees locales prennent le relais.

## Architecture

```
src/
├── app/                               # Pages + API routes
│   ├── api/stocks/                    # API V1
│   ├── api/v2/stocks/                 # API V2 (envelope standard)
│   ├── scanner/page.tsx               # Scanner avec filtres
│   └── stocks/[ticker]/page.tsx       # Detail + explications
│
├── lib/
│   ├── data/                          # Data Provider Pattern
│   │   ├── provider.ts                #   Interface DataProvider
│   │   ├── yahoo-provider.ts          #   Yahoo Finance (gratuit)
│   │   ├── mock-provider.ts           #   Dataset local
│   │   ├── composite-provider.ts      #   Fallback chain
│   │   ├── cache.ts                   #   Cache in-memory TTL
│   │   └── index.ts                   #   Factory singleton
│   │
│   ├── scoring/                       # Moteur de scoring
│   │   ├── engine.ts                  #   Registry + scoring + confidence
│   │   ├── normalize.ts               #   Normalisation lineaire
│   │   ├── sector-benchmarks.ts       #   Medianes sectorielles
│   │   ├── completeness.ts            #   Data completeness + confidence
│   │   ├── utils.ts                   #   Weighted average, sector adjust
│   │   ├── explain.ts                 #   Explications + resume naturel
│   │   ├── strategies/buffett.ts      #   Auto-enregistrees
│   │   ├── strategies/lynch.ts
│   │   ├── strategies/growth.ts
│   │   ├── strategies/dividend.ts
│   │   └── __tests__/                 #   47 tests unitaires
│   │
│   ├── types.ts                       # Stock, StrategyScore, Confidence...
│   ├── strategies.ts                  # Metadata des 4 strategies
│   ├── format.ts                      # Utilitaires de formatage
│   └── mock-data.ts                   # 25 actions mockees
│
├── hooks/                             # useWatchlist, useTheme, useStocks
└── components/                        # UI modulaire
    └── ui/confidence-badge.tsx        # Badge confiance + missing data
```

## Scoring

Chaque action recoit un **score /100** par strategie, decompose en sous-scores ponderes.

### Normalisation

Interpolation lineaire entre min/max configurables. Plus granulaire que des seuils absolus.

### Ajustement sectoriel

Les metriques sont comparees aux **medianes du secteur** (8 secteurs definis).
Un ROE de 15% est bon pour une banque mais mediocre pour du tech.
Facteur d'ajustement borne entre 0.7x et 1.3x.

### Confiance du score

Chaque score inclut :
- **dataCompleteness** : % de metriques disponibles, liste des manquantes
- **confidence** : high (>=85%), medium (>=60%), low (<60%)

Affiche dans l'UI : badge colore, indicateur dans le tableau, detail des donnees manquantes.

## Tests

```bash
npm test                 # Run all 47 tests
npm run test:watch       # Watch mode
```

| Suite | Tests | Couvre |
|-------|-------|-------|
| normalize | 12 | Normalisation lineaire, inverse, range, scoreMetric |
| utils | 8 | Weighted total/average, weight redistribution |
| completeness | 7 | Completeness par strategie, niveaux de confiance |
| strategies | 20 | Registry, shape output, differentiation, donnees partielles |

## Historique des versions

### V2.1 (actuelle)
- Yahoo Finance provider gratuit
- Composite provider avec fallback automatique
- Data completeness + score confidence
- Benchmarks sectoriels (8 secteurs)
- 47 tests unitaires
- Suppression de toute dependance payante (FMP)
- Nettoyage des fichiers scoring V1 legacy

### V2.0
- Data provider pattern, scoring engine extensible, normalisation, explications, watchlist, dark mode

### V1.0 (MVP)
- Scoring simple avec seuils absolus, donnees mockees, 3 pages

---

*Donnees simulees a titre educatif. Ne constitue pas un conseil en investissement.*
