import { Readable } from "node:stream";
import { buffer } from "node:stream/consumers";
import { BoxApiError } from "box-node-sdk";
import { getBoxClient, getBoxRootFolderId } from "./client";

// Per-user JSON storage in Box.
//
// Layout (all owned by the Box app's service account):
//   <BOX_ROOT_FOLDER_ID>/
//     <user email>/            folder description = "duo-sub:<OIDC subject>"
//       templates.json
//       recipient-lists.json
//
// Each collection is a single JSON array. Writes use the file's etag with
// If-Match so two browsers saving at the same time can't silently overwrite
// each other; a conflicting write re-reads the latest version and retries.

export interface StorageUser {
  subject: string;
  email?: string;
}

/** The user's folder exists but belongs to a different OIDC subject. */
export class StorageOwnershipError extends Error {}

/** A stored collection could not be parsed, so it must not be overwritten. */
export class StorageCorruptError extends Error {}

/** Concurrent writes kept conflicting after several retries. */
export class StorageConflictError extends Error {}

const MAX_WRITE_ATTEMPTS = 4;
const FOLDER_ITEMS_PAGE_SIZE = 1000;

// Cache of OIDC subject -> Box folder ID. It's only an optimization; a stale
// entry (e.g. the folder was deleted in Box) is detected and refreshed.
const globalStorageState = globalThis as typeof globalThis & {
  __hartnellMailerUserFolders?: Map<string, string>;
};
const userFolderCache =
  globalStorageState.__hartnellMailerUserFolders ??
  (globalStorageState.__hartnellMailerUserFolders = new Map<string, string>());

function ownerTag(subject: string): string {
  return `duo-sub:${subject}`;
}

function boxStatus(error: unknown): number | undefined {
  return error instanceof BoxApiError ? error.responseInfo.statusCode : undefined;
}

/** Extracts the ID of the existing item from a Box 409 name-conflict error. */
function conflictingItemId(error: unknown): string | undefined {
  if (!(error instanceof BoxApiError)) {
    return undefined;
  }

  const conflicts: unknown = error.responseInfo.contextInfo?.conflicts;
  const first = Array.isArray(conflicts) ? conflicts[0] : conflicts;
  if (typeof first === "object" && first !== null && "id" in first) {
    const id = (first as { id: unknown }).id;
    return typeof id === "string" ? id : undefined;
  }

  return undefined;
}

/**
 * Builds a Box-safe folder name from the user's email (falling back to the
 * OIDC subject). Box disallows "/" and "\", names of "." or "..", leading or
 * trailing spaces, and names longer than 255 characters.
 */
export function userFolderName(user: StorageUser): string {
  const raw = user.email?.trim().toLowerCase() || user.subject.trim();
  const name = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[/\\]/g, "_")
    .trim()
    .slice(0, 255);

  if (!name || name === "." || name === "..") {
    throw new Error("Unable to derive a Box folder name for this user.");
  }

  return name;
}

async function claimFolder(folderId: string, subject: string): Promise<void> {
  const client = getBoxClient();
  const folder = await client.folders.getFolderById(folderId, {
    queryParams: { fields: ["description"] },
  });
  const description = folder.description?.trim() ?? "";

  if (!description) {
    // Folder was created outside the app (or before tagging). Claim it.
    await client.folders.updateFolderById(folderId, {
      requestBody: { description: ownerTag(subject) },
    });
    return;
  }

  if (description !== ownerTag(subject)) {
    throw new StorageOwnershipError(
      "This user's Box folder is assigned to a different account."
    );
  }
}

async function resolveUserFolderId(user: StorageUser): Promise<string> {
  const cached = userFolderCache.get(user.subject);
  if (cached) {
    return cached;
  }

  const client = getBoxClient();
  const name = userFolderName(user);
  let folderId: string;

  try {
    const folder = await client.folders.createFolder({
      name,
      parent: { id: getBoxRootFolderId() },
    });
    folderId = folder.id;
    await client.folders.updateFolderById(folderId, {
      requestBody: { description: ownerTag(user.subject) },
    });
  } catch (error) {
    const existingId = boxStatus(error) === 409 ? conflictingItemId(error) : undefined;
    if (!existingId) {
      throw error;
    }
    folderId = existingId;
    await claimFolder(folderId, user.subject);
  }

  userFolderCache.set(user.subject, folderId);
  return folderId;
}

/** Runs an operation against the user's folder, recovering once from a stale cached ID. */
async function withUserFolder<T>(
  user: StorageUser,
  operation: (folderId: string) => Promise<T>
): Promise<T> {
  const wasCached = userFolderCache.has(user.subject);
  const folderId = await resolveUserFolderId(user);

  try {
    return await operation(folderId);
  } catch (error) {
    if (wasCached && boxStatus(error) === 404) {
      userFolderCache.delete(user.subject);
      return operation(await resolveUserFolderId(user));
    }
    throw error;
  }
}

interface StoredFileRef {
  id: string;
  etag?: string;
}

async function findFile(folderId: string, fileName: string): Promise<StoredFileRef | undefined> {
  const client = getBoxClient();
  let offset = 0;

  for (;;) {
    const page = await client.folders.getFolderItems(folderId, {
      queryParams: { fields: ["name", "etag"], limit: FOLDER_ITEMS_PAGE_SIZE, offset },
    });
    const entries = page.entries ?? [];

    for (const entry of entries) {
      if (entry.type === "file" && entry.name === fileName) {
        return { id: entry.id, etag: entry.etag ?? undefined };
      }
    }

    offset += entries.length;
    if (entries.length === 0 || offset >= (page.totalCount ?? 0)) {
      return undefined;
    }
  }
}

async function downloadJsonArray(fileId: string, fileName: string): Promise<unknown[]> {
  const stream = await getBoxClient().downloads.downloadFile(fileId);
  if (!stream) {
    return [];
  }

  const text = (await buffer(stream)).toString("utf8");
  if (!text.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StorageCorruptError(`${fileName} in Box is not valid JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new StorageCorruptError(`${fileName} in Box does not contain a list.`);
  }

  return parsed;
}

function jsonStream(items: unknown[]): Readable {
  return Readable.from([Buffer.from(JSON.stringify(items, null, 2), "utf8")]);
}

/** Reads a collection, dropping any entries that fail the guard. */
export async function readCollection<T>(
  user: StorageUser,
  fileName: string,
  guard: (value: unknown) => value is T
): Promise<T[]> {
  return withUserFolder(user, async (folderId) => {
    const file = await findFile(folderId, fileName);
    if (!file) {
      return [];
    }
    return (await downloadJsonArray(file.id, fileName)).filter(guard);
  });
}

/**
 * Applies `mutate` to the latest copy of a collection and saves it.
 * Return `null` from `mutate` to skip the write (nothing changed).
 * Entries that fail the guard are preserved untouched so unknown data is never lost.
 */
export async function updateCollection<T>(
  user: StorageUser,
  fileName: string,
  guard: (value: unknown) => value is T,
  mutate: (items: T[]) => T[] | null
): Promise<T[]> {
  return withUserFolder(user, async (folderId) => {
    const client = getBoxClient();

    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt++) {
      const file = await findFile(folderId, fileName);
      const raw = file ? await downloadJsonArray(file.id, fileName) : [];
      const current = raw.filter(guard);
      const unknownEntries = raw.filter((entry) => !guard(entry));

      const next = mutate(current);
      if (next === null) {
        return current;
      }

      const contents = [...next, ...unknownEntries];

      try {
        if (file) {
          await client.uploads.uploadFileVersion(
            file.id,
            { attributes: { name: fileName }, file: jsonStream(contents) },
            { headers: { ifMatch: file.etag } }
          );
        } else {
          await client.uploads.uploadFile({
            attributes: { name: fileName, parent: { id: folderId } },
            file: jsonStream(contents),
          });
        }
        return next;
      } catch (error) {
        const status = boxStatus(error);
        // 412: etag changed since we read it. 409: another request created the file first.
        if (status === 412 || status === 409) {
          continue;
        }
        throw error;
      }
    }

    throw new StorageConflictError(
      "Box storage is busy with other changes. Please try again."
    );
  });
}
