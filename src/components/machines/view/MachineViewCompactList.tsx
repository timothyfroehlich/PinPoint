"use client";

import * as React from "react";
import { formatDistanceStrict } from "date-fns";
import { Wrench } from "lucide-react";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { useMeasuredWidths } from "~/components/list-view/use-measured-widths";
import { formatCompactAgeAgo } from "~/lib/dates";
import { planLineDrops } from "~/lib/list-view/overflow";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
} from "~/lib/machines/status";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import { cn } from "~/lib/utils";
import {
  MachineIdentity,
  machineYearLabel,
  OpenIssueCount,
  PlayabilityDot,
  type MachineRowAction,
  type MachineSelectionHandler,
} from "./field-catalog";

type TextSegment = "manufacturer" | "year";
type DetailSegment = TextSegment | "owner" | "lastServiced";

/** The text after the Playability label, in display order (§5.9). */
const TEXT_ORDER: readonly TextSegment[] = ["manufacturer", "year"];

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

/** Up to two initials from a display name: "Priya Shah" → "PS". */
function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * The owner's initials in a 20px circle, or an empty dashed circle when the
 * machine has no owner (§5.9), matching the issue row's assignee avatar.
 * Names only, never email addresses (CORE-SEC-007).
 */
function OwnerAvatar({ name }: { name: string | null }): React.JSX.Element {
  const label = name === null ? "No owner" : `Owner: ${name}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full align-middle text-[9px] leading-none font-bold",
        name === null
          ? "border border-dashed border-muted-foreground/60"
          : "bg-outline text-foreground"
      )}
    >
      {name === null ? null : nameInitials(name)}
    </span>
  );
}

interface ServiceAgeText {
  /** "2h ago", "just now", or "never". */
  short: string;
  /** "Serviced 2 hours ago", or "Never serviced". */
  spoken: string;
}

/** The service age's words (§5.7, §5.9). */
function serviceAgeText(
  lastServicedAt: string | null,
  now: number
): ServiceAgeText {
  if (lastServicedAt === null) {
    return { short: "never", spoken: "Never serviced" };
  }
  const short = formatCompactAgeAgo(lastServicedAt, now);
  const spoken =
    short === "just now"
      ? "Serviced just now"
      : `Serviced ${formatDistanceStrict(lastServicedAt, now, {
          addSuffix: true,
          roundingMethod: "floor",
        })}`;
  return { short, spoken };
}

/**
 * A wrench and the short age; screen readers hear the spoken words instead.
 * Plain text on a Compact row, never a link (§5.12).
 */
function ServiceAge({ text }: { text: ServiceAgeText }): React.JSX.Element {
  return (
    <>
      <Wrench aria-hidden="true" className="size-3.5 shrink-0" />
      <span aria-hidden="true">{text.short}</span>
      <span className="sr-only">{text.spoken}</span>
    </>
  );
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
  const lineRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const now = useRelativeNow();

  const playability =
    showPlayability && row.health ? row.health.playability : null;
  const playabilityLabel =
    playability === null ? null : getMachineStatusLabel(playability);
  const ownerName = row.hasOwner ? row.ownerName : null;
  const text: Record<TextSegment, string> = {
    manufacturer: row.manufacturer,
    year: machineYearLabel(row),
  };
  // The service age waits for the shared clock, like every relative age, and
  // for the service data, which displaying Last Serviced loads (§3.6).
  const serviced =
    showServiced && now !== null && row.lastServicedAt !== undefined
      ? serviceAgeText(row.lastServicedAt, now)
      : null;
  const present: readonly DetailSegment[] =
    serviced === null
      ? [...TEXT_ORDER, "owner"]
      : [...TEXT_ORDER, "owner", "lastServiced"];

  const contentKey = [
    playabilityLabel ?? "",
    text.manufacturer,
    text.year,
    ownerName ?? "",
    serviced?.short ?? "",
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
  const visibleText = TEXT_ORDER.filter((key) => !dropped.has(key));
  const showOwner = !dropped.has("owner");
  // Every part of the left group after the first follows a separator.
  const leadCount = playabilityLabel === null ? 0 : 1;

  return (
    // Not positioned: a positioned line would sit above the row link's
    // overlay and swallow taps on it. The lane anchors to the row instead.
    <div className="mt-0.5 min-w-0">
      <div
        ref={lineRef}
        data-testid="machine-row-detail"
        className="flex min-w-0 items-center gap-3 text-[13px] leading-5 text-muted-foreground"
      >
        <p className="min-w-0 truncate">
          {playability !== null ? (
            <span className={MACHINE_STATUS_COLORS[playability].text}>
              {playabilityLabel}
            </span>
          ) : null}
          {visibleText.map((key, index) => (
            <React.Fragment key={key}>
              {leadCount + index > 0 ? SEPARATOR : null}
              {text[key]}
            </React.Fragment>
          ))}
          {showOwner ? (
            <>
              {leadCount + visibleText.length > 0 ? SEPARATOR : null}
              <OwnerAvatar name={ownerName} />
            </>
          ) : null}
        </p>
        {/* Right-anchored under the open-issue count, at least 12px from the
            left group; once it drops, the left group has the whole line. */}
        {serviced !== null && !dropped.has("lastServiced") ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
            <ServiceAge text={serviced} />
          </span>
        ) : null}
      </div>
      {/* Each part at its natural width, with its separator or its 12px gap
          (list-views §8). */}
      <div
        ref={laneRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden text-[13px] leading-5"
      >
        {playabilityLabel !== null ? (
          <span data-measure="playability" className="absolute whitespace-pre">
            {playabilityLabel}
          </span>
        ) : null}
        {TEXT_ORDER.map((key) => (
          <span
            key={key}
            data-measure={key}
            className="absolute whitespace-pre"
          >
            {SEPARATOR}
            {text[key]}
          </span>
        ))}
        <span data-measure="owner" className="absolute whitespace-pre">
          {SEPARATOR}
          <OwnerAvatar name={ownerName} />
        </span>
        {serviced !== null ? (
          <span
            data-measure="lastServiced"
            className="absolute inline-flex items-center gap-1 pl-3 whitespace-nowrap"
          >
            <ServiceAge text={serviced} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The phone Compact list (machine-views §5.3, §5.9): two lines per machine.
 * Line 1 holds the Playability dot, identity, and open-issue count; the name
 * truncates first, so the initials badge and the count always stay on
 * screen. Line 2 spans the row and never wraps: the Playability label,
 * manufacturer, year, and the owner's initials avatar on the left, and the
 * service age (a wrench and "2h ago") right-anchored under the count. When
 * they do not fit it drops year, manufacturer, the service age, then the
 * owner (§5.10). Other selected fields show only in Table mode. The whole
 * row links to the machine; the open-issue count and any row action stay
 * their own targets above it.
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
