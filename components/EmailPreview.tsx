import { EmailTag } from "./types";
import { sanitizeEmailHtml } from "@/lib/sanitizeHtml";

interface Props {
  to: EmailTag[];
  cc: EmailTag[];
  bcc: EmailTag[];
  subject: string;
  body: string;
}

function formatRecipients(recipients: EmailTag[]) {
  if (recipients.length === 0) { 
    return "No recipients added";
  }

  if (recipients.length <= 2) {
    return recipients.map((recipient) => recipient.email).join(", ");
  }

  return `${recipients[0].email}, ${recipients[1].email} +${recipients.length - 2} more`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function replaceRecipientTokens(value: string) {
  return value.replace(/{{\s*(first_name|last_name|full_name|name)\s*}}/gi, (_, token: string) => {
    const previews: Record<string, string> = {
      first_name: "Jordan",
      last_name: "Lee",
      full_name: "Jordan Lee",
      name: "Jordan Lee",
    };
    return previews[token.toLowerCase()] ?? "Jordan";
  });
}

function replaceNonBreakingSpaces(value: string) {
  return value.replace(/&nbsp;|&#160;|&#xA0;/gi, " ");
}

function createPreviewDocument(body: string) {
  const trimmedBody = body.trim();
  const isFullDocument = /<!doctype\s+html|<html[\s>]/i.test(trimmedBody);
  if (isFullDocument) {
    return sanitizeEmailHtml(replaceRecipientTokens(body));
  }

  const previewBody = replaceNonBreakingSpaces(replaceRecipientTokens(body));
  const hasMarkup = /<[a-z][\s\S]*>/i.test(previewBody);
  const content = hasMarkup
    ? sanitizeEmailHtml(previewBody)
    : escapeHtml(previewBody).replace(/\r?\n/g, "<br />");

  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      ${PREVIEW_STYLES}
    </style>
  </head>
  <body>${content || '<p style="margin: 0; color: #94a3b8;">Your message will appear here.</p>'}</body>
  </html>`;
}

function RecipientLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs leading-5">
      <span className="w-12 shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 truncate text-slate-600">{value}</span>
    </div>
  );
}

export default function EmailPreview({ to, cc, bcc, subject, body }: Props) {
  return (
    <aside className="xl:sticky xl:top-6 xl:self-start" aria-label="Email preview">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Live Preview</h2>
          <p className="mt-0.5 text-xs text-slate-400">Updates as you type</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8c1d40] text-xs font-bold text-white">
              H
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-700">Hartnell College</p>
              <p className="text-xs text-slate-400">New message</p>
            </div>
          </div>
          <div className="space-y-0.5">
            <RecipientLine label="To: " value={formatRecipients(to)} />
            {cc.length > 0 && <RecipientLine label="Cc: " value={formatRecipients(cc)} />}
            {bcc.length > 0 && <RecipientLine label="Bcc: " value={formatRecipients(bcc)} />}
          </div>
          <p className="mt-3 truncate border-t border-slate-200 pt-3 text-sm font-semibold text-slate-800">
            {replaceRecipientTokens(subject.trim()) || "No subject"}
          </p>
        </div>

        <iframe
          title="Rendered email body preview"
          srcDoc={createPreviewDocument(body)}
          sandbox="allow-popups"
          className="block h-[440px] w-full border-0 bg-white"
        />
      </div>
    </aside>
  );
}

const PREVIEW_STYLES = `
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    padding: 28px 24px;
    color: #1e293b;
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  img { max-width: 100%; height: auto; }
  a { color: #1d4ed8; }
`;
