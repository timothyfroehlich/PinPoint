import "server-only";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { machineSettingsSets } from "~/server/db/schema";
import {
  BUILTIN_SETTINGS_TAG_NAMES,
  BUILTIN_SETTINGS_TAGS,
  type SettingsPreferredSlot,
} from "~/lib/machines/settings-types";
import { canManageMachineSettings } from "~/lib/permissions";
import {
  setPreferredSettingsSet,
  setSettingsSetTag,
  updateSettingsSet,
} from "~/services/machine-settings";

import {
  mcpSettingsSectionSchema,
  parseSettingsPayload,
  settingsSetNameSchema,
  toStoredDescription,
  toStoredSections,
} from "./settings-set-shape";
import {
  defineTool,
  machineUrl,
  McpToolError,
  resolveMachine,
  type ToolOutcome,
  WRITE_TOOL_ANNOTATIONS,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

export const updateSettingsSetSchema = z
  .object({
    machine: z
      .string()
      .trim()
      .min(1)
      .describe("Machine initials (case-insensitive) or UUID."),
    set: z.uuid().describe("The set's id, from list_settings_sets."),
    version: z.iso
      .datetime()
      .optional()
      .describe(
        "The set's version from the list_settings_sets read your changes are based on. Required with sections. If the set was edited after that read, the update is refused so the edit is not overwritten."
      ),
    name: settingsSetNameSchema.optional(),
    description: z
      .string()
      .nullable()
      .optional()
      .describe("New plain-text description, or null to clear it."),
    sections: z
      .array(mcpSettingsSectionSchema)
      .optional()
      .describe(
        "Replaces ALL of the set's sections, in display order. To change one row, send every section back with that row edited; a section left out is deleted."
      ),
    makeCommunity: z
      .literal(true)
      .optional()
      .describe(
        "Turn your personal set into a community set that technicians, the machine owner and admins can edit. Only the set's author can, and it cannot be undone."
      ),
    house: z
      .boolean()
      .optional()
      .describe("Apply (true) or remove (false) the House tag."),
    tournament: z
      .boolean()
      .optional()
      .describe("Apply (true) or remove (false) the Tournament tag."),
    preferredHouse: z
      .boolean()
      .optional()
      .describe(
        "Make this the machine's preferred House set (true) or clear it (false). Setting it preferred also turns a personal set into a community set."
      ),
    preferredTournament: z
      .boolean()
      .optional()
      .describe(
        "Make this the machine's preferred Tournament set (true) or clear it (false). Setting it preferred also turns a personal set into a community set."
      ),
  })
  .refine(
    (args) =>
      args.name !== undefined ||
      args.description !== undefined ||
      args.sections !== undefined ||
      args.makeCommunity !== undefined ||
      args.house !== undefined ||
      args.tournament !== undefined ||
      args.preferredHouse !== undefined ||
      args.preferredTournament !== undefined,
    {
      message:
        "Supply at least one field to change: name, description, sections, makeCommunity, house, tournament, preferredHouse, or preferredTournament.",
    }
  )
  .refine((args) => args.sections === undefined || args.version !== undefined, {
    message:
      "sections replaces every section, so pass the set's version from the list_settings_sets read the sections came from.",
  });

type UpdateSettingsSetArgs = z.infer<typeof updateSettingsSetSchema>;

export async function runUpdateSettingsSet(
  args: UpdateSettingsSetArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  const machine = await resolveMachine(args.machine);
  const notFound = new McpToolError(
    "not_found",
    `No settings set ${args.set} on ${machine.initials}. Use list_settings_sets to find its id.`
  );

  const current = await db.query.machineSettingsSets.findFirst({
    where: eq(machineSettingsSets.id, args.set),
    columns: {
      machineId: true,
      name: true,
      description: true,
      sections: true,
      updatedAt: true,
      isPreferredHouse: true,
      isPreferredTournament: true,
    },
    with: {
      tags: {
        with: {
          tag: {
            columns: { slug: true },
          },
        },
      },
    },
  });
  if (current?.machineId !== machine.id) throw notFound;

  // Tag and preferred changes run after the content write, each in its own
  // transaction, so refuse up front the ones the service would refuse: a call
  // that is going to fail must not land half of its changes first.
  const tagChanges = BUILTIN_SETTINGS_TAGS.flatMap((tag) => {
    const applied = tag === "house" ? args.house : args.tournament;
    return applied === undefined ? [] : [{ tag, applied }];
  });
  const preferredChanges: {
    slot: SettingsPreferredSlot;
    preferred: boolean;
  }[] = [];
  if (args.preferredHouse !== undefined) {
    preferredChanges.push({ slot: "house", preferred: args.preferredHouse });
  }
  if (args.preferredTournament !== undefined) {
    preferredChanges.push({
      slot: "tournament",
      preferred: args.preferredTournament,
    });
  }

  const hasCurateChange = tagChanges.length > 0 || preferredChanges.length > 0;
  if (
    hasCurateChange &&
    !canManageMachineSettings(machine.ownerId, ctx.userId, ctx.accessLevel)
  ) {
    throw new McpToolError(
      "denied",
      "Only technicians, admins, and the machine owner can tag its settings sets or choose preferred sets."
    );
  }

  for (const { tag, applied } of tagChanges) {
    // If preferred status is also being changed in this call, test against the requested state.
    const preferredChange = preferredChanges.find((p) => p.slot === tag);
    const preferred =
      preferredChange !== undefined
        ? preferredChange.preferred
        : tag === "house"
          ? current.isPreferredHouse
          : current.isPreferredTournament;
    if (!applied && preferred) {
      const slot = BUILTIN_SETTINGS_TAG_NAMES[tag];
      throw new McpToolError(
        "invalid",
        `This is the machine's preferred ${slot} set, so it keeps the ${slot} tag. Unset it as preferred first.`
      );
    }
  }

  const existingTags = new Set(current.tags.map((t) => t.tag.slug));
  for (const { slot, preferred } of preferredChanges) {
    if (preferred) {
      const tagArg = slot === "house" ? args.house : args.tournament;
      const willHaveTag = tagArg ?? existingTags.has(slot);
      if (!willHaveTag) {
        const slotName = BUILTIN_SETTINGS_TAG_NAMES[slot];
        throw new McpToolError(
          "invalid",
          `Only a set tagged ${slotName} can be the preferred ${slotName} set.`
        );
      }
    }
  }

  const wantsContent =
    args.name !== undefined ||
    args.description !== undefined ||
    args.sections !== undefined;
  // Fields left out keep their stored value; the service replaces the whole
  // payload, so the unchanged parts are carried over from the row.
  const payload = wantsContent
    ? parseSettingsPayload({
        name: args.name ?? current.name,
        description:
          args.description === undefined
            ? (current.description ?? null)
            : toStoredDescription(
                args.description,
                current.description ?? null
              ),
        sections:
          args.sections === undefined
            ? current.sections
            : toStoredSections(args.sections, current.sections),
      })
    : undefined;

  const updated = await updateSettingsSet({
    setId: args.set,
    actor: { userId: ctx.userId, access: ctx.accessLevel },
    expectedMachineId: machine.id,
    // The payload is built from the caller's read (version) and this one's
    // unchanged fields; refuse it if the set moved since the earlier of them.
    ...(payload
      ? {
          payload,
          expectedUpdatedAt:
            args.version === undefined
              ? current.updatedAt
              : new Date(args.version),
        }
      : {}),
    ...(args.makeCommunity ? { makeCommunity: true } : {}),
  });
  if (!updated.ok) {
    if (updated.code === "not_found") throw notFound;
    throw new McpToolError(
      updated.code,
      updated.code === "denied"
        ? `You can't change this set. ${updated.message}`
        : updated.message
    );
  }

  const actor = { userId: ctx.userId, access: ctx.accessLevel };
  let tagsChanged = false;
  // Apply tag additions first so preferred changes that rely on them succeed.
  for (const { tag, applied } of tagChanges.filter((t) => t.applied)) {
    const tagged = await setSettingsSetTag({
      setId: args.set,
      actor,
      tag,
      applied,
    });
    if (!tagged.ok) {
      throw new McpToolError(
        tagged.code,
        tagged.code === "denied"
          ? "Only technicians, admins, and the machine owner can tag its settings sets."
          : tagged.message
      );
    }
    tagsChanged ||= tagged.value.changed;
  }

  let preferredChanged = false;
  let isCommunity = updated.value.isCommunity;
  for (const { slot, preferred } of preferredChanges) {
    const res = await setPreferredSettingsSet({
      setId: args.set,
      actor,
      slot,
      preferred,
    });
    if (!res.ok) {
      throw new McpToolError(
        res.code,
        res.code === "denied"
          ? "Only technicians, admins, and the machine owner can choose preferred sets."
          : res.message
      );
    }
    preferredChanged ||= res.value.changed;
    if (preferred && res.value.changed) {
      isCommunity = true;
    }
  }

  // Apply tag removals after preferred changes so unsetting preferred allows removing the tag.
  for (const { tag, applied } of tagChanges.filter((t) => !t.applied)) {
    const tagged = await setSettingsSetTag({
      setId: args.set,
      actor,
      tag,
      applied,
    });
    if (!tagged.ok) {
      throw new McpToolError(
        tagged.code,
        tagged.code === "denied"
          ? "Only technicians, admins, and the machine owner can tag its settings sets."
          : tagged.message
      );
    }
    tagsChanged ||= tagged.value.changed;
  }

  return {
    result: {
      changed: updated.value.changed || tagsChanged || preferredChanged,
      contentChanged: updated.value.contentChanged,
      id: updated.value.id,
      machine: machine.initials,
      kind: isCommunity ? "community" : "personal",
      url: `${machineUrl(machine.initials)}/settings`,
    },
    machineId: machine.id,
  };
}

export const updateSettingsSetTool = defineTool({
  name: "update_settings_set",
  title: "Update a settings set",
  description:
    "Change a settings set's name, description, or sections, make your personal set a community set, apply or remove its House and Tournament tags, or set/clear it as the machine's preferred House or Tournament set. Making a set preferred also turns it into a community set and adds a timeline event. Supply machine and set id (from list_settings_sets) plus at least one field. sections replaces every section, so send the full list read from list_settings_sets with your edits applied. Content edits need edit rights: a personal set's author, or for a community set technicians, the owner and admins. Each change adds a timeline entry on the machine.",
  inputSchema: updateSettingsSetSchema,
  annotations: WRITE_TOOL_ANNOTATIONS,
  mutates: true,
  run: runUpdateSettingsSet,
});
