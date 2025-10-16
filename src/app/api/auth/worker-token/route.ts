import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await authClient.getSession();
  if (!session?.data?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // For now we return a short-lived opaque token (user id). In production,
  // issue a signed JWT from your backend if needed.
  return NextResponse.json({ token: session.data.user.id, expiresIn: 300 });
}
