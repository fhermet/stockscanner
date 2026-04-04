import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stratégies d'investissement",
  description:
    "Découvrez 4 stratégies d'investissement : Warren Buffett (qualité-valeur), Peter Lynch (croissance raisonnable), Growth (croissance agressive) et Dividende (rendement stable).",
  alternates: { canonical: "/strategies" },
};

const STRATEGIES = [
  {
    id: "buffett",
    name: "Warren Buffett",
    subtitle: "Qualité et valeur",
    color: "border-indigo-200 bg-indigo-50",
    description:
      "La stratégie Buffett identifie les entreprises de qualité avec un avantage compétitif durable, une rentabilité forte (ROE élevé, marges solides), un cash flow abondant et une dette maîtrisée. La valorisation doit rester raisonnable : un bon business acheté à un prix correct.",
    metrics: ["ROE", "Marge opérationnelle", "Free Cash Flow", "Dette/Capitaux propres", "PER"],
    scoring: "3 axes : Qualité (40%), Solidité financière (30%), Valorisation (30%). Le score intègre un ajustement sectoriel pour ne pas pénaliser les secteurs structurellement différents.",
  },
  {
    id: "lynch",
    name: "Peter Lynch",
    subtitle: "Croissance à prix raisonnable (GARP)",
    color: "border-emerald-200 bg-emerald-50",
    description:
      "La stratégie Peter Lynch recherche des entreprises en croissance dont le prix reste raisonnable par rapport à leur potentiel de bénéfices. Le ratio PEG (Price/Earnings to Growth) est la clé : une croissance solide qui n'est pas encore entièrement reflétée dans le cours.",
    metrics: ["PEG", "Croissance BPA", "Croissance CA", "Marge opérationnelle", "Dette"],
    scoring: "3 axes : Croissance (40%), Valeur-PEG (35%), Qualité (25%). Privilégie les entreprises capables de croître durablement sans survalorisation.",
  },
  {
    id: "growth",
    name: "Growth",
    subtitle: "Croissance agressive",
    color: "border-violet-200 bg-violet-50",
    description:
      "La stratégie Growth cible les entreprises à forte croissance de revenus et de bénéfices, avec un momentum fondamental fort. La valorisation est secondaire : on mise sur les entreprises qui capturent des marchés en expansion rapide, même si le prix semble élevé aujourd'hui.",
    metrics: ["Croissance CA", "Croissance BPA", "Marge opérationnelle", "ROE", "Capitalisation"],
    scoring: "3 axes : Momentum de croissance (50%), Rentabilité (25%), Potentiel de croissance (25%). Les petites et moyennes capitalisations reçoivent un bonus de potentiel.",
  },
  {
    id: "dividend",
    name: "Dividende",
    subtitle: "Rendement et stabilité",
    color: "border-amber-200 bg-amber-50",
    description:
      "La stratégie Dividende sélectionne les entreprises offrant un dividende attractif, soutenable et en croissance. L'objectif est de générer des revenus réguliers et de préserver le capital grâce à des dividendes fiables, bien couverts par le cash flow et historiquement en progression.",
    metrics: ["Rendement dividende", "Payout Ratio", "Free Cash Flow", "Dette/Capitaux", "Historique"],
    scoring: "3 axes : Rendement (30%), Soutenabilité (35%), Stabilité (35%). Le payout ratio optimal est entre 30% et 60%.",
  },
];

export default function StrategiesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-4">
        Stratégies d&apos;investissement
      </h1>
      <p className="text-lg text-slate-600 mb-12 max-w-2xl">
        StockScanner classe chaque action selon 4 approches d&apos;investissement
        reconnues. Chaque stratégie a ses propres critères, pondérations et
        métriques clés.
      </p>

      <div className="space-y-10">
        {STRATEGIES.map((s) => (
          <article
            key={s.id}
            className={`rounded-2xl border p-8 ${s.color}`}
          >
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {s.name}
            </h2>
            <p className="text-sm font-medium text-slate-500 mb-4">
              {s.subtitle}
            </p>
            <p className="text-sm leading-relaxed text-slate-700 mb-6">
              {s.description}
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Métriques clés
                </h3>
                <ul className="space-y-1">
                  {s.metrics.map((m) => (
                    <li key={m} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Composition du score
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {s.scoring}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href={`/scanner?strategy=${s.id}`}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
              >
                Voir le classement {s.name} →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
