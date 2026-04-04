export function formatMarketCap(cap: number): string {
  if (cap >= 1000) return `${(cap / 1000).toFixed(1)}T$`;
  if (cap >= 1) return `${cap}B$`;
  return `${(cap * 1000).toFixed(0)}M$`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatRatio(value: number): string {
  return value.toFixed(2);
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
