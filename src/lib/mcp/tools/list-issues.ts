import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { and, count, eq, inArray, type SQL } from "drizzle-orm";
import { z } from "zod";

import {
  CLOSED_STATUSES,
  ISSUE_STATUS_VALUES,
  OPEN_STATUSES,
  type IssueStatus,
} from "~/lib/issues/status";
import { checkPermission } from "~/lib/permissions/helpers";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { ISSUE_SEVERITY_VALUES } from "~/lib/types";

import {
  issueUrl,
  McpToolError,
  READ_ONLY_TOOL_ANNOTATIONS,
  resolveAssigneeFilter,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/** Page size when the caller doesn't ask for one. */
const DEFAULT_LIMIT = 50;

/**
 * `status` takes a SET, not a single value.
 *
 * `list_machines` shipped `presence` as one value and immediately needed
 * widening (PP-u4ab.13): a worklist that cannot say "these three states" cannot
 * exclude the rows nobody will ever action, so those rows sit in every page of
 * the filter forever and a sweep never reaches empty. The same failure applies
 * here, so the set form ships first rather than second.
 */
const statusFilterSchema = z.union([
  z.literal("open"),
  z.literal("closed"),
  z.enum(ISSUE_STATUS_VALUES),
  z.array(z.enum(ISSUE_STATUS_VALUES)).min(1),
]);

type StatusFilter = z.infer<typeof statusFilterSchema>;

function resolveStatuses(filter: StatusFilter | undefined): IssueStatus[] {
  if (filter === undefined || filter === "open") return [...OPEN_STATUSES];
  if (filter === "closed") return [...CLOSED_STATUSES];
  return Array.isArray(filter) ? filter : [filter];
}

const listIssuesSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only issues on this machine (initials or UUID). Omit to search the whole collection."
    ),
  status: statusFilterSchema
    .optional()
    .describe(
      "Which statuses to include: 'open' (default), 'closed', a single status, or an array of statuses."
    ),
  severity: z
    .enum(ISSUE_SEVERITY_VALUES)
    .optional()
    .describe("Only issues at this severity."),
  assignee: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Only issues assigned to this person (full name or UUID). Any user resolves here, including one who can no longer be assigned new work. Note there is no filter for 'unassigned'."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      `Maximum issues to return (default ${DEFAULT_LIMIT}, max 100). The response reports the matching 'total' and 'hasMore' so you can tell a full list from a truncated page.`
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of matches to skip for pagination."),
});

type ListIssuesArgs = z.infer<typeof listIssuesSchema>;

export async function runListIssues(
  args: ListIssuesArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("issues.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view issues.");
  }

  const conditions: SQL[] = [
    inArray(issues.status, resolveStatuses(args.status)),
  ];

  if (args.machine) {
    const machine = await resolveMachine(args.machine);
    conditions.push(eq(issues.machineInitials, machine.initials));
  }
  if (args.severity) {
    conditions.push(eq(issues.severity, args.severity));
  }
  if (args.assignee) {
    // resolveAssigneeFilter, NOT resolveAssignee: this asks who the name refers
    // to, not who may be assigned work. A name that resolves to nobody still
    // throws, so the filter never silently degrades into "no assignee filter" —
    // which would return the whole collection under a filter that narrowed
    // nothing.
    conditions.push(
      eq(issues.assignedTo, await resolveAssigneeFilter(args.assignee))
    );
  }

  // One WHERE for both the page and the count — a filter applied to only one of
  // them reports a total the page can never reach (CORE-ARCH-012).
  const where = and(...conditions);
  const limit = args.limit ?? DEFAULT_LIMIT;
  const offset = args.offset ?? 0;

  const [rows, totalRows] = await Promise.all([
    db.query.issues.findMany({
      where,
      columns: {
        machineInitials: true,
        issueNumber: true,
        title: true,
        status: true,
        severity: true,
        priority: true,
        createdAt: true,
      },
      with: { assignedToUser: { columns: { name: true } } },
      // `machineInitials, issueNumber` break ties on `createdAt`, and together
      // they are unique (`unique_issue_number`), so this is a TOTAL order.
      // Ordering on createdAt alone leaves same-timestamp rows in an order
      // Postgres is free to vary between the separate queries offset paging
      // issues — one issue returned twice while another is never shown at all,
      // a sweep reporting itself complete having skipped an issue
      // (CORE-ARCH-012).
      orderBy: (i, { asc, desc }) => [
        desc(i.createdAt),
        asc(i.machineInitials),
        asc(i.issueNumber),
      ],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(issues).where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const issueList = rows.map((r) => ({
    machine: r.machineInitials,
    number: r.issueNumber,
    title: r.title,
    status: r.status,
    severity: r.severity,
    priority: r.priority,
    assignee: r.assignedToUser?.name ?? null,
    createdAt: r.createdAt.toISOString(),
    url: issueUrl(r.machineInitials, r.issueNumber),
  }));

  return {
    result: {
      count: issueList.length,
      total,
      offset,
      hasMore: offset + issueList.length < total,
      issues: issueList,
    },
  };
}

/**
 * Offset paging over a mutating result set.
 *
 * Offset paging is coherent only over a result set that holds still, and
 * `update_issue` writes every field this tool filters on — `status` (which is
 * also the DEFAULT filter), `severity`, and `assignee`.
 */
export function registerListIssues(server: McpServer): void {
  server.registerTool(
    "list_issues",
    {
      title: "List issues",
      description:
        "List issues across the entire collection or on a specific machine. Supports filtering by machine (initials/UUID), status ('open', 'closed', or specific statuses), severity, and assignee. Returns paginated results with total count and hasMore.",
      inputSchema: listIssuesSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool("list_issues", extra, (ctx) => runListIssues(args, ctx))
  );
}
