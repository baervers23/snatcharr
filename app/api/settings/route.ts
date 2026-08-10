import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAllSettings, setManySettings } from "@/lib/db/settings";
import type { AppSettings } from "@/lib/db/settings";
import { updateConfig, type AppConfig } from "@/lib/config";
import { logAudit, logActionFail } from "@/lib/audit";

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

  if (body.smtpPassword === "***") {
    delete body.smtpPassword;
  }

  if (body.infoPopupMode !== undefined) {
    body.infoPopupEnabled = body.infoPopupMode !== "disabled";
  }

  await setManySettings(body);

  if (body.maxGrabsPerUserPerDay !== undefined) {
    const { syncGlobalGrabLimitToUsers } = await import("@/lib/user-limits-sync");
    await syncGlobalGrabLimitToUsers(body.maxGrabsPerUserPerDay);
  }

  // Mirror the user-visible settings into config.json so the rest of the app
  // (sidebar, login screen, info popup) reads consistent values.
  const configPatch: Partial<AppConfig> = {};
  if (body.infoPopupMode !== undefined) {
    configPatch.warningOnOpen = body.infoPopupMode;
  } else if (body.infoPopupEnabled !== undefined) {
    configPatch.warningOnOpen = body.infoPopupEnabled ? "always" : "disabled";
  }
  if (body.infoPopupText !== undefined) configPatch.importantPopupText = body.infoPopupText;
  if (body.signupEnabled !== undefined) configPatch.allowGuestRegister = body.signupEnabled;
  if (body.authMethod !== undefined) configPatch.authMethod = body.authMethod;
  if (body.requireAppGrant !== undefined) configPatch.requireAppGrant = body.requireAppGrant;
  if (body.maxSearchRequestsPerUserPerDay !== undefined) {
    configPatch.maxSearchRequestsPerUserPerDay = body.maxSearchRequestsPerUserPerDay;
  }
  if (body.maxGrabsPerUserPerDay !== undefined) {
    configPatch.maxGrabsPerUserPerDay = body.maxGrabsPerUserPerDay;
  }
  if (body.requireEmail !== undefined) configPatch.emailRequired = body.requireEmail;
  if (Object.keys(configPatch).length > 0) updateConfig(configPatch);

  if (body.logLevel !== undefined) {
    const { setLogLevel } = await import("@/lib/logger");
    setLogLevel(body.logLevel);
  }
  if (body.backgroundTasks !== undefined) {
    const { startBackgroundTasks } = await import("@/lib/tasks");
    startBackgroundTasks();
  }
  if (body.downloadDir !== undefined) {
    const { setDownloadDirCache } = await import("@/lib/paths");
    setDownloadDirCache(body.downloadDir);
  }

  await logAudit("settings.update", {
    userId: session.user.id,
    username: session.user.username,
    details: Object.keys(body).join(", "),
    req,
  });
  return NextResponse.json({ success: true });
}
