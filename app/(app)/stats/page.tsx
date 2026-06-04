import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs, users } from "@/lib/db/schema";
import { desc, count, sum, eq } from "drizzle-orm";
import { formatBytes } from "@/lib/utils";
import { BarChart2, Download, HardDrive, Users, TrendingUp } from "lucide-react";

export const metadata = { title: "Stats | Snatcharr" };

export default async function StatsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  // User's own stats
  const myGrabs = await db.query.grabs.findMany({
    where: eq(grabs.userId, session!.user.id),
  });

  const myCompleted = myGrabs.filter((g) => g.status === "completed");
  const myTotalBytes = myCompleted.reduce((acc, g) => acc + (g.sizeBytes ?? 0), 0);

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const g of myGrabs) {
    if (g.category) catMap.set(g.category, (catMap.get(g.category) ?? 0) + 1);
  }
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Admin stats
  let adminStats: {
    totalUsers: number;
    totalGrabs: number;
    totalBytes: number;
    topUsers: Array<{ username: string; grabCount: number; bytes: number }>;
  } | null = null;

  if (isAdmin) {
    const allGrabs = await db.query.grabs.findMany({ with: { user: { columns: { username: true } } } as never });
    const allUsers = await db.query.users.findMany();

    const userMap = new Map<string, { username: string; grabCount: number; bytes: number }>();
    for (const g of allGrabs as typeof allGrabs & { user?: { username: string } }[]) {
      const username = (g as { user?: { username: string } }).user?.username ?? "unknown";
      const entry = userMap.get(g.userId) ?? { username, grabCount: 0, bytes: 0 };
      entry.grabCount++;
      entry.bytes += g.sizeBytes ?? 0;
      userMap.set(g.userId, entry);
    }

    adminStats = {
      totalUsers: allUsers.length,
      totalGrabs: allGrabs.length,
      totalBytes: allGrabs.reduce((acc, g) => acc + (g.sizeBytes ?? 0), 0),
      topUsers: [...userMap.values()].sort((a, b) => b.grabCount - a.grabCount).slice(0, 10),
    };
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-primary" />
        Statistics
      </h1>

      {/* My Stats */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Activity</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Download} label="Total Grabs" value={String(myGrabs.length)} color="text-primary" />
          <StatCard icon={TrendingUp} label="Completed" value={String(myCompleted.length)} color="text-green-400" />
          <StatCard icon={HardDrive} label="Downloaded" value={formatBytes(myTotalBytes)} color="text-blue-400" />
          <StatCard
            icon={BarChart2}
            label="Success Rate"
            value={myGrabs.length ? `${Math.round((myCompleted.length / myGrabs.length) * 100)}%` : "—"}
            color="text-purple-400"
          />
        </div>

        {topCategories.length > 0 && (
          <div className="nv-card p-4">
            <h3 className="text-sm font-semibold mb-3">Top Categories</h3>
            <div className="space-y-2">
              {topCategories.map(([cat, count]) => {
                const pct = Math.round((count / myGrabs.length) * 100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-32 truncate">{cat}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Admin Stats */}
      {isAdmin && adminStats && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Admin Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard icon={Users} label="Total Users" value={String(adminStats.totalUsers)} color="text-orange-400" />
            <StatCard icon={Download} label="Total Grabs" value={String(adminStats.totalGrabs)} color="text-primary" />
            <StatCard icon={HardDrive} label="Total Downloaded" value={formatBytes(adminStats.totalBytes)} color="text-green-400" />
          </div>

          {adminStats.topUsers.length > 0 && (
            <div className="nv-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">User Rankings</h3>
              </div>
              <table className="nv-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Grabs</th>
                    <th>Downloaded</th>
                  </tr>
                </thead>
                <tbody>
                  {adminStats.topUsers.map((u, i) => (
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
      )}
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

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
