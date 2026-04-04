import { DataProvider } from "./provider";
import { MockDataProvider } from "./mock-provider";
import { FMPDataProvider } from "./fmp-provider";
import { CachedDataProvider } from "./cache";

export type { DataProvider } from "./provider";
export { MockDataProvider } from "./mock-provider";
export { FMPDataProvider } from "./fmp-provider";
export { CachedDataProvider } from "./cache";

/**
 * Factory singleton pour le DataProvider.
 *
 * Lit FMP_API_KEY dans les variables d'environnement.
 * Si absent, utilise le mock provider.
 * Le cache est toujours actif.
 */
let instance: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (instance) return instance;

  const fmpKey = process.env.FMP_API_KEY;

  const baseProvider = fmpKey
    ? new FMPDataProvider(fmpKey)
    : new MockDataProvider();

  instance = new CachedDataProvider(baseProvider);

  return instance;
}
