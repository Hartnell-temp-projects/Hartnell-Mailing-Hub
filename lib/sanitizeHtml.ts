import DOMPurify from "isomorphic-dompurify";

/**
 * This will make sure the HTML is safe to use in emails. It will remove any potentially dangerous tags and attributes.
 */

export function sanitizeEmailHtml(value: string): string {
  return DOMPurify.sanitize(value, {
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["embed", "form", "iframe", "object", "script"],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}
