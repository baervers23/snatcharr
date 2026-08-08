import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Guidarr — all routes are public; admin auth is handled per API route. */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
