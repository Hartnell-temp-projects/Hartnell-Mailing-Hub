import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import type { StorageUser } from "@/lib/box/userStorage";
import {
  StorageConflictError,
  StorageCorruptError,
  StorageOwnershipError,
} from "@/lib/box/userStorage";
import { InvalidInputError } from "./userData";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Returns the signed-in user, or a 401 response. The Box folder is always derived from this. */
export function requireStorageUser(request: NextRequest): StorageUser | NextResponse {
  const session = getSession(request);
  if (!session) {
    return json({ error: "Please log in to access saved data." }, 401);
  }
  return { subject: session.subject, email: session.email };
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new InvalidInputError("Request body must be valid JSON.");
  }
}

export function storageErrorResponse(error: unknown, action: string) {
  if (error instanceof InvalidInputError) {
    return json({ error: error.message }, 400);
  }
  if (error instanceof StorageConflictError) {
    return json({ error: error.message }, 409);
  }
  if (error instanceof StorageOwnershipError) {
    console.error(`Box storage ownership mismatch while trying to ${action}:`, error);
    return json({ error: "Your Box storage folder could not be verified. Contact IT." }, 403);
  }
  if (error instanceof StorageCorruptError) {
    console.error(`Box storage data is unreadable while trying to ${action}:`, error);
    return json({ error: "Saved data in Box could not be read. Contact IT." }, 500);
  }

  console.error(`Box storage failed while trying to ${action}:`, error);
  return json({ error: `Unable to ${action}. Please try again.` }, 502);
}
