import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getMachineSettingsSets } from "~/lib/machines/settings-queries";
import { checkPermission } from "~/lib/permissions/helpers";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import { db } from "~/server/db";
import { machines } from "~/server/db/schema";

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
  // getMachineSettingsSets is the Settings tab's own query: it applies the
  // visibility rules (another user's private draft is left out) and computes
  // per-set edit rights.
  const [notes, sets] = await Promise.all([
    db.query.machines.findFirst({
      where: eq(machines.id, machine.id),
      columns: { settingsRequests: true, settingsInstructions: true },
    }),
    getMachineSettingsSets(db, machine.id, {
      viewerId: ctx.userId,
      access: ctx.accessLevel,
      machineOwnerId: machine.ownerId,
    }),
  ]);

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
        name: set.name,
        kind: set.isOwnerSet ? "owner" : "community",
        isOwnersDefault: set.isPreferred,
        isPublic: set.isPublic,
        isTournament: set.isTournament,
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
        "Read every settings set on a machine you can see — the Owner's default, public sets, and your own private drafts — with full contents: software adjustment rows, tables, DIP switch banks, and notes. Also returns the machine's owner requests and how-to-change-settings notes. Use before create_settings_set to avoid duplicating an existing set, and before update_settings_set to get the set id and current sections.",
      inputSchema: listSettingsSetsSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    (args, extra) =>
      runTool("list_settings_sets", extra, (ctx) =>
        runListSettingsSets(args, ctx)
      )
  );
}
