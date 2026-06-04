import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { isPublic?: boolean };

  const grab = await db.query.grabs.findFirst({ where: eq(grabs.id, id) });
  if (!grab) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the owner or admin can update
  if (grab.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Partial<typeof grab> = {};
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;

  await db.update(grabs).set(updates).where(eq(grabs.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const grab = await db.query.grabs.findFirst({ where: eq(grabs.id, id) });

  if (!grab) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (grab.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(grabs).where(eq(grabs.id, id));
  return NextResponse.json({ success: true });
}
