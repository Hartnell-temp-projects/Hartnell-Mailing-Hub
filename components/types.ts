export interface EmailTag {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface RecipientRecord {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  content: string;
  source: "built-in" | "saved";
}

export type EditorMode = "rich" | "html";

export interface SavedRecipientList {
  id: string;
  name: string;
  description: string;
  emails: string[];
  recipients?: RecipientRecord[];
  createdAt: string;
}

export interface SentEmailRecord {
  id: string;
  subject: string;
  recipientCount: number;
  toCount: number;
  ccCount: number;
  bccCount: number;
  batches: number;
  sentAt: string;
}

export type RecipientMode = "manual" | "list";

export type Status = { type: "success" | "error"; message: string } | null;
