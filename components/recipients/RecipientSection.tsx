"use client";

import { useState } from "react";
import { EmailTag, RecipientMode } from "../types";
import EmailTagInput from "./EmailTagInput";
import ListRecipients from "./ListRecipients";

interface Props {
  to: EmailTag[];
  cc: EmailTag[];
  bcc: EmailTag[];
  onAddTo: (email: string) => void;
  onRemoveTo: (id: string) => void;
  onAddCc: (email: string) => void;
  onRemoveCc: (id: string) => void;
  onAddBcc: (email: string) => void;
  onRemoveBcc: (id: string) => void;
  onListLoad: (emails: string[]) => void;
}

export default function RecipientSection({
  to, cc, bcc,
  onAddTo, onRemoveTo,
  onAddCc, onRemoveCc,
  onAddBcc, onRemoveBcc,
  onListLoad,
}: Props) {
  const [mode, setMode] = useState<RecipientMode>("manual");
  const [showCcBcc, setShowCcBcc] = useState(false);

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div>
        <label className="block text-sm font-semibold text-slate-600 mb-2 tracking-wide uppercase">
          Recipients <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <ModeButton
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            }
            label="Input Manually"
          />
          <ModeButton
            active={mode === "list"}
            onClick={() => setMode("list")}
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            }
            label="Use Recipient List"
          />
        </div>
      </div>

      {/* To field */}
      {mode === "manual" ? (
        <EmailTagInput
          label="To"
          tags={to}
          onAdd={onAddTo}
          onRemove={onRemoveTo}
          placeholder="recipient@college.edu"
          required
        />
      ) : (
        <ListRecipients onRecipientsLoaded={onListLoad} />
      )}

      {/* CC / BCC — available in both modes */}
      {!showCcBcc ? (
        <button
          type="button"
          onClick={() => setShowCcBcc(true)}
          className="text-xs font-semibold text-[#8d1c40] hover:text-[#7c0b30] underline-offset-2 hover:underline transition-colors"
        >
          + Add CC / BCC
        </button>
      ) : (
        <div className="space-y-4">
          <EmailTagInput
            label="CC"
            tags={cc}
            onAdd={onAddCc}
            onRemove={onRemoveCc}
            placeholder="cc@college.edu"
          />
          <EmailTagInput
            label="BCC"
            tags={bcc}
            onAdd={onAddBcc}
            onRemove={onRemoveBcc}
            placeholder="bcc@college.edu"
          />
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? "bg-[#8c1d40] text-white border-[#8c1d40] shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {icon}
      </svg>
      {label}
    </button>
  );
}
