import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email-verification";
import { getSetting } from "@/lib/db/settings";
import { resolvePublicBaseUrl } from "@/lib/public-url";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const hostUrl = resolvePublicBaseUrl(await getSetting("hostUrl"), req, {
    preferRequestHost: true,
  });
  return NextResponse.redirect(`${hostUrl}/login?verified=1`);
}
