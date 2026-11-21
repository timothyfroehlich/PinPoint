"use client";

import type * as React from "react";
import { ListExportButton } from "~/components/list-view/ListExportButton";
import { exportMachinesAction } from "~/app/(app)/m/export-action";
import type { MachineExportScope } from "~/app/(app)/m/export-schema";

interface MachineExportButtonProps {
  /** The list's URL query; the server reads it exactly as the list does. */
  query: string;
  /** The Surface the list belongs to; the server resolves it. */
  scope: MachineExportScope;
}

/**
 * Export in the Machines List Header (machine-views §3.15): a CSV of every
 * machine matching the current View Configuration across all pages, within
 * the Surface's scope.
 */
export function MachineExportButton({
  query,
  scope,
}: MachineExportButtonProps): React.JSX.Element {
  return (
    <ListExportButton
      exportCsv={() => exportMachinesAction({ query, scope })}
      emptyMessage="No machines to export."
    />
  );
}
