import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparateur",
  description: "Comparez 2 à 4 actions côte à côte selon une stratégie d'investissement.",
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
