/**
 * Reads per-index manifest files from public/data/sec/ and generates
 * TypeScript ticker lists in src/lib/indices/generated/.
 *
 * The pipeline writes _sp500.json, _nasdaq100.json, _dowjones.json alongside
 * the global _index.json. This script reads each per-index manifest and
 * generates the corresponding TS file.
 *
 * SEC data uses dot notation (BRK.B), Yahoo uses dash notation (BRK-B).
 * This script normalizes to Yahoo convention.
 *
 * Usage: npx tsx scripts/generate-sp500-tickers.ts
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = join(new URL(".", import.meta.url).pathname, "..");
const SEC_DIR = join(ROOT, "public", "data", "sec");
const OUTPUT_DIR = join(ROOT, "src", "lib", "indices", "generated");

interface SecIndex {
  readonly schema_version: string;
  readonly last_updated: string;
  readonly tickers: readonly string[];
  readonly count: number;
}

function secToYahoo(ticker: string): string {
  return ticker.replace(/\./g, "-");
}

function generateIndex(
  indexId: string,
  constName: string,
  manifestFile: string
): void {
  const manifestPath = join(SEC_DIR, manifestFile);

  if (!existsSync(manifestPath)) {
    // Fallback to _index.json for backwards compat (before per-index manifests)
    const fallbackPath = join(SEC_DIR, "_index.json");
    if (indexId === "sp500" && existsSync(fallbackPath)) {
      console.warn(
        `  Warning: ${manifestFile} not found, falling back to _index.json (contains all indices)`
      );
      generateFromFile(fallbackPath, indexId, constName);
      return;
    }
    console.warn(`  Skipping ${indexId}: ${manifestFile} not found`);
    return;
  }

  generateFromFile(manifestPath, indexId, constName);
}

function generateFromFile(
  filePath: string,
  indexId: string,
  constName: string
): void {
  const raw = readFileSync(filePath, "utf-8");
  const index: SecIndex = JSON.parse(raw);

  const tickers = index.tickers.map(secToYahoo).sort();
  const outputPath = join(OUTPUT_DIR, `${indexId}.ts`);

  const lines: string[] = [
    "/**",
    ` * Auto-generated from SEC pipeline manifest`,
    ` * Last updated: ${index.last_updated}`,
    ` * Total: ${tickers.length} tickers`,
    " *",
    " * Run: npx tsx scripts/generate-sp500-tickers.ts",
    " */",
    "",
    `export const ${constName} = [`,
  ];

  for (let i = 0; i < tickers.length; i += 8) {
    const chunk = tickers.slice(i, i + 8);
    const formatted = chunk.map((t) => `"${t}"`).join(", ");
    lines.push(`  ${formatted},`);
  }

  lines.push("] as const;");
  lines.push("");

  writeFileSync(outputPath, lines.join("\n"), "utf-8");
  console.log(`  ${indexId}: ${tickers.length} tickers -> ${outputPath}`);
}

// Ensure output directory exists
mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("Generating index ticker lists...");
generateIndex("sp500", "SP500_TICKERS", "_sp500.json");
generateIndex("nasdaq100", "NASDAQ100_TICKERS", "_nasdaq100.json");
generateIndex("dowjones", "DOWJONES_TICKERS", "_dowjones.json");
console.log("Done.");
