"use client";

import { useState, useEffect, useCallback } from "react";
import {
  StrategyId,
  ScoredStock,
  Strategy,
  StockFilters,
} from "@/lib/types";

interface UseStocksParams {
  readonly strategyId: StrategyId;
  readonly filters: StockFilters;
}

interface UseStocksReturn {
  readonly stocks: readonly ScoredStock[];
  readonly strategy: Strategy | null;
  readonly sectors: readonly string[];
  readonly countries: readonly string[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

export function useStocks({
  strategyId,
  filters,
}: UseStocksParams): UseStocksReturn {
  const [stocks, setStocks] = useState<readonly ScoredStock[]>([]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [sectors, setSectors] = useState<readonly string[]>([]);
  const [countries, setCountries] = useState<readonly string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ strategy: strategyId });
      if (filters.sector) params.set("sector", filters.sector);
      if (filters.country) params.set("country", filters.country);
      if (filters.marketCapMin !== undefined)
        params.set("marketCapMin", String(filters.marketCapMin));
      if (filters.marketCapMax !== undefined)
        params.set("marketCapMax", String(filters.marketCapMax));

      const res = await fetch(`/api/stocks?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}`);
      }

      const data = await res.json();
      setStocks(data.stocks);
      setStrategy(data.strategy);
      setSectors(data.filters.sectors);
      setCountries(data.filters.countries);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur inconnue";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [strategyId, filters]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  return {
    stocks,
    strategy,
    sectors,
    countries,
    loading,
    error,
    refetch: fetchStocks,
  };
}
