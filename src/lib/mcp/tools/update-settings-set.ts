import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { machineSettingsSets } from "~/server/db/schema";
import { updateSettingsSet } from "~/services/machine-settings";

import {
  mcpSettingsSectionSchema,
  parseSettingsPayload,
  settingsSetNameSchema,
  toStoredDescription,
  toStoredSections,
} from "./settings-set-shape";
import {
  machineUrl,
  McpToolError,
  resolveMachine,
  runTool,
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
    isPublic: z
      .boolean()
      .optional()
      .describe("Publish (true) or return to a private draft (false)."),
    isTournament: z
      .boolean()
      .optional()
      .describe("Add (true) or remove (false) the Tournament tag."),
  })
  .refine(
    (args) =>
      args.name !== undefined ||
      args.description !== undefined ||
      args.sections !== undefined ||
      args.isPublic !== undefined ||
      args.isTournament !== undefined,
    {
      message:
        "Supply at least one field to change: name, description, sections, isPublic, or isTournament.",
    }
  );

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
    },
  });
  if (current?.machineId !== machine.id) throw notFound;

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
    // The payload carries this read's unchanged fields, so refuse it if the
    // set moved since.
    ...(payload ? { payload, expectedUpdatedAt: current.updatedAt } : {}),
    ...(args.isPublic !== undefined ? { isPublic: args.isPublic } : {}),
    ...(args.isTournament !== undefined
      ? { isTournament: args.isTournament }
      : {}),
  });
  if (!updated.ok) {
    if (updated.code === "not_found") throw notFound;
    throw new McpToolError(
      updated.code,
      updated.code === "denied"
        ? "You can't edit this set. Owner sets are editable only by the machine owner and admins; a private draft only by its creator."
        : updated.message
    );
  }

  return {
    result: {
      changed: updated.value.changed,
      contentChanged: updated.value.contentChanged,
      id: updated.value.id,
      machine: machine.initials,
      isPublic: updated.value.isPublic,
      isTournament: updated.value.isTournament,
      url: `${machineUrl(machine.initials)}/settings`,
    },
    machineId: machine.id,
  };
}

export function registerUpdateSettingsSet(server: McpServer): void {
  server.registerTool(
    "update_settings_set",
    {
      title: "Update a settings set",
      description:
        "Change a settings set's name, description, or sections, publish or unpublish it, or toggle its Tournament tag. Supply machine and set id (from list_settings_sets) plus at least one field. sections replaces every section, so send the full list read from list_settings_sets with your edits applied. A content change adds a timeline entry on the machine.",
      inputSchema: updateSettingsSetSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool(
        "update_settings_set",
        extra,
        (ctx) => runUpdateSettingsSet(args, ctx),
        { mutates: true }
      )
  );
}
