import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  and,
  count,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

import {
  getOpenIssueCounts,
  getOwnerNamesByMachine,
  McpToolError,
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
 * The WHERE fragment each link state selects.
 *
 * A `Record` keyed by the filter union rather than an if/else chain so that
 * adding a state to {@link PINBALLMAP_FILTERS} without a condition is a type
 * error. A missed branch would silently return the *whole* fleet under a
 * narrowing filter name, with a `total` that looks authoritative
 * (CORE-ARCH-012).
 */
const PINBALLMAP_FILTER_CONDITIONS: Record<PinballmapFilter, SQL | undefined> =
  {
    // Both halves are load-bearing: "no catalog match" alone would keep handing
    // the linking pass the machines someone already decided are not on PBM.
    unlinked: and(
      isNull(machines.pinballmapMachineId),
      eq(machines.pinballmapExcluded, false)
    ),
    linked: isNotNull(machines.pinballmapMachineId),
    excluded: eq(machines.pinballmapExcluded, true),
  };

const listMachinesSchema = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Filter by machine name or initials (case-insensitive substring)."
    ),
  presence: z
    .enum(VALID_MACHINE_PRESENCE_STATUSES)
    .optional()
    .describe("Only machines with this availability status."),
  pinballmap: z
    .enum(PINBALLMAP_FILTERS)
    .optional()
    .describe(
      "Only machines in this PinballMap link state. 'unlinked' = no catalog match yet and not marked as absent from PinballMap (the linking worklist); 'linked' = matched to a catalog title; 'excluded' = deliberately marked as not on PinballMap. Combines with 'search' and 'presence'."
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
    .describe(
      "How many matches to skip, for paging past the limit. Machines are ordered by name, so a stable full listing is offset 0, then offset+limit until 'hasMore' is false."
    ),
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
  if (args.presence) {
    conditions.push(eq(machines.presenceStatus, args.presence));
  }
  if (args.search) {
    const like = `%${args.search}%`;
    conditions.push(
      or(ilike(machines.name, like), ilike(machines.initials, like))
    );
  }

  if (args.pinballmap) {
    conditions.push(PINBALLMAP_FILTER_CONDITIONS[args.pinballmap]);
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
      orderBy: (m, { asc }) => [asc(m.name)],
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

export function registerListMachines(server: McpServer): void {
  server.registerTool(
    "list_machines",
    {
      title: "List machines",
      description:
        "List machines with their initials, name, availability, owner name, and open-issue count. Use this to find a machine's initials before acting on it (e.g. disambiguate 'the Medieval Madness by the door'). Supports a name/initials search, a presence filter, and a PinballMap link-state filter (pinballmap: 'unlinked' | 'linked' | 'excluded') — use pinballmap: 'unlinked' to get the machines still needing a PinballMap catalog match. Returns 'count' (this page), 'total' (every match), 'offset', and 'hasMore'. Answer counting questions from 'total', never from 'count' or the array length. To enumerate a collection larger than one page, keep requesting with offset += limit until hasMore is false — raising limit alone caps at 100 and will not reach the rest.",
      inputSchema: listMachinesSchema.shape,
    },
    (args, extra) =>
      runTool("list_machines", extra, (ctx) => runListMachines(args, ctx))
  );
}
