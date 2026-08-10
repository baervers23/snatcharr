import { db } from "./db";
import { auditLog } from "./db/schema";
import {
  clientIp,
  formatActionLine,
  fromLegacyAction,
  logAction,
  type ActionLogInput,
} from "./action-log";

export { logAction } from "./action-log";
import { type LogLevel } from "./logger";

export interface AuditOptions {
  userId?: string;
  username?: string;
  details?: string;
  level?: LogLevel;
  req?: Request;
  error?: unknown;
}

/** Actions persisted to the admin audit log. */
const ADMIN_AUDIT_ACTIONS = new Set([
  "settings.update",
  "user.create",
  "user.update",
  "user.delete",
  "user.sync",
  "indexer.create",
  "indexer.update",
  "indexer.delete",
  "download-client.create",
  "download-client.update",
  "download-client.delete",
  "app.create",
  "app.update",
  "app.delete",
  "grab.delete",
  "grab.download",
  "task.run",
  "setup.complete",
]);

/** Live system log — structured action format. */
export function logEvent(action: string, opts: AuditOptions = {}): void {
  logAction(fromLegacyAction(action, opts));
}

/** Structured action log with optional DB audit trail. */
async function logAuditAction(input: ActionLogInput & { auditKey?: string; userId?: string }): Promise<void> {
  logAction(input);

  const auditKey = input.auditKey;
  if (!auditKey || !ADMIN_AUDIT_ACTIONS.has(auditKey) || input.outcome !== "ok") return;

  const ipAddress = clientIp(input.req);
  const userAgent = input.req?.headers.get("user-agent") ?? null;

  try {
    await db.insert(auditLog).values({
      userId: input.userId ?? null,
      action: auditKey,
      details: input.details ?? null,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });
  } catch {
    // Audit must never break the main request path.
  }
}

/** Admin audit trail — success only, also mirrored to live logs. */
export async function logAudit(action: string, opts: AuditOptions = {}): Promise<void> {
  const input = fromLegacyAction(action, { ...opts, level: opts.level ?? "info" });
  if (input.outcome !== "ok") input.outcome = "ok";
  await logAuditAction({
    ...input,
    auditKey: action,
    userId: opts.userId,
    details: opts.details ?? formatActionLine(input).replace(/^\[[^\]]+\]\s+/, ""),
  });
}

/** Log a failed or denied action without DB persistence. */
export function logActionFail(
  domain: string,
  action: string,
  outcome: "failed" | "denied" | "aborted",
  opts: Omit<AuditOptions, "level"> = {},
): void {
  logAction({
    domain,
    action,
    outcome,
    username: opts.username,
    details: opts.details,
    error: opts.error,
    req: opts.req,
  });
}
