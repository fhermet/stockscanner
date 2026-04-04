import { IndexDefinition } from "./types";

export const DAX40: IndexDefinition = {
  id: "dax40",
  name: "DAX 40",
  shortName: "DAX 40",
  country: "Allemagne",
  countryCode: "de",
  description: "Les 40 plus grandes capitalisations allemandes",
  theoreticalCount: 40,
  tickers: [
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
  ],
};

export const GERMANY_INDICES = [DAX40] as const;
