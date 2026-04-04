"use client";

import Link from "next/link";
import { ScoredStock, StrategyId } from "@/lib/types";
import ScoreBadge from "./ui/score-badge";
import ScoreGauge from "./ui/score-gauge";
import WatchlistButton from "./watchlist-button";
import { formatPrice, formatMarketCap } from "@/lib/format";

interface StockCardProps {
  readonly item: ScoredStock;
  readonly strategyId: StrategyId;
  readonly rank: number;
}

export default function StockCard({ item, strategyId, rank }: StockCardProps) {
  const topExplanation = item.score.explanations.find(
    (e) => e.type === "positive"
  );

  return (
    <Link
      href={`/stocks/${item.stock.ticker}?strategy=${strategyId}`}
      className="group block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
            {rank}
          </span>
          <div>
            <h3 className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
              {item.stock.ticker}
            </h3>
            <p className="text-sm text-slate-500">{item.stock.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <WatchlistButton ticker={item.stock.ticker} size="sm" />
          <ScoreBadge score={item.score.total} size="sm" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-slate-400">Prix</p>
          <p className="text-sm font-semibold">{formatPrice(item.stock.price, item.stock.currency)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">PER</p>
          <p className="text-sm font-semibold">{item.stock.per}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Cap.</p>
          <p className="text-sm font-semibold">
            {formatMarketCap(item.stock.marketCap, item.stock.currency)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {item.score.subScores.map((sub) => (
          <ScoreGauge key={sub.name} score={sub.value} label={sub.label} size="sm" />
        ))}
      </div>

      {topExplanation && (
        <p className="mt-3 text-xs text-emerald-600 line-clamp-1">
          {topExplanation.text}
        </p>
      )}
    </Link>
  );
}
