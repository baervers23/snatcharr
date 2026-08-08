import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "25")));
  const offset = (page - 1) * limit;

  const rows = await db.query.auditLog.findMany({
    orderBy: [desc(auditLog.createdAt)],
    limit: limit + 1,
    offset,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const allUsers = await db.query.users.findMany({ columns: { id: true, username: true } });
  const nameById = new Map(allUsers.map((u) => [u.id, u.username]));

  const events = slice.map((e) => ({
    id: e.id,
    action: e.action,
    details: e.details,
    username: e.userId ? (nameById.get(e.userId) ?? "system") : "system",
    ipAddress: e.ipAddress,
    createdAt: e.createdAt?.toISOString() ?? "",
  }));

  return NextResponse.json({ events, page, limit, hasMore });
}
