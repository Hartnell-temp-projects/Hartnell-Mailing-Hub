import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json(
    { loggedOut: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSessionCookie(response);
  return response;
}
