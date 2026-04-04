import { DataProvider } from "./provider";
import { MockDataProvider } from "./mock-provider";
import { YahooDataProvider } from "./yahoo-provider";
import { CompositeDataProvider } from "./composite-provider";
import { CachedDataProvider } from "./cache";

export type { DataProvider } from "./provider";
export { MockDataProvider } from "./mock-provider";
export { YahooDataProvider } from "./yahoo-provider";
export { CompositeDataProvider } from "./composite-provider";
export { CachedDataProvider } from "./cache";
export { getMeta } from "./metadata";

/**
 * Factory singleton pour le DataProvider.
 *
 * Chaine de resolution :
 *   Cache → Composite(Yahoo → Mock)
 *
 * Yahoo est active si YAHOO_ENABLED=true dans .env.
 * Sinon, seul le mock provider est utilise.
 * Le cache encapsule toujours le tout.
 */
let instance: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (instance) return instance;

  const providers: DataProvider[] = [];

  if (process.env.YAHOO_ENABLED === "true") {
    providers.push(new YahooDataProvider());
  }

  providers.push(new MockDataProvider());

  const composite = new CompositeDataProvider(providers);
  instance = new CachedDataProvider(composite);

  return instance;
}
