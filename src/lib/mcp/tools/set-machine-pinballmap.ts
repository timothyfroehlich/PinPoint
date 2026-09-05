import "server-only";

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { checkPermission } from "~/lib/permissions/helpers";
import { updateMachinePbmLink } from "~/services/machines";

import { buildMachinePinballmap } from "./pinballmap-block";
import {
  machineUrl,
  McpToolError,
  resolveMachine,
  runTool,
  type ToolOutcome,
} from "./shared";
import type { McpAuthContext } from "~/lib/mcp/verify-token";

/**
 * Argument names deliberately match `add_machine`'s
 * (`pinballmapMachineId` / `pinballmapExcluded` / `pinballmapExcludedReason`).
 * The fleet linking pass (PP-h059) drives both tools in one session, and two
 * spellings of one concept is a mistake waiting to be made.
 */
export const setMachinePinballmapSchema = z.object({
  machine: z
    .string()
    .trim()
    .min(1)
    .describe("Machine initials (case-insensitive) or UUID."),
  pinballmapMachineId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "The Pinball Map catalog id of the title/edition this machine IS. Must be a `pinballmapMachineId` from search_pinballmap_catalog — never a `machineGroupId`, which identifies an edition family."
    ),
  pinballmapExcluded: z
    .boolean()
    .optional()
    .describe(
      "Pass true to record that this machine is deliberately NOT on Pinball Map (homebrew, a one-off, a title the catalog doesn't carry). Mutually exclusive with pinballmapMachineId."
    ),
  pinballmapExcludedReason: z
    .string()
    .trim()
    // Rejecting the empty string is narrower than the edit form, deliberately.
    // The form has to accept it — an emptied input IS how a human clears a
    // reason — but here an empty string can only be a caller filling a field it
    // had nothing to put in, and the service reads "no reason supplied" as
    // "keep the stored one". Accepting it would make that carry-over depend on
    // whether the caller sent "" or nothing, which is not a distinction any
    // caller is making on purpose.
    .min(1)
    // 200 to match the edit form's shared schema (`m/schemas.ts`), NOT a looser
    // MCP-only cap. The two write the same column and the form prefills it: a
    // 201–500 char reason written here would render into an input that then
    // fails validation on every later save from that page, wedging the picker
    // behind text the user never typed.
    .max(200)
    .optional()
    .describe(
      "Why the machine is excluded (max 200 characters). Only meaningful alongside pinballmapExcluded: true. Leaving it out when the machine is ALREADY excluded keeps the reason already stored — re-confirming an exclusion never erases someone else's note. This tool cannot clear a stored reason; use the machine's edit page."
    ),
});

type SetMachinePinballmapArgs = z.infer<typeof setMachinePinballmapSchema>;

/**
 * Set (or re-target) a machine's PinballMap catalog link, or mark it as not on
 * Pinball Map.
 *
 * The write half of the walk-the-floor flow (PP-u4ab.12), sharing one seam with
 * the machine edit page: `updateMachinePbmLink` owns the intent carry-over and
 * the abandoned-listing record, so this tool cannot disagree with the form
 * about either.
 *
 * Three things this tool deliberately cannot do:
 *
 *  - **Set listing intent from its arguments.** Intent is not an input here any
 *    more than it is on the edit form (PP-o355.29). It moves only via the
 *    carry-over — same title kept ⇒ keep the intent, spec 2.3 — and via the
 *    toggle a person presses. Nothing infers it (spec 5.1).
 *  - **List or unlist a machine on pinballmap.com.** That is an outbound write
 *    gated on `machines.pinballmap.push` and owned by the web UI (PP-o355.21).
 *  - **Clear a link back to "nothing recorded".** Every accepted call states a
 *    fact — this title, or not on Pinball Map. Silence is not one of the two, so
 *    a call carrying neither is rejected rather than read as "unlink".
 */
export async function runSetMachinePinballmap(
  args: SetMachinePinballmapArgs,
  ctx: McpAuthContext
): Promise<ToolOutcome> {
  const machine = await resolveMachine(args.machine);

  if (
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

  const linking = args.pinballmapMachineId !== undefined;
  const excluding = args.pinballmapExcluded === true;

  // The resolver treats "neither linked nor excluded" as a valid selection that
  // CLEARS every PBM column — correct for the edit form, where a human emptied
  // the picker on purpose. Reached from a tool call it would mean an argument
  // was forgotten, and a forgotten argument must not wipe a link (CORE-ARCH-012).
  if (!linking && !excluding) {
    throw new McpToolError(
      "invalid",
      "Pass pinballmapMachineId to link this machine to a Pinball Map title, or pinballmapExcluded: true to record that it is not on Pinball Map. This tool cannot clear a link back to 'nothing recorded' — use the machine's edit page for that."
    );
  }
  if (linking && excluding) {
    throw new McpToolError(
      "invalid",
      "A machine can't be both linked to a Pinball Map title and marked as not on Pinball Map. Pass one or the other."
    );
  }

  const updated = await updateMachinePbmLink({
    machineId: machine.id,
    actorUserId: ctx.userId,
    // Model metadata (manufacturer/year/OPDB/IPDB) is NOT passed and cannot be:
    // the service derives it from the catalog mirror for whichever id lands
    // here, so a caller cannot write a year the catalog disagrees with.
    selection: {
      pinballmapMachineId: args.pinballmapMachineId,
      pinballmapExcluded: args.pinballmapExcluded,
      pinballmapExcludedReason: args.pinballmapExcludedReason,
    },
    // The stored PBM state is NOT passed either. The service re-reads it under
    // the row lock it writes through, so the snapshot resolved above cannot go
    // stale between here and the write — the hourly reconcile pass is a real
    // concurrent writer of these exact columns.
  });

  if (!updated.ok) {
    throw new McpToolError(updated.reason, updated.message);
  }

  // Same block `get_machine` returns, built from the STORED columns — a read
  // and the write that followed it never describe one machine differently.
  // `previous` comes from the locked read inside the write, not from the
  // `resolveMachine` snapshot above, so it names the state actually replaced.
  const [previous, pinballmap] = await Promise.all([
    buildMachinePinballmap(updated.previous),
    buildMachinePinballmap(updated.columns),
  ]);

  return {
    result: {
      initials: machine.initials,
      name: machine.name,
      pinballmap,
      previousPinballmap: previous,
      url: machineUrl(machine.initials),
    },
    machineId: machine.id,
  };
}

export function registerSetMachinePinballmap(server: McpServer): void {
  server.registerTool(
    "set_machine_pinballmap",
    {
      title: "Set a machine's Pinball Map title",
      description:
        "Record WHICH Pinball Map catalog title a machine is — or that it isn't on Pinball Map at all. Two steps, always in this order: (1) call search_pinballmap_catalog to find the title and get its `pinballmapMachineId`, (2) call this tool with that id. Do not guess an id; ids are not derivable from a title's name. THE ID MUST BE A `pinballmapMachineId`, NOT A `machineGroupId` — the catalog search returns both as adjacent bare integers, and they are separate id spaces that overlap numerically, so passing a group id links the machine to a real but unrelated title and nothing about the number itself will tell you. Group ids come back from families; machine ids come back from editions and from single-edition families. Alternatively pass `pinballmapExcluded: true` with a `pinballmapExcludedReason` for a machine that genuinely isn't a catalog title (homebrew, a one-off). Pass one or the other, never both, and never neither: this tool cannot clear a link back to 'nothing recorded'. Manufacturer, year, OPDB id and IPDB id are re-derived from the catalog for the id you pass — you cannot set them, and passing a wrong id rewrites all four. Re-targeting a machine that is LISTED on the public map to a different title clears its listing (the old public entry no longer describes it; PinPoint records it as an entry to remove by hand), while re-sending the SAME id it already has leaves the listing untouched. Nothing here lists or unlists a machine on pinballmap.com. Returns the machine's new Pinball Map state in the same shape get_machine reports, plus `previousPinballmap` so you can see exactly what changed. Use get_machine or list_machines(pinballmap: 'unlinked') first to find machines still needing a title.",
      inputSchema: setMachinePinballmapSchema,
    },
    (args, extra) =>
      runTool("set_machine_pinballmap", extra, (ctx) =>
        runSetMachinePinballmap(args, ctx)
      )
  );
}
