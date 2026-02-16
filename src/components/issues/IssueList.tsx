"use client";

import * as React from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { ISSUE_PAGE_SIZES, hasActiveIssueFilters } from "~/lib/issues/filters";
import {
  STATUS_CONFIG,
  SEVERITY_CONFIG,
  PRIORITY_CONFIG,
} from "~/lib/issues/status";
import type { IssueListItem } from "~/lib/types";
import Link from "next/link";
import { formatIssueId } from "~/lib/issues/utils";
import { toast } from "sonner";
import {
  updateIssueStatusAction,
  updateIssueSeverityAction,
  updateIssuePriorityAction,
  assignIssueAction,
} from "~/app/(app)/issues/actions";

import { useSearchParams } from "next/navigation";
import { useSearchFilters } from "~/hooks/use-search-filters";
import { parseIssueFilters } from "~/lib/issues/filters";
import { IssueEditableCell } from "~/components/issues/cells/IssueEditableCell";
import {
  IssueAssigneeCell,
  type UserOption,
} from "~/components/issues/cells/IssueAssigneeCell";
import {
  useTableResponsiveColumns,
  type ColumnConfig,
} from "~/hooks/use-table-responsive-columns";

export type SortDirection = "asc" | "desc" | null;

interface IssueListProps {
  issues: IssueListItem[];
  totalCount: number;
  sort: string;
  page: number;
  pageSize: number;
  allUsers: UserOption[];
}

const COLUMN_WIDTH = 150;
const ISSUE_MIN_WIDTH = 200;
const ISSUE_BUFFER = 50;

export function IssueList({
  issues,
  totalCount,
  sort,
  page,
  pageSize,
  allUsers,
}: IssueListProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const filters = parseIssueFilters(searchParams);
  const { setSort, setPage, setPageSize } = useSearchFilters(filters);

  const columnConfig = React.useMemo(
    () =>
      [
        { key: "modified", minWidth: COLUMN_WIDTH, priority: 1 },
        { key: "assignee", minWidth: COLUMN_WIDTH, priority: 2 },
        { key: "severity", minWidth: COLUMN_WIDTH, priority: 3 },
        { key: "priority", minWidth: COLUMN_WIDTH, priority: 4 },
        { key: "status", minWidth: COLUMN_WIDTH, priority: 5 },
      ] as (ColumnConfig & {
        key: "modified" | "assignee" | "severity" | "priority" | "status";
      })[],
    []
  );

  // Responsive column visibility
  const { visibleColumns, containerRef } = useTableResponsiveColumns<
    "status" | "priority" | "severity" | "assignee" | "modified"
  >(columnConfig, ISSUE_MIN_WIDTH, ISSUE_BUFFER);

  // For managing multiple concurrent updates if needed, though we'll likely do one at a time per row/cell
  const [_isPending, startTransition] = React.useTransition();
  // format: issueId-field
  const [updatingCell, setUpdatingCell] = React.useState<string | null>(null);

  // Stable order tracking: only update display order when sort/page changes
  const [stableIds, setStableIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    setStableIds(issues.map((i) => i.id));
  }, [issues, sort, page, pageSize, totalCount]);

  const stableIssues = React.useMemo(() => {
    const issueMap = new Map(issues.map((i) => [i.id, i]));
    return stableIds
      .map((id) => issueMap.get(id))
      .filter((i): i is IssueListItem => !!i);
  }, [issues, stableIds]);

  const handleSort = (column: string): void => {
    // Simple toggle logic
    // For PinPoint, we mostly use column_asc/column_desc format in the URL
    // Default for many is desc (e.g. updated_desc)

    const newSort =
      sort === `${column}_desc`
        ? `${column}_asc`
        : sort === `${column}_asc`
          ? `${column}_desc`
          : `${column}_desc`;

    setSort(newSort);
  };

  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalCount === 0 ? 0 : Math.min(totalCount, page * pageSize);
  const isFirstPage = page <= 1;
  const isLastPage = end >= totalCount;

  const currentColumn = sort.split("_")[0];
  const currentDirection = sort.split("_")[1] as SortDirection;

  const renderSortIcon = (column: string): React.JSX.Element => {
    if (currentColumn !== column) {
      return (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-100 transition-opacity" />
      );
    }
    return currentDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    );
  };

  const TableHeader = ({
    label,
    column,
    align = "left",
    className,
  }: {
    label: string;
    column: string;
    align?: "left" | "right" | "center";
    className?: string;
  }): React.JSX.Element => (
    <th
      className={cn(
        "px-4 py-3 text-sm font-semibold text-muted-foreground group cursor-pointer hover:text-foreground transition-colors sticky top-0 bg-muted/30 z-10",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      onClick={() => handleSort(column)}
    >
      <div
        className={cn(
          "flex items-center",
          align === "right" && "justify-end",
          align === "center" && "justify-center"
        )}
      >
        {label}
        {renderSortIcon(column)}
      </div>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm font-bold tracking-tight text-foreground/90 uppercase">
            Issues Log
          </span>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {totalCount}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground mr-2">
            <span>
              {start}-{end} of {totalCount}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted"
                onClick={() => setPage(page - 1)}
                disabled={isFirstPage}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted"
                onClick={() => setPage(page + 1)}
                disabled={isLastPage}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 px-2.5 font-medium shadow-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                View Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Sort Options
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setSort("updated_desc")}
                className="text-xs"
              >
                <span className="flex-1">Modified (Newest)</span>
                {sort === "updated_desc" && (
                  <Check className="h-3.5 w-3.5 ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort("updated_asc")}
                className="text-xs"
              >
                <span className="flex-1">Modified (Oldest)</span>
                {sort === "updated_asc" && (
                  <Check className="h-3.5 w-3.5 ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort("created_desc")}
                className="text-xs"
              >
                <span className="flex-1">Created (Newest)</span>
                {sort === "created_desc" && (
                  <Check className="h-3.5 w-3.5 ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort("created_asc")}
                className="text-xs"
              >
                <span className="flex-1">Created (Oldest)</span>
                {sort === "created_asc" && (
                  <Check className="h-3.5 w-3.5 ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort("assignee_asc")}
                className="text-xs"
              >
                <span className="flex-1">Assignee (A–Z)</span>
                {sort === "assignee_asc" && (
                  <Check className="h-3.5 w-3.5 ml-2" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setSort("assignee_desc")}
                className="text-xs"
              >
                <span className="flex-1">Assignee (Z–A)</span>
                {sort === "assignee_desc" && (
                  <Check className="h-3.5 w-3.5 ml-2" />
                )}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Page Size
              </DropdownMenuLabel>
              {ISSUE_PAGE_SIZES.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => setPageSize(size)}
                  className="text-xs"
                >
                  <span className="flex-1">{size} per page</span>
                  {pageSize === size && <Check className="h-3.5 w-3.5 ml-2" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full bg-card border rounded-lg overflow-hidden shadow-sm overflow-x-auto"
      >
        <div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <TableHeader
                  label="Issue"
                  column="id"
                  className="w-full min-w-[200px]"
                />
                {visibleColumns.status && (
                  <TableHeader
                    label="Status"
                    column="status"
                    className="min-w-[150px] max-w-[150px]"
                  />
                )}
                {visibleColumns.priority && (
                  <TableHeader
                    label="Priority"
                    column="priority"
                    className="min-w-[150px] max-w-[150px]"
                  />
                )}
                {visibleColumns.severity && (
                  <TableHeader
                    label="Severity"
                    column="severity"
                    className="min-w-[150px] max-w-[150px]"
                  />
                )}
                {visibleColumns.assignee && (
                  <TableHeader
                    label="Assignee"
                    column="assignee"
                    className="min-w-[150px] max-w-[150px]"
                  />
                )}
                {visibleColumns.modified && (
                  <TableHeader
                    label="Modified"
                    column="updated"
                    align="right"
                    className="min-w-[150px] max-w-[150px]"
                  />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stableIssues.map((issue) => {
                const sc = STATUS_CONFIG as Record<
                  string,
                  { label: string; icon: LucideIcon; iconColor: string }
                >;
                const sv = SEVERITY_CONFIG as Record<
                  string,
                  { label: string; icon: LucideIcon; iconColor: string }
                >;
                const pr = PRIORITY_CONFIG as Record<
                  string,
                  { label: string; icon: LucideIcon; iconColor: string }
                >;

                const statusConfig = sc[issue.status]!;
                const severityConfig = sv[issue.severity]!;
                const priorityConfig = pr[issue.priority]!;

                return (
                  <tr
                    key={issue.id}
                    data-testid="issue-row"
                    data-issue-id={issue.id}
                    className="hover:bg-muted/50 transition-colors group"
                  >
                    <td className="px-4 py-4 min-w-[200px] sm:min-w-[300px]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-foreground whitespace-nowrap overflow-hidden min-w-0">
                          <Link
                            href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
                            data-testid="issue-id"
                            className="hover:text-primary transition-colors shrink-0"
                          >
                            {formatIssueId(
                              issue.machineInitials,
                              issue.issueNumber
                            )}
                          </Link>
                          <span className="text-muted-foreground/60 font-medium shrink-0">
                            —
                          </span>
                          <span className="text-muted-foreground font-semibold truncate min-w-0">
                            {issue.machine.name}
                          </span>
                        </div>
                        <Link
                          href={`/m/${issue.machineInitials}/i/${issue.issueNumber}`}
                          data-testid="issue-title"
                          className="text-sm text-muted-foreground line-clamp-1 group-hover:text-foreground transition-colors"
                        >
                          {issue.title}
                        </Link>
                      </div>
                    </td>
                    {visibleColumns.status && (
                      <IssueEditableCell
                        issue={issue}
                        field="status"
                        config={statusConfig}
                        options={Object.entries(STATUS_CONFIG).map(
                          ([val, cfg]) => ({
                            value: val,
                            label: cfg.label,
                            icon: cfg.icon,
                            iconColor: cfg.iconColor,
                          })
                        )}
                        onUpdate={(val) => {
                          const formData = new FormData();
                          formData.append("issueId", issue.id);
                          formData.append("status", val);
                          setUpdatingCell(`${issue.id}-status`);
                          startTransition(async () => {
                            try {
                              const result = await updateIssueStatusAction(
                                undefined,
                                formData
                              );
                              if (result.ok) {
                                toast.success("Status updated");
                              } else {
                                toast.error(result.message);
                              }
                            } catch {
                              toast.error("Failed to update status");
                            } finally {
                              setUpdatingCell(null);
                            }
                          });
                        }}
                        isUpdating={updatingCell === `${issue.id}-status`}
                      />
                    )}
                    {visibleColumns.priority && (
                      <IssueEditableCell
                        issue={issue}
                        field="priority"
                        config={priorityConfig}
                        options={Object.entries(PRIORITY_CONFIG).map(
                          ([val, cfg]) => ({
                            value: val,
                            label: cfg.label,
                            icon: cfg.icon,
                            iconColor: cfg.iconColor,
                          })
                        )}
                        onUpdate={(val) => {
                          const formData = new FormData();
                          formData.append("issueId", issue.id);
                          formData.append("priority", val);
                          setUpdatingCell(`${issue.id}-priority`);
                          startTransition(async () => {
                            try {
                              const result = await updateIssuePriorityAction(
                                undefined,
                                formData
                              );
                              if (result.ok) {
                                toast.success("Priority updated");
                              } else {
                                toast.error(result.message);
                              }
                            } catch {
                              toast.error("Failed to update priority");
                            } finally {
                              setUpdatingCell(null);
                            }
                          });
                        }}
                        isUpdating={updatingCell === `${issue.id}-priority`}
                      />
                    )}
                    {visibleColumns.severity && (
                      <IssueEditableCell
                        issue={issue}
                        field="severity"
                        config={severityConfig}
                        options={Object.entries(SEVERITY_CONFIG).map(
                          ([val, cfg]) => ({
                            value: val,
                            label: cfg.label,
                            icon: cfg.icon,
                            iconColor: cfg.iconColor,
                          })
                        )}
                        onUpdate={(val) => {
                          const formData = new FormData();
                          formData.append("issueId", issue.id);
                          formData.append("severity", val);
                          setUpdatingCell(`${issue.id}-severity`);
                          startTransition(async () => {
                            try {
                              const result = await updateIssueSeverityAction(
                                undefined,
                                formData
                              );
                              if (result.ok) {
                                toast.success("Severity updated");
                              } else {
                                toast.error(result.message);
                              }
                            } catch {
                              toast.error("Failed to update severity");
                            } finally {
                              setUpdatingCell(null);
                            }
                          });
                        }}
                        isUpdating={updatingCell === `${issue.id}-severity`}
                      />
                    )}
                    {visibleColumns.assignee && (
                      <IssueAssigneeCell
                        issue={issue}
                        users={allUsers}
                        onUpdate={(userId) => {
                          const formData = new FormData();
                          formData.append("issueId", issue.id);
                          formData.append("assignedTo", userId ?? "");
                          setUpdatingCell(`${issue.id}-assignee`);
                          startTransition(async () => {
                            try {
                              const result = await assignIssueAction(
                                undefined,
                                formData
                              );
                              if (result.ok) {
                                toast.success("Assignee updated");
                              } else {
                                toast.error(result.message);
                              }
                            } catch {
                              toast.error("Failed to update assignee");
                            } finally {
                              setUpdatingCell(null);
                            }
                          });
                        }}
                        isUpdating={updatingCell === `${issue.id}-assignee`}
                      />
                    )}
                    {visibleColumns.modified && (
                      <td className="px-4 py-4 text-right min-w-[150px] max-w-[150px]">
                        <span className="text-xs font-medium text-foreground leading-tight line-clamp-2">
                          {formatDistanceToNow(new Date(issue.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {issues.length === 0 && (
        <div className="p-12 flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border/60 bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-base font-semibold text-foreground">
            {hasActiveIssueFilters(searchParams)
              ? "No issues found"
              : "No issues yet. Report your first issue!"}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">
            {hasActiveIssueFilters(searchParams)
              ? "Adjust your filters to see more issues."
              : "Issues will appear here once they are reported."}
          </p>
          {!hasActiveIssueFilters(searchParams) && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 shadow-sm"
              asChild
            >
              <Link href="/report">Report an Issue</Link>
            </Button>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span>
              {start}-{end} of {totalCount}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted"
                onClick={() => setPage(page - 1)}
                disabled={isFirstPage}
                aria-label="Previous page"
                data-testid="bottom-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-muted"
                onClick={() => setPage(page + 1)}
                disabled={isLastPage}
                aria-label="Next page"
                data-testid="bottom-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
