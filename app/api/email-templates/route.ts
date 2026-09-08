import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const content = await readFile(
      path.join(process.cwd(), "lib", "emails", "test.html"),
      "utf8"
    );

    return NextResponse.json([
      {
        id: "it-security-notice",
        name: "IT Security Notice",
        description: "Hartnell IT security alert with branded styling.",
        subject: "IT Security Notice",
        content,
        source: "built-in",
      },
    ]);
  } catch {
    return NextResponse.json(
      { error: "Unable to load built-in email templates." },
      { status: 500 }
    );
  }
}
