import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { after } from "next/server";
import { z } from "zod";

import { isPgErrorCode } from "~/lib/db/postgres-errors";
import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import { resolvePbmLinkColumns } from "~/lib/pinballmap/link-columns";
import { createMachine } from "~/services/machines";

import {
  getOwnerNamesByMachine,
  machineUrl,
  McpToolError,
  resolveOwner,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const addMachineSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Machine name is required")
    .max(100, "Machine name must be less than 100 characters")
    .describe("Display name, e.g. 'Medieval Madness'."),
  initials: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .regex(/^[A-Z0-9]+$/i, "Only letters and numbers allowed")
    .transform((val) => val.toUpperCase())
    .describe("Unique 2–6 character key, e.g. 'MM'."),
  owner: z
    .string()
    .trim()
    .optional()
    .describe("Owner: a member's full name ('First Last') or user UUID."),
  presence: z
    .enum(VALID_MACHINE_PRESENCE_STATUSES)
    .optional()
    .describe("Initial availability (default on_the_floor)."),
  pinballmapMachineId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Pinball Map catalog id to link this machine to."),
  pinballmapExcluded: z
    .boolean()
    .optional()
    .describe("Mark the machine as intentionally not on Pinball Map."),
  pinballmapExcludedReason: z
    .string()
    .trim()
    .optional()
    .describe("Reason the machine is excluded from Pinball Map."),
});

type AddMachineArgs = z.infer<typeof addMachineSchema>;

function wantsPbmLink(args: AddMachineArgs): boolean {
  return (
    args.pinballmapMachineId !== undefined ||
    args.pinballmapExcluded === true ||
    args.pinballmapExcludedReason !== undefined
  );
}

export async function runAddMachine(
  args: AddMachineArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("machines.create", ctx.accessLevel)) {
    throw new McpToolError(
      "denied",
      "You must be an admin or technician to add a machine."
    );
  }

  const linkPbm = wantsPbmLink(args);
  if (
    linkPbm &&
    !checkPermission("machines.pinballmap.link", ctx.accessLevel)
  ) {
    throw new McpToolError(
      "denied",
      "You do not have permission to link machines to Pinball Map."
    );
  }

  const owner = await resolveOwner(args.owner);

  let pbmColumns = null;
  if (linkPbm) {
    const resolved = await resolvePbmLinkColumns({
      pinballmapMachineId: args.pinballmapMachineId,
      pinballmapExcluded: args.pinballmapExcluded,
      pinballmapExcludedReason: args.pinballmapExcludedReason,
    });
    if (!resolved.ok) {
      throw new McpToolError("invalid", resolved.message);
    }
    pbmColumns = resolved.columns;
  }

  let created;
  try {
    created = await createMachine({
      name: args.name,
      initials: args.initials,
      actorUserId: ctx.userId,
      ownerId: owner.ownerId,
      invitedOwnerId: owner.invitedOwnerId,
      presenceStatus: args.presence,
      pbmColumns,
    });
  } catch (error) {
    if (isPgErrorCode(error, "23505")) {
      throw new McpToolError(
        "invalid",
        `Initials '${args.initials}' are already taken.`
      );
    }
    throw error;
  }

  after(() => dispatchNotification(created.deliveryPlan));

  const ownerNames = await getOwnerNamesByMachine([created.machine]);

  return {
    result: {
      initials: created.machine.initials,
      name: created.machine.name,
      presence: created.machine.presenceStatus,
      owner: ownerNames.get(created.machine.id) ?? null,
      url: machineUrl(created.machine.initials),
    },
    machineId: created.machine.id,
  };
}

export function registerAddMachine(server: McpServer): void {
  server.registerTool(
    "add_machine",
    {
      title: "Add machine",
      description:
        "Create a machine: name and unique initials, optional owner (member name or UUID), optional initial availability, and optional Pinball Map linking (a catalog id, or mark it excluded with a reason). Returns the new machine and its URL.",
      inputSchema: addMachineSchema.shape,
    },
    (args, extra) =>
      runTool("add_machine", extra, (ctx) => runAddMachine(args, ctx))
  );
}
