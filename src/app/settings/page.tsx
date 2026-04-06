"use client";

import { useAlerts } from "@/hooks/use-alerts";
import { usePreferences, AlertMode, MODE_PRESETS } from "@/hooks/use-preferences";
import { StrategyId } from "@/lib/types";

const STRATEGIES: { id: StrategyId; label: string }[] = [
  { id: "buffett", label: "Buffett" },
  { id: "lynch", label: "Lynch" },
  { id: "growth", label: "Growth" },
  { id: "dividend", label: "Dividende" },
];

const MODES: { id: AlertMode; label: string; description: string }[] = [
  { id: "strict", label: "Strict", description: "Moins d'alertes, seuils élevés" },
  { id: "normal", label: "Normal", description: "Équilibre par défaut" },
  { id: "sensitive", label: "Sensible", description: "Plus d'alertes, seuils bas" },
];

export default function SettingsPage() {
  const { prefs, update, reset } = usePreferences();
  const { rules, toggleRule, updateRuleThreshold, resetRules } = useAlerts();

  const handleModeChange = (mode: AlertMode) => {
    update({ alertMode: mode });
    const preset = MODE_PRESETS[mode];
    resetRules(preset.score, preset.delta);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Paramètres</h1>
      <p className="text-sm text-slate-500 mb-8">
        Personnalisez votre expérience StockScanner
      </p>

      {/* Favorite strategy */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Stratégie favorite
        </h2>
        <div className="flex flex-wrap gap-2">
          {STRATEGIES.map((s) => (
            <button
              key={s.id}
              onClick={() => update({ favoriteStrategy: s.id })}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                prefs.favoriteStrategy === s.id
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Alert mode */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Mode d&apos;alerte
        </h2>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                prefs.alertMode === mode.id
                  ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <p className="font-semibold text-slate-900 text-sm">{mode.label}</p>
              <p className="text-xs text-slate-500 mt-1">{mode.description}</p>
              <p className="text-xs text-slate-400 mt-2">
                Score &gt; {MODE_PRESETS[mode.id].score} &middot; Delta &gt; {MODE_PRESETS[mode.id].delta}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Watchlist only */}
      <section className="mb-8">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="font-semibold text-slate-900 text-sm">
              Alertes watchlist uniquement
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Ne déclencher les alertes que pour les actions suivies
            </p>
          </div>
          <button
            role="switch"
            aria-checked={prefs.watchlistOnly}
            aria-label="Alertes watchlist uniquement"
            onClick={() => update({ watchlistOnly: !prefs.watchlistOnly })}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              prefs.watchlistOnly ? "bg-brand-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                prefs.watchlistOnly ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Alert rules */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">
          Règles d&apos;alerte
        </h2>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`rounded-xl border p-4 transition-all ${
                rule.enabled
                  ? "border-slate-200 bg-white"
                  : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-slate-900 text-sm">{rule.label}</p>
                <button
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`Activer ${rule.label}`}
                  onClick={() => toggleRule(rule.id)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    rule.enabled ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      rule.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              {rule.enabled && (
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-500">Seuil :</label>
                  <input
                    type="number"
                    value={rule.threshold}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) updateRuleThreshold(rule.id, val);
                    }}
                    className="w-20 rounded border border-slate-200 px-2 py-1 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
                  />
                  <span className="text-xs text-slate-400">
                    {rule.type.includes("score") ? "/ 100" : "points"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Reset */}
      <div className="border-t border-slate-200 pt-6">
        <button
          onClick={() => {
            reset();
            resetRules(80, 5);
          }}
          className="text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Réinitialiser tous les paramètres
        </button>
      </div>
    </div>
  );
}
