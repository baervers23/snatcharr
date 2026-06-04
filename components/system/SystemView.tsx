"use client";

import { useState, useEffect } from "react";
import { Monitor, Cpu, HardDrive, MemoryStick, Clock, Server, Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { Indexer, DownloadClient } from "@/lib/db/schema";

interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  uptime: string;
  memoryMB: number;
  cpuCores: number;
  disk: { free: number; total: number } | null;
}

interface HealthCheck {
  id: string;
  name: string;
  type: "indexer" | "client";
  status: "ok" | "warning" | "error" | "unknown" | "checking";
  message?: string;
}

interface Props {
  systemInfo: SystemInfo;
  indexers: Indexer[];
  downloadClients: DownloadClient[];
}

export default function SystemView({ systemInfo, indexers, downloadClients }: Props) {
  const [checks, setChecks] = useState<HealthCheck[]>([
    ...indexers.map((i) => ({
      id: i.id,
      name: i.name,
      type: "indexer" as const,
      status: (i.lastStatus ?? "unknown") as HealthCheck["status"],
      message: i.lastError ?? undefined,
    })),
    ...downloadClients.map((c) => ({
      id: c.id,
      name: c.name,
      type: "client" as const,
      status: (c.lastStatus ?? "unknown") as HealthCheck["status"],
      message: c.lastError ?? undefined,
    })),
  ]);
  const [runningChecks, setRunningChecks] = useState(false);
  const [logs, setLogs] = useState<Array<{ ts: string; level: string; msg: string }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  async function runHealthChecks() {
    setRunningChecks(true);
    setChecks((prev) => prev.map((c) => ({ ...c, status: "checking" })));

    try {
      const response = await fetch("/api/system/health", { method: "POST" });
      const data = await response.json() as { results: Array<{ id: string; status: HealthCheck["status"]; message?: string }> };
      setChecks((prev) =>
        prev.map((c) => {
          const result = data.results?.find((r) => r.id === c.id);
          return result ? { ...c, status: result.status, message: result.message } : c;
        }),
      );
    } catch {
      setChecks((prev) => prev.map((c) => ({ ...c, status: "error", message: "Health check failed" })));
    } finally {
      setRunningChecks(false);
    }
  }

  async function fetchLogs() {
    setLoadingLogs(true);
    try {
      const response = await fetch("/api/system/logs");
      const data = await response.json() as { logs: typeof logs };
      setLogs(data.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const overallHealth = checks.every((c) => c.status === "ok")
    ? "ok"
    : checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warning")
    ? "warning"
    : "unknown";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        System
      </h1>

      {/* System Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard icon={Server} label="Version" value={`v${systemInfo.version}`} sub={systemInfo.nodeVersion} />
        <InfoCard icon={Clock} label="Uptime" value={systemInfo.uptime} sub={systemInfo.platform} />
        <InfoCard icon={MemoryStick} label="Memory" value={`${systemInfo.memoryMB} MB`} sub="RSS" />
        <InfoCard icon={Cpu} label="CPU Cores" value={String(systemInfo.cpuCores)} />
        {systemInfo.disk && (
          <InfoCard
            icon={HardDrive}
            label="Disk Free"
            value={formatBytes(systemInfo.disk.free)}
            sub={`of ${formatBytes(systemInfo.disk.total)}`}
            className="col-span-2"
          />
        )}
      </div>

      {/* Health Checks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Health Checks
            <HealthBadge status={overallHealth} />
          </h2>
          <button
            onClick={runHealthChecks}
            disabled={runningChecks}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3 w-3", runningChecks && "animate-spin")} />
            Run Checks
          </button>
        </div>

        {checks.length === 0 ? (
          <div className="nv-card p-6 text-center text-muted-foreground text-sm">
            No services configured. Add indexers and download clients in Settings.
          </div>
        ) : (
          <div className="nv-card divide-y divide-border overflow-hidden">
            {checks.map((check) => (
              <div key={check.id} className="flex items-center gap-3 p-4">
                <HealthIcon status={check.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{check.name}</p>
                  {check.message && (
                    <p className={cn(
                      "text-xs mt-0.5",
                      check.status === "error" ? "text-red-400" : "text-muted-foreground",
                    )}>
                      {check.message}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground capitalize">{check.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live Logs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Live Logs</h2>
          <button onClick={fetchLogs} disabled={loadingLogs} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50">
            <RefreshCw className={cn("h-3 w-3", loadingLogs && "animate-spin")} />
            Refresh
          </button>
        </div>

        <div className="nv-card bg-black/50 font-mono text-xs p-4 h-80 overflow-y-auto space-y-0.5">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">No logs available</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">{log.ts}</span>
                <span className={cn(
                  "shrink-0 uppercase font-bold",
                  log.level === "error" && "text-red-400",
                  log.level === "warn" && "text-yellow-400",
                  log.level === "info" && "text-blue-400",
                  log.level === "debug" && "text-muted-foreground",
                )}>
                  [{log.level}]
                </span>
                <span className="text-foreground break-all">{log.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("nv-card p-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function HealthIcon({ status }: { status: HealthCheck["status"] }) {
  if (status === "checking") return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-400" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
  return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />;
}

function HealthBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "text-xs font-medium px-2 py-0.5 rounded-full normal-case tracking-normal",
      status === "ok" && "bg-green-500/15 text-green-400",
      status === "error" && "bg-red-500/15 text-red-400",
      status === "warning" && "bg-yellow-500/15 text-yellow-400",
      status === "unknown" && "bg-muted text-muted-foreground",
    )}>
      {status === "ok" ? "All Healthy" : status === "error" ? "Issues Detected" : status === "warning" ? "Warnings" : "Unknown"}
    </span>
  );
}
