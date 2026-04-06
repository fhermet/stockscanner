/**
 * Input validation utilities for API routes.
 */

const TICKER_PATTERN = /^[A-Z0-9.]{1,10}$/;

export function isValidTicker(ticker: unknown): ticker is string {
  return typeof ticker === "string" && TICKER_PATTERN.test(ticker.toUpperCase());
}
