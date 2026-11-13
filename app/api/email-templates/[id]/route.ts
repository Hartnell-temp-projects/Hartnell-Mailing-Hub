import { NextRequest, NextResponse } from "next/server";
import { json, requireStorageUser, storageErrorResponse } from "@/lib/storage/http";
import { deleteTemplate } from "@/lib/storage/userData";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  ctx: RouteContext<"/api/email-templates/[id]">
) {
  const user = await requireStorageUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const { id } = await ctx.params;

  try {
    const deleted = await deleteTemplate(user, id);
    return deleted ? json({ deleted: true }) : json({ error: "Template not found." }, 404);
  } catch (error) {
    return storageErrorResponse(error, "delete the template");
  }
}
