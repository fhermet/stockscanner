export interface IndexDefinition {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly country: string;
  readonly countryCode: string; // "us", "fr", "de", "gb", "ch", "eu"
  readonly description: string;
  readonly tickers: readonly string[];
  readonly theoreticalCount: number; // official number of constituents
}

export interface CountryInfo {
  readonly code: string;
  readonly name: string;
  readonly flag: string;
  readonly indexCount: number;
}
