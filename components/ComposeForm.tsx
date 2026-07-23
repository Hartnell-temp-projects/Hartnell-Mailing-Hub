"use client";

import { useState } from "react";
import { EmailTag, Status } from "./types";
import RecipientSection from "./recipients/RecipientSection";
import StatusBanner from "./StatusBanner";

export default function ComposeForm() {
  const [to, setTo] = useState<EmailTag[]>([]);
  const [cc, setCc] = useState<EmailTag[]>([]);
  const [bcc, setBcc] = useState<EmailTag[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const addTag =
    (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) =>
    (email: string) => {
      setter((prev) => {
        if (prev.some((t) => t.email === email)) return prev;
        return [...prev, { id: crypto.randomUUID(), email }];
      });
    };

  const removeTag =
    (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) =>
    (id: string) => {
      setter((prev) => prev.filter((t) => t.id !== id));
    };

  const handleListLoad = (emails: string[]) => {
    setTo([{ id: crypto.randomUUID(), email: "itrinfo@hartnell.edu"}])
    setBcc(emails.map((email) => ({ id: crypto.randomUUID(), email })));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (to.length === 0) {
      setStatus({ type: "error", message: "At least one recipient is required." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.map((t) => t.email),
          cc: cc.map((t) => t.email),
          bcc: bcc.map((t) => t.email),
          subject,
          content: body,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus({ type: "success", message: "Email sent successfully." });
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject("");
      setBody("");
    } catch {
      setStatus({ type: "error", message: "Failed to send email. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const totalRecipients = to.length + cc.length + bcc.length;

  return (
    <>
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
                Sending…
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
    </>
  );
}
