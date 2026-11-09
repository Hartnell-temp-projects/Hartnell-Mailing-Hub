"use client";

import { useEffect, useState } from "react";
import { EditorMode, EmailTag, EmailTemplate, RecipientRecord, Status } from "./types";
import RecipientSection from "./recipients/RecipientSection";
import StatusBanner from "./StatusBanner";
import EmailPreview from "./EmailPreview";
import TemplateChooser from "./TemplateChooser";
import MessageEditor from "./MessageEditor";
import { deleteSavedTemplate, fetchTemplates, saveTemplate } from "@/lib/storage/api";

const SES_RECIPIENT_LIMIT = 50;
const SEND_BATCH_TIMEOUT_MS = 30_000;
const SES_BATCH_DELAY_MS = 2_500;
const PERSONALIZATION_TOKEN_PATTERN = /{{\s*(?:first_name|last_name|full_name|name)\s*}}/i;

function hasToken(value: string, token: string): boolean {
  return new RegExp(`{{\\s*${token}\\s*}}`, "i").test(value);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) {
    return [arr];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

interface SendResponse {
  sentRecipients?: string[];
  failedRecipients?: string[];
  failureReasons?: Record<string, string>;
  error?: string;
}

interface SendRecovery {
  personalized: boolean;
  totalRecipients: number;
  sentRecipients: string[];
  retryRecipients: string[];
  uncertainRecipients: string[];
  failureReasons: Record<string, string>;
}

function uniqueEmails(emails: string[]): string[] {
  return Array.from(
    new Map(emails.map((email) => [email.trim().toLowerCase(), email.trim()])).values()
  );
}

export default function ComposeForm() {
  const [composeMode, setComposeMode] = useState<"choice" | "compose">("choice");
  const [editorMode, setEditorMode] = useState<EditorMode>("rich");
  const [to, setTo] = useState<EmailTag[]>([]);
  const [cc, setCc] = useState<EmailTag[]>([]);
  const [bcc, setBcc] = useState<EmailTag[]>([]);
  const [personalizedRecipients, setPersonalizedRecipients] = useState<RecipientRecord[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [sendRecovery, setSendRecovery] = useState<SendRecovery | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Built-in templates and the user's saved templates (from Box) come from one endpoint.
    const loadTemplates = async () => {
      try {
        const { templates: loaded, errors } = await fetchTemplates();
        if (!cancelled) {
          setTemplates(loaded);
          setTemplatesError(errors.length > 0 ? errors.join(" ") : null);
        }
      } catch (error) {
        if (!cancelled) {
          setTemplates([]);
          setTemplatesError(
            error instanceof Error ? error.message : "Templates could not be loaded."
          );
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

  const clearSendRecovery = () => {
    setSendRecovery(null);
    setStatus(null);
  };

  const addTag =
    (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) =>
    (email: string) => {
      clearSendRecovery();
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
      clearSendRecovery();
      setter((prev) => prev.filter((t) => t.id !== id));
    };

  const handleListLoad = (recipients: RecipientRecord[]) => {
    clearSendRecovery();
    setPersonalizedRecipients(recipients);
    setTo([{ id: crypto.randomUUID(), email: process.env.SES_FROM_ADDRESS || "itrinfo@hartnell.edu" }]);
    setBcc(
      recipients.map((recipient) => ({
        id: crypto.randomUUID(),
        email: recipient.email,
        firstName: recipient.firstName,
        lastName: recipient.lastName,
      }))
    );
  };

  const resetDraft = () => {
    clearSendRecovery();
    setTo([]);
    setCc([]);
    setBcc([]);
    setPersonalizedRecipients([]);
    setSubject("");
    setBody("");
    setStatus(null);
  };

  const handleStartFromScratch = () => {
    resetDraft();
    setEditorMode("rich");
    setComposeMode("compose");
  };

  const handleUseTemplate = (template: EmailTemplate) => {
    resetDraft();
    setSubject(template.subject);
    setBody(template.content);
    setEditorMode("rich");
    setComposeMode("compose");
  };

  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (template.source !== "saved") return;

    const confirmed = window.confirm(`Delete the “${template.name}” template?`);
    if (!confirmed) return;

    try {
      await deleteSavedTemplate(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setTemplatesError(null);
    } catch (error) {
      setTemplatesError(
        error instanceof Error ? error.message : "The template could not be deleted."
      );
    }
  };

  const handleSaveTemplate = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingTemplate) return;
    const name = templateName.trim();

    if (!name || !subject.trim() || !body.trim()) {
      setStatus({
        type: "error",
        message: "Add a template name, subject, and message body before saving.",
      });
      return;
    }

    setSavingTemplate(true);
    try {
      const newTemplate = await saveTemplate({ name, subject, content: body });
      setTemplates((current) => [newTemplate, ...current]);
      setTemplateName("");
      setSaveTemplateOpen(false);
      setStatus({ type: "success", message: `Template “${name}” saved to Box.` });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "The template could not be saved.",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const sendRecipientEmails = async (
    recipientEmails: string[],
    usesPersonalization: boolean,
    previousRecovery: SendRecovery | null = null
  ) => {
    const toEmails = to.map((t) => t.email);
    const ccEmails = cc.map((t) => t.email);
    const reservedSlots = toEmails.length + ccEmails.length;
    const bccChunkSize = Math.max(SES_RECIPIENT_LIMIT - reservedSlots, 1);

    if (reservedSlots >= SES_RECIPIENT_LIMIT) {
      setStatus({
        type: "error",
        message: `To + Cc already use ${reservedSlots} of ${SES_RECIPIENT_LIMIT} allowed recipients per email — no room left for Bcc.`,
      });
      return;
    }

    const bccBatches = recipientEmails.length > 0 ? chunkArray(recipientEmails, bccChunkSize) : [[]];
    const requestBatches = usesPersonalization
      ? chunkArray(recipientEmails, SES_RECIPIENT_LIMIT)
      : bccBatches;
    const personalizedByEmail = new Map(
      personalizedRecipients.map((recipient) => [recipient.email.toLowerCase(), recipient])
    );
    const sentRecipients: string[] = [];
    const failedRecipients: string[] = [];
    const uncertainRecipients: string[] = [];
    const failureReasons: Record<string, string> = {};
    let requestError: string | null = null;

    setLoading(true);
    setStatus(null);
    setProgress({ sent: 0, total: requestBatches.length });

    for (let i = 0; i < requestBatches.length; i++) {
      const batch = requestBatches[i];
      const batchRecipients = usesPersonalization
        ? batch
            .map((email) => personalizedByEmail.get(email.toLowerCase()))
            .filter((recipient): recipient is RecipientRecord => Boolean(recipient))
        : [];

      if (usesPersonalization && batchRecipients.length !== batch.length) {
        setStatus({
          type: "error",
          message: "Some personalized recipients could not be matched to the selected list.",
        });
        setLoading(false);
        setProgress(null);
        return;
      }

      let response: Response;
      let responseBody: SendResponse = {};
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SEND_BATCH_TIMEOUT_MS);

      try {
        response = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            to: toEmails,
            cc: ccEmails,
            bcc: batch,
            subject,
            content: body,
            personalizedRecipients: usesPersonalization ? batchRecipients : undefined,
            personalizedDestination: usesPersonalization ? "bcc" : undefined,
          }),
        });
        responseBody = (await response.json().catch(() => ({}))) as SendResponse;
      } catch (error) {
        requestError = controller.signal.aborted
          ? `Batch ${i + 1} timed out after ${SEND_BATCH_TIMEOUT_MS / 1000} seconds.`
          : error instanceof Error && error.message
            ? error.message
            : "The sending request could not be completed.";
        uncertainRecipients.push(...requestBatches.slice(i).flat());
        break;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        requestError =
          responseBody.error ||
          (response.status === 401
            ? "Please log in with Duo before sending email."
            : "The email service could not confirm this request.");
        uncertainRecipients.push(...requestBatches.slice(i).flat());
        break;
      }

      const successful = Array.isArray(responseBody.sentRecipients)
        ? responseBody.sentRecipients
        : batch;
      sentRecipients.push(...successful);

      if (Array.isArray(responseBody.failedRecipients)) {
        failedRecipients.push(...responseBody.failedRecipients);
      }
      if (responseBody.failureReasons) {
        Object.assign(failureReasons, responseBody.failureReasons);
      }

      setProgress({ sent: i + 1, total: requestBatches.length });

      if (i < requestBatches.length - 1) {
        await delay(SES_BATCH_DELAY_MS);
      }
    }

    const combinedSentRecipients = uniqueEmails([
      ...(previousRecovery?.sentRecipients ?? []),
      ...sentRecipients,
    ]);
    const retryRecipients = uniqueEmails([...failedRecipients, ...uncertainRecipients]);

    if (retryRecipients.length > 0) {
      setSendRecovery({
        personalized: usesPersonalization,
        totalRecipients: previousRecovery?.totalRecipients ?? recipientEmails.length,
        sentRecipients: combinedSentRecipients,
        retryRecipients,
        uncertainRecipients: uniqueEmails(uncertainRecipients),
        failureReasons,
      });
      setStatus({
        type: "error",
        message: `${requestError ? `${requestError} ` : ""}${combinedSentRecipients.length} of ${
          previousRecovery?.totalRecipients ?? recipientEmails.length
        } recipients were sent. ${retryRecipients.length} need attention.`,
      });
    } else {
      setSendRecovery(null);
      setStatus({
        type: "success",
        message:
          requestBatches.length > 1
            ? `Email sent successfully in ${requestBatches.length} batches.`
            : "Email sent successfully.",
      });
      setTo([]);
      setCc([]);
      setBcc([]);
      setPersonalizedRecipients([]);
      setSubject("");
      setBody("");
      setEditorMode("rich");
    }

    setLoading(false);
    setProgress(null);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (to.length === 0 && bcc.length === 0) {
      setStatus({ type: "error", message: "At least one recipient is required." });
      return;
    }
    if (!body.trim()) {
      setStatus({ type: "error", message: "A message body is required." });
      return;
    }

    const usesPersonalization = PERSONALIZATION_TOKEN_PATTERN.test(`${subject}\n${body}`);
    if (usesPersonalization && personalizedRecipients.length === 0) {
      setStatus({
        type: "error",
        message: "Upload or select a recipient list with names before using personalization tokens.",
      });
      return;
    }

    if (
      hasToken(`${subject}\n${body}`, "first_name") &&
      personalizedRecipients.some((recipient) => !recipient.firstName?.trim())
    ) {
      setStatus({ type: "error", message: "Every recipient needs a first name for the first-name token." });
      return;
    }

    if (
      hasToken(`${subject}\n${body}`, "last_name") &&
      personalizedRecipients.some((recipient) => !recipient.lastName?.trim())
    ) {
      setStatus({ type: "error", message: "Every recipient needs a last name for the last-name token." });
      return;
    }

    if (hasToken(`${subject}\n${body}`, "full_name") || hasToken(`${subject}\n${body}`, "name")) {
      const missingFullName = personalizedRecipients.some(
        (recipient) => !recipient.firstName?.trim() && !recipient.lastName?.trim()
      );
      if (missingFullName) {
        setStatus({ type: "error", message: "Every recipient needs a name for the full-name token." });
        return;
      }
    }

    clearSendRecovery();
    await sendRecipientEmails(
      bcc.map((recipient) => recipient.email),
      usesPersonalization
    );
  };

  const handleRetryFailedRecipients = async () => {
    if (!sendRecovery || loading) return;
    await sendRecipientEmails(
      sendRecovery.retryRecipients,
      sendRecovery.personalized,
      sendRecovery
    );
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
              disabled={savingTemplate}
              className="rounded-lg bg-[#8c1d40] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#721633] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingTemplate ? "Saving…" : "Save template"}
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
                onChange={(e) => {
                  clearSendRecovery();
                  setSubject(e.target.value);
                }}
                placeholder="Email subject line"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              />
            </div>

            <MessageEditor
              value={body}
              mode={editorMode}
              onChange={(value) => {
                clearSendRecovery();
                setBody(value);
              }}
            />
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

        {sendRecovery && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p className="font-semibold">
              {sendRecovery.retryRecipients.length} recipient
              {sendRecovery.retryRecipients.length !== 1 ? "s" : ""} need attention.
            </p>
            {sendRecovery.uncertainRecipients.length > 0 && (
              <p className="mt-1">
                Some recipients could not be confirmed. They may have been accepted by the email provider, so review
                before retrying.
              </p>
            )}
            {sendRecovery.uncertainRecipients.length === 0 && (
              <p className="mt-1">
                SES reported that these recipients failed. Review the reported reason before retrying.
              </p>
            )}
            <details className="mt-3 rounded-lg border border-amber-200 bg-white/60 px-3 py-2">
              <summary className="cursor-pointer font-semibold text-amber-900">
                Show all {sendRecovery.retryRecipients.length} recipient
                {sendRecovery.retryRecipients.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-amber-800">
                {sendRecovery.retryRecipients.map((email) => (
                  <li key={email}>
                    {email}
                    {sendRecovery.failureReasons[email] && ` — ${sendRecovery.failureReasons[email]}`}
                  </li>
                ))}
              </ul>
            </details>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleRetryFailedRecipients()}
                disabled={loading}
                className="rounded-lg bg-[#8c1d40] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#721633] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendRecovery.uncertainRecipients.length > 0
                  ? "Retry unconfirmed recipients"
                  : "Retry failed recipients"}
              </button>
              <button
                type="button"
                onClick={() => setSendRecovery(null)}
                disabled={loading}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <EmailPreview to={to} cc={cc} bcc={bcc} subject={subject} body={body} />
    </div>
  );
}
