import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Suivez vos actions favorites : scores par stratégie, variations quotidiennes et alertes de changements significatifs.",
  alternates: { canonical: "/watchlist" },
};

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
