const MAX_NZB_BYTES = 8 * 1024 * 1024;

export function isValidNzbBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0 || buffer.length > MAX_NZB_BYTES) return false;
  const head = buffer.subarray(0, 512).toString("utf-8").trimStart();
  return head.includes("<nzb") || (head.startsWith("<?xml") && head.includes("nzb"));
}

export function parseNzbTitle(xml: string, fallback = "Manual NZB"): string {
  const meta = xml.match(/<meta[^>]*type=["']title["'][^>]*>([^<]+)<\/meta>/i);
  if (meta?.[1]?.trim()) return meta[1].trim().slice(0, 200);

  const subject = xml.match(/<file[^>]*subject=["']([^"']+)["']/i);
  if (subject?.[1]?.trim()) return subject[1].trim().slice(0, 200);

  return fallback.slice(0, 200);
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "[::1]" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export async function fetchNzbFromUrl(url: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("URL host is not allowed");
  }

  const response = await fetch(parsed.toString(), {
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
    headers: { Accept: "application/xml, text/xml, */*" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch NZB (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!isValidNzbBuffer(buffer)) {
    throw new Error("Response is not a valid NZB file");
  }
  return buffer;
}
