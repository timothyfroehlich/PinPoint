import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { createIssue } from "~/services/issues";

import {
  issueUrl,
  McpToolError,
  resolveMachine,
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
    .enum(["cosmetic", "minor", "major", "unplayable"])
    .optional()
    .describe("How bad it is (default minor)."),
  priority: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe("Triage priority (default medium)."),
  frequency: z
    .enum(["intermittent", "frequent", "constant"])
    .optional()
    .describe("How often it happens (default intermittent)."),
});

type CreateIssueArgs = z.infer<typeof createIssueSchema>;

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

  const { issue, deliveryPlan } = await createIssue({
    title: args.title,
    description: args.description ? plainTextToDoc(args.description) : null,
    machineInitials: machine.initials,
    severity: args.severity ?? "minor",
    priority: args.priority,
    frequency: args.frequency,
    reportedBy: ctx.userId,
    // A fresh key per call: this is a new report, not a retried submission.
    idempotencyKey: crypto.randomUUID(),
  });

  after(() => dispatchNotification(deliveryPlan));

  return {
    result: {
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
        "File an issue against a machine (identified by initials or UUID). Requires a title; optional plain-text description, severity (cosmetic/minor/major/unplayable), priority (low/medium/high), and frequency (intermittent/frequent/constant). Attributed to the authenticated admin.",
      inputSchema: createIssueSchema.shape,
    },
    (args, extra) =>
      runTool("create_issue", extra, (ctx) => runCreateIssue(args, ctx))
  );
}
