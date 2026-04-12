#!/usr/bin/env bash
#
# Refresh all SEC data and regenerate index ticker lists.
#
# Usage:
#   npm run refresh           # full refresh (scrape + ingest + export + generate)
#   npm run refresh -- --skip-ingest   # re-export and regenerate only (no SEC API calls)
#   npm run refresh -- --skip-scrape   # skip Wikipedia scrape (use cached lists)
#
# Prerequisites:
#   - stock-scanner-data repo at ../stock-scanner-data (sibling directory)
#   - Python venv set up: cd ../stock-scanner-data && make setup
#   - PostgreSQL running with stockscanner DB initialized
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$(cd "$APP_DIR/../stock-scanner-data" && pwd)"
SEC_OUTPUT="$APP_DIR/public/data/sec"

PYTHON="$DATA_DIR/.venv/bin/python"
CLI="PYTHONPATH=$DATA_DIR/src $PYTHON -m stockscanner_data.cli"

SKIP_INGEST=false
SKIP_SCRAPE=false

for arg in "$@"; do
  case "$arg" in
    --skip-ingest) SKIP_INGEST=true ;;
    --skip-scrape) SKIP_SCRAPE=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-ingest] [--skip-scrape]"
      echo ""
      echo "  --skip-ingest   Skip SEC API ingestion (re-export only)"
      echo "  --skip-scrape   Skip Wikipedia scrape (use cached index lists)"
      exit 0
      ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# --- Helpers ---

step() {
  echo ""
  echo "=== $1 ==="
}

run_cli() {
  eval "$CLI $*"
}

# --- 1. Scrape index lists from Wikipedia ---

if [ "$SKIP_SCRAPE" = false ]; then
  step "1/5 Scraping index lists from Wikipedia"
  run_cli update-sp500
  run_cli update-nasdaq100
  run_cli update-dowjones
else
  step "1/5 Skipping Wikipedia scrape (--skip-scrape)"
fi

# --- 2. Ingest SEC data ---

if [ "$SKIP_INGEST" = false ]; then
  step "2/5 Ingesting SEC data (pipeline SP500 NASDAQ100 DOWJONES)"
  run_cli pipeline SP500 NASDAQ100 DOWJONES
else
  step "2/5 Skipping SEC ingestion (--skip-ingest)"
fi

# --- 3. Export to web app ---

step "3/5 Exporting SEC data to $SEC_OUTPUT"
run_cli export-for-web SP500 NASDAQ100 DOWJONES --output-dir "$SEC_OUTPUT"

# --- 4. Generate TypeScript index ticker lists ---

step "4/5 Generating TypeScript index files"
cd "$APP_DIR"
npx tsx scripts/generate-sp500-tickers.ts

# --- 5. Verify ---

step "5/5 Verifying"
TICKER_COUNT=$(python3 -c "import json; print(json.load(open('$SEC_OUTPUT/_index.json'))['count'])")
SP500_COUNT=$(python3 -c "import json; print(json.load(open('$SEC_OUTPUT/_sp500.json'))['count'])")
NDX_COUNT=$(python3 -c "import json; print(json.load(open('$SEC_OUTPUT/_nasdaq100.json'))['count'])")
DJ_COUNT=$(python3 -c "import json; print(json.load(open('$SEC_OUTPUT/_dowjones.json'))['count'])")

echo "  Total SEC files: $TICKER_COUNT"
echo "  S&P 500:         $SP500_COUNT"
echo "  NASDAQ 100:      $NDX_COUNT"
echo "  Dow Jones:       $DJ_COUNT"

# Quick TS compilation check
npx tsc --noEmit 2>&1 | head -5
TS_EXIT=${PIPESTATUS[0]}
if [ "$TS_EXIT" -eq 0 ]; then
  echo "  TypeScript:      OK"
else
  echo "  TypeScript:      ERRORS (run npx tsc --noEmit)"
  exit 1
fi

echo ""
echo "Done. Run 'npm run dev' to start the app with fresh data."
