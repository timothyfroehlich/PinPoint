import "server-only";

import { createHash } from "node:crypto";

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

/**
 * How long an identical `create_issue` call is treated as a retry of the same
 * report rather than a second, deliberate one.
 *
 * MCP has no client-supplied idempotency token, so the key is derived from the
 * call itself: same admin, same machine, same field-for-field content, same
 * window. A transport-level retry resends byte-identical arguments and lands on
 * the same key, so the service returns the original issue instead of filing a
 * duplicate.
 *
 * The window is what keeps this from being wrong in the other direction — a
 * genuine re-report of the same fault weeks later ("left flipper weak" after a
 * repair regressed) must file a NEW issue, not silently resolve to the old one.
 * A retry that straddles a window boundary degrades to the previous behaviour
 * (a duplicate), which is the safe direction to fail.
 */
const RETRY_WINDOW_MS = 10 * 60 * 1000;

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
  const parts = [
    userId,
    machineId,
    args.title,
    args.description ?? "",
    args.severity ?? "",
    args.priority ?? "",
    args.frequency ?? "",
    String(Math.floor(now / RETRY_WINDOW_MS)),
  ];
  // NUL-joined so no field's content can impersonate a boundary between two
  // others ("ab" + "c" must not hash the same as "a" + "bc").
  const digest = createHash("sha256").update(parts.join("\u0000")).digest();

  // Take the leading 16 bytes and stamp the version (8) and RFC 4122 variant
  // bits in place, then render the canonical 8-4-4-4-12 form.
  const bytes = digest.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
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

  const { issue, deliveryPlan } = await createIssue({
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
        "File an issue against a machine (identified by initials or UUID). Requires a title; optional plain-text description, severity (cosmetic/minor/major/unplayable), priority (low/medium/high), and frequency (intermittent/frequent/constant). Attributed to the authenticated admin. Safe to retry: repeating the identical call within a few minutes returns the issue already filed rather than a duplicate.",
      inputSchema: createIssueSchema.shape,
    },
    (args, extra) =>
      runTool("create_issue", extra, (ctx) => runCreateIssue(args, ctx))
  );
}
