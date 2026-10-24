"use client";

import { useEffect, useState } from "react";
import { BarChart2, Download, HardDrive, Users, TrendingUp, Loader2 } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";

interface StatsData {
  my: {
    totalGrabs: number;
    completed: number;
    totalBytes: number;
    successRate: number | null;
    topCategories: Array<{ label: string; count: number; pct: number }>;
  };
  community: {
    totalUsers: number;
    totalGrabs: number;
    totalBytes: number;
    totalBytesFormatted: string;
  };
  rankings: Array<{
    username: string;
    grabCount: number;
    completed: number;
    bytes: number;
  }> | null;
}

export default function StatsView() {
  const t = useT();
  const [data, setData] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (!res.ok) throw new Error(t("stats.loadFailed"));
        setData((await res.json()) as StatsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("stats.loadFailed"));
      }
    }
    void load();
  }, [t]);

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("stats.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-primary" />
        {t("stats.title")}
      </h1>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("stats.myActivity")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Download} label={t("stats.totalGrabs")} value={String(data.my.totalGrabs)} color="text-primary" />
          <StatCard icon={TrendingUp} label={t("stats.completed")} value={String(data.my.completed)} color="text-green-400" />
          <StatCard icon={HardDrive} label={t("stats.downloaded")} value={formatBytes(data.my.totalBytes)} color="text-blue-400" />
          <StatCard
            icon={BarChart2}
            label={t("stats.successRate")}
            value={data.my.successRate !== null ? `${data.my.successRate}%` : "—"}
            color="text-purple-400"
          />
        </div>

        {data.my.topCategories.length > 0 && (
          <div className="nv-card p-4">
            <h3 className="text-sm font-semibold mb-3">{t("stats.topCategories")}</h3>
            <div className="space-y-2">
              {data.my.topCategories.map((cat) => (
                <div key={cat.label} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-40 truncate" title={cat.label}>
                    {cat.label}
                  </span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${cat.pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {t("stats.allUsers")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard icon={Users} label={t("stats.totalUsers")} value={String(data.community.totalUsers)} color="text-orange-400" />
          <StatCard icon={Download} label={t("stats.totalGrabs")} value={String(data.community.totalGrabs)} color="text-primary" />
          <StatCard
            icon={HardDrive}
            label={t("stats.totalDownloaded")}
            value={data.community.totalBytesFormatted}
            color="text-green-400"
          />
        </div>

        {data.rankings && data.rankings.length > 0 && (
          <div className="nv-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">{t("stats.userRankings")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("stats.adminOnly")}</p>
            </div>
            <table className="nv-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("common.user")}</th>
                  <th>{t("common.grabs")}</th>
                  <th>{t("stats.downloaded")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((u, i) => (
                  <tr key={u.username}>
                    <td className="text-muted-foreground font-mono text-xs">{i + 1}</td>
                    <td className="font-medium">{u.username}</td>
                    <td>{u.grabCount}</td>
                    <td className="text-muted-foreground">{formatBytes(u.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="nv-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
