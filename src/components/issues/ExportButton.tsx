"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { toast } from "sonner";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";
import type { IssueFilters } from "~/lib/issues/filters";

interface ExportButtonProps {
  /** Current filter state — serialized and sent to the server action. */
  filters?: IssueFilters;
  /** Machine initials — for machine-page export (overrides filters). */
  machineInitials?: string;
}

export function ExportButton({
  filters,
  machineInitials,
}: ExportButtonProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const result = await exportIssuesAction({
        ...(filters !== undefined && { filtersJson: JSON.stringify(filters) }),
        ...(machineInitials !== undefined && { machineInitials }),
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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 shadow-sm"
            onClick={handleExport}
            disabled={isExporting}
            aria-label="Export to CSV"
            data-testid="export-csv-button"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export to CSV</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
