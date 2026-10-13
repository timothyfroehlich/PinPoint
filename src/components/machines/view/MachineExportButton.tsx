"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listHeaderIconButtonClass } from "~/components/list-view/classes";
import { exportMachinesAction } from "~/app/(app)/m/export-action";
import type { MachineExportScope } from "~/app/(app)/m/export-schema";

interface MachineExportButtonProps {
  /** The list's URL query; the server reads it exactly as the list does. */
  query: string;
  /** The Surface the list belongs to; the server resolves it. */
  scope: MachineExportScope;
}

/**
 * Export in the Machines List Header (machine-views §3.15): a CSV of every machine
 * matching the current View Configuration across all pages, within the
 * Surface's scope.
 */
export function MachineExportButton({
  query,
  scope,
}: MachineExportButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const result = await exportMachinesAction({ query, scope });

      if (!result.ok) {
        if (result.code === "EMPTY") {
          toast.info("No machines to export.");
        } else {
          toast.error(result.message);
        }
        return;
      }

      // Trigger browser download via Blob
      const blob = new Blob([result.value.csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.value.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <button
      type="button"
      className={listHeaderIconButtonClass}
      onClick={handleExport}
      disabled={isExporting}
      aria-label="Export to CSV"
      title="Export to CSV"
      data-testid="export-csv-button"
    >
      {isExporting ? (
        <Loader2
          aria-hidden="true"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}
