"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, Info, Minus, Plus, RefreshCw } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
} from "~/lib/machines/presence";
import {
  LINEUP_FIX_GROUPS,
  LINEUP_MATRIX_ROWS,
  LINEUP_REASON_GROUP,
  isDifferenceGroup,
  isLineupCellId,
  lineupCellTone,
  type LineupCabinet,
  type LineupCellId,
  type LineupFixGroup,
  type LineupMachineRef,
  type LineupMatrixRow,
  type LineupPresence,
  type LineupReady,
  type LineupRow,
  type LineupTitleSummary,
} from "~/lib/pinballmap/lineup-comparison";
import type { PbmListingIntent } from "~/lib/pinballmap/listing-state";
import { cn } from "~/lib/utils";

import { LineupRowActions, type LineupActionContext } from "./LineupRowActions";

/** The URL parameter that carries the selected matrix cell (§4.4). */
export const LINEUP_CELL_PARAM = "cell";

/** Intent in the listing control's own words (§7.2). */
const INTENT_LABEL: Record<PbmListingIntent, string> = {
  on: "On the lineup",
  off: "Off the lineup",
  no_sync: "Don't sync",
};

const ROW_LABEL: Record<LineupMatrixRow, { label: string; sub: string }> = {
  on: { label: "On the lineup", sub: "At least one cabinet" },
  off: { label: "Off the lineup", sub: "None On, at least one Off" },
  none: { label: "No PinPoint machine", sub: "Entry matches no cabinet" },
  no_sync: { label: "Don't sync", sub: "Every cabinet" },
};

/** "Not on Pinball Map" → "not on Pinball Map": mid-sentence, keeping the proper noun. */
function lowerFirst(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

const PRESENCE_LABEL: Record<LineupPresence, string> = {
  on_pbm: "On Pinball Map",
  not_on_pbm: "Not on Pinball Map",
};

const GROUP_META: Record<
  LineupFixGroup,
  {
    name: string;
    summary: (n: number) => string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    glyphClass: string;
    chipClass: string;
  }
> = {
  to_add: {
    name: "To add",
    summary: (n) => `${String(n)} to add`,
    description: "Set On the lineup in PinPoint; not on Pinball Map.",
    icon: Plus,
    glyphClass: "border-success/50 bg-success-container/40 text-success",
    chipClass: "border-success/50 text-success",
  },
  to_remove: {
    name: "To remove",
    summary: (n) => `${String(n)} to remove`,
    description: "On Pinball Map; nothing in PinPoint keeps it there.",
    icon: Minus,
    glyphClass: "border-destructive/50 bg-destructive/10 text-destructive-text",
    chipClass: "border-destructive/50 text-destructive-text",
  },
  to_update: {
    name: "To update",
    summary: (n) => `${String(n)} to update`,
    description: "On Pinball Map and set On the lineup; a setting differs.",
    icon: RefreshCw,
    glyphClass: "border-warning/50 bg-warning-container/40 text-warning",
    chipClass: "border-warning/50 text-warning",
  },
  needs_decision: {
    name: "Needs a decision",
    summary: (n) => `${String(n)} ${n === 1 ? "needs" : "need"} a decision`,
    description: "PinPoint can't tell which side is right.",
    icon: Info,
    glyphClass: "border-secondary/50 bg-secondary-container/40 text-secondary",
    chipClass: "border-secondary/50 text-secondary",
  },
  worth_a_look: {
    name: "Worth a look",
    summary: (n) => `${String(n)} worth a look`,
    description: "In sync. No action required.",
    icon: Info,
    glyphClass: "border-outline-variant bg-card text-muted-foreground",
    chipClass: "border-outline-variant text-muted-foreground",
  },
};

const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/**
 * The lineup page's summary, comparison matrix, fix groups, in-sync list and
 * not-compared footer (lineup spec §4–§6). Everything arrives classified by
 * `compareLineup` on the server; this component only filters it by the
 * selected matrix cell, which lives in the URL so a filtered view can be
 * linked and survives a reload (§4.4).
 */
export function LineupComparisonView({
  comparison,
  context,
}: {
  comparison: LineupReady;
  context: LineupActionContext;
}): React.JSX.Element {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawCell = searchParams.get(LINEUP_CELL_PARAM);
  const selected: LineupCellId | null =
    rawCell !== null &&
    isLineupCellId(rawCell) &&
    lineupCellTone(rawCell) !== "empty"
      ? rawCell
      : null;

  function select(cell: LineupCellId | null): void {
    const params = new URLSearchParams(searchParams.toString());
    if (cell === null) params.delete(LINEUP_CELL_PARAM);
    else params.set(LINEUP_CELL_PARAM, cell);
    const query = params.toString();
    // The native history API integrates with the App Router: the URL changes
    // and `useSearchParams` follows, with no server round trip (§4.4).
    window.history.pushState(
      null,
      "",
      query === "" ? pathname : `${pathname}?${query}`
    );
  }

  const inCell = (cells: readonly LineupCellId[]): boolean =>
    selected === null || cells.includes(selected);
  const rows = comparison.rows.filter((row) => inCell(row.cells));
  const inSync = comparison.inSync.filter((s) => inCell([s.cell]));
  const dontSync = comparison.notCompared.dontSync.filter((s) =>
    inCell([s.cell])
  );

  return (
    <div className="space-y-6">
      <Summary comparison={comparison} />

      <Matrix
        comparison={comparison}
        selected={selected}
        onSelect={(cell) => {
          select(cell === selected ? null : cell);
        }}
      />

      {selected !== null ? (
        <div
          className="flex flex-wrap items-center gap-3 text-sm"
          data-testid="pbm-lineup-filter"
        >
          <span className="text-muted-foreground">Showing</span>
          <span className="rounded-full border border-outline-variant px-2.5 py-0.5 font-medium">
            {ROW_LABEL[rowOf(selected)].label} ·{" "}
            {lowerFirst(PRESENCE_LABEL[presenceOf(selected)])}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              select(null);
            }}
          >
            Show all titles
          </Button>
        </div>
      ) : null}

      {LINEUP_FIX_GROUPS.map((group) => {
        const groupRows = rows.filter(
          (row) => LINEUP_REASON_GROUP[row.reason] === group
        );
        if (groupRows.length === 0) return null;
        return (
          <FixGroup
            key={group}
            group={group}
            rows={groupRows}
            context={context}
          />
        );
      })}

      {selected !== null && rowOf(selected) === "no_sync" ? (
        <TitleList
          testId="pbm-lineup-dont-sync"
          heading="Don't sync"
          description="Set to Don't sync on every cabinet, so not compared."
          titles={dontSync}
          defaultOpen
        />
      ) : null}

      {selected !== null &&
      rows.length === 0 &&
      inSync.length === 0 &&
      rowOf(selected) !== "no_sync" ? (
        <p className="text-sm text-muted-foreground">No titles in this cell.</p>
      ) : null}

      {selected === null && rows.length === 0 ? (
        <p
          className="flex items-center gap-2 text-sm text-foreground"
          data-testid="pbm-lineup-all-in-sync"
        >
          <Check aria-hidden="true" className="size-4 text-success" />
          PinPoint and Pinball Map agree.
        </p>
      ) : null}

      {inSync.length > 0 ? (
        <TitleList
          // Re-mounts when a selection opens or closes it by default.
          key={selected ?? "all"}
          testId="pbm-lineup-in-sync"
          heading="In sync"
          description={`${String(
            inSync.filter((s) => presenceOf(s.cell) === "on_pbm").length
          )} on Pinball Map · ${String(
            inSync.filter((s) => presenceOf(s.cell) === "not_on_pbm").length
          )} not on Pinball Map`}
          titles={inSync}
          defaultOpen={
            selected !== null && lineupCellTone(selected) === "in_sync"
          }
        />
      ) : null}

      <NotCompared comparison={comparison} />
    </div>
  );
}

function rowOf(cell: LineupCellId): LineupMatrixRow {
  const [row] = cell.split(":");
  return LINEUP_MATRIX_ROWS.find((r) => r === row) ?? "none";
}

function presenceOf(cell: LineupCellId): LineupPresence {
  return cell.endsWith(":on_pbm") ? "on_pbm" : "not_on_pbm";
}

/** The total and the per-group counts (§4.1). Worth a look is not counted. */
function Summary({
  comparison,
}: {
  comparison: LineupReady;
}): React.JSX.Element {
  const groups = LINEUP_FIX_GROUPS.filter(
    (g) => isDifferenceGroup(g) && comparison.groupCounts[g] > 0
  );
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-4 gap-y-2"
      data-testid="pbm-lineup-summary"
    >
      <h2 className="text-xl font-bold">
        {comparison.differenceCount === 0
          ? "No differences between PinPoint and Pinball Map"
          : `${plural(comparison.differenceCount, "difference", "differences")} between PinPoint and Pinball Map`}
      </h2>
      {groups.map((group) => (
        <span
          key={group}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
            GROUP_META[group].chipClass
          )}
        >
          {GROUP_META[group].summary(comparison.groupCounts[group])}
        </span>
      ))}
    </div>
  );
}

const TONE_CLASS = {
  in_sync: "border-success/40 bg-success-container/20",
  difference: "border-destructive/50 bg-destructive/10",
  neutral: "border-outline-variant bg-background",
  empty: "border-dashed border-outline-variant text-muted-foreground",
} as const;

/** Titles by title intent against lineup presence (§4.2–§4.5). */
function Matrix({
  comparison,
  selected,
  onSelect,
}: {
  comparison: LineupReady;
  selected: LineupCellId | null;
  onSelect: (cell: LineupCellId) => void;
}): React.JSX.Element {
  const presences: readonly LineupPresence[] = ["on_pbm", "not_on_pbm"];
  const rowsInCell = (cell: LineupCellId): number =>
    comparison.rows.filter((row) => row.cells.includes(cell)).length;

  const cellLabel = (cell: LineupCellId): string => {
    switch (lineupCellTone(cell)) {
      case "in_sync": {
        // A title here can still sit in a group below (§4.5).
        const other = rowsInCell(cell);
        const agreeing = comparison.inSync.filter(
          (s) => s.cell === cell
        ).length;
        return other === 0
          ? "In sync"
          : `${String(agreeing)} in sync · ${String(other)} in groups below`;
      }
      case "difference":
        return "Differences";
      case "neutral":
        return "Not compared";
      case "empty":
        return "Nothing to compare";
    }
  };

  return (
    <section
      aria-labelledby="pbm-lineup-matrix-heading"
      className="@container rounded-xl border border-outline-variant bg-card p-4"
      data-testid="pbm-lineup-matrix"
    >
      <h2 id="pbm-lineup-matrix-heading" className="sr-only">
        Comparison matrix
      </h2>
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_minmax(0,1fr)] gap-2 @xl:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] @xl:gap-3">
        <div className="self-end text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
          PinPoint intent
        </div>
        {presences.map((p) => (
          <div
            key={p}
            className="self-end text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
          >
            {PRESENCE_LABEL[p]}
          </div>
        ))}
        {LINEUP_MATRIX_ROWS.map((row) => (
          <MatrixRow
            key={row}
            row={row}
            presences={presences}
            comparison={comparison}
            selected={selected}
            onSelect={onSelect}
            cellLabel={cellLabel}
          />
        ))}
      </div>
    </section>
  );
}

function MatrixRow({
  row,
  presences,
  comparison,
  selected,
  onSelect,
  cellLabel,
}: {
  row: LineupMatrixRow;
  presences: readonly LineupPresence[];
  comparison: LineupReady;
  selected: LineupCellId | null;
  onSelect: (cell: LineupCellId) => void;
  cellLabel: (cell: LineupCellId) => string;
}): React.JSX.Element {
  return (
    <>
      <div className="flex flex-col justify-center">
        <span className="text-sm font-semibold">{ROW_LABEL[row].label}</span>
        <span className="text-xs text-muted-foreground">
          {ROW_LABEL[row].sub}
        </span>
      </div>
      {presences.map((presence) => {
        const cell: LineupCellId = `${row}:${presence}`;
        const tone = lineupCellTone(cell);
        const count = comparison.matrix[cell];
        const isSelected = selected === cell;
        return (
          <button
            key={cell}
            type="button"
            aria-pressed={isSelected}
            disabled={tone === "empty"}
            aria-label={`${ROW_LABEL[row].label}, ${lowerFirst(PRESENCE_LABEL[presence])}: ${
              count === null
                ? "nothing to compare"
                : plural(count, "title", "titles")
            }`}
            onClick={() => {
              onSelect(cell);
            }}
            data-testid={`pbm-lineup-cell-${cell.replace(":", "-")}`}
            className={cn(
              "flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
              TONE_CLASS[tone],
              tone !== "empty" && "hover:bg-muted/60",
              isSelected &&
                "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              "disabled:cursor-default"
            )}
          >
            <span className="text-2xl font-bold tabular-nums">
              {count ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {cellLabel(cell)}
            </span>
          </button>
        );
      })}
    </>
  );
}

/** One fix group: name, count, what it means, and its rows (§5.1, §5.7). */
function FixGroup({
  group,
  rows,
  context,
}: {
  group: LineupFixGroup;
  rows: readonly LineupRow[];
  context: LineupActionContext;
}): React.JSX.Element {
  const meta = GROUP_META[group];
  const Icon = meta.icon;
  const headingId = `pbm-lineup-group-${group}`;
  return (
    <section
      aria-labelledby={headingId}
      className="@container rounded-xl border border-outline-variant bg-card"
      data-testid={`pbm-lineup-group-${group}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-md border",
            meta.glyphClass
          )}
        >
          <Icon className="size-4" />
        </span>
        <h3 id={headingId} className="text-base font-bold">
          {meta.name}
        </h3>
        <span className="font-semibold tabular-nums text-muted-foreground">
          {rows.length}
        </span>
        <span className="text-sm text-muted-foreground">
          {meta.description}
        </span>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-2 border-t border-outline-variant px-4 py-3 @3xl:grid @3xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_9rem_minmax(0,auto)] @3xl:items-center @3xl:gap-4"
            data-testid="pbm-lineup-row"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold">{row.title.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <RowSubject row={row} />
              </div>
            </div>
            <div className="min-w-0 text-sm">{reasonText(row)}</div>
            <div className="text-xs text-muted-foreground">
              {commentText(row)}
            </div>
            <LineupRowActions row={row} context={context} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The cabinets involved, or what the entry is when no cabinet owns it. */
function RowSubject({ row }: { row: LineupRow }): React.JSX.Element {
  switch (row.reason) {
    case "left_behind":
      return (
        <>
          Left behind when <MachineLink machine={row.abandonedBy} /> was
          re-matched
        </>
      );
    case "previous_location":
      return (
        <>
          Left by <MachineLink machine={row.abandonedBy} /> at a previously
          tracked location
        </>
      );
    case "unmatched_entry":
      return <>{modelLine(row.title) ?? "No PinPoint machine"}</>;
    case "edition_near_miss":
      return (
        <>
          <Cabinets cabinets={row.cabinets} /> · Pinball Map has{" "}
          {row.entry.title.name}
        </>
      );
    default:
      return <Cabinets cabinets={row.cabinets} />;
  }
}

function modelLine(title: LineupRow["title"]): string | null {
  const parts = [title.manufacturer, title.year?.toString() ?? null].filter(
    (p): p is string => p !== null && p !== ""
  );
  return parts.length === 0 ? null : parts.join(" · ");
}

function Cabinets({
  cabinets,
}: {
  cabinets: readonly LineupCabinet[];
}): React.JSX.Element {
  return (
    <>
      {cabinets.map((cabinet, i) => (
        <span key={cabinet.id}>
          {i > 0 ? "; " : null}
          <MachineLink machine={cabinet} /> · {INTENT_LABEL[cabinet.intent]} ·{" "}
          {getMachinePresenceLabel(cabinet.presenceStatus)}
        </span>
      ))}
    </>
  );
}

function MachineLink({
  machine,
}: {
  machine: LineupMachineRef;
}): React.JSX.Element {
  if (machine.initials === "") return <>{machine.name}</>;
  return (
    <Link
      href={`/m/${machine.initials}`}
      className="font-semibold text-foreground underline-offset-2 hover:underline"
    >
      {machine.initials}
    </Link>
  );
}

/** The reason in plain words (§5.7, §7). */
function reasonText(row: LineupRow): string {
  switch (row.reason) {
    case "missing":
      return "Not on Pinball Map";
    case "lingering":
      return "Still on Pinball Map";
    case "left_behind":
      return "Old entry still on Pinball Map";
    case "previous_location":
      return "On Pinball Map at a location PinPoint no longer tracks";
    case "ic_differs":
      return `Insider Connected: PinPoint ${row.icTarget === "on" ? "On" : "Off"}, Pinball Map ${
        row.icOnPinballMap === "on"
          ? "On"
          : row.icOnPinballMap === "off"
            ? "Off"
            : "Not set"
      }`;
    case "alert": {
      const cabinet = row.cabinets.find((c) => c.advisory === "alert");
      return `Set On the lineup, but availability is ${presenceWord(
        cabinet?.presenceStatus
      )}`;
    }
    case "edition_near_miss":
      return "Same game, different edition";
    case "unmatched_entry":
      return "On Pinball Map; no PinPoint machine for it";
    case "flag": {
      const cabinet = row.cabinets.find((c) => c.advisory === "flag");
      return `On Pinball Map while ${presenceWord(
        cabinet?.presenceStatus
      ).toLowerCase()} — remove it if it stays away more than a week`;
    }
  }
}

function presenceWord(status: MachinePresenceStatus | undefined): string {
  return status === undefined ? "unknown" : getMachinePresenceLabel(status);
}

function commentText(row: LineupRow): string {
  const count =
    row.reason === "edition_near_miss"
      ? row.entry.commentCount
      : row.commentCount;
  if (count === null)
    return row.reason === "previous_location" ? "Comment count unknown" : "—";
  const text =
    count === 0 ? "No comments" : plural(count, "comment", "comments");
  return row.reason === "edition_near_miss"
    ? `${text} on the ${row.entry.title.name} entry`
    : text;
}

/** A collapsible title list: In sync (§6.1) and a selected Don't sync cell. */
function TitleList({
  testId,
  heading,
  description,
  titles,
  defaultOpen,
}: {
  testId: string;
  heading: string;
  description: string;
  titles: readonly LineupTitleSummary[];
  defaultOpen: boolean;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultOpen);
  const listId = `${testId}-list`;
  return (
    <section
      aria-label={heading}
      className="@container rounded-xl border border-outline-variant bg-card"
      data-testid={testId}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span
          aria-hidden="true"
          className="inline-flex size-7 items-center justify-center rounded-md border border-success/40 bg-success-container/20 text-success"
        >
          <Check className="size-4" />
        </span>
        <h3 className="text-base font-bold">{heading}</h3>
        <span className="font-semibold tabular-nums text-muted-foreground">
          {titles.length}
        </span>
        <span className="text-sm text-muted-foreground">{description}</span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => {
            setExpanded(!expanded);
          }}
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 transition-transform motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
          {expanded ? "Hide" : "Show"}
        </Button>
      </div>
      {expanded ? (
        <ul id={listId}>
          {titles.map((summary) => (
            <li
              key={summary.key}
              className="flex flex-col gap-1 border-t border-outline-variant px-4 py-2.5 @3xl:grid @3xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_9rem] @3xl:items-center @3xl:gap-4"
            >
              <span className="text-sm font-semibold">
                {summary.title.name}
              </span>
              <span className="text-xs text-muted-foreground">
                <Cabinets cabinets={summary.cabinets} />
              </span>
              <span className="text-xs text-muted-foreground">
                {summary.commentCount === null
                  ? PRESENCE_LABEL[presenceOf(summary.cell)]
                  : summary.commentCount === 0
                    ? "No comments"
                    : plural(summary.commentCount, "comment", "comments")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** What the page does not compare (§6.2), and Insider Connected (§6.3). */
function NotCompared({
  comparison,
}: {
  comparison: LineupReady;
}): React.JSX.Element {
  const { dontSync, uncataloged, unmatched, unmatchedRemoved } =
    comparison.notCompared;
  const ic = comparison.insiderConnected;
  const parts: React.ReactNode[] = [];
  if (dontSync.length > 0)
    parts.push(
      <span key="dont-sync">
        {plural(dontSync.length, "title", "titles")} set to Don&apos;t sync
      </span>
    );
  if (uncataloged.length > 0)
    parts.push(
      <span key="uncataloged">
        {String(uncataloged.length)} uncataloged (
        <MachineList machines={uncataloged} href={(m) => `/m/${m.initials}`} />)
      </span>
    );
  if (unmatched.length > 0)
    parts.push(
      <span key="unmatched">
        {plural(unmatched.length, "machine", "machines")} without a catalog
        match (
        <MachineList
          machines={unmatched}
          href={(m) => `/m/${m.initials}/edit`}
        />
        )
      </span>
    );
  if (unmatchedRemoved.length > 0)
    parts.push(
      <span key="removed">
        {plural(unmatchedRemoved.length, "removed machine", "removed machines")}{" "}
        without a catalog match
      </span>
    );

  return (
    <footer
      className="space-y-1 px-1 text-sm leading-relaxed text-muted-foreground"
      data-testid="pbm-lineup-not-compared"
    >
      {parts.length > 0 ? (
        <p>
          Not compared:{" "}
          {parts.map((part, i) => (
            <span key={i}>
              {i > 0 ? " · " : null}
              {part}
            </span>
          ))}
        </p>
      ) : null}
      {ic.titles > 0 ? (
        <p data-testid="pbm-lineup-ic-summary">
          Insider Connected:{" "}
          {plural(ic.titles, "eligible title", "eligible titles")} on Pinball
          Map {ic.titles === 1 ? "has" : "have"} no PinPoint setting, so nothing
          is compared. Pinball Map shows {String(ic.onPinballMap.on)} On,{" "}
          {String(ic.onPinballMap.off)} Off, {String(ic.onPinballMap.not_set)}{" "}
          Not set.
        </p>
      ) : null}
    </footer>
  );
}

function MachineList({
  machines,
  href,
}: {
  machines: readonly LineupMachineRef[];
  href: (machine: LineupMachineRef) => string;
}): React.JSX.Element {
  return (
    <>
      {machines.map((machine, i) => (
        <span key={machine.id}>
          {i > 0 ? ", " : null}
          <Link
            href={href(machine)}
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {machine.initials}
          </Link>
        </span>
      ))}
    </>
  );
}
