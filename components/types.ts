export interface EmailTag {
  id: string;
  email: string;
}

export type RecipientMode = "manual" | "list";

export type Status = { type: "success" | "error"; message: string } | null;
