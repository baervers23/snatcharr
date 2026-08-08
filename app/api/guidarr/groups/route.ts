import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guidarr/api-auth";
import { createGroup, getGroups, reorderGroups } from "@/lib/guidarr/storage";

/** GET — list all groups (public). */
export async function GET() {
  const groups = await getGroups();
  return NextResponse.json({ groups });
}

/** POST — create a new group (admin). */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as { name?: string; icon?: string | null };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const group = await createGroup(name, body.icon ?? null);
  return NextResponse.json({ group }, { status: 201 });
}

/** PATCH — reorder groups (admin). */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as { orderedIds?: string[] };
  if (!body.orderedIds?.length) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
  }

  const groups = await reorderGroups(body.orderedIds);
  return NextResponse.json({ groups });
}
