import type { MachineViewFieldId, MachineViewSortDirection } from "~/lib/types";
import { MACHINE_VIEW_FIELDS } from "~/lib/machines/view/config";

/**
 * How the sort control names each Machine View sort (machine-views §3.14,
 * list-views §5.5): the field, then its direction in words that fit the
 * field's values, such as "Name, A–Z" or "Last Serviced, oldest".
 */
export function machineSortFieldLabel(field: MachineViewFieldId): string {
  const definition = MACHINE_VIEW_FIELDS[field];
  return definition.sortLabel ?? definition.label;
}

export function machineSortDirectionLabels(
  field: MachineViewFieldId
): Record<MachineViewSortDirection, string> {
  return MACHINE_VIEW_FIELDS[field].directionLabels;
}

/** The sort control's face, such as "Name, A–Z". */
export function machineSortLabel(
  field: MachineViewFieldId,
  dir: MachineViewSortDirection
): string {
  return `${machineSortFieldLabel(field)}, ${machineSortDirectionLabels(field)[dir]}`;
}
