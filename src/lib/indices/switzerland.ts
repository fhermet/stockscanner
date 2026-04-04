import { IndexDefinition } from "./types";

export const SMI: IndexDefinition = {
  id: "smi",
  name: "Swiss Market Index",
  shortName: "SMI",
  country: "Suisse",
  countryCode: "ch",
  description: "Les 20 plus grandes capitalisations suisses",
  theoreticalCount: 20,
  tickers: [
    "NESN.SW",  // Nestle
    "NOVN.SW",  // Novartis
    "ROG.SW",   // Roche
    "UBSG.SW",  // UBS
    "ABBN.SW",  // ABB
    "ZURN.SW",  // Zurich Insurance
  ],
};

export const SWITZERLAND_INDICES = [SMI] as const;
