"use client";

import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import { useScoreHistory, ScoreDelta } from "@/hooks/use-score-history";

interface ScoreMoversProps {
  readonly stocks: readonly ScoredStock[];
  readonly strategyId: StrategyId;
}

interface Mover {
  readonly ticker: string;
  readonly name: string;
  readonly delta: ScoreDelta;
}

export default function ScoreMovers({ stocks, strategyId }: ScoreMoversProps) {
  const { getDelta } = useScoreHistory();

  const movers: Mover[] = stocks
    .map((s) => ({
      ticker: s.stock.ticker,
      name: s.stock.name,
      delta: getDelta(s.stock.ticker, strategyId, s.score.total),
    }))
    .filter((m) => m.delta.delta !== null && Math.abs(m.delta.delta) >= 3)
    .sort((a, b) => Math.abs(b.delta.delta!) - Math.abs(a.delta.delta!))
    .slice(0, 5);

  if (movers.length === 0) return null;

  const gainers = movers.filter((m) => m.delta.delta! > 0);
  const losers = movers.filter((m) => m.delta.delta! < 0);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">
        Mouvements notables depuis votre derniere visite
      </h3>
      <div className="flex flex-wrap gap-3">
        {gainers.map((m) => (
          <Link
            key={m.ticker}
            href={`/stocks/${m.ticker}?strategy=${strategyId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm hover:bg-emerald-100 transition-colors"
          >
            <span className="font-semibold text-slate-900">{m.ticker}</span>
            <span className="font-bold text-emerald-600">+{m.delta.delta}</span>
          </Link>
        ))}
        {losers.map((m) => (
          <Link
            key={m.ticker}
            href={`/stocks/${m.ticker}?strategy=${strategyId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm hover:bg-red-100 transition-colors"
          >
            <span className="font-semibold text-slate-900">{m.ticker}</span>
            <span className="font-bold text-red-500">{m.delta.delta}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
