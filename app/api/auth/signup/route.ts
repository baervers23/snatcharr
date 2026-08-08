import { NextResponse } from "next/server";

import { db } from "@/lib/db";

import { users } from "@/lib/db/schema";

import { eq } from "drizzle-orm";

import bcrypt from "bcryptjs";

import { z } from "zod";

import { getSetting } from "@/lib/db/settings";

import { logAudit } from "@/lib/audit";

import { sendEmailVerification } from "@/lib/email-verification";

import { signupPasswordSchema } from "@/lib/password-policy";



const signupSchema = z

  .object({

    username: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_-]+$/),

    password: signupPasswordSchema,

    confirmPassword: z.string(),

    email: z.string().email().optional(),

  })

  .refine((data) => data.password === data.confirmPassword, {

    message: "Passwords do not match",

    path: ["confirmPassword"],

  });



export async function POST(req: Request) {

  const signupEnabled = await getSetting("signupEnabled");

  if (!signupEnabled) {

    return NextResponse.json({ error: "Registration is disabled" }, { status: 403 });

  }



  const body = await req.json();

  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {

    const message = parsed.error.issues[0]?.message ?? "Invalid data";

    return NextResponse.json({ error: message }, { status: 422 });

  }



  const { username, password, email } = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });

  if (existing) {

    return NextResponse.json({ error: "Username already exists" }, { status: 409 });

  }



  if (email) {

    const emailTaken = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });

    if (emailTaken) {

      return NextResponse.json({ error: "This email address is already in use" }, { status: 409 });

    }

  }



  const requireEmail = await getSetting("requireEmail");

  if (requireEmail && !email) {

    return NextResponse.json({ error: "Email is required" }, { status: 422 });

  }



  const maxGrabs = await getSetting("maxGrabsPerUserPerDay");

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db

    .insert(users)

    .values({

      username,

      passwordHash,

      role: "user",

      email: email ?? null,

      emailVerified: requireEmail ? false : !!email,

      imported: false,

      maxGrabsPerDay: maxGrabs,

      ignoreSyncedLimits: false,

      isActive: true,

      createdAt: new Date(),

      updatedAt: new Date(),

    })

    .returning();



  await logAudit("user.create", {

    details: `signup: ${username}`,

    req,

  });



  if (requireEmail && email) {

    const mailResult = await sendEmailVerification(user.id, email, username, req);

    if (!mailResult.ok) {

      return NextResponse.json(

        {

          success: true,

          userId: user.id,

          message:

            "Account created, but the verification email could not be sent. Ask an admin to approve your email.",

        },

        { status: 201 },

      );

    }

    return NextResponse.json(
      {
        success: true,
        userId: user.id,
        verificationEmailSent: true,
        message: "Account created — check your inbox to verify your email, then sign in",
      },
      { status: 201 },
    );

  }



  return NextResponse.json({ success: true, userId: user.id }, { status: 201 });

}


