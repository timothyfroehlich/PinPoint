"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listHeaderIconButtonClass } from "~/components/list-view/classes";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";
import type { IssueExportScope } from "~/app/(app)/issues/export-schema";

interface ExportButtonProps {
  /** The list's URL query; the server reads it exactly as the list does. */
  query: string;
  /** The Collection or Tag tab the list belongs to; the server resolves it. */
  scope?: IssueExportScope | undefined;
}

/**
 * Export in the Issues List Header (issues-list §5.4): a CSV of every issue
 * matching the current View Configuration across all pages, within the
 * Surface's scope.
 */
export function ExportButton({
  query,
  scope,
}: ExportButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const result = await exportIssuesAction({
        query,
        ...(scope !== undefined && { scope }),
      });

      if (!result.ok) {
        if (result.code === "EMPTY") {
          toast.info("No issues to export.");
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
