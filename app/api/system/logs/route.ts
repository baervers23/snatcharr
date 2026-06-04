import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { logBuffer } from "@/lib/logger";     // ← nur logBuffer importieren

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ logs: logBuffer.slice(-200).reverse() });
}