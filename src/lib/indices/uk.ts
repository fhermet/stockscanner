import { IndexDefinition } from "./types";

export const FTSE100: IndexDefinition = {
  id: "ftse100",
  name: "FTSE 100",
  shortName: "FTSE 100",
  country: "Royaume-Uni",
  countryCode: "gb",
  description: "Les 100 plus grandes capitalisations britanniques",
  theoreticalCount: 100,
  tickers: [
    "SHEL.L",   // Shell
    "AZN.L",    // AstraZeneca
    "ULVR.L",   // Unilever
    "HSBA.L",   // HSBC
    "BP.L",     // BP
    "GSK.L",    // GSK
    "RIO.L",    // Rio Tinto
    "DGE.L",    // Diageo
    "REL.L",    // RELX
    "BATS.L",   // BAT
    "LSEG.L",   // London Stock Exchange
    "NG.L",     // National Grid
    "CRH.L",    // CRH
    "EXPN.L",   // Experian
    "CPG.L",    // Compass Group
    "RKT.L",    // Reckitt
    "ABF.L",    // AB Foods
    "SSE.L",    // SSE
    "VOD.L",    // Vodafone
    "AAL.L",    // Anglo American
    "GLEN.L",   // Glencore
    "LLOY.L",   // Lloyds Banking
    "BARC.L",   // Barclays
    "PRU.L",    // Prudential
    "ANTO.L",   // Antofagasta
    "IMB.L",    // Imperial Brands
    "SGRO.L",   // Segro
    "PSON.L",   // Pearson
    "TSCO.L",   // Tesco
    "MNG.L",    // M&G
  ],
};

export const UK_INDICES = [FTSE100] as const;
