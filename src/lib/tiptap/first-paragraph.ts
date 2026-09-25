import type { ProseMirrorDoc, ProseMirrorNode } from "./types";

/**
 * Extract the first paragraph's plain text from a ProseMirrorDoc.
 * Strips all formatting marks. Joins hard breaks with spaces.
 * Handles legacy plain-text string values.
 */
export function extractFirstParagraph(
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

  // Find the first paragraph node
  const firstParagraph = validDoc.content.find(
    (node) => node.type === "paragraph"
  );
  if (!firstParagraph?.content) return "";

  return extractTextFromNodes(firstParagraph.content).trim();
}

/**
 * Extract plain text from ProseMirror nodes,
 * ignoring all marks (bold, italic, links, etc.).
 * Handles text, mentions, and hard breaks in the given node array.
 */
function extractTextFromNodes(nodes: ProseMirrorNode[]): string {
  const parts: string[] = [];

  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      parts.push(node.text);
    } else if (
      node.type === "mention" &&
      typeof node.attrs?.["label"] === "string"
    ) {
      parts.push(`@${node.attrs["label"]}`);
    } else if (node.type === "hardBreak") {
      parts.push(" ");
    }
  }

  return parts.join("");
}
