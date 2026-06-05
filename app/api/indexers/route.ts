import { auth } from "@/auth";
import { db } from "@/lib/db";
import { indexers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await db.query.indexers.findMany({ orderBy: (t, { asc }) => [asc(t.priority), asc(t.name)] });
  const safe = list.map((i) => ({
    ...i,
    apiKey: session.user.role === "admin" ? i.apiKey : "***",
  }));
  return NextResponse.json({ indexers: safe });
}

const indexerSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  url: z.string().url(),
  apiKey: z.string().min(1),
  categories: z.string().default(""),
  priority: z.number().int().default(0),
});

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = indexerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const cats = parsed.data.categories
    ? parsed.data.categories.split(",").map((c) => parseInt(c.trim())).filter((n) => !isNaN(n))
    : [];

  const [result] = await db.insert(indexers).values({
    name: parsed.data.name,
    type: parsed.data.type,
    url: parsed.data.url,
    apiKey: parsed.data.apiKey,
    categories: JSON.stringify(cats),
    priority: parsed.data.priority,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return NextResponse.json({ indexer: result }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(indexers).where(eq(indexers.id, id));
  return NextResponse.json({ success: true });
}
