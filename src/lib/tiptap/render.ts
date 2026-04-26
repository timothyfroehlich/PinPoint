import * as Sentry from "@sentry/nextjs";
import sanitizeHtml from "sanitize-html";
import { escapeHtml } from "~/lib/markdown";
import {
  type ProseMirrorDoc,
  type ProseMirrorMark,
  type ProseMirrorNode,
  plainTextToDoc,
} from "./types";

/**
 * Sentinel string returned by `renderDocToHtml` when rendering fails.
 *
 * Contract: callers MUST compare the return value of `renderDocToHtml` to
 * this exact string (reference/value equality) BEFORE injecting it as HTML.
 * The sentinel is intentionally NOT routed through `sanitizeHtml`, so the
 * `data-render-failed` attribute survives — that attribute exists only as
 * an out-of-band marker for human debuggers (e.g. inspecting the DOM after
 * a future refactor accidentally bypasses the sentinel check).
 *
 * `RichTextDisplay` is the only consumer today and does this check; never
 * inject this string into the DOM, and never re-sanitize it (sanitization
 * would strip the `data-` attribute and break any future debug heuristics).
 */
export const RENDER_FAILED_SENTINEL = '<span data-render-failed="true"></span>';

/**
 * Safely extract a string from an unknown ProseMirror attribute value.
 * Returns fallback if the value is not a string or number.
 */
function attrStr(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  return fallback;
}

type MentionRenderer = (id: string, label: string) => string;

function defaultMentionRenderer(id: string, label: string): string {
  return `<a class="mention" href="/profile/${escapeHtml(id)}" data-mention-id="${escapeHtml(id)}">@${escapeHtml(label)}</a>`;
}

/**
 * Apply ProseMirror marks (bold, italic, link, etc.) to text content.
 */
function applyMarks(
  html: string,
  marks: ProseMirrorMark[] | undefined
): string {
  if (!marks) return html;
  let result = html;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
        result = `<strong>${result}</strong>`;
        break;
      case "italic":
        result = `<em>${result}</em>`;
        break;
      case "link": {
        const href = escapeHtml(attrStr(mark.attrs?.["href"]));
        const target = mark.attrs?.["target"]
          ? ` target="${escapeHtml(attrStr(mark.attrs["target"]))}"`
          : "";
        const rel = mark.attrs?.["rel"]
          ? ` rel="${escapeHtml(attrStr(mark.attrs["rel"]))}"`
          : "";
        result = `<a href="${href}"${target}${rel}>${result}</a>`;
        break;
      }
      case "strike":
        result = `<s>${result}</s>`;
        break;
      case "code":
        result = `<code>${result}</code>`;
        break;
    }
  }
  return result;
}

/**
 * Recursively render ProseMirror nodes to an HTML string.
 *
 * This is a custom renderer that does NOT require a DOM environment.
 * It handles all node types from StarterKit + Link + Mention extensions.
 */
function renderNodes(
  nodes: ProseMirrorNode[] | undefined,
  mentionRenderer: MentionRenderer
): string {
  if (!nodes) return "";
  return nodes.map((n) => renderNode(n, mentionRenderer)).join("");
}

function renderNode(
  node: ProseMirrorNode,
  mentionRenderer: MentionRenderer
): string {
  const children = renderNodes(node.content, mentionRenderer);

  switch (node.type) {
    case "text":
      return applyMarks(escapeHtml(node.text ?? ""), node.marks);
    case "paragraph":
      return `<p>${children}</p>`;
    case "heading": {
      const level = Math.min(
        3,
        Math.max(2, Number(node.attrs?.["level"]) || 2)
      );
      return `<h${String(level)}>${children}</h${String(level)}>`;
    }
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList":
      return `<ol>${children}</ol>`;
    case "listItem":
      return `<li>${children}</li>`;
    case "blockquote":
      return `<blockquote>${children}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${children}</code></pre>`;
    case "horizontalRule":
      return "<hr>";
    case "hardBreak":
      return "<br>";
    case "mention": {
      const id = attrStr(node.attrs?.["id"]);
      const label = attrStr(node.attrs?.["label"], id);
      return mentionRenderer(id, label);
    }
    default:
      return children;
  }
}

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
    "s",
    "code",
    "pre",
    "blockquote",
    "hr",
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
 * Uses a custom recursive renderer (no DOM/jsdom dependency) so it works
 * in any environment: server components, client components, Edge, tests.
 *
 * Return value contract:
 *   - On success: a sanitize-html allowlisted HTML string. Safe to inject.
 *   - On failure: the exact `RENDER_FAILED_SENTINEL` string. NOT safe to
 *     inject blindly — callers MUST compare to `RENDER_FAILED_SENTINEL`
 *     and render a React placeholder instead. The exception is captured
 *     to Sentry before this branch returns.
 *
 * Security: success-path output is sanitized via sanitize-html with strict
 * tag/attribute allowlists.
 */
export function renderDocToHtml(
  doc: ProseMirrorDoc | string | null | undefined
): string {
  if (!doc) return "";

  try {
    const prosemirrorDoc = typeof doc === "string" ? plainTextToDoc(doc) : doc;
    const html = renderNodes(prosemirrorDoc.content, defaultMentionRenderer);
    return sanitizeHtml(html, SANITIZE_OPTIONS);
  } catch (e) {
    Sentry.captureException(e, {
      contexts: { pinpoint: { action: "renderDocToHtml" } },
    });
    console.error("renderDocToHtml failed", e);
    return RENDER_FAILED_SENTINEL;
  }
}
