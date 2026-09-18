import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { getScoreEntryUrl } from "~/lib/iscored/config";
import { checkPermission } from "~/lib/permissions/helpers";
import { updateMachineIscoredLink } from "~/services/machines";

import {
  machineUrl,
  McpToolError,
  resolveMachine,
  runTool,
  type ToolOutcome,
  WRITE_TOOL_ANNOTATIONS,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

export const setMachineIscoredSchema = z.strictObject({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  gameId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .describe(
      "iScored game ID string to link to this machine. Omit, pass an empty string, or pass null to clear the link."
    ),
  iscoredGameId: z
    .string()
    .trim()
    .nullable()
    .optional()
    .describe("Alias for gameId."),
});

export type SetMachineIscoredArgs = z.infer<typeof setMachineIscoredSchema>;

export async function runSetMachineIscored(
  args: SetMachineIscoredArgs,
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
      "Only the machine owner, technicians, or admins can link or unlink iScored."
    );
  }

  // Allow gameId or iscoredGameId, prioritizing gameId if both are provided
  const rawId = args.gameId ?? args.iscoredGameId ?? null;

  const { changed, iscoredGameId, previousIscoredGameId } =
    await updateMachineIscoredLink({
      machineId: machine.id,
      iscoredGameId: rawId,
    });

  return {
    result: {
      initials: machine.initials,
      name: machine.name,
      iscoredGameId,
      previousIscoredGameId,
      changed,
      url: machineUrl(machine.initials),
      scoreEntryUrl: iscoredGameId ? getScoreEntryUrl(iscoredGameId) : null,
    },
    machineId: machine.id,
  };
}

export function registerSetMachineIscored(server: McpServer): void {
  server.registerTool(
    "set_machine_iscored",
    {
      title: "Set machine iScored link",
      description:
        "Set or clear a machine's iScored game ID. Identify the machine by initials or UUID. Provide gameId as the iScored game ID string, or omit / pass empty string to clear the association. No records on iScored are altered.",
      inputSchema: setMachineIscoredSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool(
        "set_machine_iscored",
        extra,
        (ctx) => runSetMachineIscored(args, ctx),
        { mutates: true }
      )
  );
}
