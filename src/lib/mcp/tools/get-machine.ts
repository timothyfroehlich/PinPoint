import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { OPEN_STATUSES } from "~/lib/issues/status";
import { checkPermission } from "~/lib/permissions/helpers";
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";

import {
  getOwnerNamesByMachine,
  issueUrl,
  machineUrl,
  McpToolError,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const getMachineSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  openIssueLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum recent open issues to include (default 10)."),
});

type GetMachineArgs = z.infer<typeof getMachineSchema>;

export async function runGetMachine(
  args: GetMachineArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("machines.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view machines.");
  }

  const machine = await resolveMachine(args.machine);
  const ownerNames = await getOwnerNamesByMachine([machine]);

  const openIssues = await db.query.issues.findMany({
    where: and(
      eq(issues.machineInitials, machine.initials),
      inArray(issues.status, [...OPEN_STATUSES])
    ),
    columns: {
      issueNumber: true,
      title: true,
      severity: true,
      status: true,
      createdAt: true,
    },
    orderBy: (i, { desc }) => [desc(i.createdAt)],
    limit: args.openIssueLimit ?? 10,
  });

  return {
    result: {
      initials: machine.initials,
      name: machine.name,
      presence: machine.presenceStatus,
      owner: ownerNames.get(machine.id) ?? null,
      url: machineUrl(machine.initials),
      openIssues: openIssues.map((i) => ({
        number: i.issueNumber,
        title: i.title,
        severity: i.severity,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        url: issueUrl(machine.initials, i.issueNumber),
      })),
    },
    machineId: machine.id,
  };
}

export function registerGetMachine(server: McpServer): void {
  server.registerTool(
    "get_machine",
    {
      title: "Get machine detail",
      description:
        "Get one machine's detail — name, initials, availability, owner name, and its recent open issues (each with number, title, severity, status, and URL). Identify the machine by initials or UUID.",
      inputSchema: getMachineSchema.shape,
    },
    (args, extra) =>
      runTool("get_machine", extra, (ctx) => runGetMachine(args, ctx))
  );
}
