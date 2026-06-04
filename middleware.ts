import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/setup", "/setup"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth(async function middleware(req: NextRequest & { auth?: { user?: { id: string } } | null }) {
  const { pathname } = req.nextUrl;

  // Statische Dateien und öffentliche Pfade immer erlauben
  if (
    isPublic(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Setup-Check (kann später erweitert werden)
  if (!pathname.startsWith("/setup") && !pathname.startsWith("/api/")) {
    // Hier kannst du später prüfen, ob das Setup bereits abgeschlossen ist
    // z.B. über ein Cookie oder eine schnelle DB-Abfrage
  }

  // Wenn kein User eingeloggt ist → zum Login weiterleiten
  if (!req.auth?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// WICHTIG: Node.js Runtime verwenden wegen better-sqlite3 / Database Adapter
export const runtime = "nodejs";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js)).*)",
  ],
};

// import { auth } from "@/auth";
// import { NextResponse } from "next/server";
// import type { NextRequest } from "next/server";

// const PUBLIC_PATHS = ["/login", "/api/auth", "/api/setup", "/setup"];

// function isPublic(pathname: string): boolean {
//   return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
// }


// export default auth(async function middleware(req: NextRequest & { auth?: { user?: { id: string } } | null }) {
//   const { pathname } = req.nextUrl;

//   // Allow public paths and static assets
//   if (
//     isPublic(pathname) ||
//     pathname.startsWith("/_next") ||
//     pathname.startsWith("/favicon") ||
//     pathname.match(/\.(png|jpg|svg|ico|webp)$/)
//   ) {
//     return NextResponse.next();
//   }

//   // Check setup completion (except during setup itself)
//   if (!pathname.startsWith("/setup") && !pathname.startsWith("/api/")) {
//     // Redirect to setup if not authenticated AND setup not done
//     // (actual setup check happens in the page for performance)
//   }

//   if (!req.auth?.user) {
//     const loginUrl = new URL("/login", req.url);
//     loginUrl.searchParams.set("callbackUrl", pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   return NextResponse.next();
// });

// export const config = {
//   matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
// };
