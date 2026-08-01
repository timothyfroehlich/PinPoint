"use client";

import type React from "react";
import Link from "next/link";
import { Check, Download, ListFilter, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { exportIssuesAction } from "~/app/(app)/issues/export-action";

type IssuesView = "open" | "all";

interface MachineIssuesMenuProps {
  machineInitials: string;
  /** Which in-card list is currently shown (drives the active toggle mark). */
  view: IssuesView;
}

/**
 * The Service tab's Open Issues card control — a single ⋯ menu (no inline
 * filter bar / search / sort, per design §4). Holds:
 *
 * - an **Open / All** in-place view toggle (links that set `?view=` on the
 *   maintenance route, so the choice is shareable and survives a reload);
 * - a **View all in Issues list** link to the global list, machine-scoped and
 *   all-statuses;
 * - **Export all issues (CSV)** — fired via `onSelect` (a nested form would
 *   unmount before submit — pinpoint-ui dropdown rule), reusing
 *   `exportIssuesAction`.
 */
export function MachineIssuesMenu({
  machineInitials,
  view,
}: MachineIssuesMenuProps): React.JSX.Element {
  async function handleExport(): Promise<void> {
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
      triggerCsvDownload(result.value.csv, result.value.fileName);
    } catch {
      toast.error("Export failed. Please try again.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Issue options"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show</DropdownMenuLabel>
        <ViewToggleItem
          href={`/m/${machineInitials}/maintenance?view=open`}
          label="Open issues"
          active={view === "open"}
        />
        <ViewToggleItem
          href={`/m/${machineInitials}/maintenance?view=all`}
          label="All issues"
          active={view === "all"}
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/issues?machine=${machineInitials}`}>
            <ListFilter className="size-4" aria-hidden="true" />
            View all in Issues list
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void handleExport();
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Export all issues (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewToggleItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}): React.JSX.Element {
  return (
    <DropdownMenuItem asChild>
      <Link href={href} {...(active ? { "aria-current": "true" } : {})}>
        <Check
          className={cn("size-4", active ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        />
        {label}
      </Link>
    </DropdownMenuItem>
  );
}

/** Blob → download of a generated CSV. No-op when the browser lacks the API. */
function triggerCsvDownload(csv: string, fileName: string): void {
  if (typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
