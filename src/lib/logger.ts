/**
 * Minimal structured logger for server-side observability.
 *
 * Outputs JSON lines to stdout. Each entry has:
 * - level: info | warn | error
 * - module: caller identity (e.g. "yahoo-provider", "cache")
 * - msg: human-readable message
 * - data: optional structured payload
 * - ts: ISO timestamp
 *
 * In production, these can be piped to any log aggregator.
 * In dev, they show up in the terminal.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  module: string;
  msg: string;
  data?: Record<string, unknown>;
  ts: string;
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(module: string) {
  return {
    info(msg: string, data?: Record<string, unknown>) {
      emit({ level: "info", module, msg, data, ts: new Date().toISOString() });
    },
    warn(msg: string, data?: Record<string, unknown>) {
      emit({ level: "warn", module, msg, data, ts: new Date().toISOString() });
    },
    error(msg: string, data?: Record<string, unknown>) {
      emit({ level: "error", module, msg, data, ts: new Date().toISOString() });
    },
  };
}
