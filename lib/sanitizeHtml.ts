import DOMPurify from "isomorphic-dompurify";

/**
 * This will make sure the HTML is safe to use in emails. It will remove any potentially dangerous tags and attributes.
 */

const FULL_DOCUMENT_PATTERN = /<!doctype\s+html|<html[\s>]/i;

const SANITIZE_OPTIONS = {
  ADD_ATTR: ["target", "rel"],
  FORBID_TAGS: ["embed", "form", "iframe", "object", "script"],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

export function sanitizeEmailHtml(value: string): string {
  if (FULL_DOCUMENT_PATTERN.test(value.trim())) {
    return DOMPurify.sanitize(value, {
      ...SANITIZE_OPTIONS,
      ADD_TAGS: ["style"],
      WHOLE_DOCUMENT: true,
    });
  }

  return DOMPurify.sanitize(value, SANITIZE_OPTIONS);
}
