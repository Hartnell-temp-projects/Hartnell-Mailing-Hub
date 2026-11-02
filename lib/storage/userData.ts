import { randomUUID } from "node:crypto";
import type { EmailTemplate, RecipientRecord, SavedRecipientList } from "@/components/types";
import { readCollection, StorageUser, updateCollection } from "@/lib/box/userStorage";

const TEMPLATES_FILE = "templates.json";
const RECIPIENT_LISTS_FILE = "recipient-lists.json";

export const LIMITS = {
  nameLength: 200,
  subjectLength: 998,
  contentLength: 2_000_000,
  recipients: 100_000,
  emailLength: 320,
  personNameLength: 200,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Guards for data read back from Box ----------

export function isSavedTemplate(value: unknown): value is EmailTemplate {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const template = value as Partial<EmailTemplate>;
  return (
    typeof template.id === "string" &&
    typeof template.name === "string" &&
    typeof template.description === "string" &&
    typeof template.subject === "string" &&
    typeof template.content === "string" &&
    template.source === "saved"
  );
}

function isRecipientRecord(value: unknown): value is RecipientRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const recipient = value as Partial<RecipientRecord>;
  return (
    typeof recipient.email === "string" &&
    (recipient.firstName === undefined || typeof recipient.firstName === "string") &&
    (recipient.lastName === undefined || typeof recipient.lastName === "string")
  );
}

export function isSavedRecipientList(value: unknown): value is SavedRecipientList {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const list = value as Partial<SavedRecipientList>;
  return (
    typeof list.id === "string" &&
    typeof list.name === "string" &&
    typeof list.description === "string" &&
    Array.isArray(list.emails) &&
    list.emails.every((email) => typeof email === "string") &&
    (list.recipients === undefined ||
      (Array.isArray(list.recipients) && list.recipients.every(isRecipientRecord))) &&
    typeof list.createdAt === "string"
  );
}

// ---------- Input validation for data coming from the browser ----------

export class InvalidInputError extends Error {}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidInputError(`${field} is required.`);
  }
  if (value.length > maxLength) {
    throw new InvalidInputError(`${field} must be ${maxLength} characters or fewer.`);
  }
  return value;
}

function optionalName(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || value.length > LIMITS.personNameLength) {
    throw new InvalidInputError(`${field} is invalid.`);
  }
  return value.trim() || undefined;
}

function parseRecipients(value: unknown): RecipientRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidInputError("At least one recipient is required.");
  }
  if (value.length > LIMITS.recipients) {
    throw new InvalidInputError(`A list can contain at most ${LIMITS.recipients} recipients.`);
  }

  const seen = new Set<string>();
  const recipients: RecipientRecord[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      throw new InvalidInputError("Recipient entries are invalid.");
    }
    const raw = item as Record<string, unknown>;
    const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
    if (!email || email.length > LIMITS.emailLength || !EMAIL_PATTERN.test(email)) {
      throw new InvalidInputError(`Invalid recipient email: ${String(raw.email).slice(0, 80)}`);
    }
    if (seen.has(email)) {
      continue;
    }
    seen.add(email);

    const firstName = optionalName(raw.firstName, "First name");
    const lastName = optionalName(raw.lastName, "Last name");
    recipients.push({
      email,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });
  }

  return recipients;
}

// ---------- Templates ----------

export function listTemplates(user: StorageUser): Promise<EmailTemplate[]> {
  return readCollection(user, TEMPLATES_FILE, isSavedTemplate);
}

export async function createTemplate(user: StorageUser, input: unknown): Promise<EmailTemplate> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const template: EmailTemplate = {
    id: randomUUID(),
    name: requiredText(body.name, "Template name", LIMITS.nameLength).trim(),
    description: "Saved to Box.",
    subject: requiredText(body.subject, "Subject", LIMITS.subjectLength),
    content: requiredText(body.content, "Message body", LIMITS.contentLength),
    source: "saved",
  };

  await updateCollection(user, TEMPLATES_FILE, isSavedTemplate, (items) => [template, ...items]);
  return template;
}

/** Returns false when no template with that ID exists. */
export async function deleteTemplate(user: StorageUser, id: string): Promise<boolean> {
  let found = false;
  await updateCollection(user, TEMPLATES_FILE, isSavedTemplate, (items) => {
    const remaining = items.filter((item) => item.id !== id);
    found = remaining.length !== items.length;
    return found ? remaining : null;
  });
  return found;
}

// ---------- Recipient lists ----------

export function listRecipientLists(user: StorageUser): Promise<SavedRecipientList[]> {
  return readCollection(user, RECIPIENT_LISTS_FILE, isSavedRecipientList);
}

export async function createRecipientList(
  user: StorageUser,
  input: unknown
): Promise<SavedRecipientList> {
  const body = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const name = requiredText(body.name, "List name", LIMITS.nameLength).trim();
  const recipients = parseRecipients(body.recipients);

  const list: SavedRecipientList = {
    id: randomUUID(),
    name,
    description: `${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`,
    emails: recipients.map((recipient) => recipient.email),
    recipients,
    createdAt: new Date().toISOString(),
  };

  await updateCollection(user, RECIPIENT_LISTS_FILE, isSavedRecipientList, (items) => [
    list,
    ...items,
  ]);
  return list;
}

/** Returns false when no list with that ID exists. */
export async function deleteRecipientList(user: StorageUser, id: string): Promise<boolean> {
  let found = false;
  await updateCollection(user, RECIPIENT_LISTS_FILE, isSavedRecipientList, (items) => {
    const remaining = items.filter((item) => item.id !== id);
    found = remaining.length !== items.length;
    return found ? remaining : null;
  });
  return found;
}
