import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
      "Which statuses to include: 'open' (the default), 'closed', one status, or an array of statuses. Open statuses are new, confirmed, wait_owner, in_progress, need_parts, need_help. Closed are fixed, wont_fix, wai, no_repro, duplicate."
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
    .describe(
      "How many matches to skip. Issues come back newest first, with machine initials and issue number breaking ties — a total order, so separate requests agree about where a page boundary falls, for as long as the underlying rows don't change. Whether you should advance this offset at all depends on whether your own calls change what matches; the tool description has the rule."
    ),
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
 * Why the description repeats `list_machines`' drain procedure.
 *
 * Offset paging is coherent only over a result set that holds still, and
 * `update_issue` writes every field this tool filters on — `status` (which is
 * also the DEFAULT filter), `severity`, and `assignee`. Working a filtered
 * worklist while paging it is the normal use here rather than an edge case, so
 * the failure sits on the common path: each issue actioned leaves the filter,
 * the rest shift up, and `offset += limit` steps over exactly the ones that
 * moved.
 *
 * Stated once in the description, for the model that has to follow it; this
 * comment is the rationale, not a second copy.
 */
export function registerListIssues(server: McpServer): void {
  server.registerTool(
    "list_issues",
    {
      title: "List issues",
      description:
        "Find issues across the whole collection, or on one machine. Every row carries the machine initials and issue number you need to act on it with get_issue, add_issue_comment, or update_issue. Filters: machine, status ('open' by default, or 'closed', or a specific set like ['need_parts','need_help']), severity, and assignee. Returns 'count' (this page), 'total' (every match), 'offset', and 'hasMore'. Answer counting questions from 'total', never from 'count' or the array length. To enumerate more than one page, keep requesting with offset += limit until hasMore is false — raising limit alone caps at 100 and will not reach the rest. That works only while the matching set holds still, and your own calls move it: update_issue changes status, severity, and assignee, which are exactly the filters here. So if you are ACTING on the issues as you page them — 'triage every new issue', 'close everything already fixed' — do NOT advance the offset. Each issue you action leaves the filter and the rest shift up, so offset += limit steps over exactly as many issues as you just handled, and the sweep ends on hasMore:false having never shown them. Re-request offset 0 and let the list drain instead. Raise offset only past issues you deliberately left unchanged, so they don't keep coming back. You are done when a request returns EMPTY (count 0), NOT when total reaches 0 — issues you left unchanged hold total above 0 forever.",
      inputSchema: listIssuesSchema.shape,
    },
    (args, extra) =>
      runTool("list_issues", extra, (ctx) => runListIssues(args, ctx))
  );
}
