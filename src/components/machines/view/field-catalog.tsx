"use client";

import type React from "react";
import Link from "next/link";
import { CircleCheck, TriangleAlert, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { MachinePresenceBadge } from "~/components/machines/MachinePresenceBadge";
import { useRelativeNow } from "~/components/issues/RelativeTimeProvider";
import { formatDate } from "~/lib/dates";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  getMachineStatusLabel,
  type MachineStatus,
} from "~/lib/machines/status";
import { MACHINE_VIEW_FIELDS } from "~/lib/machines/view/config";
import { formatCompactAgeAgo } from "~/lib/machines/view/model";
import type { MachineViewFieldId, MachineViewRow } from "~/lib/types";
import { cn } from "~/lib/utils";

export type MachineSelectionHandler = (machineId: string) => void;

const STATUS_INDICATORS: Record<
  MachineStatus,
  { icon: LucideIcon; color: string }
> = {
  operational: { icon: CircleCheck, color: "text-success" },
  needs_service: { icon: Wrench, color: "text-warning" },
  unplayable: { icon: TriangleAlert, color: "text-destructive-text" },
};

interface MachineIdentityProps {
  row: MachineViewRow;
  onMachineSelect?: MachineSelectionHandler | undefined;
}

export function MachineIdentity({
  row,
  onMachineSelect,
}: MachineIdentityProps): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={`/m/${row.initials}`}
          {...(onMachineSelect === undefined
            ? {}
            : {
                onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault();
                  onMachineSelect(row.id);
                },
              })}
          className="truncate rounded-sm text-sm font-bold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.title}
        </Link>
        <Badge
          variant="outline"
          className="shrink-0 border-outline-variant px-1.5 py-0 text-xs font-medium uppercase text-muted-foreground"
        >
          {row.initials}
        </Badge>
      </div>
      <div className="mt-0.5 truncate text-sm font-normal text-muted-foreground">
        {row.manufacturer} · {row.year ?? "Unknown"} · {row.ownerName}
      </div>
    </div>
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
  const indicator = STATUS_INDICATORS[status];
  const Icon = indicator.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <Icon aria-hidden="true" className={cn("size-4", indicator.color)} />
      {getMachineStatusLabel(status)}
    </span>
  );
}

function IssueCount({ row }: { row: MachineViewRow }): React.JSX.Element {
  const count = row.health?.openIssues ?? 0;
  if (count === 0)
    return <span className="text-xs font-medium text-muted-foreground">0</span>;
  const worst = row.health?.worstSeverity;
  const label = `${count} open ${count === 1 ? "issue" : "issues"}`;
  const severity =
    worst === null || worst === undefined ? null : SEVERITY_CONFIG[worst];
  const Icon = severity?.icon;

  return (
    <Link
      href={`/issues?machine=${encodeURIComponent(row.initials)}`}
      aria-label={`View ${label} for ${row.title}`}
      className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {Icon ? (
        <Icon aria-hidden="true" className={cn("size-4", severity.iconColor)} />
      ) : null}
      {count}
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

export interface MachineViewFieldRenderer {
  label: string;
  align: "left" | "center" | "right";
  tableClassName?: string;
  render(row: MachineViewRow): React.ReactNode;
}

export const MACHINE_VIEW_FIELD_RENDERERS: Record<
  Exclude<MachineViewFieldId, "machine">,
  MachineViewFieldRenderer
> = {
  playability: {
    label: MACHINE_VIEW_FIELDS.playability.label,
    align: "left",
    render: (row) =>
      row.health ? <Playability status={row.health.playability} /> : "—",
  },
  openIssues: {
    label: MACHINE_VIEW_FIELDS.openIssues.label,
    align: "center",
    tableClassName: "tabular-nums",
    render: (row) => <IssueCount row={row} />,
  },
  lastServiced: {
    label: MACHINE_VIEW_FIELDS.lastServiced.label,
    align: "left",
    render: (row) => <LastServiced row={row} />,
  },
  presence: {
    label: MACHINE_VIEW_FIELDS.presence.label,
    align: "left",
    render: (row) => <MachinePresenceBadge status={row.presence} size="sm" />,
  },
  owner: {
    label: MACHINE_VIEW_FIELDS.owner.label,
    align: "left",
    render: (row) => row.ownerName,
  },
  manufacturer: {
    label: MACHINE_VIEW_FIELDS.manufacturer.label,
    align: "left",
    render: (row) => row.manufacturer,
  },
  year: {
    label: MACHINE_VIEW_FIELDS.year.label,
    align: "right",
    tableClassName: "tabular-nums",
    render: (row) => row.year ?? "Unknown",
  },
  oldestOpenIssue: {
    label: MACHINE_VIEW_FIELDS.oldestOpenIssue.label,
    align: "left",
    render: (row) =>
      row.health?.oldestOpenIssueAt ? (
        <RelativeAge value={row.health.oldestOpenIssueAt} />
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
  },
  lastActivity: {
    label: MACHINE_VIEW_FIELDS.lastActivity.label,
    align: "left",
    render: (row) =>
      row.lastActivityAt ? (
        <RelativeAge value={row.lastActivityAt} />
      ) : (
        <span className="text-muted-foreground">None</span>
      ),
  },
  dateAdded: {
    label: MACHINE_VIEW_FIELDS.dateAdded.label,
    align: "left",
    render: (row) => (
      <time dateTime={row.createdAt}>{formatDate(row.createdAt)}</time>
    ),
  },
};
