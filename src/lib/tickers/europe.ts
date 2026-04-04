/**
 * European equity universe — CAC 40, DAX 40, FTSE 100 top components.
 * ~130 tickers. Yahoo suffixes: .PA (Paris), .DE (Frankfurt), .L (London).
 */

export const EUROPE_TICKERS = [
  // --- CAC 40 (Paris .PA) ---
  "MC.PA",    // LVMH
  "OR.PA",    // L'Oreal
  "TTE.PA",   // TotalEnergies
  "SAN.PA",   // Sanofi
  "AI.PA",    // Air Liquide
  "SU.PA",    // Schneider Electric
  "BN.PA",    // Danone
  "CS.PA",    // AXA
  "RI.PA",    // Pernod Ricard
  "DSY.PA",   // Dassault Systemes
  "SAF.PA",   // Safran
  "AIR.PA",   // Airbus
  "KER.PA",   // Kering
  "BNP.PA",   // BNP Paribas
  "GLE.PA",   // Societe Generale
  "CAP.PA",   // Capgemini
  "VIV.PA",   // Vivendi
  "ORA.PA",   // Orange
  "SGO.PA",   // Saint-Gobain
  "DG.PA",    // Vinci
  "RMS.PA",   // Hermes
  "EL.PA",    // EssilorLuxottica
  "STLAP.PA", // Stellantis
  "EN.PA",    // Bouygues
  "LR.PA",    // Legrand
  "PUB.PA",   // Publicis
  "URW.PA",   // Unibail-Rodamco
  "HO.PA",    // Thales
  "ML.PA",    // Michelin
  "ACA.PA",   // Credit Agricole

  // --- DAX 40 (Frankfurt .DE) ---
  "SAP.DE",   // SAP
  "SIE.DE",   // Siemens
  "ALV.DE",   // Allianz
  "DTE.DE",   // Deutsche Telekom
  "MUV2.DE",  // Munich Re
  "DHL.DE",   // DHL Group
  "BAS.DE",   // BASF
  "BAYN.DE",  // Bayer
  "BMW.DE",   // BMW
  "MBG.DE",   // Mercedes-Benz
  "VOW3.DE",  // Volkswagen
  "ADS.DE",   // Adidas
  "IFX.DE",   // Infineon
  "HEN3.DE",  // Henkel
  "DB1.DE",   // Deutsche Boerse
  "RWE.DE",   // RWE
  "DTG.DE",   // Daimler Truck
  "BEI.DE",   // Beiersdorf
  "SRT3.DE",  // Sartorius
  "FRE.DE",   // Fresenius

  // --- FTSE 100 top ~40 (London .L) ---
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

  // --- Nordic & Benelux (US-listed or local) ---
  "ASML",     // ASML (US-listed)
  "NVO",      // Novo Nordisk (US-listed)
  "NXPI",     // NXP Semiconductors (US-listed)
  "SPOT",     // Spotify (US-listed)
  "ERIC",     // Ericsson (US-listed)
  "VOLV-B.ST", // Volvo
  "AZN",      // AstraZeneca (US-listed)
  "SHEL",     // Shell (US-listed)

  // --- Swiss ---
  "NESN.SW",  // Nestle
  "NOVN.SW",  // Novartis
  "ROG.SW",   // Roche
  "UBSG.SW",  // UBS
  "ABBN.SW",  // ABB
  "ZURN.SW",  // Zurich Insurance
] as const;
