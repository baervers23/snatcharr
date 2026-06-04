import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadClients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { testSabnzbdConnection } from "@/lib/sabnzbd";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await db.query.downloadClients.findMany({
    orderBy: (t, { asc }) => [asc(t.priority), asc(t.name)],
  });

  // Mask API keys for non-admins
  const safe = clients.map((c) => ({
    ...c,
    apiKey: session.user.role === "admin" ? c.apiKey : "***",
  }));

  return NextResponse.json({ clients: safe });
}

const clientSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["sabnzbd", "nzbget", "nzbvortex"]),
  url: z.string().url(),
  apiKey: z.string().min(1),
  category: z.string().default("snatcharr"),
  priority: z.number().int().default(0),
});

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const result = await db.insert(downloadClients).values({
    ...parsed.data,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return NextResponse.json({ client: result[0] });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(downloadClients).where(eq(downloadClients.id, id));
  return NextResponse.json({ success: true });
}
