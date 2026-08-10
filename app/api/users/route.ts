import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getSetting } from "@/lib/db/settings";

const createUserSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(8),
  role: z.enum(["admin", "user"]).default("user"),
  maxGrabsPerDay: z.number().int().min(0).default(20),
  email: z.string().email().optional(),
});

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userList = await db.query.users.findMany({
    orderBy: (t, { asc }) => [asc(t.username)],
  });

  // Never return password hashes
  const safe = userList.map(({ passwordHash: _, ...u }) => u);
  return NextResponse.json({ users: safe });
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid data" }, { status: 422 });

  const { username, password, role, maxGrabsPerDay, email } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) return NextResponse.json({ error: "Username already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const requireAppGrant = await getSetting("requireAppGrant");
  const globalGrabLimit = await getSetting("maxGrabsPerUserPerDay");
  const granted = role === "admin" || !requireAppGrant;
  const [user] = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role,
      maxGrabsPerDay: maxGrabsPerDay || globalGrabLimit,
      email,
      canGrab: granted,
      canDownload: granted,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  await logAudit("user.create", {
    userId: session.user.id,
    username: session.user.username,
    details: `${username} (${role})`,
    req,
  });

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe }, { status: 201 });
}
