import { z } from "zod";

/**
 * The most characters an issue title may hold — the same when reporting,
 * editing on the issue page, converting a Pinball Map comment, or writing
 * through MCP (spec issue-detail §4.4). Older titles over the limit are never
 * shortened automatically; they save again only once edited down.
 */
export const ISSUE_TITLE_MAX = 60;

export const ISSUE_TITLE_MAX_MESSAGE = `Title must be ${ISSUE_TITLE_MAX} characters or less`;

/**
 * An issue title is one line. Every run of whitespace or control characters —
 * newlines, CRLF, tabs, NUL and the rest of Unicode `Cc` — becomes a single
 * space, and the ends are trimmed. Collapsed, never rejected (PP-61u5).
 *
 * drizzle/0105_single-line-issue-titles.sql applied the same rule in SQL to
 * the legacy titles that held newlines.
 */
export function normalizeIssueTitle(raw: string): string {
  return raw.replace(/[\s\p{Cc}]+/gu, " ").trim();
}

/**
 * The title field for every issue write path: report forms, the
 * multiple-issues grid, the inline title edit, Pinball Map comment conversion,
 * and the MCP tools. Normalizes first, so the required and length checks see
 * the stored single-line value. Each surface keeps its own wording, so the
 * messages are parameters; omitted ones fall back to Zod's defaults.
 */
export function issueTitleSchema(
  messages: { required?: string; tooLong?: string } = {}
): z.ZodString {
  return z
    .string()
    .overwrite(normalizeIssueTitle)
    .min(1, messages.required)
    .max(ISSUE_TITLE_MAX, messages.tooLong);
}
