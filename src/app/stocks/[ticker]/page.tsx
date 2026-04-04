import { notFound } from "next/navigation";
import Link from "next/link";
import { getDataProvider, getMeta } from "@/lib/data";
import { isValidStrategyId, getStrategy } from "@/lib/strategies";
import "@/lib/scoring/strategies/buffett";
import "@/lib/scoring/strategies/lynch";
import "@/lib/scoring/strategies/growth";
import "@/lib/scoring/strategies/dividend";
import { scoreStock } from "@/lib/scoring/engine";
import ScoreBadge from "@/components/ui/score-badge";
import ScoreGauge from "@/components/ui/score-gauge";
import MetricCard from "@/components/ui/metric-card";
import ExplanationList from "@/components/ui/explanation-list";
import ConfidenceBadge from "@/components/ui/confidence-badge";
import DataSourceBadge from "@/components/ui/data-source-badge";
import WatchlistButton from "@/components/watchlist-button";
import ScoreHistoryPanel from "@/components/score-history-panel";
import { formatMarketCap, formatPrice } from "@/lib/format";

interface PageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ strategy?: string }>;
}

export default async function StockDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { ticker } = await params;
  const { strategy: strategyParam } = await searchParams;

  const strategyId =
    strategyParam && isValidStrategyId(strategyParam)
      ? strategyParam
      : "buffett";

  const provider = getDataProvider();
  const stock = await provider.getStock(ticker);
  if (!stock) notFound();

  const score = scoreStock(stock, strategyId);
  const strategy = getStrategy(strategyId);
  const meta = getMeta();

  const positiveExplanations = score.explanations.filter(
    (e) => e.type === "positive"
  );
  const negativeExplanations = score.explanations.filter(
    (e) => e.type === "negative"
  );
  const neutralExplanations = score.explanations.filter(
    (e) => e.type === "neutral"
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/scanner" className="hover:text-slate-900 transition-colors">
          Scanner
        </Link>
        <span>/</span>
        <Link
          href={`/scanner?strategy=${strategyId}`}
          className="hover:text-slate-900 transition-colors"
        >
          {strategy.name}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">{stock.ticker}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900">
              {stock.ticker}
            </h1>
            <WatchlistButton ticker={stock.ticker} size="md" />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {stock.exchange}
            </span>
          </div>
          <p className="mt-1 text-lg text-slate-500">{stock.name}</p>
          <p className="text-sm text-slate-400">
            {stock.sector} &middot; {stock.country} &middot; {stock.exchange} &middot; {stock.currency}
          </p>
          <div className="mt-2">
            <DataSourceBadge meta={meta} />
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-slate-900">
            {formatPrice(stock.price, stock.currency)}
          </p>
          <div className="mt-2">
            <ScoreBadge score={score.total} size="lg" />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Score strategie {strategy.name}
          </p>
          <div className="mt-2">
            <ConfidenceBadge
              confidence={score.confidence}
              completeness={score.dataCompleteness}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Scores + Explanations */}
        <div className="lg:col-span-2 space-y-8">
          {/* Sub-scores */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Decomposition du score
            </h2>
            <div className="space-y-4">
              {score.subScores.map((sub) => (
                <div key={sub.name}>
                  <ScoreGauge score={sub.value} label={sub.label} />
                  <p className="mt-0.5 text-xs text-slate-400">
                    Poids : {Math.round(sub.weight * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Score history */}
          <ScoreHistoryPanel
            ticker={stock.ticker}
            strategyId={strategyId}
            currentScore={score.total}
            currentSubScores={score.subScores}
          />

          {/* Explanation */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Pourquoi cette action correspond a la strategie {strategy.name} ?
            </h2>

            {positiveExplanations.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-emerald-700 mb-2">
                  Points forts
                </h3>
                <ExplanationList explanations={positiveExplanations} />
              </div>
            )}

            {neutralExplanations.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-slate-600 mb-2">
                  Points neutres
                </h3>
                <ExplanationList explanations={neutralExplanations} />
              </div>
            )}

            {negativeExplanations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-600 mb-2">
                  Points d&apos;attention
                </h3>
                <ExplanationList explanations={negativeExplanations} />
              </div>
            )}

            {score.dataCompleteness.missing.length > 0 && (
              <div className="mt-5">
                <ConfidenceBadge
                  confidence={score.confidence}
                  completeness={score.dataCompleteness}
                  showDetail
                />
              </div>
            )}
          </section>

          {/* History */}
          {stock.history.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                Historique simplifie
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left font-semibold text-slate-600">
                        Annee
                      </th>
                      <th className="py-2 text-right font-semibold text-slate-600">
                        CA (M$)
                      </th>
                      <th className="py-2 text-right font-semibold text-slate-600">
                        BPA
                      </th>
                      <th className="py-2 text-right font-semibold text-slate-600">
                        Div/action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.history.map((h) => (
                      <tr
                        key={h.year}
                        className="border-b border-slate-100"
                      >
                        <td className="py-2 font-medium text-slate-900">
                          {h.year}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {h.revenue.toLocaleString("fr-FR")}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          ${h.eps.toFixed(2)}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {h.dividendPerShare > 0
                            ? `$${h.dividendPerShare.toFixed(2)}`
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Right: Metrics sidebar */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Metriques cles
          </h2>
          <MetricCard
            label="Market Cap"
            value={formatMarketCap(stock.marketCap, stock.currency)}
          />
          <MetricCard label="PER" value={String(stock.per)} />
          <MetricCard label="PEG" value={String(stock.peg)} />
          <MetricCard label="ROE" value={`${stock.roe}%`} />
          <MetricCard
            label="Dette / Capitaux propres"
            value={String(stock.debtToEquity)}
          />
          <MetricCard
            label="Marge operationnelle"
            value={`${stock.operatingMargin}%`}
          />
          <MetricCard
            label="Free Cash Flow"
            value={`${stock.freeCashFlow} Mds ${stock.currency}`}
          />
          <MetricCard
            label="Croissance CA"
            value={`+${stock.revenueGrowth}%`}
          />
          <MetricCard
            label="Croissance BPA"
            value={`+${stock.epsGrowth}%`}
          />
          <MetricCard
            label="Rendement dividende"
            value={
              stock.dividendYield > 0
                ? `${stock.dividendYield}%`
                : "Aucun"
            }
          />
          <MetricCard
            label="Payout Ratio"
            value={
              stock.payoutRatio > 0
                ? `${stock.payoutRatio}%`
                : "N/A"
            }
          />

          <div className="pt-4">
            <Link
              href={`/scanner?strategy=${strategyId}`}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors w-full"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Retour au scanner
            </Link>
            <Link
              href={`/compare?tickers=${stock.ticker}&strategy=${strategyId}`}
              className="flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors w-full"
            >
              Comparer avec...
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
