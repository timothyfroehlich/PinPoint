import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { addIssueComment } from "~/services/issues";

import {
  contentAddressedUuid,
  issueUrl,
  McpToolError,
  resolveIssue,
  retryWindowPart,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const addIssueCommentSchema = z.object({
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
  comment: z
    .string()
    .trim()
    .min(1)
    .max(10_000)
    .describe("The comment text. Plain text — markdown is not rendered."),
});

type AddIssueCommentArgs = z.infer<typeof addIssueCommentSchema>;

/**
 * Content-addressed idempotency key, the same scheme as `create_issue`'s — the
 * digest-to-UUIDv8 rendering and the NUL joining both live in
 * {@link contentAddressedUuid}, so the two tools cannot drift apart on the bits
 * that decide whether a retry collides.
 *
 * Exported for the unit tests that pin the properties that matter: identical
 * calls in one window collide, anything else does not, and the output is always
 * a well-formed v8 UUID.
 */
export function createCommentIdempotencyKey(
  issueId: string,
  comment: string,
  userId: string,
  now: number
): string {
  return contentAddressedUuid([issueId, comment, userId, retryWindowPart(now)]);
}

export async function runAddIssueComment(
  args: AddIssueCommentArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("comments.add", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot comment on issues.");
  }

  const issue = await resolveIssue(args.machine, args.number);

  const { comment, deliveryPlan, deduped } = await addIssueComment({
    issueId: issue.id,
    content: plainTextToDoc(args.comment),
    userId: ctx.userId,
    idempotencyKey: createCommentIdempotencyKey(
      issue.id,
      args.comment,
      ctx.userId,
      Date.now()
    ),
  });

  after(() => dispatchNotification(deliveryPlan));

  return {
    result: {
      // Whether this call actually wrote anything. `deduped` comes from the
      // service explicitly — NOT from an empty delivery plan, which a genuinely
      // new comment also produces when the commenter is the only watcher or no
      // channels are configured. Reporting a real write as "already posted" is
      // the same honest-failure violation as the reverse (CORE-ARCH-012).
      created: !deduped,
      commentId: comment.id,
      machine: issue.machineInitials,
      number: issue.issueNumber,
      url: issueUrl(issue.machineInitials, issue.issueNumber),
    },
    issueId: issue.id,
  };
}

export function registerAddIssueComment(server: McpServer): void {
  server.registerTool(
    "add_issue_comment",
    {
      title: "Comment on an issue",
      description:
        "Post a comment on an issue, attributed to the authenticated user. Identify the issue by machine (initials or UUID) plus the issue number shown in its URL and returned by list_issues, get_machine, and create_issue. Plain text only — markdown is not rendered. Retrying an identical comment shortly after one usually resolves to the comment already posted instead of a duplicate — check 'created' in the response: false means nothing new was written, so report it as already posted rather than as a new comment.",
      inputSchema: addIssueCommentSchema,
    },
    (args, extra) =>
      runTool("add_issue_comment", extra, (ctx) =>
        runAddIssueComment(args, ctx)
      )
  );
}
