"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "stockscanner:watchlist";
const FREE_LIMIT = 5;

export interface UseWatchlistReturn {
  readonly tickers: readonly string[];
  readonly isInWatchlist: (ticker: string) => boolean;
  readonly add: (ticker: string) => boolean; // false si limite atteinte
  readonly remove: (ticker: string) => void;
  readonly toggle: (ticker: string) => boolean;
  readonly clear: () => void;
  readonly isFull: boolean;
  readonly count: number;
}

function loadFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(tickers: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export function useWatchlist(): UseWatchlistReturn {
  const [tickers, setTickers] = useState<string[]>([]);

  // Charger depuis localStorage au mount
  useEffect(() => {
    setTickers(loadFromStorage());
  }, []);

  const isInWatchlist = useCallback(
    (ticker: string) => tickers.includes(ticker.toUpperCase()),
    [tickers]
  );

  const add = useCallback(
    (ticker: string): boolean => {
      const upper = ticker.toUpperCase();
      if (tickers.includes(upper)) return true;
      if (tickers.length >= FREE_LIMIT) return false;

      const next = [...tickers, upper];
      setTickers(next);
      saveToStorage(next);
      return true;
    },
    [tickers]
  );

  const remove = useCallback(
    (ticker: string) => {
      const upper = ticker.toUpperCase();
      const next = tickers.filter((t) => t !== upper);
      setTickers(next);
      saveToStorage(next);
    },
    [tickers]
  );

  const toggle = useCallback(
    (ticker: string): boolean => {
      if (isInWatchlist(ticker)) {
        remove(ticker);
        return false;
      }
      return add(ticker);
    },
    [isInWatchlist, add, remove]
  );

  const clear = useCallback(() => {
    setTickers([]);
    saveToStorage([]);
  }, []);

  return {
    tickers,
    isInWatchlist,
    add,
    remove,
    toggle,
    clear,
    isFull: tickers.length >= FREE_LIMIT,
    count: tickers.length,
  };
}
