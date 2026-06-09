"use client";

import { useState, KeyboardEvent, useRef } from "react";

interface EmailTag {
  id: string;
  email: string;
}

function EmailTagInput({
  label,
  tags,
  onAdd,
  onRemove,
  placeholder,
  required,
}: {
  label: string;
  tags: EmailTag[];
  onAdd: (email: string) => void;
  onRemove: (id: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const flush = () => {
    const emails = inputValue.split(/[,;\s]+/).filter(Boolean);
    emails.forEach((e) => {
      if (e.includes("@")) onAdd(e.trim());
    });
    setInputValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      flush();
    }
    if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      onRemove(tags[tags.length - 1].id);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-600 mb-1.5 tracking-wide uppercase">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        className="flex flex-wrap gap-1.5 p-2.5 min-h-[44px] border border-slate-200 rounded-lg bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text transition-shadow"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-800 text-sm rounded-md border border-blue-200 font-medium"
          >
            {tag.email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(tag.id);
              }}
              className="text-blue-400 hover:text-blue-700 leading-none ml-0.5 text-base"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={flush}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[200px] outline-none text-sm text-slate-800 placeholder:text-slate-400 bg-transparent"
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Press Enter, Tab, or comma to add. Separate multiple with commas.
      </p>
    </div>
  );
}

type Status = { type: "success" | "error"; message: string } | null;

export default function Home() {
  const [to, setTo] = useState<EmailTag[]>([]);
  const [cc, setCc] = useState<EmailTag[]>([]);
  const [bcc, setBcc] = useState<EmailTag[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const addTag = (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) => (email: string) => {
    setter((prev) => {
      if (prev.some((t) => t.email === email)) return prev;
      return [...prev, { id: crypto.randomUUID(), email }];
    });
  };

  const removeTag = (setter: React.Dispatch<React.SetStateAction<EmailTag[]>>) => (id: string) => {
    setter((prev) => prev.filter((t) => t.id !== id));
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
      setShowCcBcc(false);
    } catch {
      setStatus({ type: "error", message: "Failed to send email. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#8c1d40] text-white shadow-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              Hartnell Email Provider
            </h1>
            <p className="text-xs text-gray-200 font-medium">
              Internal Communications — Powered by AWS SES
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Compose Message</h2>
            <p className="text-slate-500 text-sm mt-1">
              Send an email to staff, faculty, or students via the college mail system.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
          >
            <div className="p-6 space-y-5">
              {/* To */}
              <EmailTagInput
                label="To"
                tags={to}
                onAdd={addTag(setTo)}
                onRemove={removeTag(setTo)}
                placeholder="recipient@college.edu"
                required
              />

              {/* CC / BCC toggle */}
              {!showCcBcc ? (
                <button
                  type="button"
                  onClick={() => setShowCcBcc(true)}
                  className="text-xs font-semibold text-[#8d1c40] hover:text-[#7c0b30] underline-offset-2 hover:underline transition-colors"
                >
                  + Add CC / BCC
                </button>
              ) : (
                <>
                  <EmailTagInput
                    label="CC"
                    tags={cc}
                    onAdd={addTag(setCc)}
                    onRemove={removeTag(setCc)}
                    placeholder="cc@college.edu"
                  />
                  <EmailTagInput
                    label="BCC"
                    tags={bcc}
                    onAdd={addTag(setBcc)}
                    onRemove={removeTag(setBcc)}
                    placeholder="bcc@college.edu"
                  />
                </>
              )}

              {/* Divider */}
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
                {to.length > 0 && (
                  <span>
                    Sending to <strong className="text-slate-600">{to.length + cc.length + bcc.length}</strong> recipient{to.length + cc.length + bcc.length !== 1 ? "s" : ""}
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
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Send Email
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Status banner */}
          {status && (
            <div
              className={`mt-4 flex items-start gap-3 px-4 py-3.5 rounded-xl text-sm font-medium border ${
                status.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {status.type === "success" ? (
                <svg className="w-5 h-5 text-emerald-500 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
              {status.message}
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-100">
        Internal use only &mdash; Unauthorized use is prohibited.
      </footer>
    </div>
  );
}
