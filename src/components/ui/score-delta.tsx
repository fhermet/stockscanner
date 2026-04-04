import { ScoreDelta } from "@/hooks/use-score-history";

interface ScoreDeltaProps {
  readonly delta: ScoreDelta;
  readonly size?: "sm" | "md";
}

export default function ScoreDeltaBadge({ delta, size = "sm" }: ScoreDeltaProps) {
  if (delta.delta === null) return null;

  const value = delta.delta;
  if (value === 0) return null;

  const isPositive = value > 0;
  const isSignificant = Math.abs(value) >= 5;

  const colorClass = isPositive
    ? "text-emerald-600"
    : "text-red-500";

  const bgClass = isSignificant
    ? isPositive
      ? "bg-emerald-50 ring-1 ring-emerald-200"
      : "bg-red-50 ring-1 ring-red-200"
    : "";

  const sizeClass = size === "sm" ? "text-xs px-1 py-0.5" : "text-sm px-1.5 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-medium ${colorClass} ${bgClass} ${sizeClass}`}
      title={
        delta.daysAgo !== null
          ? `${isPositive ? "+" : ""}${value} pts vs il y a ${delta.daysAgo}j`
          : undefined
      }
    >
      {isPositive ? "+" : ""}
      {value}
    </span>
  );
}
