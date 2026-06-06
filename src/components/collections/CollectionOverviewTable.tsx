"use client";

import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Columns3 } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MachineStatusBadge } from "~/components/machines/MachineStatusBadge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { RelativeTime } from "~/components/issues/RelativeTime";
import {
  useTableResponsiveColumns,
  type ColumnConfig,
} from "~/hooks/use-table-responsive-columns";
import {
  MACHINE_STATUS_RANK,
  SEVERITY_RANK,
  type MachineStatus,
} from "~/lib/machines/status";
import { getTagLabel, type TimelineTag } from "~/lib/timeline/machine-tags";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { IssueSeverity } from "~/lib/types";
import { cn } from "~/lib/utils";

export interface CollectionOverviewRow {
  id: string;
  initials: string;
  name: string;
  status: MachineStatus;
  openCount: number;
  worstSeverity: IssueSeverity | null;
  lastActivity: { createdAt: Date; tag: TimelineTag } | null;
  presence: MachinePresenceStatus;
}

type ColumnKey =
  | "status"
  | "machine"
  | "open"
  | "severity"
  | "activity"
  | "presence";

const HIDEABLE: readonly ColumnKey[] = [
  "open",
  "severity",
  "activity",
  "presence",
];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  status: "Status",
  machine: "Machine",
  open: "Open",
  severity: "Worst severity",
  activity: "Last activity",
  presence: "Presence",
};
const STORAGE_KEY = "pinpoint_collection_overview_columns";

interface SortState {
  key: ColumnKey;
  dir: "asc" | "desc";
}

/**
 * Initial direction when a column first becomes the sort key: text columns
 * read naturally A→Z; status/count/severity/recency columns lead with
 * "worst/most/newest first".
 */
const DEFAULT_DIR: Record<ColumnKey, "asc" | "desc"> = {
  status: "desc",
  machine: "asc",
  open: "desc",
  severity: "desc",
  activity: "desc",
  presence: "asc",
};

function compareRows(
  a: CollectionOverviewRow,
  b: CollectionOverviewRow,
  key: ColumnKey
): number {
  switch (key) {
    case "status":
      return (
        MACHINE_STATUS_RANK[a.status] - MACHINE_STATUS_RANK[b.status] ||
        a.openCount - b.openCount ||
        a.name.localeCompare(b.name)
      );
    case "machine":
      return a.name.localeCompare(b.name);
    case "open":
      return a.openCount - b.openCount;
    case "severity": {
      const ra = a.worstSeverity === null ? -1 : SEVERITY_RANK[a.worstSeverity];
      const rb = b.worstSeverity === null ? -1 : SEVERITY_RANK[b.worstSeverity];
      return ra - rb;
    }
    case "activity": {
      const ta = a.lastActivity?.createdAt.getTime() ?? 0;
      const tb = b.lastActivity?.createdAt.getTime() ?? 0;
      return ta - tb;
    }
    case "presence":
      return a.presence.localeCompare(b.presence);
  }
}

function SortableHeader({
  column,
  sort,
  onSort,
  align = "left",
}: {
  column: ColumnKey;
  sort: SortState;
  onSort: (key: ColumnKey) => void;
  align?: "left" | "right";
}): React.JSX.Element {
  return (
    <th
      scope="col"
      aria-sort={
        sort.key === column
          ? sort.dir === "desc"
            ? "descending"
            : "ascending"
          : "none"
      }
      className={cn(
        "px-3 py-2 text-sm font-semibold text-muted-foreground",
        align === "right" && "text-right"
      )}
    >
      <button
        type="button"
        onClick={() => {
          onSort(column);
        }}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {COLUMN_LABELS[column]}
        {sort.key === column &&
          (sort.dir === "desc" ? (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-3.5" />
          ))}
      </button>
    </th>
  );
}

export function CollectionOverviewTable({
  rows,
}: {
  rows: CollectionOverviewRow[];
}): React.JSX.Element {
  // Client-side sort state: all rows are already loaded (no pagination),
  // so unlike IssueList we don't round-trip sort through the URL.
  // Default: worst status first (spec §Overview).
  const [sort, setSort] = React.useState<SortState>({
    key: "status",
    dir: "desc",
  });
  const [hidden, setHidden] = React.useState<ColumnKey[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHidden(
          parsed.filter((k): k is ColumnKey =>
            (HIDEABLE as readonly string[]).includes(String(k))
          )
        );
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const toggleColumn = (key: ColumnKey): void => {
    setHidden((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Responsive drop order (spec): presence and severity go first.
  const columnConfig = React.useMemo<(ColumnConfig & { key: ColumnKey })[]>(
    () => [
      { key: "presence", minWidth: 110, priority: 1 },
      { key: "severity", minWidth: 130, priority: 2 },
      { key: "activity", minWidth: 180, priority: 3 },
      { key: "open", minWidth: 70, priority: 4 },
    ],
    []
  );
  const { visibleColumns, containerRef } = useTableResponsiveColumns<ColumnKey>(
    columnConfig,
    360 // base width consumed by the always-on Status + Machine columns
  );

  const isShown = (key: ColumnKey): boolean => {
    if (key === "status" || key === "machine") return true;
    // All remaining keys are in columnConfig, so the hook always has an entry.
    return visibleColumns[key] && !hidden.includes(key);
  };

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const base = compareRows(a, b, sort.key);
      return sort.dir === "desc" ? -base : base;
    });
    return copy;
  }, [rows, sort]);

  const handleSort = (key: ColumnKey): void => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: DEFAULT_DIR[key] }
    );
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 aria-hidden="true" className="mr-1.5 size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {HIDEABLE.map((key) => (
              <DropdownMenuCheckboxItem
                key={key}
                checked={!hidden.includes(key)}
                onCheckedChange={() => toggleColumn(key)}
              >
                {COLUMN_LABELS[key]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left">
              <SortableHeader column="status" sort={sort} onSort={handleSort} />
              <SortableHeader
                column="machine"
                sort={sort}
                onSort={handleSort}
              />
              {isShown("open") && (
                <SortableHeader
                  column="open"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                />
              )}
              {isShown("severity") && (
                <SortableHeader
                  column="severity"
                  sort={sort}
                  onSort={handleSort}
                />
              )}
              {isShown("activity") && (
                <SortableHeader
                  column="activity"
                  sort={sort}
                  onSort={handleSort}
                />
              )}
              {isShown("presence") && (
                <SortableHeader
                  column="presence"
                  sort={sort}
                  onSort={handleSort}
                />
              )}
            </tr>
          </thead>
          <tbody data-testid="collection-overview-body">
            {sorted.map((row) => (
              <tr
                key={row.id}
                data-initials={row.initials}
                className="border-b border-border last:border-b-0"
              >
                <td className="px-3 py-2.5">
                  <MachineStatusBadge status={row.status} size="sm" />
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/m/${row.initials}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {row.name}
                  </Link>{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.initials}
                  </span>
                </td>
                {isShown("open") && (
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.openCount}
                  </td>
                )}
                {isShown("severity") && (
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.worstSeverity ?? "—"}
                  </td>
                )}
                {isShown("activity") && (
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {row.lastActivity ? (
                      <>
                        <RelativeTime value={row.lastActivity.createdAt} />
                        {" — "}
                        {getTagLabel(row.lastActivity.tag)}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {isShown("presence") && (
                  <td className="px-3 py-2.5">
                    <MachinePresenceBadge status={row.presence} size="sm" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
