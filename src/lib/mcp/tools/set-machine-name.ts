import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { updateMachineName } from "~/services/machines";

import {
  machineUrl,
  McpToolError,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const setNameSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  // Same bounds as the edit form's name field (`updateMachineSchema`).
  name: z
    .string()
    .trim()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters")
    .describe("New display name, 1-100 characters."),
});

type SetNameArgs = z.infer<typeof setNameSchema>;

export async function runSetMachineName(
  args: SetNameArgs,
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
      "Only the machine owner, technicians, or admins can rename this machine."
    );
  }

  // Only `name` moves. `initials` is the FK target for `issues.machineInitials`
  // and the `/m/<initials>` URL segment — renaming it is a cascade plus a link
  // break, so no path in this tool touches it (PP-u4ab.10).
  const { changed } = await updateMachineName({
    machineId: machine.id,
    name: args.name,
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
      name: args.name,
      previousName: machine.name,
      changed,
      url: machineUrl(machine.initials),
    },
    machineId: machine.id,
  };
}

export function registerSetMachineName(server: McpServer): void {
  server.registerTool(
    "set_machine_name",
    {
      title: "Rename a machine",
      description:
        "Change a machine's display name. Identify the machine by initials or UUID. Initials cannot be changed by this tool. No-op if the name already matches.",
      inputSchema: setNameSchema.shape,
    },
    (args, extra) =>
      runTool("set_machine_name", extra, (ctx) => runSetMachineName(args, ctx))
  );
}
