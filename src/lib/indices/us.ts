import { IndexDefinition } from "./types";
import { SP500_TICKERS } from "./generated/sp500";
import { SP400_TICKERS } from "./generated/sp400";
import { SP600_TICKERS } from "./generated/sp600";
import { NASDAQ100_TICKERS } from "./generated/nasdaq100";
import { DOWJONES_TICKERS } from "./generated/dowjones";

export const SP500: IndexDefinition = {
  id: "sp500",
  name: "S&P 500",
  shortName: "S&P 500",
  country: "USA",
  countryCode: "us",
  description: "Les 500 plus grandes capitalisations americaines",
  theoreticalCount: 500,
  tickers: SP500_TICKERS as unknown as readonly string[],
};

export const SP400: IndexDefinition = {
  id: "sp400",
  name: "S&P MidCap 400",
  shortName: "S&P 400",
  country: "USA",
  countryCode: "us",
  description: "Les 400 capitalisations moyennes americaines (5-15 Mds$)",
  theoreticalCount: 400,
  tickers: SP400_TICKERS as unknown as readonly string[],
};

export const SP600: IndexDefinition = {
  id: "sp600",
  name: "S&P SmallCap 600",
  shortName: "S&P 600",
  country: "USA",
  countryCode: "us",
  description: "Les 600 petites capitalisations americaines (1-5 Mds$)",
  theoreticalCount: 600,
  tickers: SP600_TICKERS as unknown as readonly string[],
};

export const NASDAQ100: IndexDefinition = {
  id: "nasdaq100",
  name: "NASDAQ 100",
  shortName: "NDX 100",
  country: "USA",
  countryCode: "us",
  description: "Les 100 plus grandes capitalisations du NASDAQ",
  theoreticalCount: 100,
  tickers: NASDAQ100_TICKERS as unknown as readonly string[],
};

export const DOW_JONES: IndexDefinition = {
  id: "dowjones",
  name: "Dow Jones Industrial Average",
  shortName: "Dow 30",
  country: "USA",
  countryCode: "us",
  description: "Les 30 blue chips americaines",
  theoreticalCount: 30,
  tickers: DOWJONES_TICKERS as unknown as readonly string[],
};

export const US_INDICES = [SP500, SP400, SP600, NASDAQ100, DOW_JONES] as const;
