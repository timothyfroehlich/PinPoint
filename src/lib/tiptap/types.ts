/**
 * ProseMirror JSON document types for Tiptap editor content.
 *
 * These types represent the serialized form of editor content
 * stored in JSONB columns.
 */

import { z } from "zod";

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

export interface ProseMirrorDoc {
  type: "doc";
  content: ProseMirrorNode[];
}

/**
 * Minimal Zod schema for validating ProseMirror document payloads.
 * Validates the top-level shape — content validation is handled by Tiptap.
 */
export const proseMirrorDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.unknown()).optional(),
});

/**
 * Convert plain text to a minimal ProseMirror document.
 * Splits on double newlines for paragraphs. Single newlines become hard breaks.
 */
export function plainTextToDoc(text: string): ProseMirrorDoc {
  if (!text) {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  const paragraphs = text.split(/\n\n+/);

  const content: ProseMirrorNode[] = paragraphs.map((para) => {
    const lines = para.split("\n");
    const paraContent: ProseMirrorNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line) {
        paraContent.push({ type: "text", text: line });
      }
      if (i < lines.length - 1) {
        paraContent.push({ type: "hardBreak" });
      }
    }

    const node: ProseMirrorNode = {
      type: "paragraph",
    };

    if (paraContent.length > 0) {
      node.content = paraContent;
    }

    return node;
  });

  return {
    type: "doc",
    content,
  };
}

/**
 * Extract unique mentioned user IDs from a ProseMirror document.
 */
export function extractMentions(
  doc: ProseMirrorDoc | null | undefined
): string[] {
  const d = doc as unknown;
  if (
    !d ||
    typeof d !== "object" ||
    (d as Record<string, unknown>)["type"] !== "doc" ||
    !Array.isArray((d as Record<string, unknown>)["content"])
  ) {
    return [];
  }

  const validDoc = d as ProseMirrorDoc;
  const ids = new Set<string>();

  function walk(nodes: ProseMirrorNode[] | undefined): void {
    if (!nodes || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node.type === "mention" && typeof node.attrs?.["id"] === "string") {
        ids.add(node.attrs["id"]);
      }
      if (node.content) {
        walk(node.content);
      }
    }
  }

  walk(validDoc.content);
  return Array.from(ids);
}

/**
 * Extract plain text from a ProseMirror document (for search, truncation, etc.).
 * Robustly handles legacy plain text strings.
 */
export function docToPlainText(
  doc: ProseMirrorDoc | string | null | undefined
): string {
  if (!doc) return "";
  if (typeof doc === "string") return doc;

  const d = doc as unknown;
  if (
    !d ||
    typeof d !== "object" ||
    (d as Record<string, unknown>)["type"] !== "doc" ||
    !Array.isArray((d as Record<string, unknown>)["content"])
  ) {
    return "";
  }

  const validDoc = d as ProseMirrorDoc;
  const parts: string[] = [];

  function walk(nodes: ProseMirrorNode[] | undefined): void {
    if (!nodes || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node.type === "text" && node.text) {
        parts.push(node.text);
      } else if (
        node.type === "mention" &&
        typeof node.attrs?.["label"] === "string"
      ) {
        parts.push(`@${node.attrs["label"]}`);
      } else if (node.type === "hardBreak") {
        parts.push("\n");
      } else if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "bulletList" ||
        node.type === "orderedList"
      ) {
        if (parts.length > 0 && !parts[parts.length - 1]?.endsWith("\n")) {
          parts.push("\n");
        }
        if (node.content) walk(node.content);
        parts.push("\n");
        continue;
      }
      if (node.content) walk(node.content);
    }
  }

  walk(validDoc.content);

  return parts.join("").trim();
}

/**
 * Whether a ProseMirror doc is structurally empty — no nodes, or a single empty
 * paragraph. `content` is required on the {@link ProseMirrorDoc} *type* but
 * optional in the persisted *schema*, so a stored bare `{ type: "doc" }` arrives
 * with no `content`; this reads it undefined-tolerantly (a direct
 * `doc.content[0]` would crash on such a doc).
 */
export function docIsEmpty(doc: ProseMirrorDoc | null | undefined): boolean {
  const content = doc?.content;
  const firstNode = content?.[0];
  const length = content?.length ?? 0;
  return (
    !doc ||
    length === 0 ||
    (length === 1 && firstNode?.type === "paragraph" && !firstNode.content)
  );
}

/**
 * Whether two docs carry the same visible text — the comparison the settings
 * editor persists on (a whitespace-only or formatting-only diff is not a real
 * edit for storage purposes, since the value is normalized to null when its
 * plain text is blank). Used for dirty-checks and the navigation guard so they
 * agree with what {@link docToPlainText}-based normalization actually writes.
 */
export function docsEqualByText(
  a: ProseMirrorDoc | string | null | undefined,
  b: ProseMirrorDoc | string | null | undefined
): boolean {
  return docToPlainText(a).trim() === docToPlainText(b).trim();
}
