"use client";

import { useState, useEffect } from "react";

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

  // Fetch countries on mount
  useEffect(() => {
    fetch("/api/countries")
      .then((r) => r.json())
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => {});
  }, []);

  // Fetch indices when country changes
  useEffect(() => {
    if (!selectedCountry) {
      setIndices([]);
      return;
    }
    fetch(`/api/indices?country=${selectedCountry}`)
      .then((r) => r.json())
      .then((data) => {
        setIndices(data.indices ?? []);
        // Auto-select first index if none selected
        if (!selectedIndex && data.indices?.length > 0) {
          onIndexChange(data.indices[0].id);
        }
      })
      .catch(() => {});
  }, [selectedCountry, selectedIndex, onIndexChange]);

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

      {/* Index pills (only when country selected) */}
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
