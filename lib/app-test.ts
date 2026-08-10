/** Shared connection test for "Additional Apps" (Jellyfin, Seerr, *arr, Organizr). */

function normalizeUrl(url: string): string {
  let clean = url.trim().replace(/\/$/, "");
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `http://${clean}`;
  }
  return clean;
}

export async function testExternalApp(
  type: string,
  url: string,
  apiKey: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const base = normalizeUrl(url);
    let testUrl = "";
    const headers: HeadersInit = {};

    switch (type.toLowerCase()) {
      case "jellyfin":
        testUrl = `${base}/System/Info/Public`;
        break;
      case "seerr":
        testUrl = `${base}/api/v1/status`;
        if (apiKey) headers["X-Api-Key"] = apiKey;
        break;
      case "sonarr":
      case "radarr":
      case "lidarr":
        testUrl = `${base}/api/v3/system/status`;
        if (apiKey) headers["X-Api-Key"] = apiKey;
        break;
      case "organizr":
        testUrl = `${base}/api/v2/status`;
        break;
      case "jfago":
        testUrl = `${base}/`;
        break;
      default:
        return { ok: false, error: `Unknown app type: ${type}` };
    }

    const res = await fetch(testUrl, { headers, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const version =
      (data.version as string | undefined) ??
      (data.Version as string | undefined) ??
      (data.productName as string | undefined);

    return { ok: true, version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}
