import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  deleteSession(request);

  const response = NextResponse.json(
    { loggedOut: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  clearSessionCookie(response);
  return response;
}
