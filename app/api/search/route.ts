import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { searchProwlarr } from "@/lib/prowlarr";
import { getSetting } from "@/lib/db/settings";
import { incrementSearchCount } from "@/lib/daily-usage";
import { checkGlobalSearchLimit, userCanUseApp } from "@/lib/grants";
import { searchRateLimit } from "@/lib/rate-limit";
import { logAction, logActionFail } from "@/lib/audit";
import { errorDetail } from "@/lib/action-log";
import { resolveCategoryLabel } from "@/lib/utils";
import { sanitizeSearchResultForUser } from "@/lib/search-results";
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    logActionFail("SEARCH", "query", "denied", { details: "not authenticated", req });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const grant = await userCanUseApp(session.user.id, session.user.role);
  if (!grant.allowed) {
    logActionFail("SEARCH", "query", "denied", {
      username: session.user.username,
      details: grant.reason ?? "access denied",
      req,
    });
    return NextResponse.json({ error: grant.reason ?? "Access denied" }, { status: 403 });
  }
  const searchLimit = await checkGlobalSearchLimit();
  if (!searchLimit.allowed) {
    logActionFail("SEARCH", "query", "denied", {
      username: session.user.username,
      details: `daily limit (${searchLimit.max}/day)`,
      req,
    });
    return NextResponse.json(
      { error: `Daily search limit reached (${searchLimit.max}/day)` },
      { status: 429 },
    );
  }
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rateMax = await getSetting("searchRateLimitPerMinute");
  const rl = searchRateLimit(ip, rateMax);
  if (!rl.allowed) {
    logActionFail("SEARCH", "query", "denied", {
      username: session.user.username,
      details: `rate limit for ${ip}`,
      req,
    });
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
    logActionFail("SEARCH", "query", "aborted", {
      username: session.user.username,
      details: "query too short",
      req,
    });
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }
  const categories = categoriesParam
    ? categoriesParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n))
    : [];
  const pageSize = await getSetting("maxResults");
  const fetchLimit = Math.min(Math.max(pageSize * 5, pageSize), 500);
  const activeIndexers = await db.query.indexers.findMany({
    where: (t, { eq }) => eq(t.enabled, true),
  });
  if (activeIndexers.length === 0) {
    logActionFail("SEARCH", "query", "failed", {
      username: session.user.username,
      details: `no indexers — "${query}"`,
      req,
    });
    return NextResponse.json({ error: "No indexers configured" }, { status: 503 });
  }
  const results = await Promise.allSettled(
    activeIndexers.map((indexer) =>
      searchProwlarr(indexer, query, categories, fetchLimit),
    ),
  );
  const indexerErrors: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      indexerErrors.push(`${activeIndexers[i].name}: ${errorDetail(r.reason)}`);
    }
  }
  if (indexerErrors.length > 0) {
    logActionFail("SEARCH", "query", "failed", {
      username: session.user.username,
      details: `"${query}" — ${indexerErrors.join("; ")}`,
      req,
    });
  }
  const allResults = results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof searchProwlarr>>> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => (b.grabs ?? 0) - (a.grabs ?? 0));
  const isAdmin = session.user.role === "admin";
  const sanitized = allResults.slice(0, fetchLimit).map((r) => {
    const categoryName = resolveCategoryLabel(r.categories);
    const cats = r.categories?.length
      ? [{ id: r.categories[0].id, name: categoryName }]
      : [];
    return sanitizeSearchResultForUser(
      {
        guid: r.guid,
        title: r.title,
        publishDate: r.publishDate,
        size: r.size ?? 0,
        grabs: r.grabs ?? 0,
        categories: cats,
        indexerId: r.indexerId,
        indexer: r.indexer,
        posterUrl: r.posterUrl,
        description: r.description,
        commentUrl: r.commentUrl,
        downloadUrl: r.downloadUrl,
      },
      isAdmin,
    );
  });
  const withGrabs = sanitized.filter((r) => (r.grabs ?? 0) > 0).length;
  await incrementSearchCount(session.user.id);
  if (sanitized.length === 0) {
    logActionFail("SEARCH", "query", "aborted", {
      username: session.user.username,
      details: `"${query}" — no results`,
      req,
    });
  } else if (indexerErrors.length === 0) {
    logAction({
      domain: "SEARCH",
      action: "query",
      outcome: "ok",
      username: session.user.username,
      details: `"${query}" → ${sanitized.length} results`,
      req,
      level: "debug",
    });
  }
  return NextResponse.json({ results: sanitized, pageSize });
}
