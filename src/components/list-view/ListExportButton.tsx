"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listHeaderIconButtonClass } from "~/components/list-view/classes";
import { downloadCsv } from "~/lib/export/download-csv";
import type { Result } from "~/lib/result";

interface ListExportButtonProps {
  /** Builds the CSV on the server; the EMPTY code means nothing matched. */
  exportCsv: () => Promise<Result<{ csv: string; fileName: string }>>;
  /** The toast when nothing matches, such as "No issues to export." */
  emptyMessage: string;
}

/**
 * Export in a List Header (list-views §5.5): runs the host's export and saves
 * the CSV it returns.
 */
export function ListExportButton({
  exportCsv,
  emptyMessage,
}: ListExportButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const result = await exportCsv();
      if (!result.ok) {
        if (result.code === "EMPTY") {
          toast.info(emptyMessage);
        } else {
          toast.error(result.message);
        }
        return;
      }
      if (!downloadCsv(result.value.csv, result.value.fileName)) {
        toast.error(
          "Download failed. Your browser may not support file downloads."
        );
      }
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
