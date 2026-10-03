"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "~/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import {
  DEFAULT_ISSUE_SORT,
  ISSUE_PAGE_SIZES,
  ISSUE_SORT_OPTIONS,
  hasActiveIssueFilters,
  isIssueSort,
  parseIssueFilters,
  type IssueSort,
} from "~/lib/issues/filters";
import {
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
  type IssueListRow,
} from "~/lib/types";
import { ALL_ISSUE_STATUSES } from "~/lib/issues/status";
import type { AccessLevel } from "~/lib/permissions/matrix";
import { checkPermission } from "~/lib/permissions/helpers";
import {
  updateIssueStatusAction,
  updateIssueSeverityAction,
  updateIssuePriorityAction,
  assignIssueAction,
} from "~/app/(app)/issues/actions";
import type { IssueExportScope } from "~/app/(app)/issues/export-schema";
import { useSearchFilters } from "~/hooks/use-search-filters";
import {
  IssueListEntry,
  type IssueRowField,
  type UserOption,
} from "~/components/issues/IssueListEntry";
import { ExportButton } from "~/components/issues/ExportButton";
import { PaginationControls } from "~/components/issues/PaginationControls";

/** Who is looking at the list, for per-row edit permissions (issues-list §3.5). */
export interface IssueListViewer {
  userId: string | undefined;
  accessLevel: AccessLevel;
}

interface IssueListProps {
  issues: IssueListRow[];
  totalCount: number;
  sort: IssueSort;
  page: number;
  pageSize: number;
  allUsers: UserOption[];
  viewer: IssueListViewer;
  /** The Collection or Tag tab this list is on; absent on `/issues`. */
  exportScope?: IssueExportScope | undefined;
}

const FIELD_LABELS: Record<IssueRowField, string> = {
  status: "Status",
  severity: "Severity",
  priority: "Priority",
  assignee: "Assignee",
};

/** Sends one row change to the matching server action. */
async function saveField(
  issueId: string,
  field: IssueRowField,
  value: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  const formData = new FormData();
  formData.append("issueId", issueId);
  switch (field) {
    case "status":
      formData.append("status", value ?? "");
      return updateIssueStatusAction(undefined, formData);
    case "severity":
      formData.append("severity", value ?? "");
      return updateIssueSeverityAction(undefined, formData);
    case "priority":
      formData.append("priority", value ?? "");
      return updateIssuePriorityAction(undefined, formData);
    case "assignee":
      formData.append("assignedTo", value ?? "");
      return assignIssueAction(undefined, formData);
  }
}

/**
 * The rows to show after the server re-renders the same list (issues-list
 * §3.6): the current order, fresh values where the server returned the row,
 * then any rows that are new to the list.
 */
function keepRowsInPlace(
  current: IssueListRow[],
  fresh: IssueListRow[]
): IssueListRow[] {
  const freshById = new Map(fresh.map((row) => [row.id, row]));
  const shown = new Set(current.map((row) => row.id));
  return [
    ...current.map((row) => freshById.get(row.id) ?? row),
    ...fresh.filter((row) => !shown.has(row.id)),
  ];
}

/** A row with one field changed to the value just saved. */
function withField(
  row: IssueListRow,
  field: IssueRowField,
  value: string | null,
  users: UserOption[]
): IssueListRow {
  switch (field) {
    case "status": {
      const status = ALL_ISSUE_STATUSES.find((s) => s === value);
      return status === undefined ? row : { ...row, status };
    }
    case "severity": {
      const severity = ISSUE_SEVERITY_VALUES.find((s) => s === value);
      return severity === undefined ? row : { ...row, severity };
    }
    case "priority": {
      const priority = ISSUE_PRIORITY_VALUES.find((p) => p === value);
      return priority === undefined ? row : { ...row, priority };
    }
    case "assignee": {
      const user = users.find((u) => u.id === value);
      return {
        ...row,
        assignedTo: user?.id ?? null,
        assignedToUser: user ? { id: user.id, name: user.name } : null,
      };
    }
  }
}

export function IssueList({
  issues,
  totalCount,
  sort,
  page,
  pageSize,
  allUsers,
  viewer,
  exportScope,
}: IssueListProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const filters = parseIssueFilters(searchParams);
  const { setSort, setPage, setPageSize } = useSearchFilters(filters);

  const [, startTransition] = React.useTransition();
  // The one row field being saved, and the one that last failed (issueId-field).
  const [updatingCell, setUpdatingCell] = React.useState<string | null>(null);
  const [errorCell, setErrorCell] = React.useState<string | null>(null);

  // Stable rows (issues-list §3.6): after a change from a row, the server
  // re-renders the page with fresh rows, which may reorder the list or drop
  // the changed row from it. Until the list next reloads — a new URL, meaning
  // new filters, sort, or page — keep the rows where they were, take fresh
  // values where the server still returns the row, and keep the locally
  // updated row where it does not.
  const listKey = searchParams.toString();
  const [rows, setRows] = React.useState(issues);
  const [rowsKey, setRowsKey] = React.useState(listKey);
  const [rowsSource, setRowsSource] = React.useState(issues);
  if (rowsKey !== listKey) {
    setRowsKey(listKey);
    setRowsSource(issues);
    setRows(issues);
  } else if (rowsSource !== issues) {
    setRowsSource(issues);
    setRows(keepRowsInPlace(rows, issues));
  }

  const handleUpdate = (
    issueId: string,
    field: IssueRowField,
    value: string | null
  ): void => {
    const cellKey = `${issueId}-${field}`;
    setUpdatingCell(cellKey);
    setErrorCell(null);
    startTransition(async () => {
      try {
        const result = await saveField(issueId, field, value);
        if (result.ok) {
          setRows((current) =>
            current.map((row) =>
              row.id === issueId ? withField(row, field, value, allUsers) : row
            )
          );
          toast.success(`${FIELD_LABELS[field]} updated`);
        } else {
          toast.error(result.message);
          setErrorCell(cellKey);
        }
      } catch {
        toast.error(`Failed to update ${field}`);
        setErrorCell(cellKey);
      } finally {
        setUpdatingCell(null);
      }
    });
  };

  const fieldState = (
    issueId: string,
    cell: string | null
  ): IssueRowField | null => {
    if (cell === null || !cell.startsWith(`${issueId}-`)) return null;
    const field = cell.slice(issueId.length + 1);
    return field === "status" ||
      field === "severity" ||
      field === "priority" ||
      field === "assignee"
      ? field
      : null;
  };

  const sortLabel =
    ISSUE_SORT_OPTIONS.find((option) => option.value === sort)?.label ??
    ISSUE_SORT_OPTIONS[0].label;
  const filtersActive = hasActiveIssueFilters(searchParams);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm font-bold tracking-tight text-foreground/90 uppercase">
            Issues Log
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
            {totalCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PaginationControls
            page={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onNavigate={setPage}
            prevTestId="top-prev-page"
            nextTestId="top-next-page"
            className="mr-2"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-2.5 font-medium shadow-sm"
                aria-label={`Sort: ${sortLabel}`}
              >
                <ArrowUpDown className="size-3.5" aria-hidden="true" />
                {sortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Sort
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) =>
                  setSort(isIssueSort(value) ? value : DEFAULT_ISSUE_SORT)
                }
              >
                {ISSUE_SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className="text-xs"
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <ExportButton filters={filters} scope={exportScope} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-2.5 font-medium shadow-sm"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                View Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Page Size
              </DropdownMenuLabel>
              {ISSUE_PAGE_SIZES.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => setPageSize(size)}
                  className="text-xs"
                >
                  <span className="flex-1">{size} per page</span>
                  {pageSize === size && <Check className="ml-2 size-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {rows.length > 0 && (
        <ul
          aria-label="Issues"
          className="divide-y divide-border overflow-hidden rounded-lg border bg-card shadow-sm"
        >
          {rows.map((issue) => {
            const ownership = {
              userId: viewer.userId,
              reporterId: issue.reportedByUser?.id ?? null,
              machineOwnerId: issue.machine.ownerId,
            };
            return (
              <IssueListEntry
                key={issue.id}
                issue={issue}
                canEditReporting={checkPermission(
                  "issues.update.reporting",
                  viewer.accessLevel,
                  ownership
                )}
                canTriage={checkPermission(
                  "issues.update.triage",
                  viewer.accessLevel,
                  ownership
                )}
                users={allUsers}
                onUpdate={(field, value) =>
                  handleUpdate(issue.id, field, value)
                }
                updatingField={fieldState(issue.id, updatingCell)}
                errorField={fieldState(issue.id, errorCell)}
              />
            );
          })}
        </ul>
      )}

      {rows.length === 0 && (
        <EmptyState
          icon={AlertCircle}
          title={filtersActive ? "No issues found" : "No issues yet"}
          description={
            filtersActive
              ? "Adjust your filters to see more issues."
              : "Issues will appear here once they are reported."
          }
          action={
            filtersActive ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/issues">Clear filters</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/report">Report an Issue</Link>
              </Button>
            )
          }
        />
      )}

      {totalCount > 0 && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <PaginationControls
            page={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onNavigate={setPage}
            prevTestId="bottom-prev-page"
            nextTestId="bottom-next-page"
          />
        </div>
      )}
    </div>
  );
}
