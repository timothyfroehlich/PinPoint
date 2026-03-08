// src/lib/tiptap/render.ts
import "server-only";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import sanitizeHtml from "sanitize-html";
import type { ProseMirrorDoc } from "./types";

/**
 * Extensions used for server-side HTML generation.
 * Must match the extensions configured in the editor component.
 */
const renderExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
  }),
  Link.configure({
    openOnClick: false,
  }),
  Mention.configure({
    HTMLAttributes: { class: "mention" },
    renderHTML({ options, node }) {
      return [
        "a",
        {
          ...options.HTMLAttributes,
          href: `/profile/${String(node.attrs["id"])}`,
          "data-mention-id": String(node.attrs["id"]),
        },
        `@${String(node.attrs["label"] ?? node.attrs["id"])}`,
      ];
    },
  }),
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "h2",
    "h3",
    "p",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "a",
    "br",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "class", "data-mention-id", "target", "rel"],
    span: ["class"],
  },
  allowedClasses: {
    a: ["text-link", "mention"],
    span: ["mention"],
  },
};

/**
 * Render ProseMirror JSON to sanitized HTML.
 *
 * Used for displaying rich text content in non-editor contexts:
 * issue timeline, machine detail pages, email notifications.
 *
 * Security: Output is sanitized via sanitize-html with strict tag/attribute allowlists.
 */
export function renderDocToHtml(doc: ProseMirrorDoc): string {
  const html = generateHTML(doc, renderExtensions);
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

/**
 * Render ProseMirror JSON to sanitized HTML suitable for email.
 * Strips profile links (not accessible in email context) and
 * converts mentions to bold text.
 */
export function renderDocToEmailHtml(doc: ProseMirrorDoc): string {
  const html = generateHTML(doc, renderExtensions);
  // Convert mention links to bold @name for email
  const emailHtml = html.replace(
    /<a[^>]*class="[^"]*mention[^"]*"[^>]*>(@[^<]+)<\/a>/g,
    "<strong>$1</strong>"
  );
  return sanitizeHtml(emailHtml, SANITIZE_OPTIONS);
}
