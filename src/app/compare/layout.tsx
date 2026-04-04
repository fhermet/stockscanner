import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparateur d'actions",
  description: "Comparez 2 à 4 actions côte à côte : scores, sous-scores, métriques clés et résumé automatique selon la stratégie choisie.",
  alternates: { canonical: "/compare" },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
