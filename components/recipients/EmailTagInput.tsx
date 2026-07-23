"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { EmailTag } from "../types";

interface Props {
  label: string;
  tags: EmailTag[];
  onAdd: (email: string) => void;
  onRemove: (id: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function EmailTagInput({ label, tags, onAdd, onRemove, placeholder, required }: Props) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const flush = () => {
    inputValue.split(/[,;\s]+/).filter(Boolean).forEach((e) => {
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
              onClick={(e) => { e.stopPropagation(); onRemove(tag.id); }}
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
