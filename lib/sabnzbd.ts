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

export async function addNzbToSabnzbd(
  client: DownloadClient,
  nzbBuffer: Buffer,
  filename: string,
  category?: string,
): Promise<string> {
  const base = client.url.replace(/\/$/, "");
  const formData = new FormData();
  formData.append("apikey", client.apiKey);
  formData.append("output", "json");
  formData.append("mode", "addfile");
  formData.append("cat", category ?? client.category ?? "snatcharr");
  formData.append("nzbfile", new Blob([new Uint8Array(nzbBuffer)], { type: "application/x-nzb" }), filename);

  const response = await fetch(`${base}/api`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) throw new Error(`SABnzbd add NZB failed: ${response.status}`);

  const data = (await response.json()) as { ids?: string[]; status?: boolean };
  if (!data.status || !data.ids?.length) {
    throw new Error("SABnzbd did not return a job ID");
  }

  return data.ids[0];
}

export async function getSabnzbdQueue(client: DownloadClient): Promise<SabnzbdQueueItem[]> {
  const url = buildUrl(client, "queue");
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`SABnzbd queue error: ${response.status}`);
  const data = (await response.json()) as { queue: SabnzbdStatus["queue"] };
  return data.queue?.slots ?? [];
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

export async function getSabnzbdJobStatus(
  client: DownloadClient,
  jobId: string,
): Promise<{ status: string; progress: number; speedBps: number; etaSeconds?: number; path?: string } | null> {
  const queue = await getSabnzbdQueue(client);
  const queueItem = queue.find((i) => i.nzo_id === jobId);

  if (queueItem) {
    const progress = parseFloat(queueItem.percentage) / 100;
    const speedKbps = parseFloat(queueItem.speed) || 0;
    return {
      status: "downloading",
      progress,
      speedBps: speedKbps * 1024,
    };
  }

  const history = await getSabnzbdHistory(client, 200);
  const histItem = history.find((i) => i.nzo_id === jobId);

  if (histItem) {
    const failed = histItem.status === "Failed" || histItem.fail_message;
    return {
      status: failed ? "failed" : "completed",
      progress: 1,
      speedBps: 0,
      path: histItem.storage ?? histItem.path,
    };
  }

  return null;
}
