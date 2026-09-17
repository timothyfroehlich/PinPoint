import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { checkPermission } from "~/lib/permissions/helpers";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import {
  updateMachineIscoredLink,
  updateMachineName,
  updateMachineOwner,
  updateMachinePbmLink,
  updateMachinePresence,
} from "~/services/machines";

import {
  getOwnerNamesByMachine,
  machineUrl,
  McpToolError,
  resolveMachine,
  resolveOwner,
  runTool,
  type ToolOutcome,
  WRITE_TOOL_ANNOTATIONS,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

export const updateMachineSchema = z
  .object({
    machine: z
      .string()
      .trim()
      .min(1)
      .describe("Machine initials (case-insensitive) or UUID."),
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("New machine name."),
    presenceStatus: z
      .enum(VALID_MACHINE_PRESENCE_STATUSES)
      .optional()
      .describe("New availability status."),
    owner: z
      .string()
      .trim()
      .nullable()
      .optional()
      .describe("New owner name or UUID, or empty string/null to clear."),
    pinballmapMachineId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Pinball Map catalog machine ID."),
    pinballmapExcluded: z
      .literal(true)
      .optional()
      .describe("Mark machine as excluded from Pinball Map."),
    pinballmapExcludedReason: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe("Reason for Pinball Map exclusion."),
    intent: z
      .enum(["on", "off", "no_sync"])
      .optional()
      .describe("Lineup sync intent for Pinball Map."),
    iscoredGameId: z
      .string()
      .trim()
      .nullable()
      .optional()
      .describe(
        "iScored game ID string to link to this machine, or null/empty string to clear."
      ),
  })
  .refine(
    (args) =>
      args.name !== undefined ||
      args.presenceStatus !== undefined ||
      args.owner !== undefined ||
      args.pinballmapMachineId !== undefined ||
      args.pinballmapExcluded !== undefined ||
      args.pinballmapExcludedReason !== undefined ||
      args.intent !== undefined ||
      args.iscoredGameId !== undefined,
    {
      message:
        "Supply at least one field to change: name, presenceStatus, owner, pinballmapMachineId, pinballmapExcluded, pinballmapExcludedReason, intent, or iscoredGameId.",
    }
  )
  .refine(
    (args) =>
      !(
        args.pinballmapMachineId !== undefined &&
        args.pinballmapExcluded === true
      ),
    {
      message:
        "A machine can't be both linked to a Pinball Map title and marked as not on Pinball Map. Pass one or the other.",
    }
  );

export type UpdateMachineArgs = z.infer<typeof updateMachineSchema>;

export interface MachineFieldChange {
  field: string;
  from: string | null;
  to: string | null;
  changed: boolean;
}

export interface UpdateMachineOutcome extends ToolOutcome {
  applied: MachineFieldChange[];
  result: {
    initials: string;
    name: string;
    presence: string;
    url: string;
    applied: MachineFieldChange[];
  };
}

export async function runUpdateMachine(
  args: UpdateMachineArgs,
  ctx: McpAuthContext
): Promise<UpdateMachineOutcome> {
  const parsed = updateMachineSchema.safeParse(args);
  if (!parsed.success) {
    throw new McpToolError(
      "invalid",
      parsed.error.issues[0]?.message ?? "Invalid arguments."
    );
  }
  const cleanArgs = parsed.data;

  const machine = await resolveMachine(cleanArgs.machine);

  if (
    !checkPermission("machines.edit", ctx.accessLevel, {
      userId: ctx.userId,
      machineOwnerId: machine.ownerId,
    })
  ) {
    throw new McpToolError(
      "denied",
      "Only the machine owner, technicians, or admins can edit this machine."
    );
  }

  const wantsPbm =
    cleanArgs.pinballmapMachineId !== undefined ||
    cleanArgs.pinballmapExcluded !== undefined ||
    cleanArgs.pinballmapExcludedReason !== undefined ||
    cleanArgs.intent !== undefined;

  if (
    wantsPbm &&
    !checkPermission("machines.pinballmap.link", ctx.accessLevel, {
      userId: ctx.userId,
      machineOwnerId: machine.ownerId,
    })
  ) {
    throw new McpToolError(
      "denied",
      "Only the machine owner, technicians, or admins can change this machine's Pinball Map link."
    );
  }

  // Pre-resolve owner before applying mutations so invalid owner reference fails cleanly.
  const newOwner =
    cleanArgs.owner !== undefined
      ? await resolveOwner(cleanArgs.owner)
      : undefined;

  const applied: MachineFieldChange[] = [];
  let currentName = machine.name;
  let currentPresenceStatus = machine.presenceStatus;
  let currentOwnerId = machine.ownerId;
  let currentInvitedOwnerId = machine.invitedOwnerId;

  // 1. updateMachineName (if name supplied)
  if (cleanArgs.name !== undefined) {
    const { changed } = await updateMachineName({
      machineId: machine.id,
      name: cleanArgs.name,
      actorUserId: ctx.userId,
      current: {
        name: currentName,
        ownerId: currentOwnerId,
        invitedOwnerId: currentInvitedOwnerId,
        presenceStatus: currentPresenceStatus,
      },
    });
    applied.push({
      field: "name",
      from: currentName,
      to: cleanArgs.name,
      changed,
    });
    currentName = cleanArgs.name;
  }

  // 2. updateMachinePresence (if presenceStatus supplied)
  if (cleanArgs.presenceStatus !== undefined) {
    const { changed } = await updateMachinePresence({
      machineId: machine.id,
      presenceStatus: cleanArgs.presenceStatus,
      actorUserId: ctx.userId,
      current: {
        name: currentName,
        ownerId: currentOwnerId,
        invitedOwnerId: currentInvitedOwnerId,
        presenceStatus: currentPresenceStatus,
      },
    });
    applied.push({
      field: "presenceStatus",
      from: currentPresenceStatus,
      to: cleanArgs.presenceStatus,
      changed,
    });
    currentPresenceStatus = cleanArgs.presenceStatus;
  }

  // 3. updateMachineOwner (if owner supplied)
  if (cleanArgs.owner !== undefined && newOwner !== undefined) {
    const previousOwnerNames = await getOwnerNamesByMachine([
      {
        id: machine.id,
        ownerId: currentOwnerId,
        invitedOwnerId: currentInvitedOwnerId,
      },
    ]);
    const fromOwnerName = previousOwnerNames.get(machine.id) ?? null;

    const { deliveryPlan } = await updateMachineOwner({
      machineId: machine.id,
      actorUserId: ctx.userId,
      current: {
        name: currentName,
        ownerId: currentOwnerId,
        invitedOwnerId: currentInvitedOwnerId,
        presenceStatus: currentPresenceStatus,
      },
      newOwner,
    });

    after(() => dispatchNotification(deliveryPlan));

    const newOwnerNames = await getOwnerNamesByMachine([
      {
        id: machine.id,
        ownerId: newOwner.ownerId,
        invitedOwnerId: newOwner.invitedOwnerId,
      },
    ]);
    const toOwnerName = newOwnerNames.get(machine.id) ?? null;

    const changed =
      currentOwnerId !== newOwner.ownerId ||
      currentInvitedOwnerId !== newOwner.invitedOwnerId;

    applied.push({
      field: "owner",
      from: fromOwnerName,
      to: toOwnerName,
      changed,
    });
  }

  // 4. updateMachinePbmLink (if pinballmap fields or intent supplied)
  if (wantsPbm) {
    const updated = await updateMachinePbmLink({
      machineId: machine.id,
      actorUserId: ctx.userId,
      selection: {
        pinballmapMachineId: cleanArgs.pinballmapMachineId,
        pinballmapExcluded: cleanArgs.pinballmapExcluded,
        pinballmapExcludedReason: cleanArgs.pinballmapExcludedReason,
        intent: cleanArgs.intent,
      },
    });

    if (!updated.ok) {
      throw new McpToolError(updated.reason, updated.message);
    }

    if (cleanArgs.pinballmapMachineId !== undefined) {
      applied.push({
        field: "pinballmapMachineId",
        from:
          updated.previous.pinballmapMachineId !== null
            ? String(updated.previous.pinballmapMachineId)
            : null,
        to: String(cleanArgs.pinballmapMachineId),
        changed:
          updated.previous.pinballmapMachineId !==
          cleanArgs.pinballmapMachineId,
      });
    }

    if (cleanArgs.pinballmapExcluded !== undefined) {
      const changed =
        updated.previous.pinballmapExcluded !== true ||
        (cleanArgs.pinballmapExcludedReason !== undefined &&
          updated.previous.pinballmapExcludedReason !==
            cleanArgs.pinballmapExcludedReason);
      applied.push({
        field: "pinballmapExcluded",
        from: updated.previous.pinballmapExcluded ? "true" : "false",
        to: "true",
        changed,
      });
    }

    if (cleanArgs.intent !== undefined) {
      applied.push({
        field: "intent",
        from: updated.previous.pinballmapIntent,
        to: cleanArgs.intent,
        changed: updated.previous.pinballmapIntent !== cleanArgs.intent,
      });
    }
  }

  // 5. updateMachineIscoredLink (if iscoredGameId supplied)
  if (cleanArgs.iscoredGameId !== undefined) {
    const { changed, iscoredGameId, previousIscoredGameId } =
      await updateMachineIscoredLink({
        machineId: machine.id,
        iscoredGameId: cleanArgs.iscoredGameId,
      });
    applied.push({
      field: "iscoredGameId",
      from: previousIscoredGameId,
      to: iscoredGameId,
      changed,
    });
  }

  return {
    applied,
    result: {
      initials: machine.initials,
      name: currentName,
      presence: currentPresenceStatus,
      url: machineUrl(machine.initials),
      applied,
    },
    machineId: machine.id,
  };
}

export function registerUpdateMachine(server: McpServer): void {
  server.registerTool(
    "update_machine",
    {
      title: "Update a machine",
      description:
        "Update one or more fields on a machine: name, availability (presenceStatus), owner, Pinball Map link/intent, or iScored link. Supply machine (initials or UUID) and at least one field to change. Returns applied changes.",
      inputSchema: updateMachineSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool("update_machine", extra, (ctx) => runUpdateMachine(args, ctx), {
        mutates: true,
      })
  );
}
