import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Suivez vos actions favorites avec scores et variations en temps reel.",
};

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
