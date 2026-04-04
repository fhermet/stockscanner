"use client";

import Link from "next/link";
import { useAlerts } from "@/hooks/use-alerts";
import { useWatchlist } from "@/hooks/use-watchlist";

export default function Header() {
  const { alertCount } = useAlerts();
  const { count: watchlistCount } = useWatchlist();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <svg
            className="h-6 w-6 text-brand-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
            />
          </svg>
          <span className="text-lg font-bold text-slate-900">
            Stock<span className="text-brand-600">Scanner</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/scanner?strategy=buffett"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Scanner
          </Link>
          <Link
            href="/watchlist"
            className="relative text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Watchlist
            {watchlistCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-bold text-slate-600">
                {watchlistCount}
              </span>
            )}
          </Link>
          {alertCount > 0 && (
            <Link
              href="/"
              className="relative flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
              title={`${alertCount} alerte${alertCount > 1 ? "s" : ""}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {alertCount}
              </span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
