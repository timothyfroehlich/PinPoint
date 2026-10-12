"use client";

import * as React from "react";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { useMeasuredWidths } from "~/components/list-view/use-measured-widths";
import { formatCompactAge } from "~/lib/dates";
import { planLineDrops } from "~/lib/list-view/overflow";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
} from "~/lib/machines/status";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import {
  MachineIdentity,
  machineYearLabel,
  OpenIssueCount,
  PlayabilityDot,
  type MachineRowAction,
  type MachineSelectionHandler,
} from "./field-catalog";

type DetailSegment = "manufacturer" | "year" | "owner" | "lastServiced";

/** The order line 2 shows its segments in (machine-views §5.9). */
const DISPLAY_ORDER: readonly DetailSegment[] = [
  "manufacturer",
  "year",
  "owner",
  "lastServiced",
];

/** The order line 2 drops its segments in when crowded (§5.10). */
const DROP_ORDER: readonly DetailSegment[] = [
  "year",
  "manufacturer",
  "lastServiced",
  "owner",
];

const SEPARATOR = " · ";

interface MachineViewCompactListProps {
  rows: MachineViewRow[];
  /** The displayed fields, which decide what line 2 can show (§5.9). */
  columns: readonly MachineViewFieldId[];
  onMachineSelect?: MachineSelectionHandler | undefined;
  rowAction?: MachineRowAction | undefined;
}

/** "serviced 3d", or "never serviced" without qualifying history (§5.7). */
function servicedLabel(lastServicedAt: string | null, now: number): string {
  if (lastServicedAt === null) return "never serviced";
  const age = formatCompactAge(lastServicedAt, now);
  return age === "now" ? "serviced just now" : `serviced ${age}`;
}

function DetailLine({
  row,
  showPlayability,
  showServiced,
}: {
  row: MachineViewRow;
  showPlayability: boolean;
  showServiced: boolean;
}): React.JSX.Element {
  const lineRef = React.useRef<HTMLParagraphElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const now = useRelativeNow();

  const playability =
    showPlayability && row.health ? row.health.playability : null;
  const playabilityLabel =
    playability === null ? null : getMachineStatusLabel(playability);
  // The service age waits for the shared clock, like every relative age, and
  // for the service data, which displaying Last Serviced loads (§3.6).
  const segments: Partial<Record<DetailSegment, string>> = {
    manufacturer: row.manufacturer,
    year: machineYearLabel(row),
    owner: row.ownerName,
    ...(showServiced && now !== null && row.lastServicedAt !== undefined
      ? { lastServiced: servicedLabel(row.lastServicedAt, now) }
      : {}),
  };
  const present = DISPLAY_ORDER.filter((key) => segments[key] !== undefined);

  const contentKey = [
    playabilityLabel ?? "",
    ...present.map((key) => segments[key] ?? ""),
  ].join("\n");
  const measured = useMeasuredWidths(lineRef, laneRef, contentKey);
  // Until the line is measured everything shows, and truncation keeps it to
  // one line; the first measurement lands before the browser paints.
  const dropped =
    measured && measured.available > 0
      ? planLineDrops<DetailSegment>({
          available: measured.available,
          keptWidth: measured.widths["playability"] ?? 0,
          segmentWidths: Object.fromEntries(
            present.map((key) => [key, measured.widths[key] ?? 0])
          ),
          dropOrder: DROP_ORDER,
        })
      : new Set<DetailSegment>();
  const visible = present.filter((key) => !dropped.has(key));

  return (
    // Not positioned: a positioned line would sit above the row link's
    // overlay and swallow taps on it. The lane anchors to the row instead.
    <div className="mt-0.5 min-w-0">
      <p ref={lineRef} className="truncate text-[13px] text-muted-foreground">
        {playability !== null ? (
          <span className={MACHINE_STATUS_COLORS[playability].text}>
            {playabilityLabel}
          </span>
        ) : null}
        {visible.map((key, index) => (
          <React.Fragment key={key}>
            {playabilityLabel !== null || index > 0 ? SEPARATOR : null}
            {segments[key]}
          </React.Fragment>
        ))}
      </p>
      {/* Each part at its natural width, separator included (list-views §8). */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden text-[13px]"
      >
        {playabilityLabel !== null ? (
          <span data-measure="playability" className="absolute whitespace-pre">
            {playabilityLabel}
          </span>
        ) : null}
        {present.map((key) => (
          <span
            key={key}
            data-measure={key}
            className="absolute whitespace-pre"
          >
            {SEPARATOR}
            {segments[key]}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The phone Compact list (machine-views §5.3, §5.9): two lines per machine.
 * Line 1 holds the Playability dot, identity, and open-issue count; the name
 * truncates first, so the initials badge and the count always stay on
 * screen. Line 2 spans the row and never wraps: the Playability label, then
 * manufacturer, year, owner, and Last Serviced, dropping year, manufacturer,
 * Last Serviced, then owner when they do not fit (§5.10). Other selected
 * fields show only in Table mode. The whole row links to the machine; the
 * open-issue count and any row action stay their own targets above it.
 */
export function MachineViewCompactList({
  rows,
  columns,
  onMachineSelect,
  rowAction,
}: MachineViewCompactListProps): React.JSX.Element {
  const showPlayability = columns.includes("playability");
  const showServiced = columns.includes("lastServiced");
  return (
    // Rows align with the page's horizontal padding (list-views §7.7).
    <ul aria-label="Machines list" className="md:hidden">
      {rows.map((row) => (
        // The row is the containing block for the name link's overlay, which
        // makes the whole row a link to the machine.
        <li
          key={row.id}
          className="relative flex min-h-11 items-center gap-2 border-b border-border px-4 py-2.5 sm:px-8"
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2.5">
              {row.health ? (
                <PlayabilityDot status={row.health.playability} />
              ) : null}
              <div className="min-w-0 flex-1">
                <MachineIdentity
                  row={row}
                  variant="compact"
                  onMachineSelect={onMachineSelect}
                />
              </div>
              <div className="shrink-0">
                <OpenIssueCount row={row} variant="compact" />
              </div>
            </div>
            <DetailLine
              row={row}
              showPlayability={showPlayability}
              showServiced={showServiced}
            />
          </div>
          {/* Positioned, so the action sits above the row link's overlay. */}
          {rowAction ? (
            <div className="relative shrink-0">{rowAction(row)}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
