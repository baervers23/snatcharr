import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSetting } from "@/lib/db/settings";
import { sendPasswordResetEmail } from "@/lib/password-reset";

const schema = z.object({
  username: z.string().min(1).max(50),
});

const GENERIC_MESSAGE =
  "If an account exists for that username, you will receive an email with a link to reset your password.";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your username" }, { status: 422 });
  }

  const { username } = parsed.data;
  const user = await db.query.users.findFirst({
    where: eq(users.username, username.trim()),
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  if (user.imported) {
    const forgotPasswordUrl = (await getSetting("forgotPasswordUrl")).trim();
    if (forgotPasswordUrl) {
      return NextResponse.json({ redirect: forgotPasswordUrl, message: GENERIC_MESSAGE });
    }
    return NextResponse.json({
      error: "Password recovery for imported accounts is handled by your external auth provider. Contact an admin.",
    }, { status: 400 });
  }

  if (!user.email?.trim()) {
    return NextResponse.json({
      error: "This account has no email on file. Contact an admin to reset your password.",
    }, { status: 400 });
  }

  const result = await sendPasswordResetEmail(user.id, user.email.trim(), user.username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
