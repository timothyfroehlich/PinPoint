import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { after } from "next/server";
import { z } from "zod";

import { dispatchNotification } from "~/lib/notifications";
import { reportError } from "~/lib/observability/report-error";
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
  )
  .refine(
    (args) =>
      args.pinballmapExcludedReason === undefined ||
      args.pinballmapExcluded === true,
    {
      message: "pinballmapExcludedReason requires pinballmapExcluded: true.",
    }
  );

export type UpdateMachineArgs = z.infer<typeof updateMachineSchema>;

export interface MachineFieldChange {
  field: string;
  from: string | null;
  to: string | null;
  changed: boolean;
}

export interface MachineFieldFailure {
  field: string;
  reason: string;
}

export interface UpdateMachineOutcome extends ToolOutcome {
  applied: MachineFieldChange[];
  result: {
    initials: string;
    name: string;
    presence: string;
    url: string;
    applied: MachineFieldChange[];
    partial?: boolean;
    failed?: MachineFieldFailure;
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

  let fromOwnerName: string | null = null;
  if (cleanArgs.owner !== undefined && newOwner !== undefined) {
    const previousOwnerNames = await getOwnerNamesByMachine([
      {
        id: machine.id,
        ownerId: machine.ownerId,
        invitedOwnerId: machine.invitedOwnerId,
      },
    ]);
    fromOwnerName = previousOwnerNames.get(machine.id) ?? null;
  }

  const applied: MachineFieldChange[] = [];
  let currentName = machine.name;
  let currentPresenceStatus = machine.presenceStatus;
  let currentOwnerId = machine.ownerId;
  let currentInvitedOwnerId = machine.invitedOwnerId;

  function handleFailure(
    field: string,
    reason: string,
    errorReason?:
      "denied" | "not_found" | "invalid" | "conflict" | "rate_limited"
  ): UpdateMachineOutcome {
    if (applied.length > 0) {
      return {
        applied,
        result: {
          initials: machine.initials,
          name: currentName,
          presence: currentPresenceStatus,
          url: machineUrl(machine.initials),
          applied,
          partial: true,
          failed: { field, reason },
        },
        machineId: machine.id,
        auditOutcome: "error",
        auditReason: `partial:${field}`,
      };
    }
    if (errorReason) {
      throw new McpToolError(errorReason, reason);
    }
    throw new Error(reason);
  }

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
    try {
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
    } catch (error) {
      return handleFailure(
        "presenceStatus",
        error instanceof Error ? error.message : "Updating presence failed."
      );
    }
  }

  // 3. updateMachineOwner (if owner supplied)
  if (cleanArgs.owner !== undefined && newOwner !== undefined) {
    let deliveryPlan: Awaited<
      ReturnType<typeof updateMachineOwner>
    >["deliveryPlan"];
    try {
      const outcome = await updateMachineOwner({
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
      deliveryPlan = outcome.deliveryPlan;
    } catch (error) {
      return handleFailure(
        "owner",
        error instanceof Error ? error.message : "Updating owner failed."
      );
    }

    // Owner row is committed past this point: never report it as failed.
    let toOwnerName: string | null = null;
    try {
      after(() => dispatchNotification(deliveryPlan));
      const newOwnerNames = await getOwnerNamesByMachine([
        {
          id: machine.id,
          ownerId: newOwner.ownerId,
          invitedOwnerId: newOwner.invitedOwnerId,
        },
      ]);
      toOwnerName = newOwnerNames.get(machine.id) ?? null;
    } catch (error) {
      reportError(error, {
        action: "mcp.update_machine.ownerPostCommit",
        machineId: machine.id,
      });
    }

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
    let updated: Awaited<ReturnType<typeof updateMachinePbmLink>>;
    try {
      updated = await updateMachinePbmLink({
        machineId: machine.id,
        actorUserId: ctx.userId,
        selection: {
          pinballmapMachineId: cleanArgs.pinballmapMachineId,
          pinballmapExcluded: cleanArgs.pinballmapExcluded,
          pinballmapExcludedReason: cleanArgs.pinballmapExcludedReason,
          intent: cleanArgs.intent,
        },
      });
    } catch (error) {
      return handleFailure(
        "pinballmap",
        error instanceof Error
          ? error.message
          : "Updating Pinball Map link failed."
      );
    }

    if (!updated.ok) {
      return handleFailure("pinballmap", updated.message, updated.reason);
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
    try {
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
    } catch (error) {
      return handleFailure(
        "iscoredGameId",
        error instanceof Error ? error.message : "Updating iScored link failed."
      );
    }
  }

  return {
    applied,
    result: {
      initials: machine.initials,
      name: currentName,
      presence: currentPresenceStatus,
      url: machineUrl(machine.initials),
      applied,
      partial: false,
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
