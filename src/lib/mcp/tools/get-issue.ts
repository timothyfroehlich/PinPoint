import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { docToPlainText, type ProseMirrorDoc } from "~/lib/tiptap/types";
import { db } from "~/server/db";
import { issueComments, userProfiles } from "~/server/db/schema";

import {
  issueUrl,
  McpToolError,
  resolveIssue,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/** Comments returned when the caller doesn't ask for a specific limit. */
const DEFAULT_COMMENT_LIMIT = 20;

/** The comment slice returned to the caller, plus the full thread length. */
interface CommentWindow {
  rows: {
    content: ProseMirrorDoc | null;
    createdAt: Date;
    author: { name: string } | null;
  }[];
  total: number;
}

const getIssueSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  number: z
    .number()
    .int()
    .min(1)
    .describe("The issue number within that machine, as shown in its URL."),
  commentLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      `How many of the MOST RECENT comments to include (default ${DEFAULT_COMMENT_LIMIT}, max 100). They are returned oldest-first within that window. 'commentCount' reports the full thread length and 'commentsTruncated' says whether older comments were left out.`
    ),
});

type GetIssueArgs = z.infer<typeof getIssueSchema>;

export async function runGetIssue(
  args: GetIssueArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("issues.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view issues.");
  }

  const issue = await resolveIssue(args.machine, args.number);

  // Names, never emails (CORE-SEC-007). One query for both people; `reporterName`
  // is the stored display name for anonymous and invited reporters and is the
  // fallback when no profile is linked.
  const profileIds = [issue.reportedBy, issue.assignedTo].filter(
    (id): id is string => id !== null
  );
  const profiles =
    profileIds.length > 0
      ? await db.query.userProfiles.findMany({
          where: inArray(userProfiles.id, profileIds),
          columns: { id: true, name: true },
        })
      : [];
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));

  // The thread is a separate permission from the issue body. Omitting it beats
  // denying the whole call — the issue itself is still readable. When it IS
  // omitted the payload says so (`commentsWithheld` below), because an empty
  // `comments` with `commentCount: 0` is otherwise the same answer as an issue
  // nobody has commented on (CORE-ARCH-012).
  //
  // The matrix grants `comments.view` at every access level including
  // unauthenticated, so this is false nowhere today and there is no test that
  // exercises the withheld branch. The check stays because the alternative is a
  // surface that silently keeps returning the thread if that ever changes.
  const canReadComments = checkPermission("comments.view", ctx.accessLevel);
  const commentWhere = and(
    eq(issueComments.issueId, issue.id),
    // System rows carry `eventData`, not prose. Rendering them into readable
    // history is real work for marginal value: the transitions they describe
    // are already visible as the issue's current state.
    eq(issueComments.isSystem, false)
  );
  const commentLimit = args.commentLimit ?? DEFAULT_COMMENT_LIMIT;

  // Newest-first with the limit, then reversed for display: the WINDOW is the
  // tail of the thread, not its head. Selecting `asc` + `limit` instead would
  // return the OLDEST N and drop the newest — on a long thread, hiding exactly
  // the comments that say what has been done about the issue, from a tool whose
  // whole job is to be read before commenting or updating.
  //
  // `commentCount` is the full thread length, so a truncated window is
  // detectable rather than passing for the whole thread (CORE-ARCH-012).
  const loadComments = async (): Promise<CommentWindow> => {
    const [newestFirst, countRows] = await Promise.all([
      db.query.issueComments.findMany({
        where: commentWhere,
        columns: { content: true, createdAt: true },
        with: { author: { columns: { name: true } } },
        // `id` breaks ties on `createdAt` for the same reason `list_issues`
        // orders on a total key: with `createdAt` alone, two comments sharing a
        // timestamp sit in an order Postgres is free to vary, and the LIMIT
        // falls between them — so the window can drop one comment and the next
        // call can show a different one, from a tool whose job is to be read
        // before acting (CORE-ARCH-012).
        orderBy: (c, { desc }) => [desc(c.createdAt), desc(c.id)],
        limit: commentLimit,
      }),
      db.select({ value: count() }).from(issueComments).where(commentWhere),
    ]);
    return {
      rows: [...newestFirst].reverse(),
      total: countRows[0]?.value ?? 0,
    };
  };
  const { rows: commentRows, total: commentCount } = canReadComments
    ? await loadComments()
    : { rows: [], total: 0 };

  return {
    result: {
      machine: issue.machineInitials,
      number: issue.issueNumber,
      title: issue.title,
      description: docToPlainText(issue.description),
      status: issue.status,
      severity: issue.severity,
      priority: issue.priority,
      frequency: issue.frequency,
      reporter:
        (issue.reportedBy ? nameById.get(issue.reportedBy) : null) ??
        issue.reporterName ??
        "Anonymous",
      assignee:
        (issue.assignedTo ? nameById.get(issue.assignedTo) : null) ?? null,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      closedAt: issue.closedAt?.toISOString() ?? null,
      url: issueUrl(issue.machineInitials, issue.issueNumber),
      commentCount,
      commentsTruncated: commentRows.length < commentCount,
      // Present only when the thread was withheld, so the ordinary response
      // does not carry a permanently-false field.
      ...(canReadComments ? {} : { commentsWithheld: true }),
      comments: commentRows.map((c) => ({
        author: c.author?.name ?? "Anonymous",
        text: docToPlainText(c.content),
        createdAt: c.createdAt.toISOString(),
      })),
    },
    issueId: issue.id,
  };
}

export function registerGetIssue(server: McpServer): void {
  server.registerTool(
    "get_issue",
    {
      title: "Get issue detail",
      description:
        "Get one issue in full — title, description, status, severity, priority, frequency, reporter and assignee names, timestamps, URL, and the comment thread. Identify it by machine (initials or UUID) plus the issue number shown in its URL and returned by list_issues, get_machine, and create_issue. Use this before commenting or updating, so you are acting on the issue you think you are. The thread returns the MOST RECENT comments (20 by default, up to 100 via commentLimit), listed oldest-first within that window; 'commentCount' is the full thread length and 'commentsTruncated' is true when older comments were left out, so raise commentLimit if you need the earlier history. Timeline/system rows are not included in the thread; the issue's current status is what they would describe.",
      inputSchema: getIssueSchema.shape,
    },
    (args, extra) =>
      runTool("get_issue", extra, (ctx) => runGetIssue(args, ctx))
  );
}
