import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }
  // Public folder and other static files
  if (/\.[^/]+$/.test(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
