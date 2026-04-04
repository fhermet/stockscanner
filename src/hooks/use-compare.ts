"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StrategyId } from "@/lib/types";

const MAX = 4;

export function useCompare(strategyId: StrategyId) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback((ticker: string) => {
    setSelected((prev) => {
      const upper = ticker.toUpperCase();
      if (prev.includes(upper)) return prev.filter((t) => t !== upper);
      if (prev.length >= MAX) return prev;
      return [...prev, upper];
    });
  }, []);

  const isSelected = useCallback(
    (ticker: string) => selected.includes(ticker.toUpperCase()),
    [selected]
  );

  const clear = useCallback(() => setSelected([]), []);

  const goCompare = useCallback(() => {
    if (selected.length >= 2) {
      router.push(
        `/compare?tickers=${selected.join(",")}&strategy=${strategyId}`
      );
    }
  }, [selected, strategyId, router]);

  return {
    selected,
    count: selected.length,
    canCompare: selected.length >= 2,
    toggle,
    isSelected,
    clear,
    goCompare,
  };
}
