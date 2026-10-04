import type { MachineViewFieldId, MachineViewSortDirection } from "~/lib/types";

/**
 * How the sort control names each Machine View sort (machine-views §3.14,
 * list-views §5.5): the field, then its direction in words that fit the
 * field's values, such as "Name, A–Z" or "Last Serviced, oldest".
 */
const SORT_FIELD_LABELS: Record<MachineViewFieldId, string> = {
  machine: "Name",
  playability: "Playability",
  openIssues: "Open Issues",
  lastServiced: "Last Serviced",
  presence: "Presence",
  owner: "Owner",
  manufacturer: "Manufacturer",
  year: "Year",
  oldestOpenIssue: "Oldest Open Issue",
  lastActivity: "Last Activity",
  dateAdded: "Date Added",
};

type DirectionLabels = Record<MachineViewSortDirection, string>;

const ALPHABETICAL: DirectionLabels = { asc: "A–Z", desc: "Z–A" };
const DATES: DirectionLabels = { asc: "oldest", desc: "newest" };

const SORT_DIRECTION_LABELS: Record<MachineViewFieldId, DirectionLabels> = {
  machine: ALPHABETICAL,
  playability: { asc: "best first", desc: "worst first" },
  openIssues: { asc: "fewest", desc: "most" },
  lastServiced: DATES,
  presence: { asc: "on the floor first", desc: "removed first" },
  owner: ALPHABETICAL,
  manufacturer: ALPHABETICAL,
  year: DATES,
  oldestOpenIssue: DATES,
  lastActivity: DATES,
  dateAdded: DATES,
};

export function machineSortFieldLabel(field: MachineViewFieldId): string {
  return SORT_FIELD_LABELS[field];
}

export function machineSortDirectionLabels(
  field: MachineViewFieldId
): DirectionLabels {
  return SORT_DIRECTION_LABELS[field];
}

/** The sort control's face, such as "Name, A–Z". */
export function machineSortLabel(
  field: MachineViewFieldId,
  dir: MachineViewSortDirection
): string {
  return `${SORT_FIELD_LABELS[field]}, ${SORT_DIRECTION_LABELS[field][dir]}`;
}
