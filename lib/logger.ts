import fs from "fs";
import path from "path";
import { ensureAppDataDir, getAppDataDir } from "./paths";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function getLogFilePath(): string {
  return path.join(getAppDataDir(), "snatcharr.log");
}

const MAX_BUFFER = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const logBuffer: Array<{ ts: string; level: LogLevel; msg: string }> = [];
let minLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

function ensureLogDir(): void {
  ensureAppDataDir();
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

/** Mask API keys / long tokens in log lines. */
function mask(msg: string): string {
  return msg
    .replace(/([a-zA-Z0-9]{24,})/g, (match) =>
      match.length > 8 ? `${match.slice(0, 4)}****${match.slice(-4)}` : match,
    )
    .replace(/(password|api[_-]?key|token)([=:]\s*)(\S+)/gi, "$1$2****");
}

function appendToFile(line: string): void {
  try {
    ensureLogDir();
    fs.appendFileSync(getLogFilePath(), `${line}\n`, "utf-8");
    const stat = fs.statSync(getLogFilePath());
    if (stat.size > MAX_FILE_BYTES) {
      const rotated = `${getLogFilePath()}.1`;
      if (fs.existsSync(rotated)) fs.unlinkSync(rotated);
      fs.renameSync(getLogFilePath(), rotated);
    }
  } catch {
    // Disk logging must never break the app.
  }
}

export function appendLog(level: LogLevel, msg: string): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const safeMsg = mask(msg);
  const entry = { ts, level, msg: safeMsg };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift();
  appendToFile(`${ts} [${level.toUpperCase().padEnd(5)}] ${safeMsg}`);
}

export function readLogFileLines(
  limit = 500,
  offset = 0,
): Array<{ ts: string; level: LogLevel; msg: string }> {
  try {
    if (!fs.existsSync(getLogFilePath())) return [];
    const raw = fs.readFileSync(getLogFilePath(), "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean).reverse();
    const slice = lines.slice(offset, offset + limit);
    return slice.map((line) => {
      const m = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]\s+(.*)$/);
      if (!m) return { ts: "", level: "info" as LogLevel, msg: line };
      const level = m[2].toLowerCase() as LogLevel;
      return { ts: m[1], level, msg: m[3] };
    });
  } catch {
    return [];
  }
}

export function cleanupLogFiles(): number {
  let removed = 0;
  for (const file of [`${getLogFilePath()}.1`, `${getLogFilePath()}.2`]) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        removed++;
      }
    } catch {
      // ignore
    }
  }
  return removed;
}

function stringifyMeta(meta: unknown): string {
  if (meta === undefined) return "";
  if (meta instanceof Error) return ` — ${meta.message}`;
  if (typeof meta === "string") return ` — ${meta}`;
  try {
    return ` — ${JSON.stringify(meta)}`;
  } catch {
    return ` — ${String(meta)}`;
  }
}

function write(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  const line = `[${scope.toUpperCase()}] ${message}${stringifyMeta(meta)}`;
  appendLog(level, line);
  if (!shouldLog(level)) return;
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "debug"
          ? console.debug
          : console.info;
  fn(`${level.toUpperCase().padEnd(5)} ${line}`);
}

/** Low-level scoped logger — prefer logAction() for user-facing events. */
export const logger = {
  debug: (scope: string, message: string, meta?: unknown) => write("debug", scope, message, meta),
  info: (scope: string, message: string, meta?: unknown) => write("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) => write("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) => write("error", scope, message, meta),
};
