import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

import { db } from "~/server/db";
import { machineSettingsSets } from "~/server/db/schema";
import { createSettingsSet } from "~/services/machine-settings";

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

export const createSettingsSetSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  name: settingsSetNameSchema,
  description: z
    .string()
    .optional()
    .describe(
      "Plain-text summary shown under the set's name: what the set is for, its source, anything unconfirmed."
    ),
  sections: z
    .array(mcpSettingsSectionSchema)
    .describe("The set's sections, in display order."),
  isPublic: z
    .boolean()
    .optional()
    .describe(
      "Publish the set so everyone can see it. Default false: a private draft only you (and admins) can see, to review in the Settings tab first."
    ),
  isTournament: z
    .boolean()
    .optional()
    .describe("Tag the set Tournament. Default false."),
});

type CreateSettingsSetArgs = z.infer<typeof createSettingsSetSchema>;

/** Stored section content without section ids, for spotting a retried create. */
function contentOf(sections: readonly { id: string }[]): unknown[] {
  return sections.map(({ id: _id, ...rest }) => rest);
}

export async function runCreateSettingsSet(
  args: CreateSettingsSetArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  const machine = await resolveMachine(args.machine);
  const payload = parseSettingsPayload({
    name: args.name,
    description: toStoredDescription(args.description ?? null, null),
    sections: toStoredSections(args.sections),
  });

  // A retried call must not create a second copy: a set you already created
  // here with the same name and the same content is returned instead.
  const yours = await db.query.machineSettingsSets.findMany({
    where: and(
      eq(machineSettingsSets.machineId, machine.id),
      eq(machineSettingsSets.createdBy, ctx.userId),
      eq(machineSettingsSets.name, payload.name)
    ),
    columns: { id: true, description: true, sections: true },
  });
  const wanted = contentOf(payload.sections);
  const existing = yours.find(
    (set) =>
      isDeepStrictEqual(set.description ?? null, payload.description ?? null) &&
      isDeepStrictEqual(contentOf(set.sections), wanted)
  );
  if (existing) {
    return {
      result: {
        created: false,
        reason: "You already created an identical set on this machine.",
        id: existing.id,
        machine: machine.initials,
        url: `${machineUrl(machine.initials)}/settings`,
      },
      machineId: machine.id,
    };
  }

  const created = await createSettingsSet({
    machineId: machine.id,
    actor: { userId: ctx.userId, access: ctx.accessLevel },
    payload,
    ...(args.isPublic !== undefined ? { isPublic: args.isPublic } : {}),
    ...(args.isTournament !== undefined
      ? { isTournament: args.isTournament }
      : {}),
  });
  if (!created.ok) {
    throw new McpToolError(
      created.code,
      created.code === "denied"
        ? "Only the machine owner, technicians, or admins can add settings sets to this machine."
        : created.message
    );
  }

  return {
    result: {
      created: true,
      id: created.value.id,
      machine: machine.initials,
      name: payload.name,
      kind: created.value.isOwnerSet ? "owner" : "community",
      isOwnersDefault: created.value.isPreferred,
      isPublic: created.value.isPublic,
      isTournament: created.value.isTournament,
      url: `${machineUrl(machine.initials)}/settings`,
    },
    machineId: machine.id,
  };
}

export function registerCreateSettingsSet(server: McpServer): void {
  server.registerTool(
    "create_settings_set",
    {
      title: "Create a settings set",
      description:
        "Add a settings set to a machine: named, with software adjustment rows (menu code, name, value, plus the baseline install they change from), tables, DIP switch banks, and plain-text notes (e.g. rubbers and post positions). Created as a private draft unless isPublic is true. Call list_settings_sets first so you don't duplicate an existing set. Adds a timeline entry on the machine.",
      inputSchema: createSettingsSetSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool(
        "create_settings_set",
        extra,
        (ctx) => runCreateSettingsSet(args, ctx),
        { mutates: true }
      )
  );
}
