import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { searchProwlarr } from "@/lib/prowlarr";
import { getSetting } from "@/lib/db/settings";
import { searchRateLimit } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = searchRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before searching again." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const categoriesParam = searchParams.get("categories");

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const categories = categoriesParam
    ? categoriesParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n))
    : [];

  const maxResults = await getSetting("maxResults");

  // Get all enabled indexers
  const activeIndexers = await db.query.indexers.findMany({
    where: (t, { eq }) => eq(t.enabled, true),
  });

  if (activeIndexers.length === 0) {
    return NextResponse.json({ error: "No indexers configured" }, { status: 503 });
  }

  // Fan out to all indexers in parallel
  const results = await Promise.allSettled(
    activeIndexers.map((indexer) =>
      searchProwlarr(indexer, query, categories, maxResults),
    ),
  );

  const allResults = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchProwlarr>>> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    // Sort by grabs desc, then by date desc
    .sort((a, b) => (b.grabs ?? 0) - (a.grabs ?? 0));

  // Strip sensitive NZB download URLs from response — grabbing happens server-side
  const sanitized = allResults.slice(0, maxResults).map((r) => ({
    guid: r.guid,
    title: r.title,
    publishDate: r.publishDate,
    size: r.size,
    grabs: r.grabs,
    categories: r.categories,
    indexer: r.indexer,
    posterUrl: r.posterUrl,
    description: r.description,
    commentUrl: r.commentUrl,
    // downloadUrl intentionally omitted — user never sees the real NZB link
    downloadUrl: r.downloadUrl, // kept for grab flow only (server-side)
  }));

  return NextResponse.json({ results: sanitized });
}
