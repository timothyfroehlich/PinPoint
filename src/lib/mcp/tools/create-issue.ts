import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { plainTextToDoc } from "~/lib/tiptap/types";
import {
  ISSUE_FREQUENCY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
} from "~/lib/types";
import { createIssue } from "~/services/issues";

import {
  contentAddressedUuid,
  issueUrl,
  McpToolError,
  resolveMachine,
  retryWindowPart,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const createIssueSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID to file against."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200)
    .describe("Short summary of the problem."),
  description: z
    .string()
    .trim()
    .optional()
    .describe(
      "Optional plain-text detail; converted to the app's rich format."
    ),
  severity: z
    .enum(ISSUE_SEVERITY_VALUES)
    .optional()
    .describe("How bad it is (default minor)."),
  priority: z
    .enum(ISSUE_PRIORITY_VALUES)
    .optional()
    .describe("Triage priority (default medium)."),
  frequency: z
    .enum(ISSUE_FREQUENCY_VALUES)
    .optional()
    .describe("How often it happens (default intermittent)."),
});

type CreateIssueArgs = z.infer<typeof createIssueSchema>;

/**
 * Content-addressed idempotency key for one create_issue call.
 *
 * `issues.idempotency_key` is a Postgres `uuid` column, so the digest is
 * rendered as a **UUIDv8** — the RFC 9562 version reserved for custom,
 * implementation-defined layouts, which is what a hash-derived identifier is.
 * (v4 would misrepresent these bits as random; v5 specifically means SHA-1 over
 * a namespace.)
 *
 * Exported for the unit tests that pin the properties that matter: identical
 * calls in one window collide, anything else does not, and the output is always
 * a well-formed v8 UUID.
 */
export function createIssueIdempotencyKey(
  args: CreateIssueArgs,
  userId: string,
  machineId: string,
  now: number
): string {
  return contentAddressedUuid([
    userId,
    machineId,
    args.title,
    args.description ?? "",
    args.severity ?? "",
    args.priority ?? "",
    args.frequency ?? "",
    retryWindowPart(now),
  ]);
}

export async function runCreateIssue(
  args: CreateIssueArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("issues.report", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot report issues.");
  }

  // Accept initials or UUID, and fail clearly if the machine is unknown before
  // reaching the service (which would otherwise throw a generic not-found).
  const machine = await resolveMachine(args.machine);

  const { issue, deliveryPlan, deduped } = await createIssue({
    title: args.title,
    description: args.description ? plainTextToDoc(args.description) : null,
    machineInitials: machine.initials,
    severity: args.severity ?? "minor",
    priority: args.priority,
    frequency: args.frequency,
    reportedBy: ctx.userId,
    idempotencyKey: createIssueIdempotencyKey(
      args,
      ctx.userId,
      machine.id,
      Date.now()
    ),
  });

  after(() => dispatchNotification(deliveryPlan));

  return {
    result: {
      // Whether this call actually filed something. Dedupe makes "your report
      // was recorded" and "an identical report already existed and yours was
      // not written" two different outcomes, and they must not look alike:
      // reporting the pre-existing issue's number as if it were newly filed is
      // exactly the success-for-work-not-done shape CORE-ARCH-012 forbids.
      created: !deduped,
      number: issue.issueNumber,
      title: issue.title,
      machine: machine.initials,
      severity: issue.severity,
      status: issue.status,
      url: issueUrl(machine.initials, issue.issueNumber),
    },
    machineId: machine.id,
    issueId: issue.id,
  };
}

export function registerCreateIssue(server: McpServer): void {
  server.registerTool(
    "create_issue",
    {
      title: "Create issue",
      description:
        "File an issue against a machine (identified by initials or UUID). Requires a title; optional plain-text description, severity (cosmetic/minor/major/unplayable), priority (low/medium/high), and frequency (intermittent/frequent/constant). Attributed to the authenticated admin. Retrying an identical call shortly after one usually resolves to the issue already filed instead of a duplicate — check 'created' in the response: false means nothing new was written and 'number' refers to the pre-existing issue, so report it as already filed rather than as a new one.",
      inputSchema: createIssueSchema.shape,
    },
    (args, extra) =>
      runTool("create_issue", extra, (ctx) => runCreateIssue(args, ctx))
  );
}
