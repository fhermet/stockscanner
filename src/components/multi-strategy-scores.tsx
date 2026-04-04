import { Stock, StrategyId, StrategyScore } from "@/lib/types";
import { STRATEGIES } from "@/lib/strategies";
import ScoreBadge from "./ui/score-badge";
import ScoreGauge from "./ui/score-gauge";

interface MultiStrategyScoresProps {
  readonly stock: Stock;
  readonly scores: Record<StrategyId, StrategyScore>;
  readonly currentStrategy?: StrategyId;
}

const colorBorder: Record<string, string> = {
  indigo: "border-indigo-200",
  emerald: "border-emerald-200",
  violet: "border-violet-200",
  amber: "border-amber-200",
};

export default function MultiStrategyScores({
  scores,
  currentStrategy,
}: MultiStrategyScoresProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        Comparaison multi-strategies
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {STRATEGIES.map((strategy) => {
          const score = scores[strategy.id];
          if (!score) return null;

          const isActive = strategy.id === currentStrategy;

          return (
            <div
              key={strategy.id}
              className={`rounded-xl border p-4 transition-all ${
                isActive
                  ? `${colorBorder[strategy.color] ?? "border-slate-300"} bg-white dark:bg-slate-800 shadow-sm`
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {strategy.name}
                  </h3>
                  <p className="text-xs text-slate-500">{strategy.subtitle}</p>
                </div>
                <ScoreBadge score={score.total} size="sm" />
              </div>
              <div className="space-y-2">
                {score.subScores.map((sub) => (
                  <ScoreGauge
                    key={sub.name}
                    score={sub.value}
                    label={sub.label}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
