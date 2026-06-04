import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllSettings, setManySettings } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/db/settings";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const settings = await getAllSettings();
  // Mask sensitive values
  const safe = { ...settings, smtpPassword: settings.smtpPassword ? "***" : "" };
  return NextResponse.json({ settings: safe });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Partial<AppSettings>;
  await setManySettings(body);
  return NextResponse.json({ success: true });
}
