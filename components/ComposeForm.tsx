"use client";

import { useEffect, useState } from "react";
import { EmailTag, EmailTemplate, Status } from "./types";
import RecipientSection from "./recipients/RecipientSection";
import StatusBanner from "./StatusBanner";
import EmailPreview from "./EmailPreview";
import TemplateChooser from "./TemplateChooser";

const SES_RECIPIENT_LIMIT = 50;
const SAVED_TEMPLATES_KEY = "hartnell-mailer-saved-templates";

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

export default function ComposeForm() {
  const [composeMode, setComposeMode] = useState<"choice" | "compose">("choice");
  const [to, setTo] = useState<EmailTag[]>([]);
  const [cc, setCc] = useState<EmailTag[]>([]);
  const [bcc, setBcc] = useState<EmailTag[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      let savedTemplates: EmailTemplate[] = [];

      try {
        const stored = window.localStorage.getItem(SAVED_TEMPLATES_KEY);
        let parsed: unknown = [];
        if (stored) {
          parsed = JSON.parse(stored);
        }

        if (Array.isArray(parsed)) {
          savedTemplates = parsed.filter(isEmailTemplate);
        }
      } catch {
        savedTemplates = [];
      }

      try {
        const response = await fetch("/api/email-templates");
        if (!response.ok) {
          throw new Error("Built-in templates could not be loaded.");
        }

        const builtInTemplates = (await response.json()) as EmailTemplate[];
        if (!cancelled) {
          setTemplates([...builtInTemplates, ...savedTemplates]);
        }
      } catch (error) {
        if (!cancelled) {
          setTemplates(savedTemplates);
          let message = "Built-in templates could not be loaded.";
          if (error instanceof Error) {
            message = error.message;
          }
          setTemplatesError(message);
        }
      } finally {
        if (!cancelled) {
          setTemplatesLoading(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const addTag =
    (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) =>
    (email: string) => {
      setter((prev) => {
        if (prev.some((t) => t.email === email)) {
          return prev;
        }
        return [...prev, { id: crypto.randomUUID(), email }];
      });
    };

  const removeTag =
    (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) =>
    (id: string) => {
      setter((prev) => prev.filter((t) => t.id !== id));
    };

  const handleListLoad = (emails: string[]) => {
    setTo([{ id: crypto.randomUUID(), email: "itrinfo@hartnell.edu" }]);
    setBcc(emails.map((email) => ({ id: crypto.randomUUID(), email })));
  };

  const resetDraft = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBody("");
    setStatus(null);
  };

  const handleStartFromScratch = () => {
    resetDraft();
    setComposeMode("compose");
  };

  const handleUseTemplate = (template: EmailTemplate) => {
    resetDraft();
    setSubject(template.subject);
    setBody(template.content);
    setComposeMode("compose");
  };

  const handleDeleteTemplate = (template: EmailTemplate) => {
    if (template.source !== "saved") return;

    const confirmed = window.confirm(`Delete the “${template.name}” template?`);
    if (!confirmed) return;

    const remainingTemplates = templates.filter((item) => item.id !== template.id);
    const remainingSavedTemplates = remainingTemplates.filter(
      (item) => item.source === "saved"
    );

    window.localStorage.setItem(
      SAVED_TEMPLATES_KEY,
      JSON.stringify(remainingSavedTemplates)
    );
    setTemplates(remainingTemplates);
  };

  const handleSaveTemplate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = templateName.trim();

    if (!name || !subject.trim() || !body.trim()) {
      setStatus({
        type: "error",
        message: "Add a template name, subject, and message body before saving.",
      });
      return;
    }

    const newTemplate: EmailTemplate = {
      id: crypto.randomUUID(),
      name,
      description: "Saved in this browser.",
      subject,
      content: body,
      source: "saved",
    };
    const nextSavedTemplates = [
      newTemplate,
      ...templates.filter((template) => template.source === "saved"),
    ];

    window.localStorage.setItem(SAVED_TEMPLATES_KEY, JSON.stringify(nextSavedTemplates));
    setTemplates((current) => [newTemplate, ...current]);
    setTemplateName("");
    setSaveTemplateOpen(false);
    setStatus({ type: "success", message: `Template “${name}” saved in this browser.` });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (to.length === 0) {
      setStatus({ type: "error", message: "At least one recipient is required." });
      return;
    }

    const toEmails = to.map((t) => t.email);
    const ccEmails = cc.map((t) => t.email);
    const bccEmails = bcc.map((t) => t.email);

    const reservedSlots = toEmails.length + ccEmails.length;
    const bccChunkSize = Math.max(SES_RECIPIENT_LIMIT - reservedSlots, 1);

    if (reservedSlots >= SES_RECIPIENT_LIMIT) {
      setStatus({
        type: "error",
        message: `To + Cc already use ${reservedSlots} of ${SES_RECIPIENT_LIMIT} allowed recipients per email — no room left for Bcc.`,
      });
      return;
    }

    const bccBatches = bccEmails.length > 0 ? chunkArray(bccEmails, bccChunkSize) : [[]];

    setLoading(true);
    setStatus(null);
    setProgress({ sent: 0, total: bccBatches.length });

    try {
      for (let i = 0; i < bccBatches.length; i++) {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: toEmails,
            cc: ccEmails,
            bcc: bccBatches[i],
            subject,
            content: body,
          }),
        });

        if (!res.ok) {
          throw new Error(
            `Batch ${i + 1} of ${bccBatches.length} failed (recipients ${
              i * bccChunkSize + 1
            }-${i * bccChunkSize + bccBatches[i].length}).`
          );
        }

        setProgress({ sent: i + 1, total: bccBatches.length });
      }

      setStatus({
        type: "success",
        message:
          bccBatches.length > 1
            ? `Email sent successfully in ${bccBatches.length} batches.`
            : "Email sent successfully.",
      });
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject("");
      setBody("");
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err instanceof Error
            ? `${err.message} Earlier batches may have already been sent — check before retrying.`
            : "Failed to send email. Please try again.",
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const totalRecipients = to.length + cc.length + bcc.length;

  if (composeMode === "choice") {
    return (
      <TemplateChooser
        templates={templates}
        loading={templatesLoading}
        error={templatesError}
        onStartFromScratch={handleStartFromScratch}
        onUseTemplate={handleUseTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setComposeMode("choice")}
            className="text-sm font-semibold text-[#8d1c40] transition-colors hover:text-[#7c0b30] hover:underline"
          >
            ← Change starting point
          </button>
          <button
            type="button"
            onClick={() => setSaveTemplateOpen((open) => !open)}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#8c1d40] hover:text-[#8c1d40]"
          >
            {saveTemplateOpen ? "Cancel save" : "Save as template"}
          </button>
        </div>

        {saveTemplateOpen && (
          <form
            onSubmit={handleSaveTemplate}
            className="mb-4 flex flex-col gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label htmlFor="template-name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                Template name
              </label>
              <input
                id="template-name"
                type="text"
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Monthly campus update"
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-[#8c1d40] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#721633]"
            >
              Save template
            </button>
          </form>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
        >
          <div className="p-6 space-y-5">
            <RecipientSection
              to={to}
              cc={cc}
              bcc={bcc}
              onAddTo={addTag(setTo)}
              onRemoveTo={removeTag(setTo)}
              onAddCc={addTag(setCc)}
              onRemoveCc={removeTag(setCc)}
              onAddBcc={addTag(setBcc)}
              onRemoveBcc={removeTag(setBcc)}
              onListLoad={handleListLoad}
            />

            <div className="border-t border-slate-100" />

            {/* Subject */}
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-semibold text-slate-600 mb-1.5 tracking-wide uppercase"
              >
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                id="subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>

            {/* Body */}
            <div>
              <label
                htmlFor="body"
                className="block text-sm font-semibold text-slate-600 mb-1.5 tracking-wide uppercase"
              >
                Message Body <span className="text-red-500">*</span>
              </label>
              <textarea
                id="body"
                required
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here..."
                rows={10}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              {totalRecipients > 0 && (
                <span>
                  Sending to{" "}
                  <strong className="text-slate-600">{totalRecipients}</strong>{" "}
                  recipient{totalRecipients !== 1 ? "s" : ""}
                  {loading && progress && progress.total > 1 && (
                    <> &middot; batch {progress.sent}/{progress.total}</>
                  )}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#ffc627] hover:bg-[#e6ae22] disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {progress && progress.total > 1
                    ? `Sending batch ${progress.sent}/${progress.total}…`
                    : "Sending…"}
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                    />
                  </svg>
                  Send Email
                </>
              )}
            </button>
          </div>
        </form>

        {status && <StatusBanner status={status} />}
      </div>

      <EmailPreview to={to} cc={cc} subject={subject} body={body} />
    </div>
  );
}

function isEmailTemplate(value: unknown): value is EmailTemplate {
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
