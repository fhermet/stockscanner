/**
 * Multi-currency formatting using Intl.NumberFormat.
 *
 * Scoring note: the scoring engine uses only ratios (PER, ROIC, margins,
 * growth rates) and relative metrics. It is NOT biased by currency.
 * Market cap and FCF are used as ratios (FCF/marketCap) so currency
 * cancels out. The only currency-sensitive displays are price and
 * market cap in the UI.
 */

const LOCALE_MAP: Record<string, string> = {
  USD: "en-US",
  EUR: "fr-FR",
  GBP: "en-GB",
  CHF: "de-CH",
  SEK: "sv-SE",
  DKK: "da-DK",
  JPY: "ja-JP",
};

function getLocale(currency: string): string {
  return LOCALE_MAP[currency] ?? "en-US";
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", CHF: "CHF",
    SEK: "kr", DKK: "kr", GBp: "p",
  };
  return symbols[currency] ?? currency;
}

export function formatPrice(value: number, currency = "USD"): string {
  return new Intl.NumberFormat(getLocale(currency), {
    style: "currency",
    currency: currency === "GBp" ? "GBP" : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(currency === "GBp" ? value / 100 : value);
}

export function formatMarketCap(cap: number, currency = "USD"): string {
  const sym = getCurrencySymbol(currency);
  if (cap >= 1000) return `${(cap / 1000).toFixed(1)}T ${sym}`;
  if (cap >= 1) return `${cap.toFixed(0)}B ${sym}`;
  return `${(cap * 1000).toFixed(0)}M ${sym}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatCurrency(value: number, currency = "USD"): string {
  return formatPrice(value, currency);
}

export function formatRatio(value: number): string {
  return value.toFixed(2);
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}
