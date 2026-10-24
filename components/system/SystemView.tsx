"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Monitor, Cpu, HardDrive, MemoryStick, Clock, Server, Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ListTodo, ScrollText, ClipboardList, ArrowDownToLine, Bug } from "lucide-react";
import type { AppUpdateStatus } from "@/lib/app-update";
import { cn, formatBytes } from "@/lib/utils";
import { parseActionLine, DOMAIN_COLORS, OUTCOME_COLORS } from "@/lib/action-log-format";
import type { Indexer, DownloadClient, ExternalApp } from "@/lib/db/schema";
import type { AppSettings } from "@/lib/db/settings-shared";
import TasksView from "@/components/tasks/TasksView";
import BackupRestoreSection from "@/components/system/BackupRestoreSection";
import DebugView from "@/components/system/DebugView";
import { useSearchParams } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/client";

type SystemTab = "overview" | "tasks" | "logs" | "audit" | "debug";

interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  uptime: string;
  memoryMB: number;
  cpuCores: number;
}

interface DiskInfo {
  path: string;
  free: number;
  total: number;
}

interface HealthCheck {
  id: string;
  name: string;
  type: "indexer" | "client" | "app";
  status: "ok" | "warning" | "error" | "unknown" | "checking";
  message?: string;
  lastCheckedAt?: string | null;
}

interface AuditEvent {
  id: string;
  action: string;
  details: string | null;
  username: string;
  ipAddress: string | null;
  createdAt: string;
}

interface Props {
  systemInfo: SystemInfo;
  updateStatus: AppUpdateStatus;
  dataDisk: DiskInfo | null;
  downloadDisk: DiskInfo | null;
  sameDisk: boolean;
  indexers: Indexer[];
  downloadClients: DownloadClient[];
  externalApps: ExternalApp[];
  settings: Partial<AppSettings>;
  canDownloadBackup: boolean;
  debugEnabled?: boolean;
}

const SYSTEM_TABS: Array<{ id: SystemTab; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", labelKey: "system.tabs.overview", icon: Monitor },
  { id: "tasks", labelKey: "system.tabs.tasks", icon: ListTodo },
  { id: "logs", labelKey: "system.tabs.logs", icon: ScrollText },
  { id: "audit", labelKey: "system.tabs.audit", icon: ClipboardList },
  { id: "debug", labelKey: "system.tabs.debug", icon: Bug },
];

function tabFromParam(param: string | null, debugEnabled: boolean): SystemTab {
  if (param === "tasks" || param === "logs" || param === "audit") return param;
  if (param === "debug" && debugEnabled) return "debug";
  return "overview";
}

export default function SystemView({ systemInfo, updateStatus, dataDisk, downloadDisk, sameDisk, indexers, downloadClients, externalApps, settings, canDownloadBackup, debugEnabled = false }: Props) {
  const t = useT();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SystemTab>(() =>
    tabFromParam(searchParams.get("tab"), debugEnabled),
  );
  const visibleTabs = SYSTEM_TABS.filter((tab) => tab.id !== "debug" || debugEnabled);
  const [checks, setChecks] = useState<HealthCheck[]>([
    ...indexers.map((i) => ({
      id: i.id,
      name: i.name,
      type: "indexer" as const,
      status: (i.lastStatus ?? "unknown") as HealthCheck["status"],
      message: i.lastError ?? undefined,
      lastCheckedAt: i.lastCheckedAt ? new Date(i.lastCheckedAt).toISOString() : null,
    })),
    ...downloadClients.map((c) => ({
      id: c.id,
      name: c.name,
      type: "client" as const,
      status: (c.lastStatus ?? "unknown") as HealthCheck["status"],
      message: c.lastError ?? undefined,
      lastCheckedAt: c.lastCheckedAt ? new Date(c.lastCheckedAt).toISOString() : null,
    })),
    ...externalApps.map((a) => ({
      id: a.id,
      name: a.name,
      type: "app" as const,
      status: (a.lastStatus ?? "unknown") as HealthCheck["status"],
      message: a.lastError ?? undefined,
      lastCheckedAt: a.lastCheckedAt ? new Date(a.lastCheckedAt).toISOString() : null,
    })),
  ]);
  const [runningChecks, setRunningChecks] = useState(false);
  const [logs, setLogs] = useState<Array<{ ts: string; level: string; msg: string }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logHasMore, setLogHasMore] = useState(false);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const autoHealthRan = useRef(false);

  const runHealthChecks = useCallback(async () => {
    setRunningChecks(true);
    setChecks((prev) => prev.map((c) => ({ ...c, status: "checking" as const })));

    try {
      const response = await fetch("/api/system/health", { method: "POST" });
      const data = await response.json() as {
        results: Array<{ id: string; status: HealthCheck["status"]; message?: string; lastCheckedAt?: string }>;
      };
      const checkedAt = new Date().toISOString();
      setChecks((prev) =>
        prev.map((c) => {
          const result = data.results?.find((r) => r.id === c.id);
          return result
            ? { ...c, status: result.status, message: result.message, lastCheckedAt: result.lastCheckedAt ?? checkedAt }
            : c;
        }),
      );
    } catch {
      setChecks((prev) => prev.map((c) => ({ ...c, status: "error" as const, message: t("system.healthFailed") })));
    } finally {
      setRunningChecks(false);
    }
  }, [t]);

  async function fetchLogs(page = logPage) {
    setLoadingLogs(true);
    try {
      const response = await fetch(`/api/system/logs?page=${page}&limit=100`);
      const data = await response.json() as { logs: typeof logs; hasMore?: boolean };
      setLogs(data.logs ?? []);
      setLogHasMore(!!data.hasMore);
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function fetchAudit(page = auditPage) {
    setLoadingAudit(true);
    try {
      const response = await fetch(`/api/system/audit?page=${page}&limit=25`);
      const data = (await response.json()) as { events?: AuditEvent[]; hasMore?: boolean };
      setAudit(data.events ?? []);
      setAuditHasMore(!!data.hasMore);
    } catch {
      setAudit([]);
    } finally {
      setLoadingAudit(false);
    }
  }

  useEffect(() => {
    if (activeTab !== "logs") return;
    fetchLogs(logPage);
  }, [logPage, activeTab]);

  useEffect(() => {
    if (activeTab !== "audit") return;
    fetchAudit(auditPage);
  }, [auditPage, activeTab]);

  useEffect(() => {
    if (activeTab !== "logs") return;
    const logInterval = setInterval(() => fetchLogs(logPage), 10_000);
    return () => clearInterval(logInterval);
  }, [logPage, activeTab]);

  useEffect(() => {
    if (activeTab !== "overview" || autoHealthRan.current || checks.length === 0) return;
    const needsCheck = checks.some((c) => !c.lastCheckedAt);
    if (!needsCheck) return;
    autoHealthRan.current = true;
    void runHealthChecks();
  }, [activeTab, checks.length, runHealthChecks]);

  const latestCheck = checks
    .map((c) => c.lastCheckedAt)
    .filter(Boolean)
    .sort()
    .pop();

  const overallHealth = checks.every((c) => c.status === "ok")
    ? "ok"
    : checks.some((c) => c.status === "error")
    ? "error"
    : checks.some((c) => c.status === "warning")
    ? "warning"
    : checks.some((c) => c.status === "checking")
    ? "checking"
    : "unknown";

  return (
    <div className={cn("space-y-6 mx-auto", activeTab === "logs" ? "max-w-6xl" : "max-w-5xl")}>
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        {t("system.title")}
      </h1>

      <nav className="flex flex-wrap gap-1 border-b border-border pb-1">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-md transition-colors",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-4 w-4" />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>

      {activeTab === "debug" && debugEnabled && <DebugView />}

      {activeTab === "tasks" && <TasksView settings={settings} embedded />}

      {activeTab === "overview" && (
        <>
      {updateStatus.updateAvailable && (
        <div className="nv-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 border-amber-500/30 bg-amber-500/10">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <ArrowDownToLine className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("system.updateAvailable", { version: updateStatus.latestVersion ?? "" })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("system.updateHint", { current: updateStatus.currentVersion })}
              </p>
            </div>
          </div>
          <a
            href={updateStatus.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
          >
            {t("system.viewRelease")}
          </a>
        </div>
      )}

      {/* System Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard
          icon={Server}
          label="Snatcharr"
          value={`v${systemInfo.version}`}
          sub={t("system.nodeVersion", { version: systemInfo.nodeVersion })}
        />
        <InfoCard icon={Clock} label={t("system.uptime")} value={systemInfo.uptime} sub={systemInfo.platform} />
        <InfoCard icon={MemoryStick} label={t("system.memory")} value={`${systemInfo.memoryMB} MB`} sub={t("system.rss")} />
        <InfoCard icon={Cpu} label={t("system.cpuCores")} value={String(systemInfo.cpuCores)} />
        {dataDisk && (
          <InfoCard
            icon={HardDrive}
            label={sameDisk ? t("system.storage") : t("system.dataDisk")}
            value={formatBytes(dataDisk.free)}
            sub={t("system.totalPath", { total: formatBytes(dataDisk.total), path: dataDisk.path })}
            className="col-span-2 sm:col-span-1"
          />
        )}
        {downloadDisk && !sameDisk && (
          <InfoCard
            icon={HardDrive}
            label={t("system.downloadsDisk")}
            value={formatBytes(downloadDisk.free)}
            sub={t("system.totalPath", { total: formatBytes(downloadDisk.total), path: downloadDisk.path })}
            className="col-span-2 sm:col-span-1"
          />
        )}
      </div>

      {/* Health Checks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t("system.healthChecks")}
            <HealthBadge status={overallHealth} />
          </h2>
          <div className="flex items-center gap-3">
            {latestCheck && (
              <span className="text-xs text-muted-foreground">
                {t("system.lastChecked", { time: new Date(latestCheck).toLocaleString(locale) })}
              </span>
            )}
            <button
              onClick={runHealthChecks}
              disabled={runningChecks}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", runningChecks && "animate-spin")} />
              {t("system.runChecks")}
            </button>
          </div>
        </div>

        {checks.length === 0 ? (
          <div className="nv-card p-6 text-center text-muted-foreground text-sm">
            {t("system.noServices")}
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
                  {check.lastCheckedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("system.checked", { time: new Date(check.lastCheckedAt).toLocaleString(locale) })}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground capitalize">{t(`system.checkTypes.${check.type}`)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BackupRestoreSection canDownloadBackup={canDownloadBackup} />
        </>
      )}

      {activeTab === "logs" && (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("system.liveLogs")}</h2>
          <button onClick={() => void fetchLogs(logPage)} disabled={loadingLogs} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50">
            <RefreshCw className={cn("h-3 w-3", loadingLogs && "animate-spin")} />
            {t("common.refresh")}
          </button>
        </div>

        <div className="nv-card bg-black/50 font-mono text-sm p-4 min-h-[32rem] h-[calc(100vh-14rem)] overflow-y-auto space-y-0.5">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">{t("system.noLogs")}</p>
          ) : (
            logs.map((log, i) => {
              const parsed = parseActionLine(log.msg);
              return (
                <div key={i} className="flex gap-2 leading-relaxed">
                  <span className="text-muted-foreground shrink-0">{log.ts}</span>
                  <span
                    className={cn(
                      "shrink-0 uppercase font-bold w-12",
                      log.level === "error" && "text-red-400",
                      log.level === "warn" && "text-yellow-400",
                      log.level === "info" && "text-blue-400/80",
                      log.level === "debug" && "text-muted-foreground",
                    )}
                  >
                    {log.level}
                  </span>
                  {parsed.domain ? (
                    <span className="shrink-0 flex items-center gap-1.5">
                      <span className={cn("font-bold", DOMAIN_COLORS[parsed.domain] ?? "text-primary")}>
                        {parsed.domain}
                      </span>
                      <span className="text-muted-foreground">{parsed.action}</span>
                      {parsed.outcome && (
                        <span className={cn("font-semibold uppercase", OUTCOME_COLORS[parsed.outcome])}>
                          {parsed.outcome}
                        </span>
                      )}
                    </span>
                  ) : null}
                  <span className="text-foreground break-all min-w-0">
                    {parsed.domain ? parsed.rest : log.msg}
                  </span>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={logPage <= 1} className="px-2 py-1 border border-border rounded disabled:opacity-40">{t("common.previous")}</button>
          <span>{t("common.page", { n: logPage })}</span>
          <button onClick={() => setLogPage((p) => p + 1)} disabled={!logHasMore} className="px-2 py-1 border border-border rounded disabled:opacity-40">{t("common.next")}</button>
        </div>
      </div>
      )}

      {activeTab === "audit" && (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("system.auditLog")}</h2>
          <button onClick={() => void fetchAudit(auditPage)} disabled={loadingAudit} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-accent transition-colors disabled:opacity-50">
            <RefreshCw className={cn("h-3 w-3", loadingAudit && "animate-spin")} />
            {t("common.refresh")}
          </button>
        </div>

        <div className="nv-card overflow-hidden">
          {audit.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("system.noAudit")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="nv-table">
                <thead>
                  <tr>
                    <th>{t("system.auditWhen")}</th>
                    <th>{t("system.auditUser")}</th>
                    <th>{t("system.auditAction")}</th>
                    <th className="hidden md:table-cell">{t("system.auditDetails")}</th>
                    <th className="hidden lg:table-cell">{t("system.auditIp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id}>
                      <td className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString(locale)}
                      </td>
                      <td className="text-sm font-medium whitespace-nowrap">{e.username}</td>
                      <td>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-foreground">{e.action}</span>
                      </td>
                      <td className="hidden md:table-cell text-xs text-muted-foreground max-w-md truncate">{e.details}</td>
                      <td className="hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">{e.ipAddress ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <button onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage <= 1} className="px-2 py-1 border border-border rounded disabled:opacity-40">{t("common.previous")}</button>
          <span>{t("common.page", { n: auditPage })}</span>
          <button onClick={() => setAuditPage((p) => p + 1)} disabled={!auditHasMore} className="px-2 py-1 border border-border rounded disabled:opacity-40">{t("common.next")}</button>
        </div>
      </div>
      )}
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
  const t = useT();
  return (
    <span className={cn(
      "text-xs font-medium px-2 py-0.5 rounded-full normal-case tracking-normal",
      status === "ok" && "bg-green-500/15 text-green-400",
      status === "error" && "bg-red-500/15 text-red-400",
      status === "warning" && "bg-yellow-500/15 text-yellow-400",
      status === "unknown" && "bg-muted text-muted-foreground",
    )}>
      {status === "ok" ? t("system.allHealthy") : status === "error" ? t("system.issuesDetected") : status === "warning" ? t("system.warnings") : t("system.unknown")}
    </span>
  );
}
