import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import { dispatchNotification, type DeliveryPlan } from "~/lib/notifications";
import { reportError } from "~/lib/observability/report-error";
import { checkPermission } from "~/lib/permissions/helpers";
import {
  assignIssue,
  updateIssueFrequency,
  updateIssuePriority,
  updateIssueSeverity,
  updateIssueStatus,
  updateIssueTitle,
} from "~/services/issues";

import {
  issueUrl,
  McpToolError,
  resolveAssignee,
  resolveIssue,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/**
 * Fixed apply order, so a partial application is reproducible rather than
 * depending on the order the caller happened to pass arguments in.
 */
const UPDATABLE_FIELDS = [
  "title",
  "status",
  "severity",
  "frequency",
  "priority",
  "assignee",
] as const;

type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

/**
 * Which matrix permission each field requires.
 *
 * `issues.update.reporting` covers what a reporter naturally owns — title,
 * status, severity, frequency. `issues.update.triage` is the organizational
 * half — priority and assignee. One blanket check for the whole tool would
 * either deny a legitimate status change or hand out triage rights along with
 * it.
 *
 * Both are checked with the caller's access level ALONE, no `OwnershipContext`.
 * The matrix grants guests `"own"` on `issues.update.reporting`, and
 * `checkPermission` resolves any conditional value to `false` without a
 * context — so a guest is denied both halves here, not just triage. That is the
 * intended reading of this surface rather than an oversight: the MCP caller is
 * a bearer token acting for one operator, not a person browsing an issue they
 * filed, and there is no request-scoped reporter identity to compare against.
 * It fails closed, and the door already requires admin.
 *
 * A `Record` keyed by the field union, so a field added to
 * {@link UPDATABLE_FIELDS} without a permission decision fails to compile
 * (CORE-ARCH-008).
 */
export const UPDATE_FIELD_PERMISSIONS: Record<UpdatableField, string> = {
  title: "issues.update.reporting",
  status: "issues.update.reporting",
  severity: "issues.update.reporting",
  frequency: "issues.update.reporting",
  priority: "issues.update.triage",
  assignee: "issues.update.triage",
};

const updateIssueSchema = z.object({
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
  title: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("New title for the issue."),
  status: z
    .enum(ISSUE_STATUS_VALUES)
    .optional()
    .describe(
      "New status. Open: new, confirmed, wait_owner, in_progress, need_parts, need_help. Closed: fixed, wont_fix, wai, no_repro, duplicate."
    ),
  severity: z
    .enum(["cosmetic", "minor", "major", "unplayable"])
    .optional()
    .describe(
      "How much it affects play: cosmetic, minor, major, or unplayable."
    ),
  frequency: z
    .enum(["intermittent", "frequent", "constant"])
    .optional()
    .describe("How often it happens: intermittent, frequent, or constant."),
  priority: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe("Work priority: low, medium, or high."),
  assignee: z
    .string()
    .trim()
    .optional()
    .describe(
      "Member to assign, as a full name ('First Last') or UUID. Pass an empty string to unassign. Guests and invited users cannot be assigned."
    ),
});

type UpdateIssueArgs = z.infer<typeof updateIssueSchema>;

/** One field's outcome, reported whether or not the value actually moved. */
interface FieldChange {
  field: UpdatableField;
  from: string | null;
  to: string | null;
  changed: boolean;
}

export async function runUpdateIssue(
  args: UpdateIssueArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  const supplied = UPDATABLE_FIELDS.filter((f) => args[f] !== undefined);
  if (supplied.length === 0) {
    throw new McpToolError(
      "invalid",
      "Supply at least one field to change: title, status, severity, frequency, priority, or assignee."
    );
  }

  // Only the fields actually supplied are gated. A blanket check would deny a
  // status-only call for lacking triage rights it never uses.
  for (const field of supplied) {
    if (!checkPermission(UPDATE_FIELD_PERMISSIONS[field], ctx.accessLevel)) {
      throw new McpToolError(
        "denied",
        `You cannot change an issue's ${field}.`
      );
    }
  }

  const issue = await resolveIssue(args.machine, args.number);

  // Resolved BEFORE the apply loop: an unknown assignee is a caller error, and
  // failing it here means no field has been written yet, so the whole call
  // fails cleanly rather than partially.
  const assigneeId =
    args.assignee === undefined
      ? undefined
      : await resolveAssignee(args.assignee);

  const applied: FieldChange[] = [];
  const plans: DeliveryPlan[] = [];
  let failure: { field: UpdatableField; reason: string } | null = null;

  for (const field of supplied) {
    try {
      switch (field) {
        case "title": {
          const result = await updateIssueTitle({
            issueId: issue.id,
            title: args.title ?? issue.title,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: result.oldTitle,
            to: result.newTitle,
            changed: result.oldTitle !== result.newTitle,
          });
          break;
        }
        case "status": {
          const result = await updateIssueStatus({
            issueId: issue.id,
            status: args.status ?? issue.status,
            userId: ctx.userId,
          });
          plans.push(result.deliveryPlan);
          applied.push({
            field,
            from: result.oldStatus,
            to: result.newStatus,
            changed: result.oldStatus !== result.newStatus,
          });
          break;
        }
        case "severity": {
          const result = await updateIssueSeverity({
            issueId: issue.id,
            severity: args.severity ?? issue.severity,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: result.oldSeverity,
            to: result.newSeverity,
            changed: result.oldSeverity !== result.newSeverity,
          });
          break;
        }
        case "frequency": {
          const result = await updateIssueFrequency({
            issueId: issue.id,
            frequency: args.frequency ?? issue.frequency,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: result.oldFrequency,
            to: result.newFrequency,
            changed: result.oldFrequency !== result.newFrequency,
          });
          break;
        }
        case "priority": {
          const result = await updateIssuePriority({
            issueId: issue.id,
            priority: args.priority ?? issue.priority,
            userId: ctx.userId,
          });
          applied.push({
            field,
            from: result.oldPriority,
            to: result.newPriority,
            changed: result.oldPriority !== result.newPriority,
          });
          break;
        }
        case "assignee": {
          const next = assigneeId ?? null;
          const result = await assignIssue({
            issueId: issue.id,
            assignedTo: next,
            actorId: ctx.userId,
          });
          plans.push(result.deliveryPlan);
          // `from`/`changed` come from the service, NOT from the `issue`
          // snapshot read before the loop. assignIssue no-ops when the row
          // already holds `next`, so a snapshot comparison would report this
          // call as the one that made the change whenever another writer got
          // there first (CORE-ARCH-012).
          applied.push({
            field,
            from: result.oldAssignedTo,
            to: next,
            changed: result.changed,
          });
          break;
        }
      }
    } catch (error) {
      // Handled the way `runTool` handles an error it catches itself: reported
      // to Sentry, and reduced to a message that carries no driver or Postgres
      // text. runTool never sees this one — the call still returns a success
      // payload, because the fields before it are written — so the reporting
      // has to happen here or a recurring partial write produces no events at
      // all. An McpToolError's message is already user-facing and curated, so
      // it passes through as-is.
      if (error instanceof McpToolError) {
        failure = { field, reason: error.message };
      } else {
        reportError(error, {
          action: "mcp.tool.update_issue",
          userId: ctx.userId,
        });
        failure = {
          field,
          reason: `Changing ${field} failed. The failure has been logged.`,
        };
      }
      break;
    }
  }

  // Dispatch only what actually committed, and only after the loop — never
  // inside a service's transaction (CORE-ARCH-011).
  after(() => Promise.all(plans.map((plan) => dispatchNotification(plan))));

  const outcome: ToolOutcome = {
    result: {
      machine: issue.machineInitials,
      number: issue.issueNumber,
      url: issueUrl(issue.machineInitials, issue.issueNumber),
      applied,
      // Each field commits in its own transaction, so a mid-loop failure leaves
      // the earlier fields WRITTEN. Returning a blanket error would tell the
      // caller nothing landed when some of it did, so this stays a success
      // payload that names what failed (CORE-ARCH-012).
      ...(failure ? { partial: true, failed: failure } : { partial: false }),
    },
    issueId: issue.id,
  };
  if (failure) {
    // A success payload, but not a successful call — the audit line says so.
    outcome.auditOutcome = "error";
    outcome.auditReason = `partial:${failure.field}`;
  }
  return outcome;
}

export function registerUpdateIssue(server: McpServer): void {
  server.registerTool(
    "update_issue",
    {
      title: "Update an issue",
      description:
        "Change one or more fields on an issue: title, status, severity, frequency, priority, or assignee. Identify the issue by machine (initials or UUID) plus the issue number shown in its URL. Supply only the fields you want to change; at least one is required. The response returns 'applied' — one entry per field with 'from', 'to', and 'changed', where changed:false means the issue already held that value and nothing was written. Fields are applied one at a time and are NOT a single transaction: if one fails, the fields before it stay written and the response comes back with 'partial': true plus 'failed' naming the field that stopped it. Read 'applied' rather than assuming the whole call landed.",
      inputSchema: updateIssueSchema.shape,
    },
    (args, extra) =>
      runTool("update_issue", extra, (ctx) => runUpdateIssue(args, ctx))
  );
}
