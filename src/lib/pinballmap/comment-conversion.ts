import { formatDate } from "~/lib/dates";
import type { ProseMirrorDoc, ProseMirrorNode } from "~/lib/tiptap/types";
import { pinballmapLocationUrl } from "./public-url";

/**
 * Pure helpers for converting an imported Pinball Map comment to an issue
 * (pinballmap spec 7.5; PP-o355.4).
 */

/** Issue titles are capped at 60 characters (`publicIssueSchema`). */
export const ISSUE_TITLE_MAX = 60;

/**
 * Suggest an issue title from a comment: its first line, cut at a word
 * boundary to fit the title limit. The person edits it before converting.
 */
export function suggestIssueTitle(comment: string): string {
  const firstLine =
    comment
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const collapsed = firstLine.replace(/\s+/g, " ");
  if (collapsed.length <= ISSUE_TITLE_MAX) return collapsed;
  const budget = ISSUE_TITLE_MAX - 1; // room for the ellipsis
  // Read one character past the budget so a cut that lands exactly at the end
  // of a word keeps that word.
  const cut = collapsed.slice(0, budget + 1);
  const lastSpace = cut.lastIndexOf(" ");
  // Keep a word boundary unless it would throw away most of the budget.
  const trimmed =
    lastSpace >= budget / 2 ? cut.slice(0, lastSpace) : cut.slice(0, budget);
  return `${trimmed.trimEnd()}…`;
}

export interface ConvertedCommentSource {
  comment: string;
  username: string | null;
  commentedAt: Date;
  locationId: number;
}

/** Display name for a Pinball Map commenter; null is an operator/admin entry. */
export function pinballmapCommenterName(username: string | null): string {
  return username ?? "Pinball Map user";
}

function textParagraph(text: string): ProseMirrorNode {
  const lines = text.split(/\r?\n/);
  const content: ProseMirrorNode[] = [];
  lines.forEach((line, i) => {
    if (line) content.push({ type: "text", text: line });
    if (i < lines.length - 1) content.push({ type: "hardBreak" });
  });
  return content.length > 0
    ? { type: "paragraph", content }
    : { type: "paragraph" };
}

/**
 * The new issue's description: the comment quoted verbatim, then an
 * attribution line linking to the location's Pinball Map listing (spec 9.1 —
 * the issue now displays Pinball Map data).
 */
export function convertedIssueDescription(
  source: ConvertedCommentSource
): ProseMirrorDoc {
  const quoted = source.comment
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map(textParagraph);
  return {
    type: "doc",
    content: [
      {
        type: "blockquote",
        content: quoted.length > 0 ? quoted : [{ type: "paragraph" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Pinball Map comment by ${pinballmapCommenterName(source.username)}, ${formatDate(source.commentedAt)} · `,
          },
          {
            type: "text",
            text: "View on Pinball Map",
            marks: [
              {
                type: "link",
                attrs: { href: pinballmapLocationUrl(source.locationId) },
              },
            ],
          },
        ],
      },
    ],
  };
}
