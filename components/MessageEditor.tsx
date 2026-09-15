"use client";

import { useEffect, useRef, useState } from "react";
import { EditorMode } from "./types";

interface Props {
  value: string;
  mode: EditorMode;
  onChange: (value: string) => void;
  onModeChange: (mode: EditorMode) => void;
}

const FULL_DOCUMENT_PATTERN = /<!doctype\s+html|<html[\s>]/i;

const HIGHLIGHT_COLORS = [
  { name: "Yellow highlight", value: "#fff2a8" },
  { name: "Green highlight", value: "#d9f99d" },
  { name: "Blue highlight", value: "#bfdbfe" },
  { name: "Pink highlight", value: "#fbcfe8" },
];

const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
];

const BLOCK_STYLE_OPTIONS = [
  { label: "Paragraph", value: "p" },
  { label: "Heading 1", value: "h1" },
  { label: "Heading 2", value: "h2" },
  { label: "Heading 3", value: "h3" },
  { label: "Quote", value: "blockquote" },
];

const ALIGNMENT_OPTIONS = [
  { label: "Align left", value: "left", command: "justifyLeft" },
  { label: "Center", value: "center", command: "justifyCenter" },
  { label: "Align right", value: "right", command: "justifyRight" },
  { label: "Justify", value: "justify", command: "justifyFull" },
];

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  bulletList: boolean;
  numberedList: boolean;
  fontSize: string;
  blockStyle: string;
  alignment: string;
  highlighted: boolean;
  highlightColor: string;
}

function getEditableBody(value: string) {
  if (!FULL_DOCUMENT_PATTERN.test(value.trim())) {
    return value;
  }

  const document = new DOMParser().parseFromString(value, "text/html");
  return document.body.innerHTML;
}

function getBlockStyle(value: string) {
  return value.replace(/[<>]/g, "").toLowerCase();
}

function isHighlighted(value: string) {
  const normalized = value.replace(/\s/g, "").toLowerCase();
  return !["", "transparent", "rgba(0,0,0,0)", "rgb(255,255,255)"].includes(normalized);
}

function colorsMatch(first: string, second: string) {
  const normalize = (value: string) => value.replace(/\s/g, "").toLowerCase();
  const normalizedFirst = normalize(first);
  const normalizedSecond = normalize(second);

  if (normalizedFirst === normalizedSecond) {
    return true;
  }
  if (!normalizedSecond.startsWith("#") || normalizedSecond.length !== 7) {
    return false;
  }

  const red = parseInt(normalizedSecond.slice(1, 3), 16);
  const green = parseInt(normalizedSecond.slice(3, 5), 16);
  const blue = parseInt(normalizedSecond.slice(5, 7), 16);
  return normalizedFirst === `rgb(${red},${green},${blue})`;
}

function getActiveFormats(): ActiveFormats {
  let alignment = "left";
  if (document.queryCommandState("justifyCenter")) {
    alignment = "center";
  }
  if (document.queryCommandState("justifyRight")) { 
    alignment = "right";
  }
  if (document.queryCommandState("justifyFull")) {
    alignment = "justify";
  }

  const highlightColor =
    document.queryCommandValue("hiliteColor") || document.queryCommandValue("backColor");

  return {
    bold: document.queryCommandState("bold"),
    italic: document.queryCommandState("italic"),
    underline: document.queryCommandState("underline"),
    strikeThrough: document.queryCommandState("strikeThrough"),
    bulletList: document.queryCommandState("insertUnorderedList"),
    numberedList: document.queryCommandState("insertOrderedList"),
    fontSize: document.queryCommandValue("fontSize"),
    blockStyle: getBlockStyle(document.queryCommandValue("formatBlock")),
    alignment,
    highlighted: isHighlighted(highlightColor),
    highlightColor,
  };
}

function AlignmentIcon({ alignment }: { alignment: string }) {
  const paths = {
    left: "M4 6h16M4 10h12M4 14h16M4 18h10",
    center: "M6 6h12M4 10h16M6 14h12M7 18h10",
    right: "M4 6h16M8 10h12M4 14h16M10 18h10",
    justify: "M4 6h16M4 10h16M4 14h16M4 18h16",
  };

  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d={paths[alignment as keyof typeof paths] || paths.left} />
    </svg>
  );
}

function ToolbarButton({
  label,
  title,
  active = false,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-rose-100 text-[#8c1d40] ring-1 ring-inset ring-rose-200"
          : "text-slate-600 hover:bg-white hover:text-[#8c1d40]"
      }`}
    >
      {label}
    </button>
  );
}

export default function MessageEditor({ value, mode, onChange, onModeChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fullDocumentRef = useRef<string | null>(null);
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const [blockStyleMenuOpen, setBlockStyleMenuOpen] = useState(false);
  const [alignmentMenuOpen, setAlignmentMenuOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    bulletList: false,
    numberedList: false,
    fontSize: "",
    blockStyle: "p",
    alignment: "left",
    highlighted: false,
    highlightColor: "",
  });

  useEffect(() => {
    if (mode !== "rich" || !editorRef.current) {
      return;
    }

    const isFullDocument = FULL_DOCUMENT_PATTERN.test(value.trim());
    fullDocumentRef.current = isFullDocument ? value : null;

    const editableBody = getEditableBody(value);
    if (editorRef.current.innerHTML !== editableBody) {
      editorRef.current.innerHTML = editableBody;
    }
  }, [mode, value]);

  useEffect(() => {
    const updateActiveFormats = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();

      if (!editor || !selection || !editor.contains(selection.anchorNode)) return;

      setActiveFormats(getActiveFormats());
    };

    document.addEventListener("selectionchange", updateActiveFormats);
    return () => document.removeEventListener("selectionchange", updateActiveFormats);
  }, []);

  const emitEditorChange = () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const editedBody = editor.innerHTML;
    setActiveFormats(getActiveFormats());

    if (!fullDocumentRef.current) {
      onChange(editedBody);
      return;
    }

    const parsedDocument = new DOMParser().parseFromString(fullDocumentRef.current, "text/html");
    parsedDocument.body.innerHTML = editedBody;
    onChange(`<!doctype html>\n${parsedDocument.documentElement.outerHTML}`);
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitEditorChange();
  };

  const handleInsertLink = () => {
    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0
      ? selection.getRangeAt(0).cloneRange()
      : null;
    const url = window.prompt("Enter the URL for the selected text:", "https://");
    if (!url) return;

    editorRef.current?.focus();
    if (savedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }

    document.execCommand("createLink", false, url.trim());

    if (editorRef.current && selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      editorRef.current.querySelectorAll("a").forEach((link) => {
        if (range.intersectsNode(link)) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
      });
    }

    emitEditorChange();
  };

  const handleBlockStyle = (value: string) => {
    runCommand("formatBlock", `<${value}>`);
    setBlockStyleMenuOpen(false);
  };

  const handleAlignment = (command: string) => {
    runCommand(command);
    setAlignmentMenuOpen(false);
  };

  const handleHighlight = () => {
    runCommand(
      "hiliteColor",
      activeFormats.highlighted ? "transparent" : HIGHLIGHT_COLORS[0].value
    );
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <label
            htmlFor={mode === "rich" ? "body-editor" : "body-html"}
            className="block text-sm font-semibold uppercase tracking-wide text-slate-600"
          >
            Message Body <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Use rich text tools or edit the email HTML directly.
          </p>
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist" aria-label="Editor mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "rich"}
            onClick={() => onModeChange("rich")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === "rich"
                ? "bg-white text-[#8c1d40] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Rich text
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "html"}
            onClick={() => onModeChange("html")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === "html"
                ? "bg-white text-[#8c1d40] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            HTML
          </button>
        </div>
      </div>

      {mode === "rich" ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 p-2" role="toolbar" aria-label="Text formatting toolbar">
            <ToolbarButton label="↶" title="Undo" onClick={() => runCommand("undo")} />
            <ToolbarButton label="↷" title="Redo" onClick={() => runCommand("redo")} />
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton label="B" title="Bold" active={activeFormats.bold} onClick={() => runCommand("bold")} />
            <ToolbarButton label="I" title="Italic" active={activeFormats.italic} onClick={() => runCommand("italic")} />
            <ToolbarButton label="U" title="Underline" active={activeFormats.underline} onClick={() => runCommand("underline")} />
            <ToolbarButton label="S" title="Strikethrough" active={activeFormats.strikeThrough} onClick={() => runCommand("strikeThrough")} />
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton label="• List" title="Bullet list" active={activeFormats.bulletList} onClick={() => runCommand("insertUnorderedList")} />
            <ToolbarButton label="1. List" title="Numbered list" active={activeFormats.numberedList} onClick={() => runCommand("insertOrderedList")} />
            <ToolbarButton label="Link" title="Add link to selected text" onClick={handleInsertLink} />
            <ToolbarButton label="Clear" title="Clear formatting" onClick={() => runCommand("removeFormat")} />
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <div className="relative">
              <button
                type="button"
                title="Change text alignment"
                aria-label="Change text alignment"
                aria-haspopup="menu"
                aria-expanded={alignmentMenuOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setAlignmentMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]"
              >
                <AlignmentIcon alignment={activeFormats.alignment} />
                <span>{ALIGNMENT_OPTIONS.find((option) => option.value === activeFormats.alignment)?.label || "Alignment"}</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {alignmentMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {ALIGNMENT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleAlignment(option.command)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-rose-50 hover:text-[#8c1d40] ${
                        activeFormats.alignment === option.value
                          ? "bg-rose-50 font-semibold text-[#8c1d40]"
                          : "text-slate-600"
                      }`}
                    >
                      <AlignmentIcon alignment={option.value} />
                      {option.label}
                      {activeFormats.alignment === option.value && <span className="ml-auto" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <div className="relative">
              <button
                type="button"
                title="Change text size"
                aria-label="Change text size"
                aria-haspopup="menu"
                aria-expanded={fontSizeMenuOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setFontSizeMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]"
              >
                <span className="text-sm font-bold">T</span>
                <span>
                  {FONT_SIZE_OPTIONS.find((option) => option.value === activeFormats.fontSize)?.label || "Text size"}
                </span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {fontSizeMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        runCommand("fontSize", option.value);
                        setFontSizeMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-rose-50 hover:text-[#8c1d40] ${
                        activeFormats.fontSize === option.value
                          ? "bg-rose-50 font-semibold text-[#8c1d40]"
                          : "text-slate-600"
                      }`}
                    >
                      {option.label}
                      {activeFormats.fontSize === option.value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <div className="relative">
              <button
                type="button"
                title="Change paragraph style"
                aria-label="Change paragraph style"
                aria-haspopup="menu"
                aria-expanded={blockStyleMenuOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setBlockStyleMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]"
              >
                <span>
                  {BLOCK_STYLE_OPTIONS.find((option) => option.value === activeFormats.blockStyle)?.label || "Style"}
                </span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {blockStyleMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {BLOCK_STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleBlockStyle(option.value)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-rose-50 hover:text-[#8c1d40] ${
                        activeFormats.blockStyle === option.value
                          ? "bg-rose-50 font-semibold text-[#8c1d40]"
                          : "text-slate-600"
                      }`}
                    >
                      {option.label}
                      {activeFormats.blockStyle === option.value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton
              label={activeFormats.highlighted ? "Highlighted" : "Highlight"}
              title={activeFormats.highlighted ? "Remove highlight" : "Highlight selected text"}
              active={activeFormats.highlighted}
              onClick={handleHighlight}
            />
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.name}
                aria-label={color.name}
                aria-pressed={colorsMatch(activeFormats.highlightColor, color.value)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runCommand("hiliteColor", color.value)}
                className={`h-6 w-6 rounded border shadow-sm transition-shadow ${
                  colorsMatch(activeFormats.highlightColor, color.value)
                    ? "border-slate-700 ring-2 ring-amber-300 ring-offset-1"
                    : "border-slate-300"
                }`}
                style={{ backgroundColor: color.value }}
              />
            ))}
          </div>
          <div
            id="body-editor"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-label="Rich text message body"
            aria-required="true"
            onInput={emitEditorChange}
            className="min-h-[260px] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-['Write_your_message_here...']"
          />
        </div>
      ) : (
        <textarea
          id="body-html"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste or write your email HTML here..."
          rows={14}
          spellCheck={false}
          aria-label="HTML message body"
          aria-required="true"
          className="w-full resize-y rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );
}
