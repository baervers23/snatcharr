import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const profileSchema = z.object({
  showGrabsPublic: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  email: z.string().email().nullable().optional(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  await db.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, session.user.id));
  return NextResponse.json({ success: true });
}
