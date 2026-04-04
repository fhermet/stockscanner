import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparateur",
  description: "Comparez 2 a 4 actions cote a cote selon une strategie d'investissement.",
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
