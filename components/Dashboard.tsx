"use client";

import { useEffect, useState } from "react";
import { SAVED_LISTS_KEY, SAVED_TEMPLATES_KEY, SENT_EMAILS_KEY } from "@/lib/storageKeys";
import { EmailTemplate, SavedRecipientList, SentEmailRecord } from "./types";

interface Props {
  onCompose: () => void;
}

export default function Dashboard({ onCompose }: Props) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [lists, setLists] = useState<SavedRecipientList[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmailRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadDashboardData = () => {
      setTemplates(readStoredArray(SAVED_TEMPLATES_KEY, isSavedTemplate));
      setLists(readStoredArray(SAVED_LISTS_KEY, isSavedRecipientList));
      setSentEmails(readStoredArray(SENT_EMAILS_KEY, isSentEmailRecord));
      setLoaded(true);
    };
    const frameId = window.requestAnimationFrame(loadDashboardData);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const totalRecipients = sentEmails.reduce(
    (total, email) => total + email.recipientCount,
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8c1d40]">
            Workspace overview
          </p>
          <h2 className="mt-1 text-3xl font-bold text-slate-800">User Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review your email activity, saved templates, and mailing lists.
          </p>
        </div>
        <button
          type="button"
          onClick={onCompose}
          className="rounded-lg bg-[#ffc627] px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-[#e6ae22]"
        >
          Compose email
        </button>
      </div>

      {!loaded ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">
          Loading dashboard…
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Emails sent"
              value={sentEmails.length}
              detail={`${totalRecipients} total recipients`}
              color="maroon"
            />
            <SummaryCard
              label="Saved templates"
              value={templates.length}
              detail="Available in this browser"
              color="blue"
            />
            <SummaryCard
              label="Mailing lists"
              value={lists.length}
              detail={`${lists.reduce((total, list) => total + list.emails.length, 0)} saved addresses`}
              color="green"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardSection title="Recent emails" description="Your latest successful sends.">
              {sentEmails.length === 0 ? (
                <EmptyState message="No sent emails have been recorded yet." action="Compose your first email" onAction={onCompose} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {sentEmails.slice(0, 6).map((email) => (
                    <div key={email.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">
                          {email.subject.trim() || "No subject"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {email.recipientCount} recipient{email.recipientCount !== 1 ? "s" : ""}
                          {email.batches > 1 ? ` · ${email.batches} batches` : ""}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-slate-400" dateTime={email.sentAt}>
                        {formatDate(email.sentAt)}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </DashboardSection>

            <DashboardSection title="Saved templates" description="Templates you saved for reuse.">
              {templates.length === 0 ? (
                <EmptyState message="No saved templates yet." action="Create a template" onAction={onCompose} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {templates.slice(0, 6).map((template) => (
                    <div key={template.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-semibold text-slate-700">{template.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {template.description} · {template.subject || "No subject"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </DashboardSection>

            <DashboardSection title="Mailing lists" description="Recipient lists saved from uploaded files.">
              {lists.length === 0 ? (
                <EmptyState message="No saved mailing lists yet." action="Create a mailing list" onAction={onCompose} />
              ) : (
                <div className="divide-y divide-slate-100">
                  {lists.slice(0, 6).map((list) => (
                    <div key={list.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-700">{list.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{list.description}</p>
                      </div>
                      <time className="shrink-0 text-xs text-slate-400" dateTime={list.createdAt}>
                        {formatDate(list.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              )}
            </DashboardSection>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  color: "maroon" | "blue" | "green";
}) {
  const colors = {
    maroon: "bg-rose-50 text-[#8c1d40]",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${colors[color]}`}>
        {value}
      </div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function DashboardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <p className="mt-1 text-xs text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  message,
  action,
  onAction,
}: {
  message: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{message}</p>
      <button type="button" onClick={onAction} className="mt-3 text-xs font-semibold text-[#8c1d40] hover:underline">
        {action} →
      </button>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function readStoredArray<T>(key: string, guard: (value: unknown) => value is T) {
  try {
    const stored = window.localStorage.getItem(key);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(guard) : [];
  } catch {
    return [];
  }
}

function isSavedTemplate(value: unknown): value is EmailTemplate {
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

function isSavedRecipientList(value: unknown): value is SavedRecipientList {
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
    typeof list.createdAt === "string"
  );
}

function isSentEmailRecord(value: unknown): value is SentEmailRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Partial<SentEmailRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.subject === "string" &&
    typeof record.recipientCount === "number" &&
    typeof record.toCount === "number" &&
    typeof record.ccCount === "number" &&
    typeof record.bccCount === "number" &&
    typeof record.batches === "number" &&
    typeof record.sentAt === "string"
  );
}
