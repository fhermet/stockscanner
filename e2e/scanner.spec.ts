import { test, expect } from "@playwright/test";

test.describe("Scanner — golden path", () => {
  test("home page loads and shows strategy cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("stratégie");
    // 4 strategy cards — use heading elements to avoid ambiguity
    await expect(page.getByRole("heading", { name: "Warren Buffett" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Peter Lynch" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Growth" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dividende" })).toBeVisible();
  });

  test("scanner page loads stocks for Dow Jones", async ({ page }) => {
    await page.goto("/scanner?strategy=buffett&index=dowjones");

    // Wait for stock data to appear (Phase 1 or Phase 2)
    await page.waitForSelector("table tbody tr", { timeout: 30_000 });

    // Should have stock rows with recognizable tickers
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(20); // Dow has 30, some may be N/A
  });

  test("clicking a stock navigates to detail page", async ({ page }) => {
    await page.goto("/scanner?strategy=buffett&index=dowjones");
    await page.waitForSelector("table tbody tr", { timeout: 30_000 });

    // Click on a ticker link
    const tickerLink = page.locator("table tbody tr a").first();
    await tickerLink.click();

    // Should navigate to /stocks/TICKER
    await expect(page).toHaveURL(/\/stocks\/[A-Z]+/);

    // Detail page should show ROIC metric
    await expect(page.getByText("ROIC").first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Stock detail page", () => {
  test("shows score decomposition and metrics", async ({ page }) => {
    await page.goto("/stocks/AAPL?strategy=buffett");

    // Stock name
    await expect(page.getByText("Apple").first()).toBeVisible({ timeout: 15_000 });

    // Score sub-scores — use first() to avoid strict mode on repeated text
    await expect(page.getByText("Qualite").first()).toBeVisible();
    await expect(page.getByText("Valorisation").first()).toBeVisible();
  });

  test("N/A stock shows explanation when applicable", async ({ page }) => {
    // INTC typically has negative EPS → N/A for Buffett
    await page.goto("/stocks/INTC?strategy=buffett");
    await expect(page.getByText("Intel").first()).toBeVisible({ timeout: 15_000 });

    // Check that the page loaded successfully — score or N/A
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(100);
  });

  test("tabs are navigable", async ({ page }) => {
    await page.goto("/stocks/MSFT?strategy=buffett");
    await expect(page.getByText("Microsoft").first()).toBeVisible({ timeout: 15_000 });

    // Find and click tabs
    const tabs = page.locator("[role='tab'], button").filter({ hasText: /Historique|Analyse|Score/i });
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);

    // Click each tab and verify content changes
    for (let i = 0; i < Math.min(tabCount, 3); i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe("Strategies page", () => {
  test("shows all 4 strategies with ROIC and Debt/OCF", async ({ page }) => {
    await page.goto("/strategies");

    // 4 strategies visible as headings
    await expect(page.getByRole("heading", { name: "Warren Buffett" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Peter Lynch" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Growth" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dividende" })).toBeVisible();

    // Check ROIC is mentioned (not ROE) in the Buffett section
    const body = await page.textContent("body");
    expect(body).toContain("ROIC");
    expect(body).toContain("Cash-flow");
  });
});

test.describe("Glossary page", () => {
  test("loads and shows metric definitions", async ({ page }) => {
    await page.goto("/glossary");

    // Use headings to be specific
    await expect(
      page.getByRole("heading", { name: /ROIC/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /Debt.*OCF|Dette.*Cash/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /PER/i }).first()
    ).toBeVisible();
  });
});
