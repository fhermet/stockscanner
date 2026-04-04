import { IndexDefinition } from "./types";

/**
 * STOXX Europe 50 — top 50 European blue chips across countries.
 * Mix of tickers from CAC, DAX, FTSE, SMI, and others.
 */
export const STOXX50: IndexDefinition = {
  id: "stoxx50",
  name: "STOXX Europe 50",
  shortName: "STOXX 50",
  country: "Europe",
  countryCode: "eu",
  description: "Les 50 plus grandes capitalisations europeennes",
  theoreticalCount: 50,
  tickers: [
    // France
    "MC.PA", "OR.PA", "TTE.PA", "SAN.PA", "AI.PA", "RMS.PA",
    "SU.PA", "BNP.PA", "AIR.PA",
    // Germany
    "SAP.DE", "SIE.DE", "ALV.DE", "DTE.DE", "MUV2.DE",
    // UK
    "SHEL.L", "AZN.L", "ULVR.L", "HSBA.L", "BP.L", "GSK.L",
    "RIO.L", "DGE.L", "LSEG.L",
    // Switzerland
    "NESN.SW", "NOVN.SW", "ROG.SW",
    // Netherlands
    "ASML",
    // Denmark
    "NVO",
  ],
};

export const EUROPE_INDICES = [STOXX50] as const;
