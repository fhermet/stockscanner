import { DataProvider } from "./provider";
import { MockDataProvider } from "./mock-provider";
import { CachedDataProvider } from "./cache";

export type { DataProvider } from "./provider";
export { MockDataProvider } from "./mock-provider";
export { CachedDataProvider } from "./cache";

let instance: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (instance) return instance;

  const baseProvider = new MockDataProvider();
  instance = new CachedDataProvider(baseProvider);

  return instance;
}
