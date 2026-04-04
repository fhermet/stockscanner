# StockScanner

Application web de **stock screener oriente strategies d'investissement**.

> "Choisis une strategie d'investissement, on te montre les actions qui y correspondent le mieux."

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 58 tests
```

Pour activer les donnees Yahoo Finance (gratuites, temps reel) :

```bash
cp .env.example .env
# Editer .env → YAHOO_ENABLED=true
npm run dev
```

## Strategies

| Strategie | Philosophie | Metriques cles |
|-----------|-------------|----------------|
| **Buffett** | Qualite & valeur | ROE, marge, FCF, dette, PER |
| **Peter Lynch** | Croissance a prix raisonnable | PEG, EPS growth, CA growth |
| **Growth** | Croissance agressive | CA growth, EPS growth, marges, potentiel |
| **Dividende** | Rendement & stabilite | Yield, payout ratio, FCF coverage, dette |

## Architecture data

```
  Requete utilisateur
        │
        ▼
  ┌─────────────┐
  │    Cache     │ ── hit (fresh) ──→ reponse instantanee
  │  (SWR TTL)  │ ── hit (stale) ──→ reponse + revalidation async
  └──────┬──────┘ ── miss ──────────┐
         │                          │
         ▼                          ▼
  ┌─────────────────────────────────────┐
  │        CompositeProvider            │
  │  ┌─────────┐     ┌──────────────┐  │
  │  │  Yahoo   │ ──► │ Mock (local) │  │
  │  │ Finance  │     │  25 actions  │  │
  │  └─────────┘     └──────────────┘  │
  │    ~100 tickers     fallback auto   │
  └─────────────────────────────────────┘
```

### Politique de cache (stale-while-revalidate)

| Etat | Condition | Comportement |
|------|-----------|-------------|
| **Fresh** | age < TTL (1h stocks, 15min detail) | Reponse instantanee |
| **Stale** | TTL < age < 4h | Reponse instantanee + revalidation en arriere-plan |
| **Expire** | age > 4h | Nouveau fetch bloquant |

### Politique de fallback

1. Yahoo Finance est le provider principal (gratuit, sans cle API)
2. Si Yahoo echoue (rate limit, timeout, API change), le composite bascule automatiquement sur le dataset local
3. Le fallback est transparent pour l'utilisateur — un badge ambre indique "Source de secours"
4. Chaque fallback est logge (structured JSON) pour observabilite

### Metadata de transparence

Chaque reponse API inclut un objet `meta` :

```json
{
  "source": "cache:composite:[yahoo>mock]",
  "fetchedAt": 1712234567890,
  "isFallback": false,
  "isCached": true,
  "cacheAgeMs": 342000,
  "isStale": false
}
```

Affiche dans l'UI : source, fraicheur, indicateur stale/fallback.

## Architecture projet

```
src/
├── app/                               # Pages + API routes
│   ├── api/stocks/                    # API avec meta dans la reponse
│   ├── scanner/page.tsx               # Scanner + DataSourceBadge
│   └── stocks/[ticker]/page.tsx       # Detail via DataProvider
│
├── lib/
│   ├── data/                          # Data Provider Pattern
│   │   ├── provider.ts                #   Interface DataProvider
│   │   ├── yahoo-provider.ts          #   Yahoo Finance (~100 tickers)
│   │   ├── mock-provider.ts           #   Dataset local (25 actions)
│   │   ├── composite-provider.ts      #   Fallback chain + logging
│   │   ├── cache.ts                   #   SWR cache + stats
│   │   ├── metadata.ts               #   Source/freshness tracking
│   │   └── index.ts                   #   Factory singleton
│   │
│   ├── scoring/                       # Moteur de scoring
│   │   ├── engine.ts                  #   Registry + confidence
│   │   ├── normalize.ts              #   Normalisation lineaire
│   │   ├── sector-benchmarks.ts       #   12 secteurs
│   │   ├── completeness.ts            #   Data completeness
│   │   ├── explain.ts                 #   Explications + resume
│   │   └── strategies/                #   4 strategies auto-enregistrees
│   │
│   ├── logger.ts                      #   Structured JSON logger
│   ├── types.ts                       #   Stock, Score, DataMeta...
│   ├── format.ts                      #   Formatage partage
│   └── mock-data.ts
│
├── components/
│   └── ui/
│       ├── confidence-badge.tsx       # Confiance high/medium/low
│       ├── data-source-badge.tsx      # Source + fraicheur + warnings
│       ├── score-badge.tsx
│       └── ...
│
└── hooks/                             # useWatchlist, useTheme, useStocks
```

## Tests

```bash
npm test             # 58 tests
npm run test:watch   # watch mode
```

| Suite | Tests | Couvre |
|-------|-------|-------|
| normalize | 12 | Normalisation lineaire, inverse, range |
| utils | 8 | Weighted average, redistribution |
| completeness | 7 | Completeness, confiance |
| strategies | 20 | Registry, output shape, donnees partielles |
| **coherence** | **11** | **Panel de reference, coherence metier** |

## Limites connues

- **Yahoo Finance** peut etre instable (rate limit, schema changes). Le fallback local mitigue ce risque.
- **~100 tickers hardcodes** : pas de vrai screener dynamique. Ajouter des tickers = editer `DEFAULT_TICKERS` dans `yahoo-provider.ts`.
- **Pas d'historique EPS** depuis Yahoo (`quoteSummary` ne le fournit pas simplement). L'historique n'est disponible que pour les donnees mockees.
- **Cache en memoire** : perdu au redemarrage du serveur. Suffisant pour un usage mono-instance.
- **Pas d'authentification** : pas de watchlist persistante cross-device.

## Historique des versions

### V2.2 (actuelle) — Production readiness
- Fix: page detail utilise maintenant le DataProvider (plus le mock direct)
- Metadata de transparence: source, fraicheur, fallback, staleness
- Logger structure JSON pour observabilite
- Cache SWR: stale-while-revalidate, reponse instantanee meme cache expire
- 58 tests dont 11 tests de coherence metier (panel de reference)
- Badges source/fraicheur dans le scanner et le detail

### V2.1 — Solidification
- Yahoo Finance provider, composite fallback, data completeness, sector benchmarks, 47 tests

### V2.0 — Architecture
- Data provider pattern, scoring engine, normalisation, explications, watchlist, dark mode

### V1.0 — MVP
- Scoring simple, donnees mockees, 3 pages

## V3 — Prochaines etapes

| Priorite | Idee | Complexite |
|----------|------|-----------|
| P1 | Assistant IA contextuel (chat sur les actions) | Elevee |
| P1 | Portefeuille virtuel (simulation) | Moyenne |
| P1 | Insights automatiques (deltas de scores) | Moyenne |
| P2 | Screener dynamique (recherche par criteres, pas par liste) | Moyenne |
| P2 | Authentification + watchlist persistante | Moyenne |
| P2 | Backtesting de strategies | Elevee |
| P3 | Strategies custom (poids configurables) | Moyenne |
| P3 | API publique | Faible |

---

*Donnees a titre educatif. Ne constitue pas un conseil en investissement.*
