"use client";

import type { CompareYearRow } from "@/lib/compare/compare-history";

const TICKER_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
];

interface HistoryChartProps {
  readonly years: readonly number[];
  readonly rows: readonly CompareYearRow[];
  readonly tickers: readonly string[];
  readonly smoothed?: boolean;
}

export default function HistoryChart({
  years,
  rows,
  tickers,
  smoothed = false,
}: HistoryChartProps) {
  if (years.length < 2) return null;

  const w = 600;
  const h = 300;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  function getScore(row: CompareYearRow, ticker: string): number | null {
    return smoothed
      ? (row.smoothedScores.get(ticker) ?? null)
      : (row.scores.get(ticker) ?? null);
  }

  // Compute global min/max score
  let minScore = 100;
  let maxScore = 0;
  for (const row of rows) {
    for (const ticker of tickers) {
      const score = getScore(row, ticker);
      if (score !== null) {
        minScore = Math.min(minScore, score);
        maxScore = Math.max(maxScore, score);
      }
    }
  }
  const yMin = Math.max(0, minScore - 10);
  const yMax = Math.min(100, maxScore + 10);
  const yRange = yMax - yMin || 1;

  function toX(yearIndex: number): number {
    return padL + (yearIndex / (years.length - 1)) * innerW;
  }

  function toY(score: number): number {
    return padT + innerH - ((score - yMin) / yRange) * innerH;
  }

  // Y-axis grid lines
  const yTicks: number[] = [];
  const step = yRange > 40 ? 20 : yRange > 20 ? 10 : 5;
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    yTicks.push(v);
  }

  // X-axis: show every N years to avoid overlap
  const xStep = years.length > 12 ? 3 : years.length > 6 ? 2 : 1;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={toY(v)}
              x2={w - padR}
              y2={toY(v)}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={toY(v) + 4}
              textAnchor="end"
              className="fill-slate-400"
              fontSize={10}
            >
              {v}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {years.map((year, i) =>
          i % xStep === 0 || i === years.length - 1 ? (
            <text
              key={year}
              x={toX(i)}
              y={h - padB + 16}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={10}
            >
              {year}
            </text>
          ) : null,
        )}

        {/* Lines per ticker */}
        {tickers.map((ticker, tickerIdx) => {
          const color = TICKER_COLORS[tickerIdx % TICKER_COLORS.length];
          const segments: string[] = [];
          const dots: { x: number; y: number; score: number }[] = [];

          let inPath = false;
          for (let i = 0; i < years.length; i++) {
            const score = rows[i] ? getScore(rows[i], ticker) : null;
            if (score !== null) {
              const x = toX(i);
              const y = toY(score);
              dots.push({ x, y, score });
              if (!inPath) {
                segments.push(`M ${x},${y}`);
                inPath = true;
              } else {
                segments.push(`L ${x},${y}`);
              }
            } else {
              inPath = false;
            }
          }

          return (
            <g key={ticker}>
              <path
                d={segments.join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {dots.map((dot, i) => (
                <circle
                  key={i}
                  cx={dot.x}
                  cy={dot.y}
                  r={years.length > 12 ? 2 : 3}
                  fill={color}
                >
                  <title>
                    {ticker} {years[rows.findIndex((r) => r.scores.get(ticker) === dot.score)]} : {dot.score}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 justify-center mt-2">
        {tickers.map((ticker, i) => (
          <div key={ticker} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-3 h-0.5 rounded-full inline-block"
              style={{
                backgroundColor: TICKER_COLORS[i % TICKER_COLORS.length],
              }}
            />
            <span className="font-medium text-slate-700">{ticker}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
