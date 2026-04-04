/**
 * US equity universe — S&P 500 top components + NASDAQ 100 additions.
 * ~250 tickers covering all GICS sectors.
 */

export const US_TICKERS = [
  // --- Technology (~50) ---
  "AAPL", "MSFT", "NVDA", "GOOG", "GOOGL", "META", "AVGO", "ORCL",
  "CRM", "ADBE", "AMD", "CSCO", "ACN", "INTC", "QCOM", "TXN",
  "NOW", "IBM", "AMAT", "INTU", "PANW", "MU", "LRCX", "ADI",
  "KLAC", "SNPS", "CDNS", "CRWD", "FTNT", "MRVL", "MSI", "ADSK",
  "PLTR", "NET", "SNOW", "SQ", "SHOP", "UBER", "ABNB", "DASH",
  "DDOG", "ZS", "TEAM", "WDAY", "HUBS", "MSTR", "DELL", "HPQ",

  // --- Healthcare (~35) ---
  "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "DHR",
  "PFE", "AMGN", "BMY", "MDT", "ISRG", "GILD", "VRTX", "SYK",
  "BSX", "REGN", "ZTS", "ELV", "CI", "HCA", "BDX", "MCK",
  "DXCM", "IDXX", "IQV", "EW", "A", "MRNA", "BIIB", "ILMN",
  "GEHC", "HUM", "CNC",

  // --- Financials (~35) ---
  "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS",
  "SPGI", "BLK", "AXP", "SCHW", "C", "CB", "MMC", "ICE",
  "PGR", "CME", "AON", "USB", "PNC", "TFC", "AIG", "MET",
  "AFL", "ALL", "TRV", "COF", "FIS", "PYPL", "SYF", "DFS",
  "BK", "MCO", "MSCI",

  // --- Consumer Staples (~20) ---
  "PG", "KO", "PEP", "WMT", "COST", "PM", "MO", "CL",
  "MDLZ", "KHC", "GIS", "SJM", "KMB", "HSY", "STZ", "TAP",
  "ADM", "KR", "SYY", "WBA",

  // --- Consumer Discretionary (~25) ---
  "AMZN", "TSLA", "HD", "MCD", "NKE", "LOW", "SBUX", "TJX",
  "BKNG", "CMG", "ORLY", "AZO", "ROST", "MAR", "HLT", "GM",
  "F", "YUM", "DPZ", "DHI", "LEN", "LULU", "DECK", "POOL",
  "GRMN",

  // --- Industrials (~30) ---
  "GE", "CAT", "HON", "UPS", "RTX", "DE", "LMT", "BA",
  "UNP", "ADP", "MMM", "GD", "ITW", "NOC", "WM", "EMR",
  "FDX", "CSX", "NSC", "CTAS", "PCAR", "FAST", "RSG", "JCI",
  "TT", "ROK", "CARR", "OTIS", "VRSK", "IR",

  // --- Energy (~15) ---
  "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO",
  "OXY", "WMB", "KMI", "HAL", "DVN", "FANG", "HES",

  // --- Utilities (~10) ---
  "NEE", "SO", "DUK", "D", "AEP", "SRE", "EXC", "XEL",
  "ED", "WEC",

  // --- Real Estate (~10) ---
  "PLD", "AMT", "EQIX", "CCI", "PSA", "O", "SPG", "WELL",
  "DLR", "AVB",

  // --- Telecom (~5) ---
  "T", "VZ", "TMUS", "CHTR", "CMCSA",

  // --- Materials (~10) ---
  "LIN", "APD", "SHW", "ECL", "FCX", "NEM", "NUE", "DOW",
  "DD", "PPG",
] as const;
