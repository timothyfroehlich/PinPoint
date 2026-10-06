"use server";

import { z } from "zod";

import { db } from "~/server/db";
import { getPrintRunMachines } from "~/lib/machines/settings-sheet-queries";
import {
  PRINT_RUN_MAX_MACHINES,
  type PrintRunMachine,
} from "~/lib/machines/settings-sheet-run";
import { type Result, ok, err } from "~/lib/result";

const machineIdsSchema = z.array(z.uuid()).max(PRINT_RUN_MAX_MACHINES);

/**
 * Loads machines being added to a settings sheet print run, with their sets.
 * Public like the page itself (settings-sheets §2.1): every settings set is
 * visible to anyone who can open its machine (machine-settings §2.5). Only
 * machines On the Floor come back (§2.3).
 */
export async function loadPrintRunMachinesAction(
  machineIds: string[]
): Promise<Result<PrintRunMachine[], "VALIDATION">> {
  const parsed = machineIdsSchema.safeParse(machineIds);
  if (!parsed.success) return err("VALIDATION", "Invalid machines");
  return ok(await getPrintRunMachines(db, { kind: "ids", ids: parsed.data }));
}
