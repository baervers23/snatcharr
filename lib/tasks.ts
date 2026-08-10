import { db } from "./db";
import { downloadClients, externalApps, grabs, indexers } from "./db/schema";
import { eq } from "drizzle-orm";
import { deleteGrabFiles, getGrabDir } from "./grab-files";
import { logAction, logActionFail } from "./audit";
import { cleanupLogFiles } from "./logger";
import {
  DEFAULT_BACKGROUND_TASKS,
  getAllSettings,
  getSetting,
  setSetting,
  type BackgroundTask,
} from "./db/settings";
import { testProwlarrConnection } from "./prowlarr";
import { testSabnzbdConnection } from "./sabnzbd";
import { testExternalApp } from "./app-test";

/** Node.js setTimeout/setInterval max delay (~24.8 days). */
export const MAX_NODE_TIMEOUT_MS = 2_147_483_647;

type TaskHandle = { cancel: () => void; configKey: string };

const taskHandles = new Map<string, TaskHandle>();
let schedulerStarted = false;
let startupHealthDone = false;

function clampIntervalMs(ms: number): number {
  return Math.min(Math.max(ms, 1_000), MAX_NODE_TIMEOUT_MS);
}

function taskConfigKey(task: BackgroundTask): string {
  return `${task.enabled}:${task.intervalMs}`;
}

/** Sleep in chunks so delays longer than MAX_NODE_TIMEOUT_MS work correctly. */
function sleepMs(ms: number, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (isCancelled()) {
        resolve();
        return;
      }
      if (left <= 0) {
        resolve();
        return;
      }
      const chunk = Math.min(left, MAX_NODE_TIMEOUT_MS);
      setTimeout(() => step(left - chunk), chunk);
    };
    step(ms);
  });
}

async function updateTaskLastRun(taskId: string): Promise<void> {
  const tasks = (await getSetting("backgroundTasks")) ?? DEFAULT_BACKGROUND_TASKS;
  const updated = tasks.map((t) =>
    t.id === taskId ? { ...t, lastRunAt: new Date().toISOString() } : t,
  );
  await setSetting("backgroundTasks", updated);
}

export async function cleanupMissingGrabFolders(): Promise<number> {
  const completed = await db.query.grabs.findMany({
    where: eq(grabs.status, "completed"),
  });

  const GRACE_MS = 30 * 60 * 1000;
  let removed = 0;
  for (const grab of completed) {
    const dir = getGrabDir(grab);
    if (dir) continue;
    if (grab.completedAt && Date.now() - grab.completedAt.getTime() < GRACE_MS) continue;
    await db.delete(grabs).where(eq(grabs.id, grab.id));
    removed++;
  }
  if (removed > 0) {
    logAction({
      domain: "TASK",
      action: "cleanup-missing",
      outcome: "ok",
      details: `removed ${removed} grab(s)`,
    });
  }
  return removed;
}

export async function removeOldDownloads(): Promise<number> {
  const keepDays = await getSetting("completedGrabKeepDays");
  if (!keepDays || keepDays <= 0) return 0;

  const now = Date.now();
  const cutoff = new Date(now - keepDays * 24 * 60 * 60 * 1000);
  const completed = await db.query.grabs.findMany({
    where: eq(grabs.status, "completed"),
  });
  const old = completed.filter((grab) => {
    if (grab.expiresAt && grab.expiresAt.getTime() <= now) return true;
    if (grab.completedAt && grab.completedAt < cutoff) return true;
    return false;
  });

  const downloadBase = await getSetting("downloadDir");
  let removed = 0;
  for (const grab of old) {
    const result = deleteGrabFiles(grab, downloadBase);
    if (result.path && !result.deleted) {
      logActionFail("TASK", "cleanup-old", "failed", {
        details: `"${grab.title}" at ${result.path}`,
        error: result.error,
      });
      continue;
    }
    if (!result.path && (grab.storagePath || grab.archivePath)) {
      logActionFail("TASK", "cleanup-old", "failed", {
        details: `"${grab.title}" — folder not found (storage: ${grab.storagePath ?? grab.archivePath})`,
      });
      continue;
    }
    await db.delete(grabs).where(eq(grabs.id, grab.id));
    removed++;
  }
  if (removed > 0) {
    logAction({
      domain: "TASK",
      action: "cleanup-old",
      outcome: "ok",
      details: `removed ${removed} grab(s)`,
    });
  }
  return removed;
}

export async function runHealthCheckTask(): Promise<void> {
  const failures: string[] = [];

  const idxList = await db.query.indexers.findMany({ where: eq(indexers.enabled, true) });
  for (const idx of idxList) {
    const result = await testProwlarrConnection(idx.url, idx.apiKey);
    if (!result.ok) failures.push(`indexer ${idx.name}`);
    await db
      .update(indexers)
      .set({
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        lastCheckedAt: new Date(),
      })
      .where(eq(indexers.id, idx.id));
  }

  const clients = await db.query.downloadClients.findMany({ where: eq(downloadClients.enabled, true) });
  for (const c of clients) {
    const result = await testSabnzbdConnection(c.url, c.apiKey);
    if (!result.ok) failures.push(`client ${c.name}`);
    await db
      .update(downloadClients)
      .set({
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        lastCheckedAt: new Date(),
      })
      .where(eq(downloadClients.id, c.id));
  }

  const apps = await db.query.externalApps.findMany({ where: eq(externalApps.enabled, true) });
  for (const a of apps) {
    const result = await testExternalApp(a.type, a.url, a.apiKey ?? "");
    if (!result.ok) failures.push(`app ${a.name}`);
    await db
      .update(externalApps)
      .set({
        lastStatus: result.ok ? "ok" : "error",
        lastError: result.error ?? null,
        lastCheckedAt: new Date(),
      })
      .where(eq(externalApps.id, a.id));
  }

  startupHealthDone = true;
  await updateTaskLastRun("health-check").catch(() => {});
  if (failures.length > 0) {
    logActionFail("TASK", "health-check", "failed", {
      details: failures.join(", "),
    });
  }
}

const TASK_RUNNERS: Record<string, () => Promise<void>> = {
  "health-check": async () => {
    await runHealthCheckTask();
  },
  "remove-old-downloads": async () => {
    await removeOldDownloads();
  },
  "cleanup-logs": async () => {
    const removed = cleanupLogFiles();
    if (removed > 0) {
      logAction({
        domain: "TASK",
        action: "cleanup-logs",
        outcome: "ok",
        details: `removed ${removed} file(s)`,
      });
    }
  },
  "cleanup-missing-folders": async () => {
    await cleanupMissingGrabFolders();
  },
};

async function runTask(task: BackgroundTask): Promise<void> {
  const runner = TASK_RUNNERS[task.id];
  if (!runner) return;
  try {
    await runner();
    await updateTaskLastRun(task.id);
  } catch (err) {
    logActionFail("TASK", task.id, "failed", { details: task.name, error: err });
  }
}

/** Run a single background task immediately (admin-triggered). */
export async function runBackgroundTaskById(taskId: string): Promise<string> {
  const tasks = (await getSetting("backgroundTasks")) ?? DEFAULT_BACKGROUND_TASKS;
  const task = tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Unknown task");
  const runner = TASK_RUNNERS[task.id];
  if (!runner) throw new Error("Task cannot be run");

  await runner();
  const lastRunAt = new Date().toISOString();
  const updated = tasks.map((t) => (t.id === taskId ? { ...t, lastRunAt } : t));
  await setSetting("backgroundTasks", updated);
  return lastRunAt;
}

function startTaskLoop(task: BackgroundTask, runImmediately: boolean): void {
  let cancelled = false;
  const configKey = taskConfigKey(task);
  taskHandles.set(task.id, {
    configKey,
    cancel: () => {
      cancelled = true;
    },
  });

  const intervalMs = clampIntervalMs(task.intervalMs);

  (async () => {
    if (runImmediately) {
      await runTask(task).catch(() => {});
      if (cancelled) return;
    }
    while (!cancelled) {
      await sleepMs(intervalMs, () => cancelled);
      if (cancelled) break;
      await runTask(task).catch(() => {});
    }
  })();
}

function stopTask(taskId: string): void {
  const handle = taskHandles.get(taskId);
  if (handle) {
    handle.cancel();
    taskHandles.delete(taskId);
  }
}

export function startBackgroundTasks(): void {
  const schedule = async () => {
    const settings = await getAllSettings();
    const tasks = settings.backgroundTasks ?? DEFAULT_BACKGROUND_TASKS;
    const activeIds = new Set<string>();

    for (const task of tasks) {
      if (!task.enabled) {
        stopTask(task.id);
        continue;
      }

      activeIds.add(task.id);
      const key = taskConfigKey(task);
      const existing = taskHandles.get(task.id);

      if (existing?.configKey === key) continue;

      if (existing) stopTask(task.id);
      const runNow = task.id === "health-check" ? !startupHealthDone : true;
      startTaskLoop(task, runNow);
    }

    for (const id of [...taskHandles.keys()]) {
      if (!activeIds.has(id)) stopTask(id);
    }
  };

  schedule().catch((err) =>
    logActionFail("TASK", "scheduler", "failed", { error: err }),
  );
  if (!schedulerStarted) {
    schedulerStarted = true;
    setInterval(() => schedule().catch(() => {}), 60_000);
  }
}
