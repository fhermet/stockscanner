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

- **Next.js 15** (App Router)
- **TypeScript** (strict)
- **Tailwind CSS** (dark mode support)
- **React 19**

## Installation

```bash
npm install

# Copier et configurer l'environnement (optionnel)
cp .env.example .env
# Editer .env pour ajouter FMP_API_KEY si donnees reelles souhaitees

# Dev
npm run dev

# Production
npm run build && npm start
```

Application accessible sur [http://localhost:3000](http://localhost:3000).

## Sources de donnees

| Mode | Configuration | Description |
|------|--------------|-------------|
| **Mock** (defaut) | Aucune | 25 actions avec donnees realistes |
| **FMP** | `FMP_API_KEY` dans `.env` | Financial Modeling Prep, 500+ actions |

Le passage d'un mode a l'autre est transparent grace au **Data Provider Pattern** : l'interface `DataProvider` est implementee par `MockDataProvider` et `FMPDataProvider`, avec un cache automatique.

## Architecture

```
src/
├── app/
│   ├── page.tsx                    # Accueil — choix de strategie
│   ├── scanner/page.tsx            # Liste des actions scorees
│   ├── stocks/[ticker]/page.tsx    # Detail + explications
│   └── api/
│       ├── strategies/route.ts     # GET /api/strategies
│       ├── stocks/                 # API V1 (retro-compatible)
│       └── v2/stocks/              # API V2 (envelope standard)
│
├── lib/
│   ├── types.ts                    # Types TypeScript
│   ├── strategies.ts               # Metadata des 4 strategies
│   ├── format.ts                   # Utilitaires de formatage partages
│   ├── mock-data.ts                # 25 actions mockees
│   ├── data/                       # Data Provider Pattern
│   │   ├── provider.ts             #   Interface DataProvider
│   │   ├── mock-provider.ts        #   Implementation mock
│   │   ├── fmp-provider.ts         #   Implementation FMP
│   │   ├── cache.ts                #   Cache in-memory avec TTL
│   │   └── index.ts                #   Factory singleton
│   └── scoring/                    # Moteur de scoring
│       ├── engine.ts               #   Strategy registry + scoring
│       ├── normalize.ts            #   Normalisation lineaire
│       ├── utils.ts                #   Weighted average, redistribution
│       ├── explain.ts              #   Generateur d'explications + resume
│       ├── index.ts                #   V1 scoring (retro-compatible)
│       └── strategies/             #   Strategies auto-enregistrees
│           ├── buffett.ts
│           ├── lynch.ts
│           ├── growth.ts
│           └── dividend.ts
│
├── hooks/                          # React hooks metier
│   ├── use-watchlist.ts            # Watchlist localStorage
│   ├── use-theme.ts                # Dark mode
│   └── use-stocks.ts              # Fetch + error handling
│
├── components/
│   ├── ui/                         # score-badge, score-gauge, metric-card, explanation-list
│   ├── strategy-card.tsx
│   ├── stock-table.tsx
│   ├── stock-card.tsx
│   ├── stock-filters.tsx
│   ├── watchlist-button.tsx        # Bouton ajout/retrait watchlist
│   ├── theme-toggle.tsx            # Toggle dark/light
│   ├── multi-strategy-scores.tsx   # Comparaison multi-strategies
│   ├── stock-summary.tsx           # Resume naturel en 1-2 phrases
│   └── layout/ (header, footer)
│
└── docs/
    └── V2-PLAN.md                  # Plan complet V2 + V3
```

## API

### V1 (retro-compatible)

| Endpoint | Description |
|----------|-------------|
| `GET /api/strategies` | Liste des strategies |
| `GET /api/stocks?strategy=buffett` | Actions scorees |
| `GET /api/stocks/AAPL?strategy=buffett` | Detail action |

### V2 (envelope standard)

| Endpoint | Description |
|----------|-------------|
| `GET /api/v2/stocks?strategy=buffett` | Actions scorees, format `{ success, data, error }` |
| `GET /api/v2/stocks/AAPL?strategy=buffett` | Detail avec resume |
| `GET /api/v2/stocks/AAPL?strategy=buffett&all=true` | Detail + scores de toutes les strategies |

## Scoring

### V1 (original)

Seuils absolus par paliers (ROE >= 20 → 100, >= 15 → 80...).

### V2 (normalise)

Interpolation lineaire entre min et max configurables, avec clamp. Plus granulaire, gere les edge cases (ROE aberrant, equity negative).

Chaque strategie est **auto-enregistree** via `registerStrategy()`. Ajouter une strategie = creer un fichier dans `scoring/strategies/`, zero modification ailleurs.

## Fonctionnalites V2

| Feature | Statut | Description |
|---------|--------|-------------|
| Data Provider Pattern | Fait | Mock → FMP sans toucher au scoring/UI |
| Cache in-memory | Fait | TTL configurable, decorator pattern |
| Strategy Engine extensible | Fait | Auto-registration, ajout sans modification |
| Normalisation lineaire | Fait | Scores granulaires, clamp, edge cases |
| Explications decoupees | Fait | Module separe, regles configurables |
| Resume naturel | Fait | 1-2 phrases synthetiques par action |
| Multi-strategy comparison | Fait | Scores de toutes les strategies |
| Watchlist | Fait | localStorage, 5 actions free |
| Dark mode | Fait | Tailwind class strategy + hook |
| Format partage | Fait | `formatMarketCap` etc. centralises |
| API V2 envelope | Fait | `{ success, data, error }` standard |
| Error handling | Fait | try/catch, etats erreur, retry |
| Hooks metier | Fait | useWatchlist, useTheme, useStocks |

## Documentation

Le plan complet (analyse critique, architecture, choix techniques, V3) est dans [`docs/V2-PLAN.md`](docs/V2-PLAN.md).

## V3 — Idees priorisees

| Priorite | Idee | Impact |
|----------|------|--------|
| P1 | Assistant IA (chat contextuel sur les actions) | Differenciateur majeur |
| P1 | Portefeuille virtuel (simulation) | Engagement quotidien |
| P1 | Insights automatiques (deltas, alertes) | Retention |
| P2 | Backtesting de strategies | Conviction + conversion |
| P2 | Scoring adaptatif (profil utilisateur) | Personnalisation |
| P3 | Strategies custom | Feature premium |
| P3 | Social / partage de watchlists | Viralite |
| P3 | API publique | B2B |

---

*Donnees simulees a titre educatif. Ne constitue pas un conseil en investissement.*
