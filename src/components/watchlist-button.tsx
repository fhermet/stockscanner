"use client";

import { useWatchlist } from "@/hooks/use-watchlist";

interface WatchlistButtonProps {
  readonly ticker: string;
  readonly size?: "sm" | "md";
}

export default function WatchlistButton({
  ticker,
  size = "md",
}: WatchlistButtonProps) {
  const { isInWatchlist, toggle, isFull } = useWatchlist();
  const active = isInWatchlist(ticker);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!active && isFull) {
      // Could show a toast here in a more complete version
      return;
    }
    toggle(ticker);
  };

  const sizeClass =
    size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      onClick={handleClick}
      title={
        active
          ? "Retirer de la watchlist"
          : isFull
            ? "Watchlist pleine (5 max)"
            : "Ajouter a la watchlist"
      }
      className={`inline-flex items-center justify-center rounded-full transition-all ${sizeClass} ${
        active
          ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
          : isFull
            ? "bg-slate-100 text-slate-300 cursor-not-allowed"
            : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-amber-500"
      }`}
    >
      <svg
        className={iconSize}
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
        />
      </svg>
    </button>
  );
}
