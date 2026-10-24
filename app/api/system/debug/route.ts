import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isDebugEnabled } from "@/lib/debug-mode";
import { getSetting, setManySettings } from "@/lib/db/settings";
import {
  applyNoticePreset,
  applySpeedLimitPreset,
  cleanupDebugSeeds,
  getDebugSeedStatus,
  seedDebugGrab,
  seedDebugUser,
} from "@/lib/debug-seed";
import { logAudit, logActionFail } from "@/lib/audit";

function forbidden() {
  return NextResponse.json({ error: "Debug mode disabled" }, { status: 403 });
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isDebugEnabled()) return forbidden();

  const [seeds, mockExternal, uiLanguage, speedLimit, infoPopupMode, infoPopupTitle] =
    await Promise.all([
      getDebugSeedStatus(),
      getSetting("debugMockExternal"),
      getSetting("uiLanguage"),
      getSetting("userDownloadSpeedLimitMbit"),
      getSetting("infoPopupMode"),
      getSetting("infoPopupTitle"),
    ]);

  return NextResponse.json({
    enabled: true,
    mockExternal,
    uiLanguage,
    userDownloadSpeedLimitMbit: speedLimit,
    infoPopupMode,
    infoPopupTitle,
    seeds,
    credentials: {
      username: "debug-user",
      password: "debug-user-pass",
    },
  });
}

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("seed-user") }),
  z.object({ action: z.literal("seed-grab") }),
  z.object({ action: z.literal("apply-notice") }),
  z.object({
    action: z.literal("set-speed-limit"),
    mbit: z.number().min(0).max(1000).default(1),
  }),
  z.object({
    action: z.literal("set-language"),
    language: z.string().min(2).max(8),
  }),
  z.object({
    action: z.literal("set-mock"),
    enabled: z.boolean(),
  }),
  z.object({ action: z.literal("cleanup") }),
]);

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isDebugEnabled()) {
    logActionFail("SYSTEM", "debug", "denied", {
      username: session.user.username,
      details: "debug mode disabled",
      req,
    });
    return forbidden();
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { action } = parsed.data;
  let result: Record<string, unknown> = { ok: true };

  switch (action) {
    case "seed-user": {
      result = { ok: true, ...(await seedDebugUser()) };
      break;
    }
    case "seed-grab": {
      const user = await seedDebugUser();
      result = { ok: true, ...(await seedDebugGrab(user.id)), owner: user.username };
      break;
    }
    case "apply-notice": {
      await applyNoticePreset();
      result = { ok: true, applied: "notice" };
      break;
    }
    case "set-speed-limit": {
      await applySpeedLimitPreset(parsed.data.mbit);
      result = { ok: true, mbit: parsed.data.mbit };
      break;
    }
    case "set-language": {
      await setManySettings({ uiLanguage: parsed.data.language });
      result = { ok: true, language: parsed.data.language, reload: true };
      break;
    }
    case "set-mock": {
      await setManySettings({ debugMockExternal: parsed.data.enabled });
      result = { ok: true, mockExternal: parsed.data.enabled };
      break;
    }
    case "cleanup": {
      result = { ok: true, ...(await cleanupDebugSeeds()) };
      break;
    }
  }

  await logAudit("settings.update", {
    userId: session.user.id,
    username: session.user.username,
    details: `debug.${action}`,
    req,
  });

  return NextResponse.json(result);
}
