"use client";

import type React from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import {
  LIST_ROW_RAISED,
  ListRow,
  ListRowDetails,
  ListRowTitleLink,
  type ListRowPart,
} from "~/components/list-view/ListRow";
import {
  InitialsAvatar,
  ListRowDot,
  RowAge,
  useRowAgeText,
  type ListRowDotShape,
} from "~/components/list-view/row-parts";
import { Badge } from "~/components/ui/badge";
import { machineIssuesHref } from "~/lib/issues/links";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
  type MachineStatus,
} from "~/lib/machines/status";
import type { MachineViewRow } from "~/lib/types";
import { cn } from "~/lib/utils";

export type MachineSelectionHandler = (machineId: string) => void;

/** Renders an action at the end of a machine row. */
export type MachineRowAction = (row: MachineViewRow) => React.ReactNode;

type DetailPart =
  "playability" | "manufacturer" | "year" | "owner" | "lastServiced";

/** The order line 2 drops its parts in when crowded (§5.10). */
const DROP_ORDER: readonly DetailPart[] = [
  "year",
  "manufacturer",
  "lastServiced",
  "owner",
];

/** A machine's year, or "Unknown" when it has none (machine-views §3.3). */
export function machineYearLabel(row: Pick<MachineViewRow, "year">): string {
  return row.year === null ? "Unknown" : String(row.year);
}

/*
 * Each Playability's dot shape (machine-views §5.11), matching the issue
 * rows' status dots: a filled circle, a ring, and a diamond.
 */
const PLAYABILITY_DOT_SHAPES: Record<MachineStatus, ListRowDotShape> = {
  operational: "filled",
  needs_service: "ring",
  unplayable: "diamond",
};

const NEVER_SERVICED = { short: "never", spoken: "Never serviced" };

function servicedSpoken(age: string): string {
  return `Serviced ${age}`;
}

/**
 * Line 1's identity (machine-views §3.2): the title link, which truncates
 * (its full title stays in the link text and tooltip), then the initials
 * badge, which never shrinks.
 */
function MachineIdentity({
  row,
  onMachineSelect,
}: {
  row: MachineViewRow;
  onMachineSelect?: MachineSelectionHandler | undefined;
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ListRowTitleLink
        href={`/m/${row.initials}`}
        title={row.title}
        truncate
        onClick={
          onMachineSelect === undefined
            ? undefined
            : (event) => {
                event.preventDefault();
                onMachineSelect(row.id);
              }
        }
      >
        {row.title}
      </ListRowTitleLink>
      <Badge
        variant="outline"
        className="shrink-0 rounded-[5px] border-outline-variant px-1.5 py-0 text-[11px] leading-4 font-semibold uppercase text-muted-foreground"
      >
        {row.initials}
      </Badge>
    </div>
  );
}

/**
 * A machine's open-issue count (machine-views §5.3, §5.6): "N open". A
 * nonzero count takes the color of the machine's worst open severity and
 * links to its issues in every presence state (issues-list §7.4); zero
 * reads "None open", neutral and unlinked. Color is never the only cue: the
 * link's accessible name and its tooltip both name the worst severity.
 *
 * The count draws above the row link. An invisible `::before` makes its hit
 * area at least 44px wide (list-views §7.9), growing leftward into the gap
 * before it, and reaches up to the row's top edge. It stops at line 2, so a
 * tap on line 2 always opens the machine.
 */
function OpenIssueCount({ row }: { row: MachineViewRow }): React.JSX.Element {
  const count = row.health.openIssues;
  if (count === 0) {
    return <span className="text-[13px] text-muted-foreground">None open</span>;
  }
  const worst = row.health.worstSeverity;
  const severity = worst === null ? null : SEVERITY_CONFIG[worst];
  const issues = `${count} open ${count === 1 ? "issue" : "issues"}`;
  const worstLabel = severity === null ? "" : `, worst ${severity.label}`;

  return (
    <Link
      href={machineIssuesHref(row.initials)}
      aria-label={`View ${issues} for ${row.title}${worstLabel}`}
      {...(severity === null
        ? {}
        : { title: `Worst severity: ${severity.label}` })}
      className={cn(
        LIST_ROW_RAISED,
        "inline-flex items-center rounded-sm text-[13px] whitespace-nowrap underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "before:absolute before:right-0 before:-top-3 before:bottom-0 before:w-full before:min-w-11",
        severity?.iconColor ?? "text-foreground"
      )}
    >
      {count} open
    </Link>
  );
}

/**
 * Line 2 (machine-views §5.9, §5.10), on one line at every width: the
 * Playability label, manufacturer, and year ("·" only between those), then
 * the owner's initials avatar; the service age (a wrench and "2h ago") is
 * right-anchored at the line's end. When the line does not fit it drops
 * the year, the manufacturer, the service age, then the owner. The service
 * age is plain text, never a link (§5.12).
 */
function MachineRowDetails({
  row,
}: {
  row: MachineViewRow;
}): React.JSX.Element {
  const playability = row.health.playability;
  const playabilityLabel = getMachineStatusLabel(playability);
  const ownerName = row.hasOwner ? row.ownerName : null;
  const ownerLabel = ownerName === null ? "No owner" : `Owner: ${ownerName}`;
  const year = machineYearLabel(row);
  const ageText = useRowAgeText(row.lastServicedAt);
  const serviceAge = (testId?: string): React.JSX.Element => (
    <RowAge
      date={row.lastServicedAt}
      icon={Wrench}
      spoken={servicedSpoken}
      empty={NEVER_SERVICED}
      testId={testId}
    />
  );

  const leading: ListRowPart<DetailPart>[] = [
    {
      key: "playability",
      text: true,
      truncate: true,
      node: (
        <span
          className={cn("truncate", MACHINE_STATUS_COLORS[playability].text)}
        >
          {playabilityLabel}
        </span>
      ),
    },
    { key: "manufacturer", text: true, node: row.manufacturer },
    { key: "year", text: true, node: year },
    {
      key: "owner",
      node: <InitialsAvatar name={ownerName} label={ownerLabel} />,
    },
  ];
  const trailing: ListRowPart<DetailPart>[] = [
    {
      key: "lastServiced",
      node: serviceAge("machine-row-service-age"),
      measure: serviceAge(),
    },
  ];

  return (
    <ListRowDetails
      leading={leading}
      trailing={trailing}
      dropOrder={DROP_ORDER}
      contentKey={[
        playabilityLabel,
        row.manufacturer,
        year,
        ownerName ?? "",
        ageText,
      ].join("\n")}
      testId="machine-row-detail"
    />
  );
}

/**
 * One machine row (machine-views §5.3, §5.9), on the shared two-line row at
 * every width. Line 1: the Playability dot, the identity, and the
 * open-issue count; the name truncates first, so the initials badge and the
 * count always stay on screen. Line 2: see `MachineRowDetails`. The whole
 * row links to the machine; the open-issue count and any row action stay
 * their own targets above it.
 */
export function MachineListEntry({
  row,
  onMachineSelect,
  rowAction,
}: {
  row: MachineViewRow;
  onMachineSelect?: MachineSelectionHandler | undefined;
  rowAction?: MachineRowAction | undefined;
}): React.JSX.Element {
  const playability = row.health.playability;
  return (
    <ListRow
      testId="machine-row"
      dot={
        <ListRowDot
          shape={PLAYABILITY_DOT_SHAPES[playability]}
          colorClass={MACHINE_STATUS_COLORS[playability].text}
          label={getMachineStatusLabel(playability)}
        />
      }
      title={<MachineIdentity row={row} onMachineSelect={onMachineSelect} />}
      titleEnd={<OpenIssueCount row={row} />}
      details={<MachineRowDetails row={row} />}
      action={rowAction ? rowAction(row) : undefined}
    />
  );
}
