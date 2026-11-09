"use client";

import { EmailTemplate } from "./types";

interface Props {
  templates: EmailTemplate[];
  loading: boolean;
  error: string | null;
  onStartFromScratch: () => void;
  onUseTemplate: (template: EmailTemplate) => void;
  onDeleteTemplate: (template: EmailTemplate) => void;
}

export default function TemplateChooser({
  templates,
  loading,
  error,
  onStartFromScratch,
  onUseTemplate,
  onDeleteTemplate,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#8c1d40]">
          New email
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-800">
          How would you like to start?
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Start with a blank message or use a pre-designed template.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onStartFromScratch}
          className="group rounded-xl border border-slate-200 p-5 text-left transition-colors hover:border-[#8c1d40] hover:bg-rose-50/40"
        >
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-white group-hover:text-[#8c1d40]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800">Start from scratch</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">Write a new message and add your own HTML styling.</p>
        </button>

        <div className="rounded-xl border border-slate-200 p-5">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-[#8c1d40]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v13a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 18.5v-13zM8 7h8M8 11h8M8 15h5" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800">Use a template</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">Choose a saved or pre-designed email, then customize it.</p>

          <div className="mt-4 space-y-2">
            {loading && <p className="text-sm text-slate-400">Loading templates…</p>}
            {!loading && templates.length === 0 && (
              <p className="text-sm text-slate-400">No templates available yet.</p>
            )}
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-1.5 transition-colors hover:border-[#8c1d40]"
              >
                <button
                  type="button"
                  onClick={() => onUseTemplate(template)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-rose-50/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-700">
                      {template.name}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {template.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[#8c1d40]">Use</span>
                </button>
                {template.source === "saved" && (
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(template)}
                    aria-label={`Delete ${template.name}`}
                    className="rounded-md px-1.5 py-1 text-xs font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-amber-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
