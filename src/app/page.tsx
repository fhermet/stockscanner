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
          Choisis une stratégie,{" "}
          <span className="text-brand-600">on te montre les actions</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          Analyse fondamentale simplifiée. Choisis parmi 4 approches
          d&apos;investissement éprouvées et découvre les actions les mieux
          classées pour chaque stratégie.
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
          Comment ça marche ?
        </h2>
        <div className="grid gap-8 sm:grid-cols-3 max-w-3xl mx-auto">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold mx-auto mb-3">
              1
            </div>
            <h3 className="font-semibold text-slate-900">
              Choisis ta stratégie
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Warren Buffett, Peter Lynch, Growth ou Dividende. Chaque mode a ses propres
              critères de sélection.
            </p>
          </div>
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold mx-auto mb-3">
              2
            </div>
            <h3 className="font-semibold text-slate-900">
              Découvre le classement
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Les actions sont scorées et classées selon leur compatibilité avec
              la stratégie choisie.
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
              faiblesses dans le contexte de la stratégie.
            </p>
          </div>
        </div>
      </div>

      {/* SEO content block */}
      <section className="mt-24 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
          Un stock screener orienté décision
        </h2>
        <div className="space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            StockScanner est un outil d&apos;analyse fondamentale qui classe les actions
            selon des stratégies d&apos;investissement éprouvées. Au lieu de filtrer
            manuellement des centaines de ratios financiers, choisissez une approche
            — Warren Buffett, Peter Lynch, Growth ou Dividende — et découvrez instantanément
            quelles actions y correspondent le mieux.
          </p>
          <p>
            L&apos;univers couvre les principaux indices boursiers mondiaux :
            S&amp;P 500, NASDAQ 100, Dow Jones, CAC 40, DAX 40, FTSE 100,
            SMI et STOXX Europe 50. Chaque action reçoit un score sur 100,
            décomposé en sous-scores pondérés (qualité, valorisation, croissance,
            solidité financière) avec une explication en langage naturel des
            forces et faiblesses identifiées.
          </p>
          <p>
            Les données fondamentales historiques proviennent de la SEC/EDGAR
            (bilans, comptes de résultat, cash flows sur 10 à 15 ans pour les
            entreprises US du S&amp;P 500). Les données de marché (cours, capitalisation)
            sont issues de Yahoo Finance. Cette double source permet de calculer
            des scores historiques complets et de simuler des stratégies passées.
          </p>
          <p>
            Comparez plusieurs actions côte à côte, suivez vos favorites dans une
            watchlist, simulez un backtest sur vos stratégies préférées, et recevez
            des alertes quand un score évolue significativement.
          </p>
        </div>
      </section>
    </div>
  );
}
