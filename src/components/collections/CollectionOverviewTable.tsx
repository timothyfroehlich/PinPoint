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
import { CompactAge } from "~/components/issues/CompactAge";
import {
  useTableResponsiveColumns,
  type ColumnConfig,
} from "~/hooks/use-table-responsive-columns";
import { MACHINE_STATUS_RANK, type MachineStatus } from "~/lib/machines/status";
import { getTagLabel, type TimelineTag } from "~/lib/timeline/machine-tags";
import {
  MACHINE_PRESENCE_RANK,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import { cn } from "~/lib/utils";

export interface CollectionOverviewRow {
  id: string;
  initials: string;
  name: string;
  status: MachineStatus;
  openCount: number;
  lastActivity: { createdAt: Date; tag: TimelineTag } | null;
  /** Created date of the longest-outstanding OPEN issue, null when none. */
  oldestOpenAt: Date | null;
  presence: MachinePresenceStatus;
}

type ColumnKey =
  "machine" | "status" | "open" | "oldest" | "activity" | "presence";

const HIDEABLE: readonly ColumnKey[] = [
  "open",
  "oldest",
  "activity",
  "presence",
];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  machine: "Machine",
  status: "Status",
  open: "Open Issues",
  oldest: "Oldest issue",
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
  machine: "asc",
  status: "desc",
  open: "desc",
  oldest: "asc", // oldest (most neglected) first
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
    case "activity": {
      const ta = a.lastActivity?.createdAt.getTime() ?? 0;
      const tb = b.lastActivity?.createdAt.getTime() ?? 0;
      return ta - tb;
    }
    case "oldest": {
      // Machines with no open issues are kept out of this ordering entirely
      // (handled null-last in the sort wrapper, both directions), so here both
      // values are real dates.
      const ta = a.oldestOpenAt?.getTime() ?? 0;
      const tb = b.oldestOpenAt?.getTime() ?? 0;
      return ta - tb;
    }
    case "presence":
      return (
        MACHINE_PRESENCE_RANK[a.presence] - MACHINE_PRESENCE_RANK[b.presence] ||
        a.name.localeCompare(b.name)
      );
  }
}

function SortableHeader({
  column,
  sort,
  onSort,
  align = "left",
  className,
}: {
  column: ColumnKey;
  sort: SortState;
  onSort: (key: ColumnKey) => void;
  align?: "left" | "right";
  className?: string;
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
        "whitespace-nowrap px-3 py-2 text-sm font-semibold text-muted-foreground",
        align === "right" && "text-right",
        className
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

/** Keep only valid hideable column keys from untrusted (localStorage) data. */
function sanitizeKeys(value: unknown): ColumnKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((k): k is ColumnKey =>
    (HIDEABLE as readonly string[]).includes(String(k))
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
  // Column visibility is two-layered: the user's explicit picker choices
  // (`hidden` = unchecked, `pinned` = re-checked) always win; columns the
  // user never touched fall back to responsive auto-dropping. Pinning means
  // a narrow window scrolls horizontally instead of silently hiding a column
  // the user asked for.
  const [hidden, setHidden] = React.useState<ColumnKey[]>([]);
  const [pinned, setPinned] = React.useState<ColumnKey[]>([]);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Legacy format: a bare array of hidden keys.
        setHidden(sanitizeKeys(parsed));
      } else if (typeof parsed === "object" && parsed !== null) {
        setHidden(sanitizeKeys((parsed as Record<string, unknown>)["hidden"]));
        setPinned(sanitizeKeys((parsed as Record<string, unknown>)["pinned"]));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const toggleColumn = (key: ColumnKey): void => {
    // Unchecking hides; re-checking pins (explicit choice beats auto-drop).
    // One membership test drives both branches so they can't desync.
    const isHidden = hidden.includes(key);
    const nextHidden = isHidden
      ? hidden.filter((k) => k !== key)
      : [...hidden, key];
    const nextPinned = isHidden
      ? [...pinned.filter((k) => k !== key), key]
      : pinned.filter((k) => k !== key);
    setHidden(nextHidden);
    setPinned(nextPinned);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ hidden: nextHidden, pinned: nextPinned })
    );
  };

  // Responsive auto-drop, least-important-first. Machine is a flex column
  // that shrinks to its content, so the base reservation is small (~220) —
  // columns only drop when the table is genuinely cramped (~700px), not while
  // there is obvious empty space. Verbose "last activity" drops first; the
  // open count survives longest; presence (paired with status) stays sticky.
  // Explicitly pinned columns bypass this entirely (see isShown).
  const columnConfig = React.useMemo<(ColumnConfig & { key: ColumnKey })[]>(
    () => [
      { key: "activity", minWidth: 150, priority: 1 },
      { key: "oldest", minWidth: 90, priority: 2 },
      { key: "presence", minWidth: 100, priority: 3 },
      { key: "open", minWidth: 90, priority: 4 },
    ],
    []
  );
  const { visibleColumns, containerRef } = useTableResponsiveColumns<ColumnKey>(
    columnConfig,
    220 // base width consumed by the always-on Machine + Status columns
  );

  const isShown = (key: ColumnKey): boolean => {
    if (key === "status" || key === "machine") return true;
    if (hidden.includes(key)) return false;
    if (pinned.includes(key)) return true;
    // All remaining keys are in columnConfig, so the hook always has an entry.
    return visibleColumns[key];
  };

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      // Machines with no open backlog have no "oldest issue" age; keep them at
      // the bottom of the Oldest-issue sort in BOTH directions. The generic
      // direction flip below would otherwise float them to the top on desc.
      if (sort.key === "oldest") {
        const aNull = a.oldestOpenAt === null;
        const bNull = b.oldestOpenAt === null;
        if (aNull || bNull) return aNull === bNull ? 0 : aNull ? 1 : -1;
      }
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
              <SortableHeader
                column="machine"
                sort={sort}
                onSort={handleSort}
                className="w-full"
              />
              <SortableHeader column="status" sort={sort} onSort={handleSort} />
              {isShown("presence") && (
                <SortableHeader
                  column="presence"
                  sort={sort}
                  onSort={handleSort}
                />
              )}
              {isShown("open") && (
                <SortableHeader column="open" sort={sort} onSort={handleSort} />
              )}
              {isShown("oldest") && (
                <SortableHeader
                  column="oldest"
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
            </tr>
          </thead>
          <tbody data-testid="collection-overview-body">
            {sorted.map((row) => (
              <tr
                key={row.id}
                data-initials={row.initials}
                className="border-b border-border last:border-b-0"
              >
                <td className="w-full whitespace-nowrap px-3 py-2.5">
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
                <td className="px-3 py-2.5">
                  <MachineStatusBadge status={row.status} size="sm" />
                </td>
                {isShown("presence") && (
                  <td className="px-3 py-2.5">
                    <MachinePresenceBadge status={row.presence} size="sm" />
                  </td>
                )}
                {isShown("open") && (
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {row.openCount}
                  </td>
                )}
                {isShown("oldest") && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground tabular-nums">
                    {row.oldestOpenAt ? (
                      <CompactAge value={row.oldestOpenAt} />
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                {isShown("activity") && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
