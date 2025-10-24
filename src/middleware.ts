import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // In development, you might want to mock the D1 database
  // In production with Cloudflare, this will be available via platform

  // Add header for the pathname
  const pathname = request.nextUrl.pathname;
  request.headers.set("x-pathname", pathname);
  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
}

export const config = {
  // matcher: "/api/:path*",
  matcher: ["/folders/:path*", "/api/:path*"],
};
