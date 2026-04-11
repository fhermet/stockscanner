"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import {
  StrategyId,
  ScoredStock,
  Strategy,
  DataMeta,
  StockFilters as StockFiltersType,
} from "@/lib/types";
import { isValidStrategyId } from "@/lib/strategies";
import StockFiltersComponent from "@/components/stock-filters";
import StockTable from "@/components/stock-table";
import StockCard from "@/components/stock-card";
import DataSourceBadge from "@/components/ui/data-source-badge";
import TickerSearch from "@/components/ticker-search";
import { useScoreHistory } from "@/hooks/use-score-history";
import { useAlerts } from "@/hooks/use-alerts";
import { usePreferences } from "@/hooks/use-preferences";
import { useWatchlist } from "@/hooks/use-watchlist";
import ScoreMovers from "@/components/score-movers";
import IndexSelector from "@/components/index-selector";
import { explainScoreChange } from "@/lib/scoring/change-explanation";
import { useCompare } from "@/hooks/use-compare";
import CompareBar from "@/components/compare-bar";

function parseMarketCapFilter(value: string): Partial<StockFiltersType> {
  switch (value) {
    case "mega":
      return { marketCapMin: 500 };
    case "large":
      return { marketCapMin: 100, marketCapMax: 500 };
    case "mid":
      return { marketCapMin: 10, marketCapMax: 100 };
    case "small":
      return { marketCapMax: 10 };
    default:
      return {};
  }
}

interface ScannerFilters {
  strategyId: StrategyId;
  indexCountry: string;
  indexId: string;
  sector: string;
  marketCap: string;
}

function buildApiParams(f: ScannerFilters, quick?: boolean): string {
  const p = new URLSearchParams({ strategy: f.strategyId });
  if (f.indexId) p.set("index", f.indexId);
  if (f.sector) p.set("sector", f.sector);
  const cap = parseMarketCapFilter(f.marketCap);
  if (cap.marketCapMin !== undefined) p.set("marketCapMin", String(cap.marketCapMin));
  if (cap.marketCapMax !== undefined) p.set("marketCapMax", String(cap.marketCapMax));
  if (quick) p.set("quick", "true");
  return p.toString();
}

function buildUrl(f: ScannerFilters): string {
  const p = new URLSearchParams({ strategy: f.strategyId });
  if (f.indexCountry) p.set("country", f.indexCountry);
  if (f.indexId) p.set("index", f.indexId);
  return `/scanner?${p.toString()}`;
}

function ScannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [filters, setFilters] = useState<ScannerFilters>({
    strategyId: (isValidStrategyId(searchParams.get("strategy") ?? "")
      ? searchParams.get("strategy")!
      : "buffett") as StrategyId,
    indexCountry: searchParams.get("country") ?? "",
    indexId: searchParams.get("index") ?? "",
    sector: "",
    marketCap: "",
  });

  const [stocks, setStocks] = useState<readonly ScoredStock[]>([]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [sectors, setSectors] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [indexInfo, setIndexInfo] = useState<{
    id: string; name: string; theoreticalCount: number;
  } | null>(null);
  const [universe, setUniverse] = useState<{
    total: number; fetched: number; displayed: number;
  } | null>(null);

  const { saveScores, getDelta, getPreviousSnapshot } = useScoreHistory();
  const { evaluate } = useAlerts();
  const { prefs } = usePreferences();
  const { tickers: watchlistTickers } = useWatchlist();
  const compare = useCompare(filters.strategyId);
  const abortRef = useRef<AbortController | null>(null);

  // Refs for side-effect functions — avoids stale closures in fetchStocks
  // while preventing these from triggering re-fetches when they change.
  const saveScoresRef = useRef(saveScores);
  const getDeltaRef = useRef(getDelta);
  const getPrevRef = useRef(getPreviousSnapshot);
  const evaluateRef = useRef(evaluate);
  const prefsRef = useRef(prefs);
  const watchlistRef = useRef(watchlistTickers);

  useEffect(() => { saveScoresRef.current = saveScores; }, [saveScores]);
  useEffect(() => { getDeltaRef.current = getDelta; }, [getDelta]);
  useEffect(() => { getPrevRef.current = getPreviousSnapshot; }, [getPreviousSnapshot]);
  useEffect(() => { evaluateRef.current = evaluate; }, [evaluate]);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);
  useEffect(() => { watchlistRef.current = watchlistTickers; }, [watchlistTickers]);

  const patch = useCallback(
    (update: Partial<ScannerFilters>) => {
      setFilters((prev) => {
        const next = { ...prev, ...update };
        if ("strategyId" in update || "indexCountry" in update || "indexId" in update) {
          queueMicrotask(() => router.push(buildUrl(next), { scroll: false }));
        }
        return next;
      });
    },
    [router]
  );

  const fetchStocks = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setRefreshing(false);

    try {
      // Phase 1 — instant mock
      const q1 = await fetch(`/api/stocks?${buildApiParams(filters, true)}`, { signal: ctrl.signal });
      const d1 = await q1.json();
      if (!ctrl.signal.aborted) {
        setStocks(d1.stocks);
        setStrategy(d1.strategy);
        setSectors(d1.filters.sectors);
        if (d1.meta) setMeta(d1.meta);
        if (d1.universe) setUniverse(d1.universe);
        setLoading(false);
        setRefreshing(true);
      }

      // Phase 2 — live data
      const q2 = await fetch(`/api/stocks?${buildApiParams(filters)}`, { signal: ctrl.signal });
      const d2 = await q2.json();
      if (!ctrl.signal.aborted) {
        setStocks(d2.stocks);
        setStrategy(d2.strategy);
        setSectors(d2.filters.sectors);
        if (d2.meta) setMeta(d2.meta);
        if (d2.universe) setUniverse(d2.universe);
        if (d2.index) setIndexInfo(d2.index);
        else setIndexInfo(null);
        setRefreshing(false);

        if (!d2.isQuick) {
          // Use refs to get latest values without stale closures
          saveScoresRef.current(
            d2.stocks
              .filter((s: ScoredStock) => s.score.total !== null)
              .map((s: ScoredStock) => ({
                ticker: s.stock.ticker,
                strategyId: filters.strategyId,
                score: s.score.total!,
                subScores: s.score.subScores,
              }))
          );
          evaluateRef.current(
            d2.stocks
              .filter((s: ScoredStock) => s.score.total !== null)
              .map((s: ScoredStock) => {
                const d = getDeltaRef.current(s.stock.ticker, filters.strategyId, s.score.total!);
                const prev = getPrevRef.current(s.stock.ticker, filters.strategyId);
                return {
                  ticker: s.stock.ticker,
                  name: s.stock.name,
                  score: s.score.total!,
                  delta: d.delta,
                  strategyId: filters.strategyId,
                  changeExplanation: d.delta && prev?.subScores
                    ? explainScoreChange(d.delta, s.score.subScores, prev.subScores)
                    : undefined,
                };
              }),
            { watchlistOnly: prefsRef.current.watchlistOnly, watchlistTickers: watchlistRef.current }
          );
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchStocks();
    return () => abortRef.current?.abort();
  }, [fetchStocks]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {indexInfo ? `Top ${strategy?.name ?? "Buffett"} — ${indexInfo.name}` : "Scanner"}
        </h1>
        {strategy && (
          <p className="mt-1 text-sm text-slate-500">
            Stratégie <strong>{strategy.name}</strong> &middot; {strategy.philosophy}
          </p>
        )}
        {meta && <div className="mt-2"><DataSourceBadge meta={meta} /></div>}
      </div>

      <div className="mb-6">
        <IndexSelector
          selectedCountry={filters.indexCountry}
          selectedIndex={filters.indexId}
          onCountryChange={(code) => patch({ indexCountry: code, indexId: "" })}
          onIndexChange={(id) => patch({ indexId: id })}
        />
      </div>

      <div className="mb-4">
        <TickerSearch strategyId={filters.strategyId} />
      </div>

      <div className="mb-6">
        <StockFiltersComponent
          sectors={sectors}
          selectedSector={filters.sector}
          selectedMarketCap={filters.marketCap}
          onSectorChange={(s) => patch({ sector: s })}
          onMarketCapChange={(m) => patch({ marketCap: m })}
          strategyId={filters.strategyId}
          onStrategyChange={(id) => patch({ strategyId: id })}
        />
      </div>

      {refreshing && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
          <p className="text-sm text-brand-700">Actualisation des données en direct...</p>
        </div>
      )}

      {!loading && !refreshing && stocks.length > 0 && (
        <ScoreMovers stocks={stocks} strategyId={filters.strategyId} />
      )}

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {loading ? "Chargement..." : `${stocks.length} actions classées`}
          </p>
          {!loading && universe && (
            <p className="text-xs text-slate-400">
              Base sur un univers de {universe.total} actions
              {universe.fetched < universe.total && <> &middot; {universe.fetched} récupérées</>}
            </p>
          )}
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button onClick={() => setViewMode("table")} className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "table" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 14.625c0-.621.504-1.125 1.125-1.125" /></svg>
          </button>
          <button onClick={() => setViewMode("cards")} className={`px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "cards" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      ) : viewMode === "table" ? (
        <StockTable stocks={stocks} strategyId={filters.strategyId} onToggleCompare={compare.toggle} isCompareSelected={compare.isSelected} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((item, i) => (
            <StockCard key={item.stock.ticker} item={item} strategyId={filters.strategyId} rank={i + 1} onToggleCompare={compare.toggle} isCompareSelected={compare.isSelected(item.stock.ticker)} />
          ))}
        </div>
      )}

      <CompareBar selected={compare.selected} onClear={compare.clear} onCompare={compare.goCompare} canCompare={compare.canCompare} />
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" /></div>}>
      <ScannerContent />
    </Suspense>
  );
}
