import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import SystemView from "@/components/system/SystemView";
import os from "os";
import { getAllSettings } from "@/lib/db/settings";
import { disksAreSame, getAppDiskUsage, getDownloadDiskUsage } from "@/lib/disk";
import { SETUP_ADMIN_ID } from "@/lib/setup-prefill";
import { APP_VERSION } from "@/lib/app-version";
import { getAppUpdateStatus } from "@/lib/app-update";
export const metadata = { title: "System | Snatcharr" };
function getUptime(): string {
  const s = process.uptime();
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}
export default async function SystemPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/search");
  const settings = await getAllSettings();
  const indexers = await db.query.indexers.findMany();
  const clients = await db.query.downloadClients.findMany();
  const apps = await db.query.externalApps.findMany();
  const dataDiskRaw = getAppDiskUsage();
  const downloadDiskRaw = getDownloadDiskUsage();
  const sameDisk = disksAreSame(dataDiskRaw, downloadDiskRaw);
  const dataDisk = dataDiskRaw
    ? { path: dataDiskRaw.path, free: dataDiskRaw.free, total: dataDiskRaw.total }
    : null;
  const downloadDisk =
    downloadDiskRaw && !sameDisk
      ? { path: downloadDiskRaw.path, free: downloadDiskRaw.free, total: downloadDiskRaw.total }
      : null;
  const systemInfo = {
    version: APP_VERSION,
    nodeVersion: process.version,
    platform: process.platform,
    uptime: getUptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    cpuCores: os.cpus().length,
  };
  const updateStatus = await getAppUpdateStatus();
  return (
    <SystemView
      systemInfo={systemInfo}
      updateStatus={updateStatus}
      dataDisk={dataDisk}
      downloadDisk={sameDisk ? null : downloadDisk}
      sameDisk={sameDisk}
      indexers={indexers}
      downloadClients={clients}
      externalApps={apps}
      settings={settings}
      canDownloadBackup={session.user.id === SETUP_ADMIN_ID}
    />
  );
}
