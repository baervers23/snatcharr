import { NextResponse } from "next/server";

import { auth } from "@/auth";

import { db } from "@/lib/db";

import { users } from "@/lib/db/schema";

import { getHealthySyncApps, syncUserFromExternalApps } from "@/lib/user-sync";

import { logAudit, logActionFail } from "@/lib/audit";

import { z } from "zod";



const syncSchema = z.object({

  source: z.enum(["jellyfin", "seerr"]),

});



export async function POST(req: Request) {

  const session = await auth();

  if (session?.user?.role !== "admin") {

    logActionFail("SYNC", "bulk", "denied", { username: session?.user?.username, req });

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  }



  const body = await req.json();

  const parsed = syncSchema.safeParse(body);

  if (!parsed.success) {

    logActionFail("SYNC", "bulk", "aborted", {

      username: session.user.username,

      details: "invalid source",

      req,

    });

    return NextResponse.json({ error: "Choose sync source: jellyfin or seerr" }, { status: 422 });

  }



  const { source } = parsed.data;

  const apps = await getHealthySyncApps([source]);

  const app = source === "jellyfin" ? apps.jellyfin : apps.seerr;



  if (!app) {

    logActionFail("SYNC", "bulk", "failed", {

      username: session.user.username,

      details: `no enabled ${source} app`,

      req,

    });

    return NextResponse.json(

      { error: `No enabled ${source} app with API key configured.` },

      { status: 503 },

    );

  }



  const allUsers = await db.query.users.findMany();

  let synced = 0;

  const errors: string[] = [];



  for (const user of allUsers) {

    const result = await syncUserFromExternalApps(user, source);

    if (result.ok) synced++;

    else if (result.error) errors.push(`${user.username}: ${result.error}`);

  }



  const summary = `bulk ${source} — ${synced}/${allUsers.length} updated`;

  if (errors.length > 0) {

    logActionFail("SYNC", "bulk", "failed", {

      username: session.user.username,

      details: `${summary}; ${errors.slice(0, 3).join("; ")}`,

      req,

    });

  } else {

    await logAudit("user.sync", {

      userId: session.user.id,

      username: session.user.username,

      details: summary,

      req,

    });

  }



  return NextResponse.json({

    success: true,

    synced,

    total: allUsers.length,

    source,

    errors: errors.slice(0, 10),

  });

}

