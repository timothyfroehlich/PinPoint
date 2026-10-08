import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getMachineSettingsSets } from "~/lib/machines/settings-queries";
import { checkPermission } from "~/lib/permissions/helpers";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { db } from "~/server/db";
import { machineSettingsSets, machines } from "~/server/db/schema";

import { docToMcpText, toMcpSection } from "./settings-set-shape";
import {
  machineUrl,
  McpToolError,
  READ_ONLY_TOOL_ANNOTATIONS,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

const listSettingsSetsSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
});

type ListSettingsSetsArgs = z.infer<typeof listSettingsSetsSchema>;

/** Plain text of a machine-level note, or null when it is empty. */
function noteText(doc: ProseMirrorDoc | null | undefined): string | null {
  const text = docToMcpText(doc);
  return text === "" ? null : text;
}

export async function runListSettingsSets(
  args: ListSettingsSetsArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  if (!checkPermission("machines.view", ctx.accessLevel)) {
    throw new McpToolError("denied", "You cannot view machines.");
  }

  const machine = await resolveMachine(args.machine);
  // getMachineSettingsSets is the Settings tab's own query: every set is
  // visible to everyone (machine-settings spec §2.5), with per-set rights.
  const [notes, sets, versions] = await Promise.all([
    db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
      columns: { settingsRequests: true, settingsInstructions: true },
    }),
    getMachineSettingsSets(db, machine.id, {
      viewerId: ctx.userId,
      access: ctx.accessLevel,
      machineOwnerId: machine.ownerId,
    }),
    // The view model carries updatedAt as a date only; update_settings_set
    // needs the exact timestamp to detect an edit made after this read.
    db.query.machineSettingsSets.findMany({
      where: eq(machineSettingsSets.machineId, machine.id),
      columns: { id: true, updatedAt: true },
    }),
  ]);
  const versionById = new Map(
    versions.map((v) => [v.id, v.updatedAt.toISOString()])
  );

  return {
    result: {
      machine: {
        initials: machine.initials,
        name: machine.name,
        url: `${machineUrl(machine.initials)}/settings`,
        ownerRequests: noteText(notes?.settingsRequests),
        howToChangeSettings: noteText(notes?.settingsInstructions),
      },
      sets: sets.map((set) => ({
        id: set.id,
        version: versionById.get(set.id) ?? null,
        name: set.name,
        kind: set.isCommunity ? "community" : "personal",
        isPreferredHouse: set.isPreferredHouse,
        isPreferredTournament: set.isPreferredTournament,
        tags: set.tags.map((t) => t.name),
        canEdit: set.canEdit,
        updatedBy: set.updatedBy,
        updatedAt: set.updatedAt,
        description: noteText(set.description),
        sections: set.sections.map(toMcpSection),
      })),
    },
    machineId: machine.id,
  };
}

export function registerListSettingsSets(server: McpServer): void {
  server.registerTool(
    "list_settings_sets",
    {
      title: "List a machine's settings sets",
      description:
        "Read every settings set on a machine with full contents: software adjustment rows, tables, DIP switch banks, and notes. Each set is personal (only its author edits it) or community (technicians, the owner and admins edit it), carries settings tags such as House and Tournament, and may be the machine's default House or default Tournament set. Also returns the machine's owner requests and how-to-change-settings notes. Use before create_settings_set to avoid duplicating an existing set, and before update_settings_set to get the set id, version and current sections.",
      inputSchema: listSettingsSetsSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool("list_settings_sets", extra, (ctx) =>
        runListSettingsSets(args, ctx)
      )
  );
}
