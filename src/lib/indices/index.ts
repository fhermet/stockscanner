import { IndexDefinition, CountryInfo } from "./types";
import { US_INDICES } from "./us";
import { FRANCE_INDICES } from "./france";
import { GERMANY_INDICES } from "./germany";
import { UK_INDICES } from "./uk";
import { SWITZERLAND_INDICES } from "./switzerland";
import { EUROPE_INDICES } from "./europe";

export type { IndexDefinition, CountryInfo } from "./types";

// --- All indices ---

export const ALL_INDICES: readonly IndexDefinition[] = [
  ...US_INDICES,
  ...FRANCE_INDICES,
  ...GERMANY_INDICES,
  ...UK_INDICES,
  ...SWITZERLAND_INDICES,
  ...EUROPE_INDICES,
];

// --- Countries ---

const COUNTRIES: CountryInfo[] = [
  { code: "us", name: "USA", flag: "🇺🇸", indexCount: US_INDICES.length },
  { code: "fr", name: "France", flag: "🇫🇷", indexCount: FRANCE_INDICES.length },
  { code: "de", name: "Allemagne", flag: "🇩🇪", indexCount: GERMANY_INDICES.length },
  { code: "gb", name: "Royaume-Uni", flag: "🇬🇧", indexCount: UK_INDICES.length },
  { code: "ch", name: "Suisse", flag: "🇨🇭", indexCount: SWITZERLAND_INDICES.length },
  { code: "eu", name: "Europe", flag: "🇪🇺", indexCount: EUROPE_INDICES.length },
];

// --- Lookup functions ---

export function getCountries(): readonly CountryInfo[] {
  return COUNTRIES;
}

export function getIndicesForCountry(countryCode: string): readonly IndexDefinition[] {
  return ALL_INDICES.filter((idx) => idx.countryCode === countryCode);
}

export function getIndexById(id: string): IndexDefinition | undefined {
  return ALL_INDICES.find((idx) => idx.id === id);
}

export function getIndexTickers(id: string): readonly string[] {
  return getIndexById(id)?.tickers ?? [];
}

export function getAllTickersForCountry(countryCode: string): readonly string[] {
  const indices = getIndicesForCountry(countryCode);
  return [...new Set(indices.flatMap((idx) => [...idx.tickers]))];
}

export function isValidIndexId(id: string): boolean {
  return ALL_INDICES.some((idx) => idx.id === id);
}
