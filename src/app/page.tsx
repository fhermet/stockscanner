import { STRATEGIES } from "@/lib/strategies";
import StrategyCard from "@/components/strategy-card";
import TopOpportunities from "@/components/top-opportunities";
import DailyDigest from "@/components/daily-digest";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Choisis une strategie,{" "}
          <span className="text-brand-600">on te montre les actions</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          Analyse fondamentale simplifiee. Choisis parmi 4 approches
          d&apos;investissement eprouvees et decouvre les actions les mieux
          classees pour chaque strategie.
        </p>
      </div>

      {/* Strategy cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {STRATEGIES.map((strategy) => (
          <StrategyCard key={strategy.id} strategy={strategy} />
        ))}
      </div>

      {/* Daily Digest (alerts) */}
      <div className="mt-12">
        <DailyDigest />
      </div>

      {/* Top Opportunities */}
      <div className="mt-12">
        <TopOpportunities />
      </div>

      {/* How it works */}
      <div className="mt-24 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-10">
          Comment ca marche ?
        </h2>
        <div className="grid gap-8 sm:grid-cols-3 max-w-3xl mx-auto">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold mx-auto mb-3">
              1
            </div>
            <h3 className="font-semibold text-slate-900">
              Choisis ta strategie
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Buffett, Lynch, Growth ou Dividende. Chaque mode a ses propres
              criteres de selection.
            </p>
          </div>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold mx-auto mb-3">
              2
            </div>
            <h3 className="font-semibold text-slate-900">
              Decouvre le classement
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Les actions sont scorees et classees selon leur compatibilite avec
              la strategie choisie.
            </p>
          </div>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold mx-auto mb-3">
              3
            </div>
            <h3 className="font-semibold text-slate-900">
              Comprends pourquoi
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Chaque action a une explication claire sur ses forces et ses
              faiblesses dans le contexte de la strategie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
