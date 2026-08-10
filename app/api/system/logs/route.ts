import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logBuffer, readLogFileLines } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50")));
  const offset = (page - 1) * limit;

  const fromFile = readLogFileLines(limit + 1, offset);
  const logs =
    fromFile.length > 0
      ? fromFile.slice(0, limit)
      : logBuffer
          .slice()
          .reverse()
          .slice(offset, offset + limit);

  const hasMore =
    fromFile.length > limit ||
    logBuffer.length > offset + limit;

  return NextResponse.json({ logs, page, limit, hasMore });
}
