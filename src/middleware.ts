import { NextResponse } from "next/server";

export function middleware() {
  // In development, you might want to mock the D1 database
  // In production with Cloudflare, this will be available via platform

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
