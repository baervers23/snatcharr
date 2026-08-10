import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SettingsView from "@/components/settings/SettingsView";
import { getAllSettings } from "@/lib/db/settings";
import { db } from "@/lib/db";
import { stripApiKeyFromResponse } from "@/lib/mask-secrets";

export const metadata = { title: "Settings | Snatcharr" };

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/search");

  const settings = await getAllSettings();
  const indexersList = (await db.query.indexers.findMany()).map(stripApiKeyFromResponse);
  const clientsList = (await db.query.downloadClients.findMany()).map(stripApiKeyFromResponse);
  const appsList = (await db.query.externalApps.findMany()).map(stripApiKeyFromResponse);

  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading settings…</div>}>
      <SettingsView
        settings={settings}
        indexers={indexersList}
        downloadClients={clientsList}
        externalApps={appsList}
      />
    </Suspense>
  );
}
