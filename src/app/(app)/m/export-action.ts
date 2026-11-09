"use server";

import { createClient } from "~/lib/supabase/server";
import { siteDayOf } from "~/lib/time-zone";
import { db } from "~/server/db";
import { serverActionError } from "~/lib/observability/report-error";
import { type Result, ok, err } from "~/lib/result";
import { generateCsv } from "~/lib/export/csv";
import { loadMachineExportRows } from "~/lib/machines/view/queries";
import {
  MACHINE_EXPORT_HEADERS,
  machineExportCsvRows,
} from "~/lib/machines/view/export";
import { exportMachinesSchema, type MachineExportScope } from "./export-schema";
import { resolveMachineExportScope } from "./export-scope";

export type ExportMachinesResult = Result<
  { csv: string; fileName: string },
  "UNAUTHORIZED" | "VALIDATION" | "NOT_FOUND" | "SERVER" | "EMPTY"
>;

/**
 * Exports every machine matching the list's View Configuration across all
 * pages, within the Surface's scope, in the list's sort order
 * (machine-views §3.15–§3.17), with the same columns whatever fields the list
 * displays: all machines on `/m`, or a Collection or Tag
 * tab's machines.
 */
export async function exportMachinesAction(input: {
  query?: string;
  scope: MachineExportScope;
}): Promise<ExportMachinesResult> {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err("UNAUTHORIZED", "You must be signed in to export machines.");
  }

  // 2. Validate input
  const inputValidation = exportMachinesSchema.safeParse(input);
  if (!inputValidation.success) {
    return err(
      "VALIDATION",
      inputValidation.error.issues[0]?.message ?? "Invalid input"
    );
  }
  const { query, scope } = inputValidation.data;

  try {
    // The scope loaders run inside the try so a loader failure is reported
    // and returned as SERVER rather than thrown to the client.
    const resolved = await resolveMachineExportScope(scope);
    if (resolved === null) {
      return err("NOT_FOUND", "This list is not available.");
    }

    // 3. The list's own URL, parsed and validated exactly as the list does,
    // so the export is the list across every page.
    const rows = await loadMachineExportRows(db, {
      scope: resolved.scope,
      preset: resolved.preset,
      searchParams: new URLSearchParams(query ?? ""),
      viewerId: user.id,
    });

    if (rows.length === 0) {
      return err("EMPTY", "No machines match the current filters.");
    }

    const csv = generateCsv(MACHINE_EXPORT_HEADERS, machineExportCsvRows(rows));
    const fileName = `pinpoint-machines-${siteDayOf(new Date())}.csv`;
    return ok({ csv, fileName });
  } catch (error) {
    return serverActionError(
      error,
      "SERVER",
      "An error occurred while exporting machines.",
      { action: "exportMachines" }
    );
  }
}
