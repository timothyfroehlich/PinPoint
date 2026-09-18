import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import {
  and,
  count,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import {
  VALID_MACHINE_PRESENCE_STATUSES,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

import {
  getOpenIssueCounts,
  getOwnerNamesByMachine,
  McpToolError,
  READ_ONLY_TOOL_ANNOTATIONS,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/** Page size when the caller doesn't ask for one. */
const DEFAULT_LIMIT = 50;

/**
 * PinballMap link states a caller can filter on (PP-u4ab.9).
 *
 * These three partition the fleet exactly: a DB CHECK
 * (`machines_pinballmap_link_exclusive`) forbids a row that is both linked and
 * excluded, so every machine is in exactly one bucket.
 *
 * `unlinked` is the one that matters for the fleet linking pass (PP-h059): it is
 * the *worklist*, so it must exclude machines deliberately marked as not on
 * PinballMap. Those are finished work, not a to-do — folding them in would make
 * the pass re-examine the same rows on every sweep and never reach empty.
 */
const PINBALLMAP_FILTERS = ["unlinked", "linked", "excluded"] as const;

type PinballmapFilter = (typeof PINBALLMAP_FILTERS)[number];

/**
 * The WHERE fragments each link state selects, ANDed into the shared condition
 * list by the caller.
 *
 * A `Record` keyed by the filter union rather than an if/else chain, so a state
 * added to {@link PINBALLMAP_FILTERS} without a condition fails to compile. The
 * failure it guards against is a narrowing filter name that narrows nothing:
 * the *whole* fleet returned under `pinballmap: "unlinked"`, with a `total` that
 * looks authoritative (CORE-ARCH-012).
 *
 * The value type is a NON-EMPTY tuple of bare `SQL`, which is what makes that
 * guarantee real rather than merely stated. Two weaker shapes both type-check
 * while contributing zero predicates to `and(...conditions)`, and both produce
 * exactly the whole-fleet answer above: `SQL | undefined` (what `and()` itself
 * returns) and an empty `SQL[]`. Neither is expressible here.
 */
const PINBALLMAP_FILTER_CONDITIONS: Record<PinballmapFilter, [SQL, ...SQL[]]> =
  {
    // Both halves are load-bearing: "no catalog match" alone would keep handing
    // the linking pass the machines someone already decided are not on PBM.
    unlinked: [
      isNull(machines.pinballmapMachineId),
      eq(machines.pinballmapExcluded, false),
    ],
    linked: [isNotNull(machines.pinballmapMachineId)],
    excluded: [eq(machines.pinballmapExcluded, true)],
  };

/**
 * `presence` takes a SET, not a single value (PP-u4ab.13).
 *
 * A single value cannot express the question the fleet linking pass (PP-h059)
 * actually runs on: "unlinked AND still plausibly in the collection". Without
 * it, `pinballmap: "unlinked"` also returns the cabinets that are `removed` or
 * `pending_arrival` — rows nobody will ever link, which therefore sit in every
 * page of that filter forever and hold `total` above zero permanently. The
 * model was left to notice and skip them by hand on each page.
 *
 * The single-value form is kept, not deprecated: it is what every existing
 * caller sends, and `presence: "off_the_floor"` stays the natural way to ask a
 * one-state question.
 *
 * `.min(1)` on the array is deliberate. An empty set would type-check, produce
 * `inArray(col, [])` — a predicate matching nothing — and hand back
 * `total: 0` for the whole collection, which reads as an authoritative "there
 * are none" rather than as the malformed filter it is (CORE-ARCH-012). Zod
 * rejects it instead.
 */
const presenceFilterSchema = z.union([
  z.enum(VALID_MACHINE_PRESENCE_STATUSES),
  z.array(z.enum(VALID_MACHINE_PRESENCE_STATUSES)).min(1),
]);

type PresenceFilter = z.infer<typeof presenceFilterSchema>;

function resolvePresence(filter: PresenceFilter): MachinePresenceStatus[] {
  return Array.isArray(filter) ? filter : [filter];
}

/** Exported for the schema-level tests; the tool registers this same object. */
export const listMachinesSchema = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Filter by machine name or initials (case-insensitive substring)."
    ),
  presence: presenceFilterSchema
    .optional()
    .describe(
      "Which availability statuses to include: a single status or an array of statuses (on_the_floor, off_the_floor, on_loan, pending_arrival, removed)."
    ),
  pinballmap: z
    .enum(PINBALLMAP_FILTERS)
    .optional()
    .describe(
      "Filter by PinballMap link state: 'unlinked' (no catalog match and not excluded), 'linked' (matched to catalog), or 'excluded' (marked not on PinballMap)."
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe(
      `Maximum machines to return (default ${DEFAULT_LIMIT}, max 100). The response reports the matching 'total' and 'hasMore' so you can tell a full list from a truncated page.`
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of matches to skip for pagination."),
});

type ListMachinesArgs = z.infer<typeof listMachinesSchema>;

export async function runListMachines(
  args: ListMachinesArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("machines.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view machines.");
  }

  const conditions = [];
  if (args.presence !== undefined) {
    // `inArray` for both forms — the single value is normalised to a one-element
    // set rather than kept on a separate `eq` path, so there is one condition to
    // keep in step with the count query instead of two (PP-u4ab.13).
    conditions.push(
      inArray(machines.presenceStatus, resolvePresence(args.presence))
    );
  }
  if (args.search) {
    const like = `%${args.search}%`;
    conditions.push(
      or(ilike(machines.name, like), ilike(machines.initials, like))
    );
  }

  if (args.pinballmap) {
    conditions.push(...PINBALLMAP_FILTER_CONDITIONS[args.pinballmap]);
  }

  // One WHERE for both the page and the count — a filter applied to only one of
  // them reports a total the page can never reach (CORE-ARCH-012).
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = args.limit ?? DEFAULT_LIMIT;
  const offset = args.offset ?? 0;

  // Count alongside the page so the caller can tell a complete answer from a
  // truncated one. Without this a 50-machine page of a 120-machine collection
  // reads as "there are 50", and the model answers "how many are off the floor"
  // wrongly with no way to know it was cut off (CORE-ARCH-012 honest failure).
  const [rows, totalRows] = await Promise.all([
    db.query.machines.findMany({
      where,
      columns: {
        id: true,
        initials: true,
        name: true,
        presenceStatus: true,
        ownerId: true,
        invitedOwnerId: true,
      },
      // `initials` breaks ties on `name`, and it is unique (it is the FK target
      // for issues.machineInitials), so this is a TOTAL order. Sorting on name
      // alone leaves rows with equal names in an order Postgres is free to vary
      // between queries — and paging by offset issues one query per page. The
      // collection has duplicate same-title cabinets on purpose, so two
      // "Medieval Madness" straddling a page boundary could come back twice
      // while a third machine is never returned at all: a sweep that reports
      // itself complete while silently skipping a machine (CORE-ARCH-012).
      orderBy: (m, { asc }) => [asc(m.name), asc(m.initials)],
      limit,
      offset,
    }),
    db.select({ value: count() }).from(machines).where(where),
  ]);
  const total = totalRows[0]?.value ?? 0;

  const [ownerNames, openCounts] = await Promise.all([
    getOwnerNamesByMachine(rows),
    getOpenIssueCounts(rows.map((r) => r.initials)),
  ]);

  const machineList = rows.map((r) => ({
    initials: r.initials,
    name: r.name,
    presence: r.presenceStatus,
    owner: ownerNames.get(r.id) ?? null,
    openIssues: openCounts.get(r.initials) ?? 0,
  }));

  return {
    result: {
      count: machineList.length,
      total,
      offset,
      hasMore: offset + machineList.length < total,
      machines: machineList,
    },
  };
}

/**
 * Offset paging over a mutating result set.
 *
 * Offset paging is only coherent over a result set that holds still, and the MCP
 * surface can move it: `set_machine_availability` writes `presenceStatus` (the
 * `presence` filter), `set_machine_name` writes `name` (both the `search` target
 * and the primary sort key), and `add_machine` inserts rows that can land inside
 * any filter.
 */
export function registerListMachines(server: McpServer): void {
  server.registerTool(
    "list_machines",
    {
      title: "List machines",
      description:
        "List machines with initials, name, availability (presence), owner name, and open-issue count. Supports search by name/initials, presence filtering, and PinballMap link-state filtering ('unlinked' | 'linked' | 'excluded'). Returns paginated results with total count and hasMore.",
      inputSchema: listMachinesSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool("list_machines", extra, (ctx) => runListMachines(args, ctx))
  );
}
