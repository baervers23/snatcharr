function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function baseUrlFromRequest(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      url.protocol.replace(":", "");
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host")?.trim();
    if (!host) return null;
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

/** Base URL for email links; preferRequestHost uses the request host behind a reverse proxy. */
export function resolvePublicBaseUrl(
  hostUrlSetting: string,
  req?: Request,
  opts?: { preferRequestHost?: boolean },
): string {
  const configured = (hostUrlSetting || "").trim().replace(/\/$/, "");
  const fromReq = req ? baseUrlFromRequest(req) : null;

  if (opts?.preferRequestHost && fromReq && !isLocalhostUrl(fromReq)) {
    return fromReq;
  }

  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }

  if (fromReq && !isLocalhostUrl(fromReq)) {
    return fromReq;
  }

  return configured || fromReq || "http://localhost:3000";
}
