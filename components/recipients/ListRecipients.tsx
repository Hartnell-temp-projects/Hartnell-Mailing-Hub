"use client";

import { useRef, useState } from "react";
import { RECIPIENT_GROUPS } from "@/lib/recipientLists";
import { parseRecipientFile } from "@/lib/parseRecipientFile";
import { SAVED_LISTS_KEY } from "@/lib/storageKeys";
import { SavedRecipientList } from "../types";

interface Props {
  onRecipientsLoaded: (emails: string[]) => void;
}

export default function ListRecipients({ onRecipientsLoaded }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; count: number } | null>(null);
  const [uploadedEmails, setUploadedEmails] = useState<string[]>([]);
  const [listName, setListName] = useState("");
  const [savedListName, setSavedListName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    setUploadedFile(null);
    setUploadError(null);
    const group = RECIPIENT_GROUPS.find((g) => g.id === groupId);
    if (group) onRecipientsLoaded(group.emails);
  };

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setSelectedGroupId(null);
    try {
      const emails = await parseRecipientFile(file);
      if (emails.length === 0) {
        setUploadError("No valid email addresses found in the file.");
        return;
      }
      setUploadedFile({ name: file.name, count: emails.length });
      setUploadedEmails(emails);
      setListName(file.name.replace(/\.[^/.]+$/, ""));
      setSavedListName(null);
      onRecipientsLoaded(emails);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to parse file.");
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadedEmails([]);
    setListName("");
    setSavedListName(null);
    onRecipientsLoaded([]);
  };

  const saveUploadedList = () => {
    const name = listName.trim();
    if (!name || uploadedEmails.length === 0) return;

    const newList: SavedRecipientList = {
      id: crypto.randomUUID(),
      name,
      description: `${uploadedEmails.length} recipients`,
      emails: uploadedEmails,
      createdAt: new Date().toISOString(),
    };

    try {
      const stored = window.localStorage.getItem(SAVED_LISTS_KEY);
      const previous: unknown = stored ? JSON.parse(stored) : [];
      const previousLists = Array.isArray(previous)
        ? previous.filter(isSavedRecipientList)
        : [];
      window.localStorage.setItem(
        SAVED_LISTS_KEY,
        JSON.stringify([newList, ...previousLists])
      );
      setSavedListName(name);
    } catch {
      setUploadError("This mailing list could not be saved in the browser.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Predefined groups */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Predefined Groups
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {RECIPIENT_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => handleGroupSelect(group.id)}
              className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selectedGroupId === group.id
                  ? "bg-[#8c1d40] text-white border-[#8c1d40]"
                  : "bg-white text-slate-700 border-slate-200 hover:border-[#8c1d40] hover:bg-red-50/30"
              }`}
            >
              <span className="font-medium block">{group.name}</span>
              <span
                className={`text-xs ${
                  selectedGroupId === group.id ? "text-white/70" : "text-slate-400"
                }`}
              >
                {group.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 border-t border-slate-100" />
        <span className="text-xs text-slate-400 font-medium">or upload a file</span>
        <div className="flex-1 border-t border-slate-100" />
      </div>

      {/* File upload */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Upload Recipient List
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />

        {!uploadedFile ? (
          <div
            className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:border-[#8c1d40] hover:bg-red-50/20 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileUpload(file);
            }}
          >
            <svg
              className="w-7 h-7 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-500">Click to browse or drag & drop</p>
            <p className="text-xs text-slate-400">CSV or XLSX / XLS supported</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border border-emerald-200 rounded-lg bg-emerald-50">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-emerald-500 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-emerald-800">{uploadedFile.name}</p>
                  <p className="text-xs text-emerald-600">
                    {uploadedFile.count} recipient{uploadedFile.count !== 1 ? "s" : ""} loaded
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearUpload}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </div>
          {!savedListName ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <label htmlFor="mailing-list-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Save this mailing list
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="mailing-list-name"
                  type="text"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Fall orientation attendees"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={saveUploadedList}
                  disabled={!listName.trim()}
                  className="rounded-lg bg-[#8c1d40] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#721633] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save list
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Saved as “{savedListName}” in this browser.
            </p>
          )}
          </>
        )}

        {uploadError && (
          <p className="mt-2 text-xs text-red-600 font-medium">{uploadError}</p>
        )}
      </div>
    </div>
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
