import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSetting } from "@/lib/db/settings";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const setupCompleted = await getSetting("setupCompleted");
  if (!setupCompleted) redirect("/setup");

  const session = await auth();
  if (!session?.user) redirect("/login");

  const instanceName = await getSetting("instanceName");
  const infoPopupEnabled = await getSetting("infoPopupEnabled");
  const infoPopupText = await getSetting("infoPopupText");

  return (
    <AppShell
      user={{
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
      }}
      instanceName={instanceName}
      infoPopup={infoPopupEnabled ? infoPopupText : null}
    >
      {children}
    </AppShell>
  );
}
