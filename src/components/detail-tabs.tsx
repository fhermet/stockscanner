"use client";

import { useState } from "react";

type TabId = "score" | "history" | "analysis";

interface Tab {
  readonly id: TabId;
  readonly label: string;
}

const TABS: readonly Tab[] = [
  { id: "score", label: "Score" },
  { id: "history", label: "Historique" },
  { id: "analysis", label: "Analyse" },
];

interface DetailTabsProps {
  readonly scoreContent: React.ReactNode;
  readonly historyContent: React.ReactNode;
  readonly analysisContent: React.ReactNode;
}

export default function DetailTabs({
  scoreContent,
  historyContent,
  analysisContent,
}: DetailTabsProps) {
  const [active, setActive] = useState<TabId>("score");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex-1 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="space-y-8">
        {active === "score" && scoreContent}
        {active === "history" && historyContent}
        {active === "analysis" && analysisContent}
      </div>
    </div>
  );
}
