import { IndexDefinition } from "./types";

export const SP500: IndexDefinition = {
  id: "sp500",
  name: "S&P 500",
  shortName: "S&P 500",
  country: "USA",
  countryCode: "us",
  description: "Les 500 plus grandes capitalisations americaines",
  theoreticalCount: 500,
  tickers: [
    // Top ~200 S&P 500 components by market cap
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOG", "META", "BRK-B", "AVGO",
    "LLY", "JPM", "TSLA", "UNH", "V", "MA", "ORCL", "COST",
    "HD", "PG", "JNJ", "ABBV", "CRM", "BAC", "NFLX", "WMT",
    "MRK", "CVX", "KO", "PEP", "AMD", "TMO", "LIN", "ACN",
    "CSCO", "MCD", "ADBE", "ABT", "WFC", "GS", "ISRG", "QCOM",
    "TXN", "INTC", "CAT", "AMGN", "INTU", "AMAT", "GE", "MS",
    "PFE", "IBM", "VZ", "NOW", "SPGI", "AXP", "SYK", "BLK",
    "HON", "NEE", "UNP", "RTX", "LOW", "DE", "TJX", "LRCX",
    "PGR", "BKNG", "SCHW", "ADI", "BMY", "ELV", "LMT", "VRTX",
    "ADP", "CB", "MMC", "SBUX", "MU", "GILD", "BSX", "MDT",
    "PANW", "CI", "CME", "NKE", "BDX", "ICE", "REGN", "KLAC",
    "SO", "DUK", "SLB", "CL", "CMG", "EOG", "ITW", "SNPS",
    "CDNS", "NOC", "SHW", "APD", "GD", "MMM", "EMR", "ORLY",
    "FDX", "PLD", "AMT", "EQIX", "PSA", "O", "SPG", "WM",
    "COP", "MPC", "PSX", "VLO", "OXY", "AEP", "D", "SRE",
    "XEL", "ED", "WEC", "CTAS", "PCAR", "FAST", "RSG", "MCK",
    "ECL", "FCX", "NEM", "NUE", "DOW", "DD", "PPG", "CSX",
    "NSC", "UPS", "AON", "USB", "PNC", "TFC", "AIG", "MET",
    "AFL", "ALL", "TRV", "COF", "FIS", "PYPL", "BK", "MCO",
    "MSCI", "HCA", "ZTS", "DXCM", "IDXX", "IQV", "EW", "A",
    "CRWD", "FTNT", "T", "TMUS", "CHTR", "CMCSA", "CCI", "DLR",
    "WELL", "AVB", "XOM", "BA", "HES", "MRNA", "BIIB", "GIS",
    "KMB", "HSY", "SJM", "STZ", "ADM", "KR", "SYY", "WBA",
    "HLT", "MAR", "YUM", "DPZ", "DHI", "LEN", "GM", "F",
    "ROST", "AZO", "LULU", "DECK", "GRMN", "GEHC", "DELL",
  ],
};

export const NASDAQ100: IndexDefinition = {
  id: "nasdaq100",
  name: "NASDAQ 100",
  shortName: "NDX 100",
  country: "USA",
  countryCode: "us",
  description: "Les 100 plus grandes capitalisations du NASDAQ",
  theoreticalCount: 100,
  tickers: [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "AVGO", "TSLA", "GOOG",
    "COST", "NFLX", "AMD", "ADBE", "PEP", "CSCO", "INTC", "QCOM",
    "TXN", "INTU", "AMAT", "LRCX", "ADI", "MU", "KLAC", "SNPS",
    "CDNS", "CRWD", "PANW", "FTNT", "MRVL", "NOW", "CRM", "ORCL",
    "ADSK", "WDAY", "TEAM", "DDOG", "ZS", "NET", "HUBS", "PLTR",
    "UBER", "ABNB", "SQ", "SHOP", "DASH", "SNOW", "ISRG", "VRTX",
    "GILD", "AMGN", "REGN", "BIIB", "ILMN", "MRNA", "DXCM", "IDXX",
    "BKNG", "SBUX", "CMG", "LULU", "ORLY", "AZO", "ROST",
    "HON", "CAT", "GE", "CSX", "PCAR", "FAST", "CTAS", "GEHC",
    "KO", "PEP", "MDLZ", "KHC", "MNST",
    "T", "TMUS", "CHTR", "CMCSA",
    "XOM", "PDD", "MELI", "PYPL", "ADP", "NXPI",
  ],
};

export const DOW_JONES: IndexDefinition = {
  id: "dowjones",
  name: "Dow Jones Industrial Average",
  shortName: "Dow 30",
  country: "USA",
  countryCode: "us",
  description: "Les 30 blue chips americaines",
  theoreticalCount: 30,
  tickers: [
    "AAPL", "AMGN", "AMZN", "AXP", "BA", "CAT", "CRM", "CSCO",
    "CVX", "DIS", "GS", "HD", "HON", "IBM", "INTC", "JNJ",
    "JPM", "KO", "MCD", "MMM", "MRK", "MSFT", "NKE", "PG",
    "TRV", "UNH", "V", "VZ", "WBA", "WMT",
  ],
};

export const US_INDICES = [SP500, NASDAQ100, DOW_JONES] as const;
