/**
 * ProseMirror JSON document types for Tiptap editor content.
 *
 * These types represent the serialized form of editor content
 * stored in JSONB columns.
 */

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
export function extractMentions(doc: ProseMirrorDoc): string[] {
  const ids = new Set<string>();

  function walk(nodes: ProseMirrorNode[]): void {
    for (const node of nodes) {
      if (node.type === "mention" && typeof node.attrs?.["id"] === "string") {
        ids.add(node.attrs["id"]);
      }
      if (node.content) {
        walk(node.content);
      }
    }
  }

  walk(doc.content);
  return Array.from(ids);
}

/**
 * Extract plain text from a ProseMirror document (for search, truncation, etc.).
 */
export function docToPlainText(doc: ProseMirrorDoc): string {
  const parts: string[] = [];

  function walk(nodes: ProseMirrorNode[]): void {
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

  walk(doc.content);

  return parts.join("").trim();
}
