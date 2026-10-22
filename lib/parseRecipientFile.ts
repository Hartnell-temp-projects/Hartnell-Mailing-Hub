import * as XLSX from "xlsx";
import type { RecipientRecord } from "@/components/types";

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const EMAIL_HEADERS = new Set(["email", "emailaddress", "emailaddr", "e-mail", "mail"]);
const FIRST_NAME_HEADERS = new Set(["firstname", "first", "givenname", "forename"]);
const LAST_NAME_HEADERS = new Set(["lastname", "last", "surname", "familyname"]);
const FULL_NAME_HEADERS = new Set(["name", "fullname", "studentname", "recipientname"]);

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function cellText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function splitFullName(value: string): Pick<RecipientRecord, "firstName" | "lastName"> {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  return {
    firstName: parts[0],
    ...(parts.length > 1 ? { lastName: parts.slice(1).join(" ") } : {}),
  };
}

function findEmail(row: unknown[]): string | undefined {
  for (const value of row) {
    const email = cellText(value).match(EMAIL_REGEX)?.[0];
    if (email) return email.toLowerCase();
  }
  return undefined;
}

function parseRows(rows: unknown[][]): RecipientRecord[] {
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  const emailIndex = headers.findIndex((header) => EMAIL_HEADERS.has(header));
  const firstNameIndex = headers.findIndex((header) => FIRST_NAME_HEADERS.has(header));
  const lastNameIndex = headers.findIndex((header) => LAST_NAME_HEADERS.has(header));
  const fullNameIndex = headers.findIndex((header) => FULL_NAME_HEADERS.has(header));
  const hasHeaderRow = emailIndex >= 0 || firstNameIndex >= 0 || lastNameIndex >= 0 || fullNameIndex >= 0;
  const dataRows = hasHeaderRow ? rows.slice(1) : rows;
  const seen = new Set<string>();
  const recipients: RecipientRecord[] = [];

  for (const row of dataRows) {
    const email = emailIndex >= 0 ? findEmail([row[emailIndex]]) : findEmail(row);
    if (!email || seen.has(email)) continue;

    let firstName = firstNameIndex >= 0 ? cellText(row[firstNameIndex]) : "";
    let lastName = lastNameIndex >= 0 ? cellText(row[lastNameIndex]) : "";
    if (!firstName && !lastName && fullNameIndex >= 0) {
      const fullName = splitFullName(cellText(row[fullNameIndex]));
      firstName = fullName.firstName ?? "";
      lastName = fullName.lastName ?? "";
    }

    recipients.push({
      email,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    });
    seen.add(email);
  }

  return recipients;
}

export async function parseRecipientFile(file: File): Promise<RecipientRecord[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext !== "csv" && ext !== "xlsx" && ext !== "xls") {
    throw new Error("Unsupported file type. Please upload a CSV or XLSX file.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  return parseRows(rows);
}
