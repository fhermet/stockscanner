import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scanner d'actions",
  description: "Classez 340+ actions US et européennes par stratégie : Buffett, Lynch, Growth, Dividende. Filtrez par pays, indice, secteur et capitalisation.",
  alternates: { canonical: "/scanner" },
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
