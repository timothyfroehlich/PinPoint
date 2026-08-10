import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { docToPlainText } from "~/lib/tiptap/types";
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

/** Comments returned when the caller doesn't ask for a count. */
const DEFAULT_COMMENT_LIMIT = 20;

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
      `Maximum comments to include, oldest first (default ${DEFAULT_COMMENT_LIMIT}).`
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
  // denying the whole call — the issue itself is still readable.
  const canReadComments = checkPermission("comments.view", ctx.accessLevel);
  const commentRows = canReadComments
    ? await db.query.issueComments.findMany({
        where: and(
          eq(issueComments.issueId, issue.id),
          // System rows carry `eventData`, not prose. Rendering them into
          // readable history is real work for marginal value: the transitions
          // they describe are already visible as the issue's current state.
          eq(issueComments.isSystem, false)
        ),
        columns: { content: true, createdAt: true },
        with: { author: { columns: { name: true } } },
        orderBy: (c, { asc }) => [asc(c.createdAt)],
        limit: args.commentLimit ?? DEFAULT_COMMENT_LIMIT,
      })
    : [];

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
        "Get one issue in full — title, description, status, severity, priority, frequency, reporter and assignee names, timestamps, URL, and the comment thread (oldest first). Identify it by machine (initials or UUID) plus the issue number shown in its URL and returned by list_issues, get_machine, and create_issue. Use this before commenting or updating, so you are acting on the issue you think you are. Timeline/system rows are not included in the thread; the issue's current status is what they would describe.",
      inputSchema: getIssueSchema.shape,
    },
    (args, extra) =>
      runTool("get_issue", extra, (ctx) => runGetIssue(args, ctx))
  );
}
