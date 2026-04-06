import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stratégies d'investissement — Comment sont calculés les scores",
  description:
    "Découvrez en détail comment StockScanner calcule les scores des 4 stratégies : Warren Buffett, Peter Lynch, Growth et Dividende. Métriques, pondérations, formules et plages de normalisation.",
  alternates: { canonical: "/strategies" },
};

interface MetricDetail {
  readonly name: string;
  readonly weight: string;
  readonly range: string;
  readonly note?: string;
}

interface SubScoreDetail {
  readonly name: string;
  readonly label: string;
  readonly weight: string;
  readonly metrics: readonly MetricDetail[];
  readonly note?: string;
}

interface StrategyDetail {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly color: string;
  readonly accentColor: string;
  readonly philosophy: string;
  readonly totalFormula: string;
  readonly subScores: readonly SubScoreDetail[];
  readonly sectorAdjustment?: string;
  readonly historicalNote: string;
}

const STRATEGIES: readonly StrategyDetail[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    subtitle: "Qualité et valeur",
    color: "border-indigo-200 bg-indigo-50",
    accentColor: "bg-indigo-600",
    philosophy:
      "Identifier les entreprises de qualité avec un avantage compétitif durable, une rentabilité forte, un cash flow abondant et une dette maîtrisée. La valorisation doit rester raisonnable : un bon business acheté à un prix correct.",
    totalFormula: "Score = Qualité × 40% + Solidité × 30% + Valorisation × 30%",
    subScores: [
      {
        name: "quality",
        label: "Qualité",
        weight: "40%",
        metrics: [
          { name: "ROE", weight: "40%", range: "0% → 40% (linéaire)", note: "Ajusté par secteur" },
          { name: "Marge opérationnelle", weight: "35%", range: "0% → 40% (linéaire)", note: "Ajusté par secteur" },
          { name: "FCF Yield", weight: "25%", range: "0% → 10% (linéaire)", note: "FCF Yield = Free Cash Flow / Capitalisation × 100" },
        ],
      },
      {
        name: "strength",
        label: "Solidité financière",
        weight: "30%",
        metrics: [
          { name: "Dette / Capitaux propres", weight: "60%", range: "3 → 0 (inversé : bas = bon)" },
          { name: "Free Cash Flow positif", weight: "40%", range: "Binaire : 100 si FCF > 0, 10 sinon" },
        ],
      },
      {
        name: "valuation",
        label: "Valorisation",
        weight: "30%",
        metrics: [
          { name: "PER (Price/Earnings)", weight: "100%", range: "50 → 10 (inversé : bas = bon)", note: "Ajusté par secteur" },
        ],
      },
    ],
    sectorAdjustment:
      "Le ROE, la marge opérationnelle et le PER sont comparés aux médianes du secteur de l'action. Un ROE de 15% est excellent pour une banque mais moyen pour une entreprise tech. L'ajustement sectoriel corrige ce biais.",
    historicalNote:
      "Le score historique couvre 100% des sous-scores quand les prix de marché sont disponibles. Sans prix (années anciennes), la valorisation (PER) est exclue (couverture 70%).",
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    subtitle: "Croissance à prix raisonnable (GARP)",
    color: "border-emerald-200 bg-emerald-50",
    accentColor: "bg-emerald-600",
    philosophy:
      "Rechercher des entreprises en croissance dont le prix reste raisonnable par rapport à leur potentiel de bénéfices. Le ratio PEG est la clé : une croissance solide qui n'est pas encore entièrement reflétée dans le cours.",
    totalFormula: "Score = Croissance × 40% + Valeur × 35% + Qualité × 25%",
    subScores: [
      {
        name: "growth",
        label: "Croissance",
        weight: "40%",
        metrics: [
          { name: "Croissance BPA (EPS Growth)", weight: "60%", range: "-5% → 40% (linéaire)" },
          { name: "Croissance CA (Revenue Growth)", weight: "40%", range: "-5% → 35% (linéaire)" },
        ],
      },
      {
        name: "value",
        label: "Valeur (PEG)",
        weight: "35%",
        metrics: [
          { name: "PEG Ratio", weight: "100%", range: "4 → 0.5 (inversé : bas = bon)", note: "PEG = PER / Croissance BPA. Un PEG < 1 signifie que la croissance n'est pas encore payée dans le cours." },
        ],
      },
      {
        name: "quality",
        label: "Qualité",
        weight: "25%",
        metrics: [
          { name: "Marge opérationnelle", weight: "50%", range: "0% → 40% (linéaire)" },
          { name: "Dette / Capitaux propres", weight: "50%", range: "3 → 0 (inversé)" },
        ],
      },
    ],
    historicalNote:
      "Le PEG historique est approximé à partir de la croissance BPA annuelle (pas une projection analyste). Cette stratégie est naturellement volatile car le PEG combine prix de marché et croissance, deux variables qui fluctuent fortement.",
  },
  {
    id: "growth",
    name: "Growth",
    subtitle: "Croissance agressive",
    color: "border-violet-200 bg-violet-50",
    accentColor: "bg-violet-600",
    philosophy:
      "Cibler les entreprises à forte croissance de revenus et de bénéfices, avec un momentum fondamental fort. La valorisation est secondaire : on mise sur les entreprises qui capturent des marchés en expansion rapide.",
    totalFormula: "Score = Momentum × 50% + Rentabilité × 25% + Potentiel × 25%",
    subScores: [
      {
        name: "momentum",
        label: "Momentum de croissance",
        weight: "50%",
        metrics: [
          { name: "Croissance CA", weight: "50%", range: "-5% → 35% (linéaire)" },
          { name: "Croissance BPA", weight: "50%", range: "-5% → 40% (linéaire)" },
        ],
      },
      {
        name: "profitability",
        label: "Rentabilité",
        weight: "25%",
        metrics: [
          { name: "Marge opérationnelle", weight: "50%", range: "0% → 40% (linéaire)" },
          { name: "ROE", weight: "50%", range: "0% → 40% (linéaire)" },
        ],
      },
      {
        name: "scalability",
        label: "Potentiel de croissance",
        weight: "25%",
        metrics: [
          { name: "Capitalisation boursière", weight: "100%", range: "3 000 Mds → 10 Mds (inversé : petite cap = meilleur)", note: "Les entreprises de plus petite taille ont plus de marge de croissance." },
        ],
      },
    ],
    historicalNote:
      "Le score historique couvre 100% quand la capitalisation est calculable (prix × actions en circulation). Sans prix, le potentiel de croissance est exclu (couverture 75%).",
  },
  {
    id: "dividend",
    name: "Dividende",
    subtitle: "Rendement et stabilité",
    color: "border-amber-200 bg-amber-50",
    accentColor: "bg-amber-600",
    philosophy:
      "Sélectionner les entreprises offrant un dividende attractif, soutenable et en croissance. L'objectif : générer des revenus réguliers et préserver le capital grâce à des dividendes fiables, bien couverts par le cash flow et historiquement en progression.",
    totalFormula: "Score = Rendement × 30% + Soutenabilité × 35% + Stabilité × 35%",
    subScores: [
      {
        name: "yield",
        label: "Rendement",
        weight: "30%",
        metrics: [
          { name: "Rendement du dividende (Dividend Yield)", weight: "100%", range: "0% → 6% (linéaire)" },
        ],
      },
      {
        name: "sustainability",
        label: "Soutenabilité",
        weight: "35%",
        metrics: [
          { name: "Payout Ratio", weight: "50%", range: "Zone optimale 30%–60% (score 100), décroît en dehors", note: "Un payout trop bas (< 30%) peut indiquer un manque d'engagement, trop haut (> 60%) un risque de coupe." },
          { name: "Couverture FCF du dividende", weight: "50%", range: "Barèmes : ≥ 2.5× → 100, ≥ 1.5× → 80, ≥ 1× → 55, ≥ 0.5× → 25, < 0.5× → 5", note: "Couverture = Free Cash Flow / Coût total du dividende" },
        ],
      },
      {
        name: "stability",
        label: "Stabilité",
        weight: "35%",
        metrics: [
          { name: "Dette / Capitaux propres", weight: "40%", range: "3 → 0 (inversé)" },
          { name: "Croissance historique du dividende", weight: "60%", range: "% d'années avec dividende en hausse × 100", note: "Basé sur l'historique réel du dividende par action." },
        ],
      },
    ],
    historicalNote:
      "Le score historique est complet quand le rendement est calculable (dividende/cours). La croissance historique du dividende utilise les données SEC sur les dividendes versés par année.",
  },
];

function SubScoreCard({ sub, accentColor }: { readonly sub: SubScoreDetail; readonly accentColor: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-2 w-2 rounded-full ${accentColor}`} />
        <h4 className="text-sm font-bold text-slate-800">
          {sub.label}
        </h4>
        <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
          {sub.weight}
        </span>
      </div>
      <div className="space-y-2.5">
        {sub.metrics.map((m) => (
          <div key={m.name} className="text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-slate-700">{m.name}</span>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                Poids : {m.weight}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Plage : {m.range}
            </p>
            {m.note && (
              <p className="text-xs text-slate-400 italic mt-0.5">
                {m.note}
              </p>
            )}
          </div>
        ))}
      </div>
      {sub.note && (
        <p className="text-xs text-slate-400 mt-3 italic">{sub.note}</p>
      )}
    </div>
  );
}

export default function StrategiesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
        Stratégies d&apos;investissement
      </h1>
      <p className="text-lg text-slate-600 mb-4 max-w-2xl">
        StockScanner classe chaque action selon 4 approches d&apos;investissement
        reconnues. Chaque score est calculé sur 100 points à partir de
        sous-scores pondérés.
      </p>
      <p className="text-sm text-slate-500 mb-4 max-w-2xl">
        Chaque métrique est normalisée sur une plage définie (0 = pire, 100 = meilleur)
        par interpolation linéaire. Les métriques inversées (dette, PER, PEG) attribuent
        un meilleur score aux valeurs basses. Le score final est la moyenne pondérée
        des sous-scores.
      </p>
      <p className="text-sm text-slate-500 mb-12">
        <Link
          href="/glossary"
          className="text-brand-600 hover:text-brand-700 transition-colors font-medium"
        >
          Voir le glossaire des métriques financières (PER, PEG, ROE, etc.) &rarr;
        </Link>
      </p>

      <div className="space-y-12">
        {STRATEGIES.map((s) => (
          <article
            key={s.id}
            id={s.id}
            className={`rounded-2xl border p-8 ${s.color}`}
          >
            {/* Header */}
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {s.name}
            </h2>
            <p className="text-sm font-medium text-slate-500 mb-4">
              {s.subtitle}
            </p>

            {/* Philosophy */}
            <p className="text-sm leading-relaxed text-slate-700 mb-6">
              {s.philosophy}
            </p>

            {/* Formula */}
            <div className="rounded-lg bg-white/70 border border-slate-200 px-4 py-3 mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Formule du score
              </p>
              <p className="text-sm font-mono text-slate-800">
                {s.totalFormula}
              </p>
            </div>

            {/* Sub-scores detail */}
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Détail des sous-scores
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
              {s.subScores.map((sub) => (
                <SubScoreCard
                  key={sub.name}
                  sub={sub}
                  accentColor={s.accentColor}
                />
              ))}
            </div>

            {/* Sector adjustment */}
            {s.sectorAdjustment && (
              <div className="rounded-lg bg-white/60 border border-slate-200 px-4 py-3 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ajustement sectoriel
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {s.sectorAdjustment}
                </p>
              </div>
            )}

            {/* Historical note */}
            <div className="rounded-lg bg-white/60 border border-slate-200 px-4 py-3 mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Score historique
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                {s.historicalNote}
              </p>
            </div>

            {/* CTA */}
            <Link
              href={`/scanner?strategy=${s.id}`}
              className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              Voir le classement {s.name} &rarr;
            </Link>
          </article>
        ))}
      </div>

      {/* Global methodology note */}
      <div className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-3">
          Méthodologie générale
        </h2>
        <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
          <p>
            <strong>Normalisation</strong> — Chaque métrique est convertie en un score
            de 0 à 100 par interpolation linéaire entre un minimum (score 0) et un
            maximum (score 100). Les valeurs en dehors de la plage sont plafonnées.
          </p>
          <p>
            <strong>Métriques inversées</strong> — Pour les métriques où une valeur basse
            est souhaitable (PER, dette/equity, PEG), la plage est inversée : la valeur
            haute donne 0 et la valeur basse donne 100.
          </p>
          <p>
            <strong>Zone optimale</strong> — Le payout ratio utilise une normalisation
            par zone optimale : score 100 dans la zone [30%–60%], décroissant
            linéairement en dehors.
          </p>
          <p>
            <strong>Ajustement sectoriel</strong> — Certaines métriques (ROE, marge, PER)
            sont ajustées en fonction de la médiane du secteur de l&apos;action. Cela évite de
            pénaliser des secteurs structurellement différents (ex : les banques ont
            naturellement des marges plus faibles que les entreprises tech).
          </p>
          <p>
            <strong>Score historique</strong> — Les scores historiques combinent les
            fondamentaux annuels SEC/EDGAR avec les prix historiques Yahoo Finance pour
            calculer les métriques de marché (PER, rendement, PEG, capitalisation). Sans
            prix de marché, seuls les sous-scores fondamentaux sont calculés.
          </p>
          <p>
            <strong>Confiance</strong> — Chaque score est accompagné d&apos;un indicateur de
            confiance (élevée, moyenne, faible) basé sur la complétude des données
            disponibles pour l&apos;action.
          </p>
        </div>
      </div>
    </div>
  );
}
