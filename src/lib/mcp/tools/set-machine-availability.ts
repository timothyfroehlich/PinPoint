import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { updateMachinePresence } from "~/services/machines";

import {
  machineUrl,
  McpToolError,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const setAvailabilitySchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  presence: z
    .enum(VALID_MACHINE_PRESENCE_STATUSES)
    .describe(
      "New availability: on_the_floor, off_the_floor, on_loan, pending_arrival, or removed."
    ),
});

type SetAvailabilityArgs = z.infer<typeof setAvailabilitySchema>;

export async function runSetMachineAvailability(
  args: SetAvailabilityArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  const machine = await resolveMachine(args.machine);

  if (
    !checkPermission("machines.edit", ctx.accessLevel, {
      userId: ctx.userId,
      machineOwnerId: machine.ownerId,
    })
  ) {
    throw new McpToolError(
      "denied",
      "Only the machine owner, technicians, or admins can change availability."
    );
  }

  const { changed } = await updateMachinePresence({
    machineId: machine.id,
    presenceStatus: args.presence,
    actorUserId: ctx.userId,
    current: {
      name: machine.name,
      ownerId: machine.ownerId,
      invitedOwnerId: machine.invitedOwnerId,
      presenceStatus: machine.presenceStatus,
    },
  });

  return {
    result: {
      initials: machine.initials,
      name: machine.name,
      presence: args.presence,
      changed,
      url: machineUrl(machine.initials),
    },
    machineId: machine.id,
  };
}

export function registerSetMachineAvailability(server: McpServer): void {
  server.registerTool(
    "set_machine_availability",
    {
      title: "Set machine availability",
      description:
        "Change a machine's availability (presence). Statuses: on_the_floor, off_the_floor, on_loan, pending_arrival, removed. Identify the machine by initials or UUID. No-op if already at that status.",
      inputSchema: setAvailabilitySchema.shape,
    },
    (args, extra) =>
      runTool("set_machine_availability", extra, (ctx) =>
        runSetMachineAvailability(args, ctx)
      )
  );
}
