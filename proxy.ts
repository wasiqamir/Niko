import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "niko_session";

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  if (
    (pathname.startsWith("/home") ||
      pathname.startsWith("/book") ||
      pathname.startsWith("/links") ||
      pathname.startsWith("/teams/meetings")) &&
    !hasSession
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home",
    "/home/:path*",
    "/book",
    "/book/:path*",
    "/links",
    "/links/:path*",
    "/teams/meetings/:path*",
  ],
};
