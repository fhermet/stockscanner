import { MetadataRoute } from "next";
import { ALL_TICKERS } from "@/lib/tickers";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stockscanner.app";

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/scanner`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/strategies`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/glossary`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/compare/history`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/watchlist`, lastModified: new Date(), changeFrequency: "daily", priority: 0.6 },
    { url: `${baseUrl}/settings`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const stockPages: MetadataRoute.Sitemap = ALL_TICKERS.map((ticker) => ({
    url: `${baseUrl}/stocks/${encodeURIComponent(ticker)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...stockPages];
}
