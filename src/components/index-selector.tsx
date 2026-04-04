"use client";

import { useState, useEffect, useRef } from "react";

interface CountryInfo {
  code: string;
  name: string;
  flag: string;
  indexCount: number;
}

interface IndexInfo {
  id: string;
  name: string;
  shortName: string;
  description: string;
  theoreticalCount: number;
  tickerCount: number;
}

interface IndexSelectorProps {
  readonly selectedCountry: string;
  readonly selectedIndex: string;
  readonly onCountryChange: (code: string) => void;
  readonly onIndexChange: (id: string) => void;
}

export default function IndexSelector({
  selectedCountry,
  selectedIndex,
  onCountryChange,
  onIndexChange,
}: IndexSelectorProps) {
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [indices, setIndices] = useState<IndexInfo[]>([]);

  // Track the country that triggered the current indices fetch
  // to avoid stale auto-select overwriting user choice
  const fetchingCountryRef = useRef("");

  // Fetch countries on mount (with cleanup)
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/countries", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // Fetch indices when country changes (with cleanup)
  useEffect(() => {
    if (!selectedCountry) {
      setIndices([]);
      return;
    }

    fetchingCountryRef.current = selectedCountry;
    const ctrl = new AbortController();

    fetch(`/api/indices?country=${selectedCountry}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        // Only apply if the country hasn't changed while we were fetching
        if (fetchingCountryRef.current !== selectedCountry) return;

        const newIndices = data.indices ?? [];
        setIndices(newIndices);

        // Auto-select first index ONLY if no index is currently selected
        // and user hasn't picked one while we were loading
        if (!selectedIndex && newIndices.length > 0) {
          onIndexChange(newIndices[0].id);
        }
      })
      .catch(() => {});

    return () => ctrl.abort();
  }, [selectedCountry]); // Intentionally excludes selectedIndex and onIndexChange

  const activeIndex = indices.find((i) => i.id === selectedIndex);

  return (
    <div className="space-y-3">
      {/* Country pills */}
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Pays / Region
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              onCountryChange("");
              onIndexChange("");
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
              !selectedCountry
                ? "border-slate-700 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Tous
          </button>
          {countries.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                onCountryChange(c.code);
                onIndexChange("");
              }}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                selectedCountry === c.code
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.flag} {c.name}
              <span className="ml-1 text-xs text-slate-400">
                ({c.indexCount})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Index pills */}
      {selectedCountry && indices.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Indice
          </label>
          <div className="flex flex-wrap gap-2">
            {indices.map((idx) => (
              <button
                key={idx.id}
                onClick={() => onIndexChange(idx.id)}
                className={`rounded-lg border px-3 py-2 text-left transition-all ${
                  selectedIndex === idx.id
                    ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="font-semibold text-sm text-slate-900">
                  {idx.shortName}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {idx.tickerCount} / {idx.theoreticalCount} actions
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Index info banner */}
      {activeIndex && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-4 py-2.5 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-slate-900">
              {activeIndex.name}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              {activeIndex.description}
            </span>
          </div>
          <div className="text-right text-xs text-slate-500">
            <span className="font-medium text-slate-700">{activeIndex.tickerCount}</span>
            {" / "}
            {activeIndex.theoreticalCount} couverts
            {activeIndex.tickerCount < activeIndex.theoreticalCount && (
              <span className="ml-1 text-amber-600">
                (couverture partielle)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
