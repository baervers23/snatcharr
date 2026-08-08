import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guidarr/api-auth";
import { deleteGroup, getGroup, updateGroup } from "@/lib/guidarr/storage";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — single group metadata (public). */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  return NextResponse.json({ group });
}

/** PUT — update group name/icon (admin). */
export async function PUT(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    icon?: string | null;
    order?: number;
  };

  const group = await updateGroup(id, body);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  return NextResponse.json({ group });
}

/** DELETE — remove group and all slides (admin). */
export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const ok = await deleteGroup(id);
  if (!ok) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
