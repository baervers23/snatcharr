import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

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
  const [user] = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role,
      maxGrabsPerDay,
      email,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  const { passwordHash: _, ...safe } = user;
  return NextResponse.json({ user: safe }, { status: 201 });
}
