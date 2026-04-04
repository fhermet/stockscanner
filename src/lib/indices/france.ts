import { IndexDefinition } from "./types";

export const CAC40: IndexDefinition = {
  id: "cac40",
  name: "CAC 40",
  shortName: "CAC 40",
  country: "France",
  countryCode: "fr",
  description: "Les 40 plus grandes capitalisations francaises",
  theoreticalCount: 40,
  tickers: [
    "MC.PA",    // LVMH
    "OR.PA",    // L'Oreal
    "RMS.PA",   // Hermes
    "TTE.PA",   // TotalEnergies
    "SAN.PA",   // Sanofi
    "AI.PA",    // Air Liquide
    "SU.PA",    // Schneider Electric
    "EL.PA",    // EssilorLuxottica
    "DSY.PA",   // Dassault Systemes
    "SAF.PA",   // Safran
    "AIR.PA",   // Airbus
    "BNP.PA",   // BNP Paribas
    "DG.PA",    // Vinci
    "CS.PA",    // AXA
    "KER.PA",   // Kering
    "SGO.PA",   // Saint-Gobain
    "CAP.PA",   // Capgemini
    "RI.PA",    // Pernod Ricard
    "BN.PA",    // Danone
    "LR.PA",    // Legrand
    "PUB.PA",   // Publicis
    "HO.PA",    // Thales
    "ML.PA",    // Michelin
    "GLE.PA",   // Societe Generale
    "ACA.PA",   // Credit Agricole
    "ORA.PA",   // Orange
    "VIV.PA",   // Vivendi
    "EN.PA",    // Bouygues
    "STLAP.PA", // Stellantis
    "URW.PA",   // Unibail-Rodamco
  ],
};

export const FRANCE_INDICES = [CAC40] as const;
