import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getConfig } from "@/lib/config";
import AppShell from "@/components/layout/AppShell";
import EmailGate from "@/components/auth/EmailGate";
import { getSetting } from "@/lib/db/settings";
import { canEnforceRequireEmail } from "@/lib/email-requirements.server";
import { markEmailVerifiedFromSync } from "@/lib/email-verification";
import { userCanUploadNzb } from "@/lib/grants";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const config = getConfig();

  const session = await auth();
  if (!session?.user) redirect("/login");

  let dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      email: true,
      canUploadNzb: true,
      emailVerified: true,
      jellyfinUserId: true,
    },
  });

  const requireEmail = await getSetting("requireEmail");
  const emailPaths = await canEnforceRequireEmail();
  const enforceEmail =
    requireEmail && emailPaths.allowed && session.user.role !== "admin";

  // Jellyfin/Seerr imports are trusted — SMTP verification is not required when only sync apps are configured.
  if (
    enforceEmail &&
    dbUser?.email?.trim() &&
    !dbUser.emailVerified &&
    emailPaths.syncApps &&
    (dbUser.jellyfinUserId || !emailPaths.smtp)
  ) {
    await markEmailVerifiedFromSync(session.user.id);
    dbUser = { ...dbUser, emailVerified: true };
  }

  if (enforceEmail && !dbUser?.email?.trim()) {
    return (
      <EmailGate
        username={session.user.username}
        mode="missing"
        smtpEnabled={emailPaths.smtp}
        syncAppsEnabled={emailPaths.syncApps}
      />
    );
  }
  if (enforceEmail && dbUser?.email?.trim() && !dbUser.emailVerified) {
    return (
      <EmailGate
        username={session.user.username}
        email={dbUser.email}
        mode="pending"
        smtpEnabled={emailPaths.smtp}
        syncAppsEnabled={emailPaths.syncApps}
      />
    );
  }

  const [infoPopupText, infoPopupMode] = await Promise.all([
    getSetting("infoPopupText"),
    getSetting("infoPopupMode"),
  ]);
  const disclaimer = infoPopupText?.trim() || config.importantPopupText?.trim() || "";
  const mode = infoPopupMode ?? config.warningOnOpen;
  const infoPopup = mode !== "disabled" && disclaimer ? disclaimer : null;

  const uploadGrant = await userCanUploadNzb(session.user.id, session.user.role);
  const canUploadNzb = uploadGrant.allowed;

  return (
    <AppShell
      user={{
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      }}
      canUploadNzb={canUploadNzb}
      instanceName={config.instanceName}
      infoPopup={infoPopup}
      infoPopupMode={mode}
    >
      {children}
    </AppShell>
  );
}
