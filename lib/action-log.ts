import { appendLog, type LogLevel } from "./logger";
import type { ActionOutcome } from "./action-log-format";

export interface ActionLogInput {
  domain: string;
  action: string;
  outcome: ActionOutcome;
  username?: string;
  details?: string;
  error?: unknown;
  req?: Request;
  /** Override auto level from outcome */
  level?: LogLevel;
}

export function errorDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown error";
}

export function clientIp(req?: Request): string | null {
  if (!req) return null;
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

function outcomeLevel(outcome: ActionOutcome): LogLevel {
  switch (outcome) {
    case "ok":
      return "info";
    case "failed":
      return "error";
    case "denied":
    case "aborted":
      return "warn";
  }
}

/** Build a consistent, human-readable log line. */
export function formatActionLine(input: ActionLogInput): string {
  const ip = clientIp(input.req);
  let detail = input.details?.trim();
  if (!detail && input.error !== undefined) {
    detail = errorDetail(input.error);
  }

  const parts = [`[${input.domain}]`, input.action, input.outcome];
  if (input.username) parts.push(`@${input.username}`);
  if (detail) parts.push(`— ${detail}`);
  if (ip) parts.push(`(${ip})`);
  return parts.join(" ");
}

/** Primary action logger — live log + console. */
export function logAction(input: ActionLogInput): void {
  const level = input.level ?? outcomeLevel(input.outcome);
  const line = formatActionLine(input);
  appendLog(level, line);

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

const LEGACY_ACTIONS: Record<
  string,
  Pick<ActionLogInput, "domain" | "action" | "outcome">
> = {
  "auth.login": { domain: "AUTH", action: "login", outcome: "ok" },
  "auth.failed": { domain: "AUTH", action: "login", outcome: "failed" },
  "auth.import": { domain: "AUTH", action: "import", outcome: "ok" },
  "auth.ratelimit": { domain: "AUTH", action: "ratelimit", outcome: "denied" },
  "grab.create": { domain: "GRAB", action: "create", outcome: "ok" },
  "grab.failed": { domain: "GRAB", action: "create", outcome: "failed" },
  "grab.delete": { domain: "GRAB", action: "delete", outcome: "ok" },
  "grab.visibility": { domain: "GRAB", action: "visibility", outcome: "ok" },
  "grab.download": { domain: "GRAB", action: "download", outcome: "ok" },
  search: { domain: "SEARCH", action: "query", outcome: "ok" },
  "user.sync": { domain: "SYNC", action: "user", outcome: "ok" },
  "user.create": { domain: "USER", action: "create", outcome: "ok" },
  "user.update": { domain: "USER", action: "update", outcome: "ok" },
  "user.delete": { domain: "USER", action: "delete", outcome: "ok" },
  "settings.update": { domain: "SETTINGS", action: "update", outcome: "ok" },
  "task.run": { domain: "TASK", action: "run", outcome: "ok" },
  "setup.complete": { domain: "SETUP", action: "complete", outcome: "ok" },
};

/** Map legacy dotted actions (auth.login, grab.failed) to structured input. */
export function fromLegacyAction(
  action: string,
  opts: {
    username?: string;
    details?: string;
    level?: LogLevel;
    req?: Request;
    error?: unknown;
  } = {},
): ActionLogInput {
  const preset = LEGACY_ACTIONS[action];
  if (preset) {
    let outcome = preset.outcome;
    if (opts.level === "error") outcome = "failed";
    else if (opts.level === "warn" && outcome === "ok") outcome = "denied";
    return {
      ...preset,
      outcome,
      username: opts.username,
      details: opts.details,
      error: opts.error,
      req: opts.req,
      level: opts.level,
    };
  }

  const parts = action.split(".");
  const domain = (parts[0] ?? "app").toUpperCase();
  const last = parts[parts.length - 1] ?? "action";

  if (last === "failed") {
    return {
      domain,
      action: parts.slice(1, -1).join(".") || "action",
      outcome: "failed",
      username: opts.username,
      details: opts.details,
      error: opts.error,
      req: opts.req,
      level: opts.level ?? "error",
    };
  }

  let outcome: ActionOutcome = "ok";
  if (opts.level === "error") outcome = "failed";
  else if (opts.level === "warn") outcome = "denied";

  return {
    domain,
    action: parts.slice(1).join(".") || last,
    outcome,
    username: opts.username,
    details: opts.details,
    error: opts.error,
    req: opts.req,
    level: opts.level,
  };
}
