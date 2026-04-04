import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scanner",
  description: "Classement des actions par strategie d'investissement. Filtrez par pays, indice et secteur.",
};

export default function ScannerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
