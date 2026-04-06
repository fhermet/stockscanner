"use client";

import { useState } from "react";
import Link from "next/link";
import { useAlerts } from "@/hooks/use-alerts";
import { useWatchlist } from "@/hooks/use-watchlist";

export default function Header() {
  const { alertCount } = useAlerts();
  const { count: watchlistCount } = useWatchlist();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = (
    <>
      <Link
        href="/scanner?strategy=buffett"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Scanner
      </Link>
      <Link
        href="/compare"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Comparer
      </Link>
      <Link
        href="/watchlist"
        className="relative text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Watchlist
        {watchlistCount > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-bold text-slate-600">
            {watchlistCount}
          </span>
        )}
      </Link>
      <Link
        href="/backtest"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Backtest
      </Link>
      <Link
        href="/strategies"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Stratégies
      </Link>
      <Link
        href="/glossary"
        className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        onClick={() => setMobileOpen(false)}
      >
        Glossaire
      </Link>
      {alertCount > 0 && (
        <Link
          href="/"
          className="relative flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
          onClick={() => setMobileOpen(false)}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {alertCount}
          </span>
        </Link>
      )}
      <Link
        href="/settings"
        className="text-slate-400 hover:text-slate-600 transition-colors"
        title="Paramètres"
        onClick={() => setMobileOpen(false)}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <svg className="h-6 w-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
          <span className="text-lg font-bold text-slate-900">
            Stock<span className="text-brand-600">Scanner</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-6">
          {navLinks}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex items-center justify-center h-10 w-10 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
          {alertCount > 0 && !mobileOpen && (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500" />
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-2">
          <nav className="flex flex-col [&>a]:py-2.5 [&>a]:border-b [&>a]:border-slate-100 [&>a:last-of-type]:border-b-0">
            {navLinks}
          </nav>
        </div>
      )}
    </header>
  );
}
