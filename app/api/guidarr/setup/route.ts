import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/guidarr/auth";
import { getConfig, saveConfig, seedDefaultContent } from "@/lib/guidarr/storage";

/** POST — initial admin password setup (first run only). */
export async function POST(request: Request) {
  const config = await getConfig();
  if (config.setupComplete) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
  }

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim();

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

  const adminPasswordHash = await hashPassword(password);
  await saveConfig({
    ...config,
    setupComplete: true,
    adminPasswordHash,
  });
  await seedDefaultContent();

  return NextResponse.json({ success: true });
}

/** GET — whether server-side setup is complete. */
export async function GET() {
  const config = await getConfig();
  return NextResponse.json({ setupComplete: config.setupComplete });
}
