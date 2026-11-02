import type { EmailTemplate, RecipientRecord, SavedRecipientList } from "@/components/types";

// Browser-side helpers for the Box-backed template and recipient-list routes.

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(
      body.error ||
        (response.status === 401 ? "Please log in again to access saved data." : "Request failed.")
    );
  }
  return body as T;
}

/** Built-in templates plus the user's saved templates from Box. */
export function fetchTemplates() {
  return request<{ templates: EmailTemplate[]; errors: string[] }>("/api/email-templates");
}

export function saveTemplate(input: { name: string; subject: string; content: string }) {
  return request<EmailTemplate>("/api/email-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteSavedTemplate(id: string) {
  return request<{ deleted: true }>(`/api/email-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function fetchSavedRecipientLists() {
  return request<SavedRecipientList[]>("/api/recipient-lists");
}

export function saveRecipientList(input: { name: string; recipients: RecipientRecord[] }) {
  return request<SavedRecipientList>("/api/recipient-lists", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteSavedRecipientList(id: string) {
  return request<{ deleted: true }>(`/api/recipient-lists/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
