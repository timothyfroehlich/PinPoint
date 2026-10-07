"use server";

import { z } from "zod";

import { db } from "~/server/db";
import { createPublicAction } from "~/lib/actions";
import { getPrintRunMachines } from "~/lib/machines/settings-sheet-queries";
import { PRINT_RUN_MAX_MACHINES } from "~/lib/machines/settings-sheet-run";
import { ok } from "~/lib/result";

/**
 * Loads machines being added to a settings sheet print run, with their sets.
 * Public like the page itself (settings-sheets §2.1): every settings set is
 * visible to anyone who can open its machine (machine-settings §2.5), so it
 * checks no permission. Only machines On the Floor come back (§2.3).
 */
export const loadPrintRunMachinesAction = createPublicAction({
  actionName: "loadPrintRunMachines",
  schema: z.array(z.uuid()).max(PRINT_RUN_MAX_MACHINES),
  handler: async (machineIds) =>
    ok(await getPrintRunMachines(db, { kind: "ids", ids: machineIds })),
});
