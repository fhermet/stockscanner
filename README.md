# StockScanner

Application web de **stock screener oriente strategies d'investissement**.

> "Choisis une strategie d'investissement, on te montre les actions qui y correspondent le mieux."

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 72 tests
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
  │    ~340 tickers     fallback auto   │
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

## Univers d'actions

| Region | Indices couverts | Tickers |
|--------|-----------------|---------|
| **US** | S&P 500 top, NASDAQ 100 | ~243 |
| **Europe** | CAC 40, DAX 40, FTSE 100, Nordic, Swiss | ~94 |
| **Total** | | **~340** |

L'univers est centralise dans `src/lib/tickers/` :
- `us.ts` — tickers US (suffixe implicite)
- `europe.ts` — tickers europeens avec suffixes Yahoo (.PA, .DE, .L, .SW, .ST)
- `index.ts` — merge deduplique + stats

**Recherche libre** : l'utilisateur peut aussi saisir n'importe quel ticker manuellement via la barre de recherche. Le ticker est score a la volee via Yahoo, meme s'il n'est pas dans l'univers.

### Performance

Premier chargement (~340 tickers) : **~15-20 secondes** (3 batches de 20 en parallele).
Ensuite : **instantane** grace au cache SWR (1h fresh, 4h stale tolerance).

## Architecture projet

```
src/
├── app/
│   ├── api/stocks/                    # API avec meta + universe stats
│   ├── api/stocks/search/             # Recherche libre par ticker
│   ├── scanner/page.tsx               # Scanner + recherche + badges
│   └── stocks/[ticker]/page.tsx       # Detail via DataProvider
│
├── lib/
│   ├── tickers/                       # Univers d'actions centralise
│   │   ├── us.ts                      #   S&P 500 + NASDAQ 100 (~243)
│   │   ├── europe.ts                  #   CAC/DAX/FTSE/Nordic/Swiss (~94)
│   │   └── index.ts                   #   Merge deduplique (337)
│   │
│   ├── data/                          # Data Provider Pattern
│   │   ├── provider.ts                #   Interface DataProvider
│   │   ├── yahoo-provider.ts          #   Yahoo Finance (~340 tickers)
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
│   └── format.ts                      #   Formatage partage
│
├── components/
│   ├── ticker-search.tsx              # Recherche libre par ticker
│   └── ui/
│       ├── confidence-badge.tsx       # Confiance high/medium/low
│       ├── data-source-badge.tsx      # Source + fraicheur + warnings
│       └── ...
│
├── hooks/
│   ├── use-watchlist.ts               # Watchlist localStorage
│   ├── use-score-history.ts           # Score snapshots + deltas
│   ├── use-alerts.ts                  # Regles d'alertes + evaluation
│   ├── use-theme.ts                   # Dark mode
│   └── use-stocks.ts                  # Fetch + error handling
│
└── components/
    ├── ticker-search.tsx              # Recherche libre
    ├── top-opportunities.tsx          # Top 5 par strategie (home)
    ├── daily-digest.tsx               # Alertes du jour (home)
    ├── score-movers.tsx               # Mouvements notables
    └── ui/
        ├── score-delta.tsx            # Badge +N / -N
        ├── confidence-badge.tsx
        ├── data-source-badge.tsx
        └── ...
```

## Tests

```bash
npm test             # 72 tests
npm run test:watch   # watch mode
```

| Suite | Tests | Couvre |
|-------|-------|-------|
| normalize | 12 | Normalisation lineaire, inverse, range |
| utils | 8 | Weighted average, redistribution |
| completeness | 7 | Completeness, confiance |
| strategies | 20 | Registry, output shape, donnees partielles |
| **coherence** | **11** | **Panel de reference, coherence metier** |
| **alerts** | **14** | **Evaluation, seuils, dedup, watchlist filter, modes** |

## Limites connues

- **Yahoo Finance** peut etre instable (rate limit, schema changes). Le fallback local mitigue ce risque.
- **~340 tickers predetermines** : l'univers est large mais pas dynamique. Ajouter des tickers = editer `tickers/us.ts` ou `tickers/europe.ts`. La recherche libre permet d'analyser n'importe quel ticker hors univers.
- **Pas d'historique EPS** depuis Yahoo (`quoteSummary` ne le fournit pas simplement). L'historique n'est disponible que pour les donnees mockees.
- **Cache en memoire** : perdu au redemarrage du serveur. Suffisant pour un usage mono-instance.
- **Pas d'authentification** : pas de watchlist persistante cross-device.

## Historique des versions

### V2.6 (actuelle) — Personnalisation et alertes intelligentes
- Preferences utilisateur (localStorage): strategie favorite, mode alerte, seuils
- 3 modes d'alerte: strict (score>85/delta>8), normal (80/5), sensitive (70/3)
- Page /settings: mode selector, toggles on/off par regle, seuils editables,
  switch watchlist-only, bouton reset
- Alertes enrichies avec explanation (1 phrase contextuelle par alerte)
- Daily digest ameliore: filtres (toutes/watchlist/hausse/baisse),
  tri (importance/variation/strategie), badge strategie, explications
- 72 tests (14 nouveaux pour le moteur d'alertes)

### V2.5 — Engagement et retour quotidien
- Systeme d'alertes: 4 types de regles (score_above/below, delta_above/below),
  evaluation automatique, persistence localStorage, deduplication par jour
- Page /watchlist dediee: scores live, deltas, tri par score/variation/nom,
  bordures colorees pour gainers/losers, bouton retrait
- Daily digest sur la home: alertes declenchees aujourd'hui, icones colorees,
  liens vers detail, bouton effacer
- Header enrichi: compteur watchlist, cloche d'alertes avec badge ambre
- 4 regles par defaut actives sans configuration

### V2.4 — Performance percue et engagement
- Progressive loading: mock instantane (phase 1) + Yahoo en arriere-plan (phase 2)
- Cold load percu: ~0ms au lieu de 15-20s (donnees indicatives puis live)
- Score history: snapshots localStorage, deltas entre visites (+3, -2)
- Top opportunites: section home page avec top 5 par strategie
- Score movers: detection automatique des mouvements significatifs (>=3 pts)
- Banniere "Actualisation en cours..." pendant le chargement live

### V2.3 — Couverture et recherche
- Univers elargi a ~340 actions (S&P 500, NASDAQ 100, CAC 40, DAX 40, FTSE 100)
- Module tickers/ centralise par region (us.ts, europe.ts)
- Parallel batching (3x20) pour cold load en ~15-20s
- Recherche libre : scorer n'importe quel ticker hors univers
- Transparence : "Base sur un univers de X actions" dans le scanner

### V2.2 — Production readiness
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
| ~~P1~~ | ~~Insights automatiques (deltas de scores)~~ | ~~Fait en V2.4~~ |
| P2 | Screener dynamique (recherche par criteres, pas par liste) | Moyenne |
| P2 | Authentification + watchlist persistante | Moyenne |
| P2 | Backtesting de strategies | Elevee |
| P3 | Strategies custom (poids configurables) | Moyenne |
| P3 | API publique | Faible |

---

*Donnees a titre educatif. Ne constitue pas un conseil en investissement.*
