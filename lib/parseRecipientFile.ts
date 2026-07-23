import * as XLSX from "xlsx";

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(EMAIL_REGEX) ?? []));
}

export async function parseRecipientFile(file: File): Promise<string[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    const text = await file.text();
    return extractEmails(text);
  }

  if (ext === "xlsx" || ext === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const allText = workbook.SheetNames.map((name) =>
      XLSX.utils.sheet_to_csv(workbook.Sheets[name])
    ).join("\n");
    return extractEmails(allText);
  }

  throw new Error("Unsupported file type. Please upload a CSV or XLSX file.");
}
