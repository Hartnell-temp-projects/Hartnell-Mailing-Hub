import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (!session) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        email: session.email,
        name: session.name,
        subject: session.subject,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
