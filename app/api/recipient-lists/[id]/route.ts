import { NextRequest, NextResponse } from "next/server";
import { json, requireStorageUser, storageErrorResponse } from "@/lib/storage/http";
import { deleteRecipientList } from "@/lib/storage/userData";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/recipient-lists/[id]">
) {
  const user = requireStorageUser(request);
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;

  try {
    const deleted = await deleteRecipientList(user, id);
    return deleted ? json({ deleted: true }) : json({ error: "Mailing list not found." }, 404);
  } catch (error) {
    return storageErrorResponse(error, "delete the mailing list");
  }
}
