import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "user"]).optional(),
  maxGrabsPerDay: z.number().int().min(0).optional(),
  email: z.string().email().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, id));
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ success: true });
}
