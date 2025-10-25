import { NextRequest, NextResponse } from "next/server";

export function middleware(_request: NextRequest) {
  // In development, you might want to mock the D1 database
  // In production with Cloudflare, this will be available via platform

  // No need to add pathname header since we're using client-side detection
  return NextResponse.next();
}

export const config = {
  // matcher: "/api/:path*",
  matcher: ["/folders/:path*", "/api/:path*"],
};
