"use client";

import * as React from "react";
import { toast } from "sonner";
import { downloadCsv } from "~/lib/export/download-csv";

import { ItemActionsMenu } from "~/components/list-view/ItemActionsMenu";
import { machineIssuesHref } from "~/lib/issues/links";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";

type IssuesView = "open" | "all";

interface MachineIssuesMenuProps {
  machineInitials: string;
  /** Which in-card list is currently shown (marked current in the menu). */
  view: IssuesView;
}

/**
 * The Service tab's Open Issues card control — a single ⋯ menu (no inline
 * filter bar / search / sort, per design §4), "Issue list actions"
 * (design-bible §26.3). Holds:
 *
 * - a **Show** section with the Open / All in-place views (links that set
 *   `?view=` on the maintenance route, so the choice is shareable and
 *   survives a reload), the shown one marked current;
 * - a **View all in Issues list** link to the global list, machine-scoped and
 *   all-statuses;
 * - **Export all issues (CSV)**, last — fired via `onSelect` (a nested form
 *   would unmount before submit — pinpoint-ui dropdown rule), reusing
 *   `exportIssuesAction`.
 */
export function MachineIssuesMenu({
  machineInitials,
  view,
}: MachineIssuesMenuProps): React.JSX.Element {
  const [isExporting, setIsExporting] = React.useState(false);

  async function handleExport(): Promise<void> {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const result = await exportIssuesAction({ machineInitials });
      if (!result.ok) {
        if (result.code === "EMPTY") {
          toast.info("No issues to export.");
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
    <ItemActionsMenu
      label="Issue list actions"
      sections={[
        {
          label: "Show",
          entries: [
            {
              key: "open",
              label: "Open issues",
              href: `/m/${machineInitials}/maintenance?view=open`,
              current: view === "open",
            },
            {
              key: "all",
              label: "All issues",
              href: `/m/${machineInitials}/maintenance?view=all`,
              current: view === "all",
            },
          ],
        },
        [
          {
            key: "issues-list",
            label: "View all in Issues list",
            href: machineIssuesHref(machineInitials),
          },
          {
            key: "export",
            label: isExporting
              ? "Exporting issues…"
              : "Export all issues (CSV)",
            busy: isExporting,
            onSelect: () => {
              void handleExport();
            },
          },
        ],
      ]}
    />
  );
}
