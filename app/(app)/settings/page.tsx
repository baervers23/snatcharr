import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SettingsView from "@/components/settings/SettingsView";
import { getAllSettings } from "@/lib/db/settings";
import { db } from "@/lib/db";

export const metadata = { title: "Settings | Snatcharr" };

export default async function SettingsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/search");

  const settings = await getAllSettings();
  const indexersList = await db.query.indexers.findMany();
  const clientsList = await db.query.downloadClients.findMany();
  const appsList = await db.query.externalApps.findMany();

  return (
    <SettingsView
      settings={settings}
      indexers={indexersList}
      downloadClients={clientsList}
      externalApps={appsList}
    />
  );
}
