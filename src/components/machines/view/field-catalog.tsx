"use client";

import type React from "react";
import Link from "next/link";
import { CircleCheck, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { formatDate } from "~/lib/dates";
import { machineIssuesHref } from "~/lib/issues/links";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
  type MachineStatus,
} from "~/lib/machines/status";
import { formatCompactAgeAgo } from "~/lib/dates";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import { cn } from "~/lib/utils";

export type MachineSelectionHandler = (machineId: string) => void;

const STATUS_ICONS: Record<MachineStatus, LucideIcon> = {
  operational: CircleCheck,
  needs_service: Wrench,
  unplayable: TriangleAlert,
};

interface MachineIdentityProps {
  row: MachineViewRow;
  onMachineSelect?: MachineSelectionHandler | undefined;
}

/**
 * Machine identity on one line (machine-views §3.2): the title link, which
 * truncates (its full title stays in the link text and tooltip), then the
 * initials badge, which never shrinks.
 */
export function MachineIdentity({
  row,
  onMachineSelect,
}: MachineIdentityProps): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href={`/m/${row.initials}`}
        title={row.title}
        {...(onMachineSelect === undefined
          ? {}
          : {
              onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                event.preventDefault();
                onMachineSelect(row.id);
              },
            })}
        className="min-w-0 truncate rounded-sm text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row.title}
      </Link>
      <Badge
        variant="outline"
        className="rounded-sm border-outline-variant px-1.5 py-0 text-xs font-medium uppercase text-muted-foreground"
      >
        {row.initials}
      </Badge>
    </div>
  );
}

/**
 * The phone Compact row's Playability dot. Color is never the only signal:
 * the dot is an image named by its Playability label.
 */
export function PlayabilityDot({
  status,
}: {
  status: MachineStatus;
}): React.JSX.Element {
  const label = getMachineStatusLabel(status);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        MACHINE_STATUS_COLORS[status].dot
      )}
    />
  );
}

function RelativeAge({ value }: { value: string }): React.JSX.Element {
  const now = useRelativeNow();
  return (
    <time dateTime={value}>
      {now === null ? "" : formatCompactAgeAgo(value, new Date(now))}
    </time>
  );
}

function Playability({ status }: { status: MachineStatus }): React.JSX.Element {
  const Icon = STATUS_ICONS[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <Icon
        aria-hidden="true"
        className={cn("size-4", MACHINE_STATUS_COLORS[status].text)}
      />
      {getMachineStatusLabel(status)}
    </span>
  );
}

/**
 * A machine's open-issue count (machine-views §5.6). A nonzero count takes the
 * color of the machine's worst open severity and links to its issues in every
 * presence state (issues-list §7.4); zero stays neutral and unlinked. The
 * table shows the number; the phone Compact row shows "N open".
 *
 * Every severity shares one icon, so color is never the only cue: the link's
 * accessible name and its tooltip both name the worst severity.
 *
 * On the phone Compact row the link stays visually compact but an invisible
 * `::before` grows its hit area to 44px tall (list-views §7.9). The hit area
 * keeps the link's own width, so it never reaches under the title beside it.
 */
export function OpenIssueCount({
  row,
  variant,
}: {
  row: MachineViewRow;
  variant: "table" | "compact";
}): React.JSX.Element {
  const count = row.health?.openIssues ?? 0;
  if (count === 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {variant === "table" ? "0" : "None open"}
      </span>
    );
  }
  const worst = row.health?.worstSeverity;
  const severity =
    worst === null || worst === undefined ? null : SEVERITY_CONFIG[worst];
  const Icon = severity?.icon;
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
        "inline-flex items-center gap-1.5 rounded-sm text-xs font-medium whitespace-nowrap underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        severity?.iconColor ?? "text-foreground",
        // 16px link → 44px tall hit area; its width already exceeds 44px.
        variant === "compact" &&
          "relative before:absolute before:inset-x-0 before:-inset-y-3.5"
      )}
    >
      {Icon ? (
        <Icon aria-hidden="true" className={cn("size-4", severity.iconColor)} />
      ) : null}
      {variant === "table" ? count : `${count} open`}
    </Link>
  );
}

function LastServiced({ row }: { row: MachineViewRow }): React.JSX.Element {
  if (!row.lastServicedAt) {
    return (
      <span className="text-xs font-medium text-muted-foreground">Never</span>
    );
  }
  return (
    <Link
      href={`/m/${row.initials}/maintenance`}
      aria-label={`View service history for ${row.title}`}
      className="inline-flex rounded-sm text-xs font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <RelativeAge value={row.lastServicedAt} />
    </Link>
  );
}

/** How a field renders in a table cell; the column label is the field's own. */
export interface MachineViewFieldRenderer {
  align: "left" | "right";
  tableClassName?: string;
  render(row: MachineViewRow): React.ReactNode;
}

export const MACHINE_VIEW_FIELD_RENDERERS: Record<
  Exclude<MachineViewFieldId, "machine">,
  MachineViewFieldRenderer
> = {
  playability: {
    align: "left",
    render: (row) =>
      row.health ? <Playability status={row.health.playability} /> : "—",
  },
  openIssues: {
    align: "right",
    tableClassName: "tabular-nums",
    render: (row) => <OpenIssueCount row={row} variant="table" />,
  },
  lastServiced: {
    align: "left",
    render: (row) => <LastServiced row={row} />,
  },
  presence: {
    align: "left",
    render: (row) => <MachinePresenceBadge status={row.presence} size="sm" />,
  },
  owner: {
    align: "left",
    render: (row) => row.ownerName,
  },
  manufacturer: {
    align: "left",
    render: (row) => row.manufacturer,
  },
  year: {
    align: "right",
    tableClassName: "tabular-nums",
    render: (row) => row.year ?? "Unknown",
  },
  oldestOpenIssue: {
    align: "left",
    render: (row) =>
      row.health?.oldestOpenIssueAt ? (
        <RelativeAge value={row.health.oldestOpenIssueAt} />
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
  },
  lastActivity: {
    align: "left",
    render: (row) =>
      row.lastActivityAt ? (
        <RelativeAge value={row.lastActivityAt} />
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
  },
  dateAdded: {
    align: "left",
    render: (row) => (
      <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
    ),
  },
};
