export interface EmailTag {
  id: string;
  email: string;
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

export type RecipientMode = "manual" | "list";

export type Status = { type: "success" | "error"; message: string } | null;
