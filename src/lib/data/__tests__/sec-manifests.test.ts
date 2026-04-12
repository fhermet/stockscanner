import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";

const SEC_DIR = path.join(process.cwd(), "public", "data", "sec");

interface Manifest {
  tickers: string[];
  count: number;
}

async function loadManifest(filename: string): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(path.join(SEC_DIR, filename), "utf-8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

describe("SEC manifest consistency", () => {
  it("_index.json exists and has tickers", async () => {
    const index = await loadManifest("_index.json");
    expect(index).not.toBeNull();
    expect(index!.tickers.length).toBeGreaterThan(0);
    expect(index!.count).toBe(index!.tickers.length);
  });

  it("_sp500.json tickers are a subset of _index.json", async () => {
    const index = await loadManifest("_index.json");
    const sp500 = await loadManifest("_sp500.json");
    if (!index || !sp500) return; // skip if manifests don't exist

    const indexSet = new Set(index.tickers);
    const orphans = sp500.tickers.filter((t) => !indexSet.has(t));
    expect(orphans).toEqual([]);
  });

  it("_nasdaq100.json tickers are a subset of _index.json", async () => {
    const index = await loadManifest("_index.json");
    const ndx = await loadManifest("_nasdaq100.json");
    if (!index || !ndx) return;

    const indexSet = new Set(index.tickers);
    const orphans = ndx.tickers.filter((t) => !indexSet.has(t));
    expect(orphans).toEqual([]);
  });

  it("_dowjones.json tickers are a subset of _index.json", async () => {
    const index = await loadManifest("_index.json");
    const dj = await loadManifest("_dowjones.json");
    if (!index || !dj) return;

    const indexSet = new Set(index.tickers);
    const orphans = dj.tickers.filter((t) => !indexSet.has(t));
    expect(orphans).toEqual([]);
  });

  it("every ticker in _index.json has a corresponding JSON file", async () => {
    const index = await loadManifest("_index.json");
    if (!index) return;

    const missing: string[] = [];
    for (const ticker of index.tickers) {
      try {
        await fs.access(path.join(SEC_DIR, `${ticker}.json`));
      } catch {
        missing.push(ticker);
      }
    }
    expect(missing).toEqual([]);
  });

  it("per-index manifest counts match their ticker arrays", async () => {
    for (const file of ["_sp500.json", "_nasdaq100.json", "_dowjones.json"]) {
      const manifest = await loadManifest(file);
      if (!manifest) continue;
      expect(manifest.count).toBe(manifest.tickers.length);
    }
  });

  it("per-index manifests have no duplicate tickers", async () => {
    for (const file of ["_index.json", "_sp500.json", "_nasdaq100.json", "_dowjones.json"]) {
      const manifest = await loadManifest(file);
      if (!manifest) continue;
      const unique = new Set(manifest.tickers);
      expect(unique.size).toBe(manifest.tickers.length);
    }
  });
});
