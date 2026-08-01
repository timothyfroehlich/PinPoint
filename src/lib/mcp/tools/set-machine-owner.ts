import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { updateMachineOwner } from "~/services/machines";

import {
  getOwnerNamesByMachine,
  machineUrl,
  McpToolError,
  resolveMachine,
  resolveOwner,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const setOwnerSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  owner: z
    .string()
    .trim()
    .optional()
    .describe(
      "New owner: a member's full name ('First Last') or user UUID. Omit or pass an empty string to clear ownership."
    ),
});

type SetOwnerArgs = z.infer<typeof setOwnerSchema>;

export async function runSetMachineOwner(
  args: SetOwnerArgs,
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
      "Only the machine owner, technicians, or admins can change the owner."
    );
  }

  const newOwner = await resolveOwner(args.owner);

  const { deliveryPlan } = await updateMachineOwner({
    machineId: machine.id,
    actorUserId: ctx.userId,
    current: {
      name: machine.name,
      ownerId: machine.ownerId,
      invitedOwnerId: machine.invitedOwnerId,
      presenceStatus: machine.presenceStatus,
    },
    newOwner,
  });

  // Notifications to the removed/added owner are delivered after the commit
  // (CORE-ARCH-011), same as updateMachineAction's owner path.
  after(() => dispatchNotification(deliveryPlan));

  const ownerNames = await getOwnerNamesByMachine([
    {
      id: machine.id,
      ownerId: newOwner.ownerId,
      invitedOwnerId: newOwner.invitedOwnerId,
    },
  ]);

  return {
    result: {
      initials: machine.initials,
      name: machine.name,
      owner: ownerNames.get(machine.id) ?? null,
      url: machineUrl(machine.initials),
    },
    machineId: machine.id,
  };
}

export function registerSetMachineOwner(server: McpServer): void {
  server.registerTool(
    "set_machine_owner",
    {
      title: "Set machine owner",
      description:
        "Set or clear a machine's owner. Identify the machine by initials or UUID; give the owner as a member's full name or UUID, or omit to clear ownership. Guests must be promoted to member first.",
      inputSchema: setOwnerSchema.shape,
    },
    (args, extra) =>
      runTool("set_machine_owner", extra, (ctx) =>
        runSetMachineOwner(args, ctx)
      )
  );
}
