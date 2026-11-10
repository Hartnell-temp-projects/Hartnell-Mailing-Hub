import { NextRequest, NextResponse } from "next/server";
import { json, readJsonBody, requireStorageUser, storageErrorResponse } from "@/lib/storage/http";
import { createRecipientList, listRecipientLists } from "@/lib/storage/userData";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await requireStorageUser(request);
  if (user instanceof NextResponse) return user;

  try {
    return json(await listRecipientLists(user));
  } catch (error) {
    return storageErrorResponse(error, "load saved mailing lists");
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStorageUser(request);
  if (user instanceof NextResponse) return user;

  try {
    return json(await createRecipientList(user, await readJsonBody(request)), 201);
  } catch (error) {
    return storageErrorResponse(error, "save the mailing list");
  }
}
