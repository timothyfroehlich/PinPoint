import type React from "react";
import type { Metadata } from "next";

import { db } from "~/server/db";
import { buildSettingsSheet } from "~/lib/machines/settings-sheet";
import {
  getPrintRunMachines,
  getSettingsTagOptions,
} from "~/lib/machines/settings-sheet-queries";
import {
  parsePrintRunQuery,
  printRunInputs,
  printRunRowsFromQuery,
  serializePrintRunQuery,
  sheetLabels,
} from "~/lib/machines/settings-sheet-run";
import { SettingsSheetPrint } from "./SettingsSheetPrint";

export const metadata: Metadata = { title: "Settings sheet · PinPoint" };

/**
 * The printed settings sheet (settings-sheets §2.8): the print run in the URL,
 * on its own page without app navigation, opening the browser's print dialog.
 * Open to everyone, like the page that builds the run (§2.1).
 */
export default async function SettingsSheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const query = parsePrintRunQuery(await searchParams);
  const [machines, tags] = await Promise.all([
    getPrintRunMachines(db, { kind: "initials", initials: query.initials }),
    getSettingsTagOptions(db),
  ]);
  const rows = printRunRowsFromQuery(query, machines);
  const sheet = buildSettingsSheet(
    printRunInputs(machines, rows, query.options),
    query.options.coverage
  );
  const backQuery = serializePrintRunQuery(machines, rows, query.options);

  return (
    <SettingsSheetPrint
      sheet={sheet}
      direction={query.options.direction}
      coverage={query.options.coverage}
      labels={sheetLabels(query.options, tags)}
      printedAt={new Date().toISOString()}
      backHref={`/m/settings-sheets?${backQuery.toString()}`}
    />
  );
}
