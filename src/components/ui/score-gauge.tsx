interface ScoreGaugeProps {
  readonly score: number;
  readonly label: string;
  readonly size?: "sm" | "md";
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function ScoreGauge({
  score,
  label,
  size = "md",
}: ScoreGaugeProps) {
  return (
    <div className={size === "sm" ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center justify-between">
        <span
          className={`text-slate-600 ${size === "sm" ? "text-xs" : "text-sm"}`}
        >
          {label}
        </span>
        <span
          className={`font-semibold text-slate-900 ${size === "sm" ? "text-xs" : "text-sm"}`}
        >
          {score}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div
          className={`score-bar ${getBarColor(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}
