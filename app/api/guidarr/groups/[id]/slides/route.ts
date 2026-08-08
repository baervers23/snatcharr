import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guidarr/api-auth";
import {
  createSlide,
  getGroup,
  getSlides,
  getSlidesWithHtml,
  reorderSlides,
} from "@/lib/guidarr/storage";

type RouteContext = { params: Promise<{ id: string }> };

/** GET — slides for a group. ?html=1 includes rendered markdown. */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const group = await getGroup(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const withHtml = new URL(request.url).searchParams.get("html") === "1";
  const slides = withHtml ? await getSlidesWithHtml(id) : await getSlides(id);
  return NextResponse.json({ slides });
}

/** POST — create slide (admin). */
export async function POST(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const body = (await request.json()) as { title?: string; markdown?: string };
  const title = body.title?.trim() || "New Slide";

  const slide = await createSlide(id, title, body.markdown);
  if (!slide) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  return NextResponse.json({ slide }, { status: 201 });
}

/** PATCH — reorder slides (admin). */
export async function PATCH(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;
  const body = (await request.json()) as { orderedIds?: string[] };
  if (!body.orderedIds?.length) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
  }

  const slides = await reorderSlides(id, body.orderedIds);
  return NextResponse.json({ slides });
}
