import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { EmailTemplate } from "@/components/types";
import { json, readJsonBody, requireStorageUser, storageErrorResponse } from "@/lib/storage/http";
import { createTemplate, listTemplates } from "@/lib/storage/userData";

export const runtime = "nodejs";

async function loadBuiltInTemplates(): Promise<EmailTemplate[]> {
  const content = await readFile(
    path.join(process.cwd(), "lib", "emails", "test.html"),
    "utf8"
  );

  return [
    {
      id: "it-security-notice",
      name: "IT Security Notice",
      description: "Hartnell IT security alert with branded styling.",
      subject: "IT Security Notice",
      content,
      source: "built-in",
    },
  ];
}

/**
 * Returns the built-in templates plus the signed-in user's saved templates from Box.
 * Either source can fail independently; failures are reported in `errors` so the
 * UI can still show whatever loaded.
 */
export async function GET(request: NextRequest) {
  const user = requireStorageUser(request);
  if (user instanceof NextResponse) return user;

  const [builtIn, saved] = await Promise.allSettled([
    loadBuiltInTemplates(),
    listTemplates(user),
  ]);

  const errors: string[] = [];
  if (builtIn.status === "rejected") {
    console.error("Built-in templates failed to load:", builtIn.reason);
    errors.push("Built-in templates could not be loaded.");
  }
  if (saved.status === "rejected") {
    console.error("Saved templates failed to load from Box:", saved.reason);
    errors.push("Saved templates could not be loaded from Box.");
  }

  return json({
    templates: [
      ...(builtIn.status === "fulfilled" ? builtIn.value : []),
      ...(saved.status === "fulfilled" ? saved.value : []),
    ],
    errors,
  });
}

export async function POST(request: NextRequest) {
  const user = requireStorageUser(request);
  if (user instanceof NextResponse) return user;

  try {
    return json(await createTemplate(user, await readJsonBody(request)), 201);
  } catch (error) {
    return storageErrorResponse(error, "save the template");
  }
}
