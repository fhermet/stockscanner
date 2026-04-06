import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Glossaire — Définitions des métriques financières",
  description:
    "Définitions précises de toutes les métriques utilisées dans StockScanner : PER, PEG, ROE, marge opérationnelle, free cash flow, payout ratio, et plus.",
  alternates: { canonical: "/glossary" },
};

interface MetricDefinition {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly category: string;
  readonly formula: string;
  readonly unit: string;
  readonly interpretation: string;
  readonly example?: string;
  readonly usedIn: readonly string[];
  readonly source: string;
  readonly warning?: string;
}

const CATEGORIES = [
  { id: "valuation", label: "Valorisation" },
  { id: "profitability", label: "Rentabilité" },
  { id: "growth", label: "Croissance" },
  { id: "solvency", label: "Solidité financière" },
  { id: "dividend", label: "Dividende" },
  { id: "cash", label: "Cash flow" },
  { id: "size", label: "Taille" },
] as const;

const METRICS: readonly MetricDefinition[] = [
  // --- Valorisation ---
  {
    id: "per",
    name: "PER (Price/Earnings Ratio)",
    nameEn: "Price-to-Earnings Ratio",
    category: "valuation",
    formula: "PER = Cours de l'action / Bénéfice net par action (EPS dilué)",
    unit: "Multiple (sans unité)",
    interpretation:
      "Indique combien d'années de bénéfices actuels il faudrait pour \"rembourser\" le prix de l'action. Un PER bas suggère une valorisation attractive, un PER élevé reflète des attentes de croissance forte.",
    example:
      "Apple à 150$ avec un EPS de 6$ → PER = 25. Il faut 25 années de bénéfices constants pour couvrir le prix.",
    usedIn: ["Warren Buffett (Valorisation, 30%)"],
    source: "Cours : Yahoo Finance. EPS dilué : SEC/EDGAR.",
    warning:
      "Le PER est trompeur pour les entreprises en forte croissance (PER élevé justifié) ou en perte (PER négatif ou non défini). Toujours le lire en contexte sectoriel.",
  },
  {
    id: "peg",
    name: "PEG (Price/Earnings to Growth)",
    nameEn: "PEG Ratio",
    category: "valuation",
    formula: "PEG = PER / Taux de croissance du BPA (en %)",
    unit: "Ratio (sans unité)",
    interpretation:
      "Rapporte la valorisation à la croissance. Un PEG < 1 suggère que la croissance n'est pas encore entièrement reflétée dans le cours. Un PEG > 2 suggère une survalorisation par rapport à la croissance.",
    example:
      "PER = 25, croissance BPA = 20% → PEG = 1.25. Le marché paie légèrement plus que la croissance ne le justifierait.",
    usedIn: ["Peter Lynch (Valeur PEG, 35%)"],
    source: "PER calculé (voir ci-dessus). Croissance BPA : SEC/EDGAR, variation annuelle.",
    warning:
      "Dans StockScanner, le PEG historique utilise la croissance BPA réelle d'une année sur l'autre (pas une projection analyste). Le PEG est non défini quand la croissance est nulle ou négative.",
  },
  {
    id: "dividend-yield",
    name: "Rendement du dividende (Dividend Yield)",
    nameEn: "Dividend Yield",
    category: "dividend",
    formula: "Yield = (Dividende par action / Cours de l'action) × 100",
    unit: "Pourcentage (%)",
    interpretation:
      "Représente le revenu annuel en dividendes rapporté au prix payé. Un yield de 3% signifie que l'investisseur reçoit 3$ de dividende pour chaque 100$ investis.",
    example:
      "Dividendes versés : 22 Mds$, Actions en circulation : 7.4 Mds, Cours : 421$ → DPS = 2.97$, Yield = 0.71%.",
    usedIn: ["Dividende (Rendement, 30%)"],
    source: "Dividendes versés et actions en circulation : SEC/EDGAR. Cours : Yahoo Finance.",
  },
  // --- Rentabilité ---
  {
    id: "roe",
    name: "ROE (Return on Equity)",
    nameEn: "Return on Equity",
    category: "profitability",
    formula: "ROE = Résultat net / Capitaux propres × 100",
    unit: "Pourcentage (%)",
    interpretation:
      "Mesure la rentabilité des fonds investis par les actionnaires. Un ROE élevé signifie que l'entreprise génère beaucoup de profit par rapport à ses capitaux propres. Indicateur clé de la qualité du management.",
    example:
      "Résultat net : 88 Mds$, Capitaux propres : 206 Mds$ → ROE = 42.7%. Excellent pour une entreprise tech.",
    usedIn: ["Warren Buffett (Qualité, 40%)", "Growth (Rentabilité, 25%)"],
    source: "SEC/EDGAR (fundamentals_annual).",
    warning:
      "Un ROE très élevé peut résulter de capitaux propres faibles (effet de levier), pas nécessairement d'une bonne rentabilité opérationnelle. À lire avec le ratio dette/capitaux propres.",
  },
  {
    id: "operating-margin",
    name: "Marge opérationnelle",
    nameEn: "Operating Margin",
    category: "profitability",
    formula: "Marge opérationnelle = Résultat opérationnel / Chiffre d'affaires × 100",
    unit: "Pourcentage (%)",
    interpretation:
      "Mesure la part du chiffre d'affaires qui se transforme en profit opérationnel, avant intérêts et impôts. Reflète l'efficacité opérationnelle de l'entreprise et la force de son modèle économique.",
    example:
      "CA : 245 Mds$, Résultat opérationnel : 109 Mds$ → Marge = 44.5%. Typique d'une entreprise software à forte valeur ajoutée.",
    usedIn: [
      "Warren Buffett (Qualité, 40%)",
      "Peter Lynch (Qualité, 25%)",
      "Growth (Rentabilité, 25%)",
    ],
    source: "SEC/EDGAR (operating_income / revenue).",
  },
  // --- Croissance ---
  {
    id: "revenue-growth",
    name: "Croissance du chiffre d'affaires",
    nameEn: "Revenue Growth (YoY)",
    category: "growth",
    formula: "Croissance CA = (CA année N / CA année N-1) - 1",
    unit: "Pourcentage (%)",
    interpretation:
      "Mesure la progression du chiffre d'affaires d'une année sur l'autre. Une croissance positive et régulière indique une entreprise qui gagne des parts de marché ou qui bénéficie d'un marché en expansion.",
    example:
      "CA 2023 : 212 Mds$, CA 2024 : 245 Mds$ → Croissance = +15.8%.",
    usedIn: [
      "Peter Lynch (Croissance, 40%)",
      "Growth (Momentum, 50%)",
    ],
    source: "SEC/EDGAR (revenue, variation annuelle).",
  },
  {
    id: "eps-growth",
    name: "Croissance du BPA (EPS Growth)",
    nameEn: "Earnings Per Share Growth (YoY)",
    category: "growth",
    formula: "Croissance BPA = (EPS dilué année N / EPS dilué année N-1) - 1",
    unit: "Pourcentage (%)",
    interpretation:
      "Mesure la progression du bénéfice par action. Plus pertinente que le bénéfice net total car elle tient compte des dilutions (émissions d'actions, stock-options). C'est l'indicateur de croissance le plus suivi par les investisseurs.",
    example:
      "EPS 2023 : 9.72$, EPS 2024 : 11.86$ → Croissance = +22.0%.",
    usedIn: [
      "Peter Lynch (Croissance, 40%)",
      "Growth (Momentum, 50%)",
    ],
    source: "SEC/EDGAR (eps_diluted, variation annuelle).",
    warning:
      "Non défini quand l'EPS de l'année précédente est négatif ou nul.",
  },
  // --- Solidité financière ---
  {
    id: "debt-to-equity",
    name: "Dette / Capitaux propres (Debt-to-Equity)",
    nameEn: "Debt-to-Equity Ratio",
    category: "solvency",
    formula: "D/E = Dette totale / Capitaux propres",
    unit: "Ratio (sans unité)",
    interpretation:
      "Mesure le levier financier de l'entreprise. Un ratio bas (< 0.5) signifie que l'entreprise est peu endettée. Un ratio élevé (> 1.5) signifie qu'elle est financée davantage par la dette que par les capitaux propres, ce qui augmente le risque.",
    example:
      "Dette : 60 Mds$, Capitaux propres : 206 Mds$ → D/E = 0.29. Très sain.",
    usedIn: [
      "Warren Buffett (Solidité, 30%)",
      "Peter Lynch (Qualité, 25%)",
      "Dividende (Stabilité, 35%)",
    ],
    source: "SEC/EDGAR (total_debt / shareholders_equity).",
    warning:
      "Les entreprises financières (banques, assurances) ont structurellement un D/E élevé. L'ajustement sectoriel corrige partiellement ce biais pour la stratégie Buffett.",
  },
  // --- Cash flow ---
  {
    id: "free-cash-flow",
    name: "Free Cash Flow (FCF)",
    nameEn: "Free Cash Flow",
    category: "cash",
    formula: "FCF = Cash flow opérationnel - Dépenses d'investissement (CapEx)",
    unit: "Devise (USD)",
    interpretation:
      "Représente la trésorerie réellement disponible après avoir financé les opérations et les investissements nécessaires. C'est l'argent que l'entreprise peut utiliser pour rembourser sa dette, verser des dividendes, racheter des actions ou investir dans de nouvelles opportunités.",
    example:
      "Cash flow opérationnel : 118 Mds$, CapEx : 44 Mds$ → FCF = 74 Mds$.",
    usedIn: ["Warren Buffett (Qualité + Solidité)"],
    source: "SEC/EDGAR (operating_cash_flow - capital_expenditure).",
  },
  {
    id: "fcf-yield",
    name: "FCF Yield (Rendement du cash flow libre)",
    nameEn: "Free Cash Flow Yield",
    category: "cash",
    formula: "FCF Yield = (FCF / Capitalisation boursière) × 100",
    unit: "Pourcentage (%)",
    interpretation:
      "Rapporte le cash flow libre à la valeur de marché de l'entreprise. Un FCF yield élevé signifie que l'entreprise génère beaucoup de cash par rapport à sa valorisation. C'est un indicateur de \"valeur réelle\" indépendant du bénéfice comptable.",
    example:
      "FCF : 74 Mds$, Market Cap : 3 119 Mds$ → FCF Yield = 2.37%.",
    usedIn: ["Warren Buffett (Qualité, 40%)"],
    source: "FCF : SEC/EDGAR. Capitalisation : prix Yahoo × actions SEC.",
  },
  // --- Dividende ---
  {
    id: "payout-ratio",
    name: "Payout Ratio (Taux de distribution)",
    nameEn: "Payout Ratio",
    category: "dividend",
    formula: "Payout Ratio = Dividendes versés / Résultat net × 100",
    unit: "Pourcentage (%)",
    interpretation:
      "Indique la proportion du bénéfice net redistribuée aux actionnaires sous forme de dividendes. Un payout de 30%–60% est considéré comme optimal : assez pour rémunérer les actionnaires, tout en conservant du capital pour investir.",
    example:
      "Dividendes versés : 22 Mds$, Résultat net : 88 Mds$ → Payout = 25%. L'entreprise conserve 75% de ses bénéfices.",
    usedIn: ["Dividende (Soutenabilité, 35%)"],
    source: "SEC/EDGAR (dividends_paid / net_income).",
    warning:
      "Un payout > 100% signifie que l'entreprise verse plus en dividendes qu'elle ne gagne — non soutenable à long terme.",
  },
  {
    id: "dividend-growth",
    name: "Croissance historique du dividende",
    nameEn: "Historical Dividend Growth",
    category: "dividend",
    formula: "Score = (Nombre d'années avec dividende en hausse / Nombre total d'années - 1) × 100",
    unit: "Pourcentage (%) des années en hausse",
    interpretation:
      "Mesure la régularité de la croissance du dividende dans le temps. Un score élevé (> 80%) indique une entreprise qui augmente son dividende presque chaque année — signe de discipline financière et de confiance du management.",
    example:
      "Sur 10 ans, le dividende a augmenté 8 fois → Score = 8/9 × 100 = 89%.",
    usedIn: ["Dividende (Stabilité, 35%)"],
    source: "SEC/EDGAR (dividends_paid, historique annuel).",
  },
  {
    id: "fcf-coverage",
    name: "Couverture FCF du dividende",
    nameEn: "FCF Dividend Coverage",
    category: "dividend",
    formula: "Couverture = Free Cash Flow / Coût total du dividende",
    unit: "Multiple (sans unité)",
    interpretation:
      "Mesure combien de fois le cash flow libre couvre le dividende versé. Une couverture ≥ 2× signifie que l'entreprise génère deux fois plus de cash qu'elle n'en distribue — le dividende est très bien protégé.",
    example:
      "FCF : 74 Mds$, Coût du dividende : 22 Mds$ → Couverture = 3.4×. Excellente.",
    usedIn: ["Dividende (Soutenabilité, 35%)"],
    source: "FCF : SEC/EDGAR. Coût du dividende = Capitalisation × Yield.",
  },
  // --- Taille ---
  {
    id: "market-cap",
    name: "Capitalisation boursière (Market Cap)",
    nameEn: "Market Capitalization",
    category: "size",
    formula: "Market Cap = Cours de l'action × Nombre d'actions en circulation",
    unit: "Devise (USD)",
    interpretation:
      "Représente la valeur totale de l'entreprise sur le marché. Les grandes capitalisations (> 200 Mds$) sont généralement plus stables, les petites caps (< 10 Mds$) ont plus de potentiel de croissance mais plus de risque.",
    example:
      "Cours : 421$, Actions : 7.4 Mds → Market Cap = 3 115 Mds$. Mega-cap.",
    usedIn: ["Growth (Potentiel de croissance, 25%)"],
    source: "Cours : Yahoo Finance. Actions en circulation : SEC/EDGAR.",
  },
  // --- Fondamentaux bruts ---
  {
    id: "revenue",
    name: "Chiffre d'affaires (Revenue)",
    nameEn: "Revenue / Net Sales",
    category: "growth",
    formula: "Total des ventes de biens et services sur l'exercice fiscal",
    unit: "Devise (USD)",
    interpretation:
      "Représente le volume total d'activité de l'entreprise. C'est le point de départ de l'analyse fondamentale — sans revenus, pas de profit. La tendance du CA est plus importante que sa valeur absolue.",
    usedIn: ["Utilisé pour calculer la marge opérationnelle et la croissance CA"],
    source: "SEC/EDGAR (concepts : RevenueFromContractWithCustomer, SalesRevenueNet, Revenues).",
  },
  {
    id: "eps-diluted",
    name: "BPA dilué (EPS Diluted)",
    nameEn: "Diluted Earnings Per Share",
    category: "profitability",
    formula: "EPS dilué = Résultat net / Nombre d'actions diluées",
    unit: "Devise par action (USD/action)",
    interpretation:
      "Bénéfice net ramené au nombre total d'actions en circulation, incluant les stock-options et actions potentielles. C'est la mesure standard du bénéfice par action utilisée pour calculer le PER et le PEG.",
    example: "Résultat net : 88 Mds$, Actions diluées : 7.43 Mds → EPS = 11.86$.",
    usedIn: ["Utilisé pour calculer PER, PEG, croissance BPA"],
    source: "SEC/EDGAR (concept : EarningsPerShareDiluted).",
  },
];

function MetricCard({ metric }: { readonly metric: MetricDefinition }) {
  return (
    <article
      id={metric.id}
      className="rounded-xl border border-slate-200 bg-white p-6 scroll-mt-20"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{metric.name}</h3>
          <p className="text-xs text-slate-400">{metric.nameEn}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {metric.unit}
        </span>
      </div>

      {/* Formula */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
          Formule
        </p>
        <p className="text-sm font-mono text-slate-800">{metric.formula}</p>
      </div>

      {/* Interpretation */}
      <p className="text-sm text-slate-700 leading-relaxed mb-3">
        {metric.interpretation}
      </p>

      {/* Example */}
      {metric.example && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 mb-3">
          <p className="text-xs font-semibold text-indigo-600 mb-0.5">
            Exemple concret
          </p>
          <p className="text-sm text-indigo-800">{metric.example}</p>
        </div>
      )}

      {/* Used in strategies */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {metric.usedIn.map((use) => (
          <span
            key={use}
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
          >
            {use}
          </span>
        ))}
      </div>

      {/* Source */}
      <p className="text-xs text-slate-400">
        <span className="font-medium">Source :</span> {metric.source}
      </p>

      {/* Warning */}
      {metric.warning && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Attention :</span> {metric.warning}
          </p>
        </div>
      )}
    </article>
  );
}

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
        Glossaire des métriques financières
      </h1>
      <p className="text-lg text-slate-600 mb-4 max-w-2xl">
        Définitions précises de toutes les grandeurs utilisées dans les scores
        StockScanner. Chaque métrique inclut sa formule, son interprétation, un
        exemple concret et les stratégies qui l&apos;utilisent.
      </p>
      <p className="text-sm text-slate-500 mb-8">
        <Link
          href="/strategies"
          className="text-brand-600 hover:text-brand-700 transition-colors font-medium"
        >
          Voir le détail du calcul des scores par stratégie &rarr;
        </Link>
      </p>

      {/* Table of contents */}
      <nav className="rounded-xl border border-slate-200 bg-white p-6 mb-10">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Sommaire
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const catMetrics = METRICS.filter((m) => m.category === cat.id);
            if (catMetrics.length === 0) return null;
            return (
              <div key={cat.id}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase mb-1.5">
                  {cat.label}
                </h3>
                <ul className="space-y-1">
                  {catMetrics.map((m) => (
                    <li key={m.id}>
                      <a
                        href={`#${m.id}`}
                        className="text-sm text-brand-600 hover:text-brand-700 transition-colors"
                      >
                        {m.name.split(" (")[0]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Metrics by category */}
      {CATEGORIES.map((cat) => {
        const catMetrics = METRICS.filter((m) => m.category === cat.id);
        if (catMetrics.length === 0) return null;
        return (
          <section key={cat.id} className="mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {cat.label}
            </h2>
            <div className="space-y-4">
              {catMetrics.map((m) => (
                <MetricCard key={m.id} metric={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
