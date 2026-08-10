import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { grabs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatBytes, resolveGrabCategoryLabel } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const me = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const myGrabs = await db.query.grabs.findMany({
    where: eq(grabs.userId, session.user.id),
  });

  const catMap = new Map<string, number>();
  for (const g of myGrabs) {
    const label = resolveGrabCategoryLabel(g);
    catMap.set(label, (catMap.get(label) ?? 0) + 1);
  }
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const allUsers = await db.query.users.findMany();
  const community = {
    totalUsers: allUsers.length,
    totalGrabs: allUsers.reduce((sum, u) => sum + (u.lifetimeGrabs ?? 0), 0),
    totalCompleted: allUsers.reduce((sum, u) => sum + (u.lifetimeCompleted ?? 0), 0),
    totalBytes: allUsers.reduce((sum, u) => sum + (u.lifetimeBytes ?? 0), 0),
  };

  const rankings = isAdmin
    ? [...allUsers]
        .map((u) => ({
          username: u.username,
          grabCount: u.lifetimeGrabs ?? 0,
          completed: u.lifetimeCompleted ?? 0,
          bytes: u.lifetimeBytes ?? 0,
        }))
        .sort((a, b) => b.grabCount - a.grabCount)
        .slice(0, 10)
    : null;

  const lifetimeGrabs = me?.lifetimeGrabs ?? 0;
  const lifetimeCompleted = me?.lifetimeCompleted ?? 0;

  return NextResponse.json({
    my: {
      totalGrabs: lifetimeGrabs,
      completed: lifetimeCompleted,
      totalBytes: me?.lifetimeBytes ?? 0,
      successRate:
        lifetimeGrabs > 0 ? Math.round((lifetimeCompleted / lifetimeGrabs) * 100) : null,
      topCategories: topCategories.map(([label, count]) => ({
        label,
        count,
        pct: myGrabs.length ? Math.round((count / myGrabs.length) * 100) : 0,
      })),
    },
    community: {
      totalUsers: community.totalUsers,
      totalGrabs: community.totalGrabs,
      totalBytes: community.totalBytes,
      totalBytesFormatted: formatBytes(community.totalBytes),
    },
    rankings,
  });
}
