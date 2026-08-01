import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, ilike, or } from "drizzle-orm";
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
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum machines to return (default 50)."),
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

  const rows = await db.query.machines.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    columns: {
      id: true,
      initials: true,
      name: true,
      presenceStatus: true,
      ownerId: true,
      invitedOwnerId: true,
    },
    orderBy: (m, { asc }) => [asc(m.name)],
    limit: args.limit ?? 50,
  });

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

  return { result: { count: machineList.length, machines: machineList } };
}

export function registerListMachines(server: McpServer): void {
  server.registerTool(
    "list_machines",
    {
      title: "List machines",
      description:
        "List machines with their initials, name, availability, owner name, and open-issue count. Use this to find a machine's initials before acting on it (e.g. disambiguate 'the Medieval Madness by the door'). Supports a name/initials search and a presence filter.",
      inputSchema: listMachinesSchema.shape,
    },
    (args, extra) =>
      runTool("list_machines", extra, (ctx) => runListMachines(args, ctx))
  );
}
