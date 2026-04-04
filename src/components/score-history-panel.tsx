"use client";

import { useState } from "react";
import { StrategyId, SubScore } from "@/lib/types";
import { useScoreHistory, ScoreSnapshot } from "@/hooks/use-score-history";
import { explainScoreChange } from "@/lib/scoring/change-explanation";
import Sparkline from "./ui/sparkline";
import ScoreDeltaBadge from "./ui/score-delta";

interface ScoreHistoryPanelProps {
  readonly ticker: string;
  readonly strategyId: StrategyId;
  readonly currentScore: number;
  readonly currentSubScores: readonly SubScore[];
}

type Period = "7d" | "30d";

export default function ScoreHistoryPanel({
  ticker,
  strategyId,
  currentScore,
  currentSubScores,
}: ScoreHistoryPanelProps) {
  const { getHistory, getDelta, getPreviousSnapshot } = useScoreHistory();
  const [period, setPeriod] = useState<Period>("7d");

  const allHistory = getHistory(ticker, strategyId);
  const delta = getDelta(ticker, strategyId, currentScore);
  const prev = getPreviousSnapshot(ticker, strategyId);

  // Filter by period
  const cutoffDays = period === "7d" ? 7 : 30;
  const filtered = allHistory.filter((h) => {
    const age = Math.round(
      (Date.now() - new Date(h.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return age <= cutoffDays;
  });

  // Generate explanation
  const explanation = prev?.subScores && delta.delta
    ? explainScoreChange(delta.delta, currentSubScores, prev.subScores)
    : "";

  if (allHistory.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-2">
          Evolution du score
        </h2>
        <p className="text-sm text-slate-400">
          L&apos;historique sera disponible a partir de votre prochaine visite.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            Evolution du score
          </h2>
          {delta.delta !== null && (
            <ScoreDeltaBadge delta={delta} size="md" />
          )}
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(["7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                period === p
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {p === "7d" ? "7 jours" : "30 jours"}
            </button>
          ))}
        </div>
      </div>

      {/* Sparkline */}
      <div className="mb-4">
        <Sparkline data={filtered} width={400} height={64} />
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3">
          <p className="text-xs font-medium text-brand-800">
            Pourquoi le score a change ?
          </p>
          <p className="text-sm text-brand-700 mt-1">{explanation}</p>
        </div>
      )}

      {/* Mini history table */}
      {filtered.length > 1 && (
        <div className="mt-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1.5 text-left text-slate-500 font-medium">Date</th>
                <th className="py-1.5 text-right text-slate-500 font-medium">Score</th>
                <th className="py-1.5 text-right text-slate-500 font-medium">Variation</th>
              </tr>
            </thead>
            <tbody>
              {[...filtered].reverse().slice(0, 7).map((entry, i, arr) => {
                const prev = i < arr.length - 1 ? arr[i + 1] : null;
                const d = prev ? entry.score - prev.score : null;
                return (
                  <tr key={entry.date} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">{entry.date}</td>
                    <td className="py-1.5 text-right font-medium text-slate-900">
                      {entry.score}
                    </td>
                    <td className="py-1.5 text-right">
                      {d !== null && d !== 0 && (
                        <span className={d > 0 ? "text-emerald-600" : "text-red-500"}>
                          {d > 0 ? "+" : ""}{d}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
