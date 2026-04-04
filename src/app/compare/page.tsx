"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import { compareStocks, ComparisonResult, ComparedMetric } from "@/lib/scoring/compare";
import ScoreBadge from "@/components/ui/score-badge";
import { formatPrice, formatMarketCap } from "@/lib/format";

const MAX_TICKERS = 4;

const STRATEGY_OPTIONS: { id: StrategyId; label: string }[] = [
  { id: "buffett", label: "Buffett" },
  { id: "lynch", label: "Lynch" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividende" },
];

const CONFIDENCE_LABELS: Record<string, { text: string; color: string }> = {
  high: { text: "Elevee", color: "text-emerald-600" },
  medium: { text: "Moyenne", color: "text-amber-600" },
  low: { text: "Faible", color: "text-red-500" },
};

function CellHighlight({
  ticker, best, worst, isNA, children,
}: {
  ticker: string; best: string | null; worst: string | null; isNA: boolean; children: React.ReactNode;
}) {
  if (isNA) return <td className="px-4 py-2.5 text-center text-sm text-slate-300 italic">N/A</td>;
  const isBest = best !== null && ticker === best;
  const isWorst = worst !== null && ticker === worst && best !== worst;
  return (
    <td className={`px-4 py-2.5 text-center text-sm font-medium ${isBest ? "bg-emerald-50 text-emerald-700" : isWorst ? "bg-red-50 text-red-500" : "text-slate-700"}`}>
      {children}
    </td>
  );
}

function ComparisonTable({ title, metrics, tickers }: { title: string; metrics: readonly ComparedMetric[]; tickers: readonly string[] }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="py-2 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{title}</th>
            {tickers.map((t) => <th key={t} className="py-2 text-center text-xs font-semibold text-slate-700 whitespace-nowrap">{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.key} className="border-b border-slate-100">
              <td className="py-2.5 text-sm text-slate-600 whitespace-nowrap pr-4">
                {m.label}{m.isPartial && <span className="ml-1 text-[10px] text-amber-500" title="Donnees partielles">*</span>}
              </td>
              {m.values.map((v) => (
                <CellHighlight key={v.ticker} ticker={v.ticker} best={m.bestTicker} worst={m.worstTicker} isNA={v.value === null}>
                  {v.formatted}
                </CellHighlight>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tickersParam = searchParams.get("tickers") ?? "";
  const strategyParam = searchParams.get("strategy") ?? "buffett";

  const [tickers, setTickers] = useState<string[]>(
    tickersParam
      ? tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, MAX_TICKERS)
      : []
  );
  const [strategyId, setStrategyId] = useState<StrategyId>(isValidStrategyId(strategyParam) ? strategyParam : "buffett");
  const [input, setInput] = useState("");
  const [stocks, setStocks] = useState<ScoredStock[]>([]);
  const [failedTickers, setFailedTickers] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const updateUrl = useCallback((t: string[], s: StrategyId) => {
    if (t.length > 0) router.push(`/compare?tickers=${t.join(",")}&strategy=${s}`, { scroll: false });
  }, [router]);

  const fetchStocks = useCallback(async () => {
    if (tickers.length < 2) { setStocks([]); setComparison(null); setFailedTickers([]); return; }
    setLoading(true);
    setFailedTickers([]);
    const results: ScoredStock[] = [];
    const failed: string[] = [];
    for (const ticker of tickers) {
      try {
        const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}?strategy=${strategyId}`);
        if (!res.ok) { failed.push(ticker); continue; }
        const data = await res.json();
        results.push({ stock: data.stock, score: data.score });
      } catch { failed.push(ticker); }
    }
    setStocks(results);
    setFailedTickers(failed);
    if (results.length >= 2) setComparison(compareStocks(results, strategyId));
    else setComparison(null);
    setLoading(false);
  }, [tickers, strategyId]);

  useEffect(() => { fetchStocks(); }, [fetchStocks]);

  const addTicker = () => {
    const t = input.trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= MAX_TICKERS) return;
    const next = [...tickers, t];
    setTickers(next); setInput(""); updateUrl(next, strategyId);
  };

  const removeTicker = (t: string) => {
    const next = tickers.filter((x) => x !== t);
    setTickers(next);
    if (next.length > 0) updateUrl(next, strategyId);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Comparateur</h1>
      <p className="text-sm text-slate-500 mb-6">Comparez 2 a 4 actions selon une strategie</p>

      <div className="mb-4 flex items-center gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="Ajouter un ticker (ex: AAPL)" disabled={tickers.length >= MAX_TICKERS}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none w-48" />
        <button onClick={addTicker} disabled={!input.trim() || tickers.length >= MAX_TICKERS}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors">
          Ajouter
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tickers.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700">
            {t}
            <button onClick={() => removeTicker(t)} className="ml-1 text-slate-400 hover:text-red-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
        {tickers.length < 2 && <span className="text-xs text-slate-400 self-center">Ajoutez au moins 2 tickers</span>}
      </div>

      {failedTickers.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
          <p className="text-sm text-red-700">
            Impossible de charger : {failedTickers.join(", ")}
          </p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {STRATEGY_OPTIONS.map((s) => (
          <button key={s.id} onClick={() => { setStrategyId(s.id); updateUrl(tickers, s.id); }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${strategyId === s.id ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600" /></div>}

      {comparison && !loading && (
        <div className="space-y-6">
          {/* Summary */}
          <div className={`rounded-xl border p-5 ${comparison.isTie ? "border-amber-200 bg-amber-50" : "border-brand-200 bg-brand-50"}`}>
            <h2 className={`text-sm font-semibold mb-2 ${comparison.isTie ? "text-amber-900" : "text-brand-900"}`}>
              {comparison.isTie ? "Match serre" : "Qui gagne ?"}
            </h2>
            <p className={`text-sm leading-relaxed ${comparison.isTie ? "text-amber-800" : "text-brand-800"}`}>{comparison.summary}</p>
          </div>

          {/* Warnings */}
          {comparison.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              {comparison.warnings.map((w, i) => <p key={i} className="text-xs text-amber-700">{w}</p>)}
            </div>
          )}

          {/* Score cards with confidence */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Scores</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {[...stocks].sort((a, b) => b.score.total - a.score.total).map((s, i) => {
                const conf = CONFIDENCE_LABELS[s.score.confidence] ?? CONFIDENCE_LABELS.high;
                const isWinner = !comparison.isTie && i === 0;
                return (
                  <div key={s.stock.ticker} className={`rounded-xl border p-4 text-center ${isWinner ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"}`}>
                    {isWinner && <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider">Meilleur</span>}
                    {comparison.isTie && i < 2 && <span className="text-[10px] font-bold uppercase text-amber-600 tracking-wider">Ex aequo</span>}
                    <Link href={`/stocks/${s.stock.ticker}?strategy=${strategyId}`}>
                      <h3 className="text-lg font-bold text-slate-900 hover:text-brand-600 transition-colors">{s.stock.ticker}</h3>
                    </Link>
                    <p className="text-xs text-slate-500 truncate">{s.stock.name}</p>
                    <div className="mt-2"><ScoreBadge score={s.score.total} size="md" /></div>
                    <div className="mt-2 space-y-0.5">
                      <p className="text-[11px]">Confiance : <span className={`font-medium ${conf.color}`}>{conf.text}</span></p>
                      <p className="text-[11px] text-slate-400">Donnees : {s.score.dataCompleteness.score}%</p>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatPrice(s.stock.price, s.stock.currency)} &middot; {formatMarketCap(s.stock.marketCap, s.stock.currency)}
                    </p>
                    <button onClick={() => removeTicker(s.stock.ticker)} className="mt-2 text-[10px] text-slate-400 hover:text-red-500 transition-colors">Retirer</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-scores */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sous-scores</h2>
            <ComparisonTable title="Axe" metrics={comparison.subScoreComparison} tickers={stocks.map((s) => s.stock.ticker)} />
          </div>

          {/* Metrics */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Metriques cles</h2>
            <ComparisonTable title="Metrique" metrics={comparison.metricComparison} tickers={stocks.map((s) => s.stock.ticker)} />
            {comparison.metricComparison.some((m) => m.isPartial) && (
              <p className="mt-2 text-[10px] text-slate-400">* Donnees partielles — comparaison limitee sur ces metriques</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" /></div>}>
      <CompareContent />
    </Suspense>
  );
}
