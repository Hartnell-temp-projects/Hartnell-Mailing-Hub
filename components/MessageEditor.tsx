"use client";

import { Extension, type Editor } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeEmailHtml } from "@/lib/sanitizeHtml";
import { EditorMode } from "./types";

interface Props {
  value: string;
  mode: EditorMode;
  onChange: (value: string) => void;
  isTemplate?: boolean;
}

const FULL_DOCUMENT_PATTERN = /<!doctype\s+html|<html[\s>]/i;

const HIGHLIGHT_COLORS = [
  { name: "Yellow highlight", value: "#fff2a8" },
  { name: "Green highlight", value: "#d9f99d" },
  { name: "Blue highlight", value: "#bfdbfe" },
  { name: "Pink highlight", value: "#fbcfe8" },
];

const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "14px" },
  { label: "Normal", value: "16px" },
  { label: "Large", value: "20px" },
];

const BLOCK_STYLE_OPTIONS = [
  { label: "Paragraph", value: "p" },
  { label: "Heading 1", value: "h1" },
  { label: "Heading 2", value: "h2" },
  { label: "Heading 3", value: "h3" },
  { label: "Quote", value: "blockquote" },
];

const ALIGNMENT_OPTIONS = [
  { label: "Align left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Align right", value: "right" },
  { label: "Justify", value: "justify" },
];

const RECIPIENT_VARIABLES = [
  { label: "First name", value: "{{first_name}}" },
  { label: "Last name", value: "{{last_name}}" },
  { label: "Full name", value: "{{full_name}}" },
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

const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    link: {
      autolink: false,
      openOnClick: false,
      protocols: ["http", "https", "mailto"],
    },
  }),
  TextStyle,
  FontSize,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ["heading", "paragraph", "blockquote"] }),
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEditableContent(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "<p></p>";
  if (FULL_DOCUMENT_PATTERN.test(trimmedValue)) {
    if (typeof DOMParser !== "undefined") {
      const document = new DOMParser().parseFromString(value, "text/html");
      const editableRegion = findEditableRegion(document);
      if (editableRegion) return editableRegion.innerHTML || "<p></p>";
    }

    const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch?.[1]) return bodyMatch[1];
  }
  if (/<[a-z][\s\S]*>/i.test(trimmedValue)) return value;
  return `<p>${escapeHtml(value).replace(/\r?\n/g, "<br />")}</p>`;
}

function findEditableRegion(document: Document): HTMLElement | null {
  const markedRegion = document.querySelector<HTMLElement>("[data-editable-region='body']");
  if (markedRegion) return markedRegion;

  const candidates = Array.from(document.querySelectorAll<HTMLElement>("main, article, section, td, div"))
    .filter((element) => element.querySelector("p, ul, ol, li") && !element.querySelector("table"));

  return candidates.sort((first, second) => (second.textContent?.length || 0) - (first.textContent?.length || 0))[0] || null;
}

function mergeEditableContent(source: string, content: string): string {
  if (!FULL_DOCUMENT_PATTERN.test(source.trim()) || typeof DOMParser === "undefined") {
    return content;
  }

  const document = new DOMParser().parseFromString(source, "text/html");
  const editableRegion = findEditableRegion(document);
  if (!editableRegion) return content;

  editableRegion.innerHTML = content;
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

function serializeTemplateDocument(document: Document) {
  const documentElement = document.documentElement.cloneNode(true) as HTMLElement;
  documentElement.querySelectorAll("[contenteditable], [spellcheck]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("spellcheck");
  });
  return `<!doctype html>\n${documentElement.outerHTML}`;
}

function getBlockStyle(editor: Editor) {
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  if (editor.isActive("blockquote")) return "blockquote";
  return "p";
}

function getActiveFormats(editor: Editor): ActiveFormats {
  const textStyle = editor.getAttributes("textStyle") as { fontSize?: string };
  const highlight = editor.getAttributes("highlight") as { color?: string };
  const alignment = ALIGNMENT_OPTIONS.find((option) => editor.isActive({ textAlign: option.value }))?.value || "left";

  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strikeThrough: editor.isActive("strike"),
    bulletList: editor.isActive("bulletList"),
    numberedList: editor.isActive("orderedList"),
    fontSize: textStyle.fontSize || "",
    blockStyle: getBlockStyle(editor),
    alignment,
    highlighted: editor.isActive("highlight"),
    highlightColor: highlight.color || "",
  };
}

function colorsMatch(first: string, second: string) {
  const normalize = (value: string) => value.replace(/\s/g, "").toLowerCase();
  const normalizedFirst = normalize(first);
  const normalizedSecond = normalize(second);

  if (normalizedFirst === normalizedSecond) return true;
  if (!normalizedSecond.startsWith("#") || normalizedSecond.length !== 7) return false;

  const red = parseInt(normalizedSecond.slice(1, 3), 16);
  const green = parseInt(normalizedSecond.slice(3, 5), 16);
  const blue = parseInt(normalizedSecond.slice(5, 7), 16);
  return normalizedFirst === `rgb(${red},${green},${blue})`;
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
        active ? "bg-rose-100 text-[#8c1d40] ring-1 ring-inset ring-rose-200" : "text-slate-600 hover:bg-white hover:text-[#8c1d40]"
      }`}
    >
      {label}
    </button>
  );
}

export default function MessageEditor({ value, mode, onChange, isTemplate = false }: Props) {
  const templateFrameRef = useRef<HTMLIFrameElement>(null);
  const templateRangeRef = useRef<Range | null>(null);
  const templateSourceRef = useRef<string | null>(null);
  const [visualTemplateHtml, setVisualTemplateHtml] = useState<string | null>(null);
  const [fullDocumentView, setFullDocumentView] = useState<"html" | "visual">("visual");
  const [fontSizeMenuOpen, setFontSizeMenuOpen] = useState(false);
  const [blockStyleMenuOpen, setBlockStyleMenuOpen] = useState(false);
  const [alignmentMenuOpen, setAlignmentMenuOpen] = useState(false);
  const [recipientVariableMenuOpen, setRecipientVariableMenuOpen] = useState(false);
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

  const isFullDocument = FULL_DOCUMENT_PATTERN.test(value.trim());
  const showHtmlSource = isTemplate ? fullDocumentView === "html" : mode === "html";
  const initialContent = useMemo(() => getEditableContent(value), [value]);
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor: updatedEditor }) => {
      const cleanContent = sanitizeEmailHtml(updatedEditor.getHTML());
      const nextValue = isTemplate
        ? mergeEditableContent(templateSourceRef.current || value, cleanContent)
        : cleanContent;
      onChange(nextValue);
      setActiveFormats(getActiveFormats(updatedEditor));
    },
  });

  useEffect(() => {
    if (!isTemplate) {
      templateSourceRef.current = null;
      return;
    }

    if (FULL_DOCUMENT_PATTERN.test(value.trim())) {
      templateSourceRef.current = value;
    }
  }, [isTemplate, value]);

  useEffect(() => {
    if (!editor || showHtmlSource || isFullDocument) {
      return;
    }

    const nextContent = getEditableContent(value);
    if (editor.getHTML() !== nextContent) {
      editor.commands.setContent(nextContent, { emitUpdate: false });
    }
  }, [editor, isFullDocument, showHtmlSource, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const updateActiveFormats = () => setActiveFormats(getActiveFormats(editor));
    editor.on("selectionUpdate", updateActiveFormats);
    editor.on("transaction", updateActiveFormats);
    updateActiveFormats();

    return () => {
      editor.off("selectionUpdate", updateActiveFormats);
      editor.off("transaction", updateActiveFormats);
    };
  }, [editor]);

  const runCommand = (command: () => boolean) => {
    if (!editor) {
      return;
    }
    command();
    setActiveFormats(getActiveFormats(editor));
  };

  const handleInsertLink = () => {
    if (!editor) {
      return;
    }

    const currentUrl = editor.getAttributes("link").href || "https://";
    const url = window.prompt("Enter the URL for the selected text:", currentUrl);
    if (!url) {
      return;
    }

    runCommand(() => editor.chain().focus().setLink({
      href: url.trim(),
      target: "_blank",
      rel: "noopener noreferrer",
    }).run());
  };

  const handleBlockStyle = (style: string) => {
    if (!editor) {
      return;
    }

    runCommand(() => {
      if (style === "p") {
        return editor.chain().focus().setParagraph().run();
      }
      if (style === "blockquote") {
        return editor.chain().focus().toggleBlockquote().run();
      }
      return editor.chain().focus().toggleHeading({ level: Number(style.slice(1)) as 1 | 2 | 3 }).run();
    });
    setBlockStyleMenuOpen(false);
  };

  const handleAlignment = (alignment: string) => {
    if (!editor) {
      return;
    }
    runCommand(() => editor.chain().focus().setTextAlign(alignment).run());
    setAlignmentMenuOpen(false);
  };

  const handleHighlight = () => {
    if (!editor) {
      return;
    }
    runCommand(() => activeFormats.highlighted
      ? editor.chain().focus().unsetHighlight().run()
      : editor.chain().focus().toggleHighlight({ color: HIGHLIGHT_COLORS[0].value }).run());
  };

  const handleInsertRecipientVariable = (recipientVariable: string) => {
    if (!editor) {
      return;
    }
    runCommand(() => editor.chain().focus().insertContent(recipientVariable).run());
    setRecipientVariableMenuOpen(false);
  };

  const handleHtmlChange = (nextValue: string) => {
    if (isTemplate && FULL_DOCUMENT_PATTERN.test(nextValue.trim())) {
      templateSourceRef.current = nextValue;
    }
    onChange(nextValue);
  };

  const handleTemplateFrameLoad = () => {
    const templateDocument = templateFrameRef.current?.contentDocument;
    if (!templateDocument?.body) return;
    if (!visualTemplateHtml) setVisualTemplateHtml(sanitizeEmailHtml(value));

    const commitTemplateChanges = () => {
      onChange(sanitizeEmailHtml(serializeTemplateDocument(templateDocument)));
    };

    templateDocument.addEventListener("selectionchange", () => {
      const selection = templateDocument.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (templateDocument.body.contains(range.commonAncestorContainer)) {
          templateRangeRef.current = range.cloneRange();
        }
      }
    });

    // Edit the rendered document directly so the template's original DOM and
    // styles stay intact. Restricting contentEditable to leaf elements made
    // headers, list items, table cells, and other content appear read-only.
    templateDocument.body.contentEditable = "true";
    templateDocument.body.spellcheck = true;
    templateDocument.body.addEventListener("input", commitTemplateChanges);

    templateDocument.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("a")) event.preventDefault();
    });
  };

  const commitVisualTemplateChanges = () => {
    const templateDocument = templateFrameRef.current?.contentDocument;
    if (!templateDocument) return;

    onChange(sanitizeEmailHtml(serializeTemplateDocument(templateDocument)));
  };

  const applyVisualTemplateFormat = (format: "bold" | "italic" | "underline" | "highlight" | "fontSize", value?: string) => {
    const templateDocument = templateFrameRef.current?.contentDocument;
    const savedRange = templateRangeRef.current;
    if (!templateDocument || !savedRange || savedRange.collapsed) return;

    const selection = templateDocument.getSelection();
    if (!selection) return;

    const startElement = savedRange.startContainer.nodeType === Node.TEXT_NODE
      ? savedRange.startContainer.parentElement
      : savedRange.startContainer as HTMLElement;
    const endElement = savedRange.endContainer.nodeType === Node.TEXT_NODE
      ? savedRange.endContainer.parentElement
      : savedRange.endContainer as HTMLElement;
    const startRegion = startElement?.closest("[contenteditable='true']");
    const endRegion = endElement?.closest("[contenteditable='true']");
    if (!startRegion || startRegion !== endRegion) return;

    const wrapper = templateDocument.createElement(
      format === "bold" ? "strong" : format === "italic" ? "em" : format === "underline" ? "u" : "span"
    );
    if (format === "highlight") wrapper.style.backgroundColor = value || HIGHLIGHT_COLORS[0].value;
    if (format === "fontSize") wrapper.style.fontSize = value || FONT_SIZE_OPTIONS[1].value;

    selection.removeAllRanges();
    selection.addRange(savedRange);
    wrapper.appendChild(savedRange.extractContents());
    savedRange.insertNode(wrapper);
    savedRange.selectNodeContents(wrapper);
    templateRangeRef.current = savedRange.cloneRange();
    commitVisualTemplateChanges();
  };

  const addVisualTemplateLink = () => {
    const url = window.prompt("Enter the URL for the selected text:", "https://");
    if (!url) return;

    const templateDocument = templateFrameRef.current?.contentDocument;
    const savedRange = templateRangeRef.current;
    if (!templateDocument || !savedRange || savedRange.collapsed) return;

    const selection = templateDocument.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(savedRange);

    const link = templateDocument.createElement("a");
    link.href = url.trim();
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(savedRange.extractContents());
    savedRange.insertNode(link);
    savedRange.selectNodeContents(link);
    templateRangeRef.current = savedRange.cloneRange();
    commitVisualTemplateChanges();
  };

  const handleInsertVisualRecipientVariable = (recipientVariable: string) => {
    const templateDocument = templateFrameRef.current?.contentDocument;
    const savedRange = templateRangeRef.current;
    if (!templateDocument?.body || !savedRange || !templateDocument.body.contains(savedRange.commonAncestorContainer)) {
      return;
    }

    const selection = templateDocument.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(savedRange);
    savedRange.deleteContents();

    const tokenNode = templateDocument.createTextNode(recipientVariable);
    savedRange.insertNode(tokenNode);
    savedRange.setStartAfter(tokenNode);
    savedRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(savedRange);
    templateRangeRef.current = savedRange.cloneRange();
    commitVisualTemplateChanges();
    setRecipientVariableMenuOpen(false);
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <label htmlFor={showHtmlSource ? "body-html" : "body-editor"} className="block text-sm font-semibold uppercase tracking-wide text-slate-600">
            Message Body <span className="text-red-500">*</span>
          </label>
          <p className="mt-1 text-xs text-slate-400">
            {isTemplate
              ? showHtmlSource
                ? "Edit the HTML source or switch back to the visual editor."
                : "Click anywhere in the rendered template to edit it. Switch on Show HTML to edit the source."
              : "Use the formatting tools to edit your message."}
          </p>
        </div>
      </div>

      {isTemplate && (
        <div className="mb-2 flex items-center gap-3" aria-label="Template editor mode">
          <span className="text-sm font-semibold text-slate-600">Visual editor</span>
          <button
            type="button"
            role="switch"
            aria-checked={showHtmlSource}
            aria-label="Show HTML source"
            title={showHtmlSource ? "Switch to the normal editor" : "Show HTML source"}
            onClick={() => {
              if (showHtmlSource) {
                setVisualTemplateHtml(sanitizeEmailHtml(value));
                setFullDocumentView("visual");
              } else {
                setFullDocumentView("html");
                setVisualTemplateHtml(null);
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              showHtmlSource ? "bg-[#8c1d40]" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                showHtmlSource ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className={`text-sm font-semibold ${showHtmlSource ? "text-[#8c1d40]" : "text-slate-500"}`}>
            Show HTML
          </span>
        </div>
      )}

      {showHtmlSource ? (
        <textarea
          id="body-html"
          value={value}
          onChange={(event) => handleHtmlChange(event.target.value)}
          placeholder="Paste or write your email HTML here..."
          rows={14}
          spellCheck={false}
          aria-label="HTML message body"
          aria-required="true"
          className="w-full resize-y rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : isTemplate && isFullDocument ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 p-2" role="toolbar" aria-label="Template text formatting toolbar">
            <ToolbarButton label="B" title="Bold selected template text" onClick={() => applyVisualTemplateFormat("bold")} />
            <ToolbarButton label="I" title="Italicize selected template text" onClick={() => applyVisualTemplateFormat("italic")} />
            <ToolbarButton label="U" title="Underline selected template text" onClick={() => applyVisualTemplateFormat("underline")} />
            <ToolbarButton label="Link" title="Add link to selected template text" onClick={addVisualTemplateLink} />
            <div className="relative">
              <button
                type="button"
                title="Insert recipient name"
                aria-label="Insert recipient name"
                aria-haspopup="menu"
                aria-expanded={recipientVariableMenuOpen}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setRecipientVariableMenuOpen((open) => !open)}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]"
              >
                <span aria-hidden="true">@</span>
                <span>Recipient name</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {recipientVariableMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {RECIPIENT_VARIABLES.map((variable) => (
                    <button
                      key={variable.value}
                      type="button"
                      role="menuitem"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleInsertVisualRecipientVariable(variable.value)}
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-rose-50 hover:text-[#8c1d40]"
                    >
                      <span>{variable.label}</span>
                      <code className="ml-3 text-[11px] text-slate-400">{variable.value}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <span className="px-2 text-xs font-semibold text-slate-600">Highlight</span>
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.name}
                aria-label={color.name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyVisualTemplateFormat("highlight", color.value)}
                className="h-6 w-6 rounded border border-slate-300 shadow-sm"
                style={{ backgroundColor: color.value }}
              />
            ))}
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            {FONT_SIZE_OPTIONS.map((option) => (
              <ToolbarButton
                key={option.value}
                label={option.label}
                title={`Set selected template text to ${option.label.toLowerCase()} size`}
                onClick={() => applyVisualTemplateFormat("fontSize", option.value)}
              />
            ))}
          </div>
          <iframe
            title="Editable rendered email template"
            ref={templateFrameRef}
            srcDoc={visualTemplateHtml ?? sanitizeEmailHtml(value)}
            onLoad={handleTemplateFrameLoad}
            sandbox="allow-same-origin allow-popups"
            className="block h-[520px] w-full border-0 bg-white"
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm focus-within:border-transparent focus-within:ring-2 focus-within:ring-blue-500">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 p-2" role="toolbar" aria-label="Text formatting toolbar">
            <ToolbarButton label="↶" title="Undo" onClick={() => runCommand(() => editor?.chain().focus().undo().run() || false)} />
            <ToolbarButton label="↷" title="Redo" onClick={() => runCommand(() => editor?.chain().focus().redo().run() || false)} />
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton label="B" title="Bold" active={activeFormats.bold} onClick={() => runCommand(() => editor?.chain().focus().toggleBold().run() || false)} />
            <ToolbarButton label="I" title="Italic" active={activeFormats.italic} onClick={() => runCommand(() => editor?.chain().focus().toggleItalic().run() || false)} />
            <ToolbarButton label="U" title="Underline" active={activeFormats.underline} onClick={() => runCommand(() => editor?.chain().focus().toggleUnderline().run() || false)} />
            <ToolbarButton label="S" title="Strikethrough" active={activeFormats.strikeThrough} onClick={() => runCommand(() => editor?.chain().focus().toggleStrike().run() || false)} />
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton label="• List" title="Bullet list" active={activeFormats.bulletList} onClick={() => runCommand(() => editor?.chain().focus().toggleBulletList().run() || false)} />
            <ToolbarButton label="1. List" title="Numbered list" active={activeFormats.numberedList} onClick={() => runCommand(() => editor?.chain().focus().toggleOrderedList().run() || false)} />
            <ToolbarButton label="Link" title="Add link to selected text" onClick={handleInsertLink} />
            <div className="relative">
              <button type="button" title="Insert recipient name" aria-label="Insert recipient name" aria-haspopup="menu" aria-expanded={recipientVariableMenuOpen} onMouseDown={(event) => event.preventDefault()} onClick={() => setRecipientVariableMenuOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]">
                <span aria-hidden="true">@</span><span>Recipient name</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </button>
              {recipientVariableMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {RECIPIENT_VARIABLES.map((variable) => (
                    <button key={variable.value} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => handleInsertRecipientVariable(variable.value)} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-rose-50 hover:text-[#8c1d40]">
                      <span>{variable.label}</span><code className="ml-3 text-[11px] text-slate-400">{variable.value}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ToolbarButton label="Clear" title="Clear formatting" onClick={() => runCommand(() => editor?.chain().focus().clearNodes().unsetAllMarks().run() || false)} />
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <div className="relative">
              <button type="button" title="Change text alignment" aria-label="Change text alignment" aria-haspopup="menu" aria-expanded={alignmentMenuOpen} onMouseDown={(event) => event.preventDefault()} onClick={() => setAlignmentMenuOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]">
                <AlignmentIcon alignment={activeFormats.alignment} /><span>{ALIGNMENT_OPTIONS.find((option) => option.value === activeFormats.alignment)?.label || "Alignment"}</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </button>
              {alignmentMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {ALIGNMENT_OPTIONS.map((option) => (
                    <button key={option.value} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => handleAlignment(option.value)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-rose-50 hover:text-[#8c1d40] ${activeFormats.alignment === option.value ? "bg-rose-50 font-semibold text-[#8c1d40]" : "text-slate-600"}`}>
                      <AlignmentIcon alignment={option.value} />{option.label}{activeFormats.alignment === option.value && <span className="ml-auto" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <div className="relative">
              <button type="button" title="Change text size" aria-label="Change text size" aria-haspopup="menu" aria-expanded={fontSizeMenuOpen} onMouseDown={(event) => event.preventDefault()} onClick={() => setFontSizeMenuOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]">
                <span className="text-sm font-bold">T</span><span>{FONT_SIZE_OPTIONS.find((option) => option.value === activeFormats.fontSize)?.label || "Text size"}</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </button>
              {fontSizeMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <button key={option.value} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => { runCommand(() => editor?.chain().focus().setMark("textStyle", { fontSize: option.value }).run() || false); setFontSizeMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-rose-50 hover:text-[#8c1d40] ${activeFormats.fontSize === option.value ? "bg-rose-50 font-semibold text-[#8c1d40]" : "text-slate-600"}`}>
                      {option.label}{activeFormats.fontSize === option.value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <div className="relative">
              <button type="button" title="Change paragraph style" aria-label="Change paragraph style" aria-haspopup="menu" aria-expanded={blockStyleMenuOpen} onMouseDown={(event) => event.preventDefault()} onClick={() => setBlockStyleMenuOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#8c1d40]">
                <span>{BLOCK_STYLE_OPTIONS.find((option) => option.value === activeFormats.blockStyle)?.label || "Style"}</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
              </button>
              {blockStyleMenuOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 min-w-32 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  {BLOCK_STYLE_OPTIONS.map((option) => (
                    <button key={option.value} type="button" role="menuitem" onMouseDown={(event) => event.preventDefault()} onClick={() => handleBlockStyle(option.value)} className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-rose-50 hover:text-[#8c1d40] ${activeFormats.blockStyle === option.value ? "bg-rose-50 font-semibold text-[#8c1d40]" : "text-slate-600"}`}>
                      {option.label}{activeFormats.blockStyle === option.value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
            <ToolbarButton label={activeFormats.highlighted ? "Highlighted" : "Highlight"} title={activeFormats.highlighted ? "Remove highlight" : "Highlight selected text"} active={activeFormats.highlighted} onClick={handleHighlight} />
            {HIGHLIGHT_COLORS.map((color) => (
              <button key={color.value} type="button" title={color.name} aria-label={color.name} aria-pressed={colorsMatch(activeFormats.highlightColor, color.value)} onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand(() => editor?.chain().focus().toggleHighlight({ color: color.value }).run() || false)} className={`h-6 w-6 rounded border shadow-sm transition-shadow ${colorsMatch(activeFormats.highlightColor, color.value) ? "border-slate-700 ring-2 ring-amber-300 ring-offset-1" : "border-slate-300"}`} style={{ backgroundColor: color.value }} />
            ))}
          </div>
          <EditorContent
            editor={editor}
            id="body-editor"
            role="textbox"
            aria-multiline="true"
            aria-label="Rich text message body"
            aria-required="true"
            className="min-h-[260px] px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 outline-none [&_.ProseMirror]:min-h-[260px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:my-2 [&_.ProseMirror_h1]:my-3 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h2]:my-3 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h3]:my-2 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_li]:my-1 [&_.ProseMirror_blockquote]:my-3 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic"
          />
        </div>
      )}
    </div>
  );
}
