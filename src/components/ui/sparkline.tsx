"use client";

import { ScoreSnapshot } from "@/hooks/use-score-history";

interface SparklineProps {
  readonly data: readonly ScoreSnapshot[];
  readonly width?: number;
  readonly height?: number;
}

function getColor(lastValue: number): string {
  if (lastValue >= 70) return "#10b981"; // emerald-500
  if (lastValue >= 50) return "#6366f1"; // brand-500
  return "#ef4444"; // red-500
}

export default function Sparkline({
  data,
  width = 200,
  height = 48,
}: SparklineProps) {
  const validData = data.filter((d) => d.score !== null);

  if (validData.length < 2) {
    return (
      <p className="text-xs text-slate-400 italic">
        Pas assez de données pour afficher un graphique
      </p>
    );
  }

  const scores = validData.map((d) => d.score);
  const min = Math.min(...scores) - 5;
  const max = Math.max(...scores) + 5;
  const range = max - min || 1;

  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = scores.map((score, i) => {
    const x = padding + (i / (scores.length - 1)) * innerW;
    const y = padding + innerH - ((score - min) / range) * innerH;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const color = getColor(scores[scores.length - 1]);

  // Area fill path
  const firstX = padding;
  const lastX = padding + innerW;
  const areaPath = `M ${points[0]} ${points.slice(1).map((p) => `L ${p}`).join(" ")} L ${lastX},${height - padding} L ${firstX},${height - padding} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full max-w-md"
    >
      {/* Area fill */}
      <path d={areaPath} fill={color} fillOpacity={0.1} />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={padding + innerW}
        cy={padding + innerH - ((scores[scores.length - 1] - min) / range) * innerH}
        r={3}
        fill={color}
      />
    </svg>
  );
}
