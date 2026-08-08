import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guidarr/api-auth";
import { getConfig, saveConfig } from "@/lib/guidarr/storage";

/** GET — public config for main page background (no secrets). */
export async function GET() {
  const config = await getConfig();
  return NextResponse.json({
    backgroundColor: config.backgroundColor,
    backgroundImage: config.backgroundImage,
    setupComplete: config.setupComplete,
  });
}

/** PUT — update background settings (admin only). */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as {
    backgroundColor?: string;
    backgroundImage?: string | null;
  };

  const config = await getConfig();
  const updated = {
    ...config,
    backgroundColor: body.backgroundColor ?? config.backgroundColor,
    backgroundImage:
      body.backgroundImage !== undefined ? body.backgroundImage : config.backgroundImage,
  };

  await saveConfig(updated);
  return NextResponse.json({
    backgroundColor: updated.backgroundColor,
    backgroundImage: updated.backgroundImage,
  });
}
