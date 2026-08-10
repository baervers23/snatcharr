import type { DownloadClient } from "./db/schema";

export interface SabnzbdQueueItem {
  nzo_id: string;
  status: string;
  filename: string;
  percentage: string;
  size: string;
  sizeleft: string;
  timeleft: string;
  speed: string;
  category: string;
  priority: string;
  script: string;
  labels?: string[];
}

interface SabStageLog {
  name: string;
  actions: string[];
}

export interface SabnzbdHistoryItem {
  nzo_id: string;
  name: string;
  status: string;
  fail_message: string;
  download_time: number;
  storage: string;
  path: string;
  category: string;
  size: string;
  bytes: number;
  completed: number;
  action_line?: string;
  report?: string;
  stage_log?: SabStageLog[];
}

export type SabJobAlert = { level: "error" | "warning"; message: string };

const SAB_WARNING_PATTERNS =
  /malformed|warning|incomplete|damaged|missing|repair|duplicat|too large|encrypt|password/i;

function stripSabHtml(text: string): string {
  return text.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();
}

export interface SabnzbdStatus {
  version: string;
  speedlimit: string;
  speedlimit_abs: string;
  paused: boolean;
  queue: {
    slots: SabnzbdQueueItem[];
    speed: string;
    kbpersec: string;
    mbleft: string;
    mb: string;
    noofslots_total: number;
    status: string;
  };
}

function buildUrl(client: DownloadClient, mode: string, extra: Record<string, string> = {}): string {
  const base = client.url.replace(/\/$/, "");
  const params = new URLSearchParams({
    apikey: client.apiKey,
    output: "json",
    mode,
    ...extra,
  });
  return `${base}/api?${params.toString()}`;
}

export async function testDownloadClientConnection(
  type: string,
  url: string,
  apiKey: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  if (type === "nzbget") {
    return testNzbgetConnection(url, apiKey);
  }
  return testSabnzbdConnection(url, apiKey);
}

async function testNzbgetConnection(
  url: string,
  password: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const base = url.replace(/\/$/, "");
    const auth = Buffer.from(`nzbget:${password}`).toString("base64");
    const response = await fetch(`${base}/jsonrpc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({ method: "version", params: [], id: 1 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const data = (await response.json()) as { result?: { Version?: string } };
    return { ok: true, version: data.result?.Version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function testSabnzbdConnection(
  url: string,
  apiKey: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const params = new URLSearchParams({ apikey: apiKey, output: "json", mode: "version" });
    const response = await fetch(`${url.replace(/\/$/, "")}/api?${params}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };

    const data = (await response.json()) as { version?: string };
    return { ok: true, version: data.version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** SABnzbd post-processing: 0 = None (download only — no repair/unpack). */
export const SAB_PP_DOWNLOAD_ONLY = "0";

/** Disable category/default scripts for this job. */
export const SAB_SCRIPT_NONE = "None";

async function sabApiGet(
  client: DownloadClient,
  mode: string,
  extra: Record<string, string> = {},
): Promise<Response> {
  const url = buildUrl(client, mode, extra);
  return fetch(url, { signal: AbortSignal.timeout(10_000) });
}

/** Force queue job to strict download-only after add (guards against category defaults). */
export async function enforceSabDownloadOnly(
  client: DownloadClient,
  nzoId: string,
): Promise<void> {
  await Promise.all([
    sabApiGet(client, "change_opts", { value: nzoId, value2: SAB_PP_DOWNLOAD_ONLY }),
    sabApiGet(client, "change_script", { value: nzoId, value2: SAB_SCRIPT_NONE }),
  ]);
}

export async function addNzbToSabnzbd(
  client: DownloadClient,
  nzbBuffer: Buffer,
  filename: string,
  category?: string,
  password?: string | null,
): Promise<string> {
  const base = client.url.replace(/\/$/, "");
  const formData = new FormData();
  formData.append("apikey", client.apiKey);
  formData.append("output", "json");
  formData.append("mode", "addfile");
  formData.append("cat", category ?? client.category ?? "snatcharr");
  formData.append("pp", SAB_PP_DOWNLOAD_ONLY);
  formData.append("script", SAB_SCRIPT_NONE);
  if (password?.trim()) {
    formData.append("password", password.trim());
  }
  formData.append("nzbfile", new Blob([new Uint8Array(nzbBuffer)], { type: "application/x-nzb" }), filename);

  const response = await fetch(`${base}/api`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`SABnzbd add NZB failed: HTTP ${response.status}`);

  const data = (await response.json()) as {
    ids?: string[];
    nzo_ids?: string[];
    status?: boolean;
    error?: string;
  };

  const jobIds = data.nzo_ids ?? data.ids;
  if (!data.status || !jobIds?.length) {
    throw new Error(
      data.error
        ? `SABnzbd rejected the NZB: ${data.error}`
        : "SABnzbd did not return a job ID (check API key & category)",
    );
  }

  const nzoId = jobIds[0];
  try {
    await enforceSabDownloadOnly(client, nzoId);
  } catch {
    // Non-fatal — job was queued; category may still override until change_opts succeeds
  }

  return nzoId;
}

export async function getSabnzbdQueue(client: DownloadClient): Promise<SabnzbdQueueItem[]> {
  const url = buildUrl(client, "queue");
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`SABnzbd queue error: ${response.status}`);
  const data = (await response.json()) as { queue: SabnzbdStatus["queue"] };
  return data.queue?.slots ?? [];
}

const SAB_POST_PROCESS_STATUSES = new Set([
  "moving",
  "fetching",
]);

export function sabHistoryIsFailed(item: SabnzbdHistoryItem): boolean {
  return item.status === "Failed" || !!item.fail_message?.trim();
}

/** SAB finished post-processing and reported success. */
export function sabHistoryIsCompleted(item: SabnzbdHistoryItem): boolean {
  return !sabHistoryIsFailed(item) && item.status === "Completed";
}

export function sabQueueIsPostProcessing(item: SabnzbdQueueItem): boolean {
  const status = item.status.trim().toLowerCase();
  if (SAB_POST_PROCESS_STATUSES.has(status)) return true;
  const pct = parseFloat(item.percentage) || 0;
  return pct >= 100 && status !== "downloading";
}

/** Extract a user-facing warning or error from a SAB queue/history slot. */
export function sabExtractJobAlert(
  item: SabnzbdHistoryItem | SabnzbdQueueItem,
  kind: "history" | "queue",
): SabJobAlert | null {
  if (kind === "history") {
    const h = item as SabnzbdHistoryItem;
    if (sabHistoryIsFailed(h)) {
      const msg = h.fail_message?.trim() || h.status || "Download failed";
      return { level: "error", message: msg };
    }
    const parts: string[] = [];
    if (h.action_line?.trim()) parts.push(stripSabHtml(h.action_line));
    if (h.report?.trim()) parts.push(stripSabHtml(h.report));
    for (const stage of h.stage_log ?? []) {
      for (const action of stage.actions ?? []) {
        const plain = stripSabHtml(action);
        if (SAB_WARNING_PATTERNS.test(plain)) {
          parts.push(`${stage.name}: ${plain}`);
        }
      }
    }
    if (parts.length) {
      return { level: "warning", message: [...new Set(parts)].join(" · ") };
    }
    return null;
  }

  const q = item as SabnzbdQueueItem;
  const status = q.status?.trim() ?? "";
  const lower = status.toLowerCase();
  if (lower.includes("fail") || lower.includes("error")) {
    return { level: "error", message: status };
  }
  const labels = q.labels?.filter(Boolean) ?? [];
  if (labels.length) {
    return { level: "warning", message: labels.join(", ") };
  }
  if (SAB_WARNING_PATTERNS.test(status)) {
    return { level: "warning", message: status };
  }
  return null;
}

export function sabClientAlertFields(
  item: SabnzbdHistoryItem | SabnzbdQueueItem,
  kind: "history" | "queue",
): {
  downloadClientStatus: string;
  downloadClientMessage: string | null;
  downloadClientAlert: "error" | "warning" | null;
} {
  const alert = sabExtractJobAlert(item, kind);
  return {
    downloadClientStatus: item.status ?? "",
    downloadClientMessage: alert?.message ?? null,
    downloadClientAlert: alert?.level ?? null,
  };
}

export async function getSabnzbdHistory(
  client: DownloadClient,
  limit = 50,
): Promise<SabnzbdHistoryItem[]> {
  const url = buildUrl(client, "history", { limit: String(limit) });
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`SABnzbd history error: ${response.status}`);
  const data = (await response.json()) as { history: { slots: SabnzbdHistoryItem[] } };
  return data.history?.slots ?? [];
}
