import { auth } from "@/auth";
import { db } from "@/lib/db";
import { externalApps } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { stripApiKeyFromResponse } from "@/lib/mask-secrets";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const list = await db.query.externalApps.findMany();
  return NextResponse.json({ apps: list.map(stripApiKeyFromResponse) });
}

const appSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["jellyfin", "seerr", "organizr", "jfago"]),
  url: z.string().url(),
  apiKey: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = appSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const [app] = await db
    .insert(externalApps)
    .values({
      ...parsed.data,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ app: stripApiKeyFromResponse(app) }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.delete(externalApps).where(eq(externalApps.id, id));
  return NextResponse.json({ success: true });
}
