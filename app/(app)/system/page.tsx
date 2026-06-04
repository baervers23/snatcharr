import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import SystemView from "@/components/system/SystemView";
import os from "os";
import fs from "fs";
import path from "path";

export const metadata = { title: "System | Snatcharr" };

function getUptime(): string {
  const s = process.uptime();
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function getDiskInfo(): { free: number; total: number } | null {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const stats = fs.statfsSync(dataDir);
    return { free: stats.bfree * stats.bsize, total: stats.blocks * stats.bsize };
  } catch {
    return null;
  }
}

export default async function SystemPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/search");

  const indexers = await db.query.indexers.findMany();
  const clients = await db.query.downloadClients.findMany();

  const systemInfo = {
    version: "1.0.0",
    nodeVersion: process.version,
    platform: process.platform,
    uptime: getUptime(),
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    cpuCores: os.cpus().length,
    disk: getDiskInfo(),
  };

  return (
    <SystemView
      systemInfo={systemInfo}
      indexers={indexers}
      downloadClients={clients}
    />
  );
}
