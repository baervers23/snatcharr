import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guidarr/api-auth";
import { deleteSlide, getSlide, updateSlide } from "@/lib/guidarr/storage";
import { markdownToHtml } from "@/lib/guidarr/markdown";

type RouteContext = { params: Promise<{ id: string; slideId: string }> };

/** GET — single slide with markdown (admin preview uses this too). */
export async function GET(_request: Request, context: RouteContext) {
  const { id, slideId } = await context.params;
  const slide = await getSlide(id, slideId);
  if (!slide) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  const html = await markdownToHtml(slide.markdown);
  return NextResponse.json({ slide: { ...slide, html } });
}

/** PUT — update slide metadata and/or markdown (admin). */
export async function PUT(request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, slideId } = await context.params;
  const body = (await request.json()) as {
    title?: string;
    markdown?: string;
    redirectUrl?: string | null;
  };

  const slide = await updateSlide(id, slideId, body);
  if (!slide) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }
  return NextResponse.json({ slide });
}

/** DELETE — remove slide (admin). */
export async function DELETE(_request: Request, context: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, slideId } = await context.params;
  const ok = await deleteSlide(id, slideId);
  if (!ok) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
