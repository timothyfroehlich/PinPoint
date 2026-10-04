import {
  describeSelection,
  type ListFilterModel,
  type ListOption,
} from "~/components/list-view/types";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  getMachinePresenceLabel,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
} from "~/lib/machines/status";
import {
  ME_OWNER_ID,
  ME_OWNER_NAME,
  UNASSIGNED_OWNER_ID,
  UNASSIGNED_OWNER_NAME,
} from "~/lib/machines/view/config";
import {
  arraysEqual,
  canonicalFilterValues,
  canonicalOwnerValues,
  MACHINE_STATUS_VALUES,
  presenceEqual,
} from "~/lib/machines/view/state";
import {
  ISSUE_SEVERITY_VALUES,
  type MachineViewOwnerOption,
  type MachineViewState,
} from "~/lib/types";

type FilterPatch = Partial<
  Pick<MachineViewState, "presence" | "status" | "severity" | "owner">
>;

interface MachineFiltersInput {
  state: MachineViewState;
  /** The Page Preset's configuration (§4.6, §7.3). */
  defaults: MachineViewState;
  ownerOptions: readonly MachineViewOwnerOption[];
  /** Whether Owner offers Me: the viewer is signed in (machine-views §3.13). */
  offersMe: boolean;
  onChange: (patch: FilterPatch) => void;
}

/**
 * Machine View's Primary Filters, in order: Presence, Playability, Issue
 * severity, and Owner (machine-views §3.12). Machine View has no Secondary
 * Filters. Owner searches people by name and offers the Me and Unassigned
 * shortcuts (§3.13). Every change is put in the canonical order URL parsing
 * uses, so a selection reads the same however it was made.
 */
export function buildMachineFilters({
  state,
  defaults,
  ownerOptions,
  offersMe,
  onChange,
}: MachineFiltersInput): ListFilterModel[] {
  const presenceOptions: ListOption[] = VALID_MACHINE_PRESENCE_STATUSES.map(
    (value) => ({ value, label: getMachinePresenceLabel(value) })
  );
  const statusOptions: ListOption[] = MACHINE_STATUS_VALUES.map((value) => ({
    value,
    label: getMachineStatusLabel(value),
    textClassName: MACHINE_STATUS_COLORS[value].text,
  }));
  const severityOptions: ListOption[] = ISSUE_SEVERITY_VALUES.map((value) => ({
    value,
    label: SEVERITY_CONFIG[value].label,
  }));
  const ownerShortcuts: ListOption[] = [
    ...(offersMe ? [{ value: ME_OWNER_ID, label: ME_OWNER_NAME }] : []),
    { value: UNASSIGNED_OWNER_ID, label: UNASSIGNED_OWNER_NAME },
  ];
  const people: ListOption[] = ownerOptions
    .filter(
      (owner) => owner.id !== UNASSIGNED_OWNER_ID && owner.id !== ME_OWNER_ID
    )
    .map((owner) => ({ value: owner.id, label: owner.name }));

  const presenceSelected = state.presence === "all" ? [] : state.presence;

  return [
    {
      id: "presence",
      label: "Presence",
      options: presenceOptions,
      selected: presenceSelected,
      valueLabel: describeSelection(presenceSelected, presenceOptions),
      atPreset: presenceEqual(state.presence, defaults.presence),
      // No presence value is the explicit unfiltered state (§4.7).
      onChange: (values) => {
        const presence = canonicalFilterValues(
          values,
          VALID_MACHINE_PRESENCE_STATUSES
        );
        onChange({ presence: presence.length === 0 ? "all" : presence });
      },
      onReset: () => onChange({ presence: defaults.presence }),
    },
    {
      id: "status",
      label: "Playability",
      options: statusOptions,
      selected: state.status,
      valueLabel: describeSelection(state.status, statusOptions),
      atPreset: arraysEqual(state.status, defaults.status),
      onChange: (values) =>
        onChange({
          status: canonicalFilterValues(values, MACHINE_STATUS_VALUES),
        }),
      onReset: () => onChange({ status: defaults.status }),
    },
    {
      id: "severity",
      label: "Issue severity",
      options: severityOptions,
      selected: state.severity,
      valueLabel: describeSelection(state.severity, severityOptions),
      atPreset: arraysEqual(state.severity, defaults.severity),
      onChange: (values) =>
        onChange({
          severity: canonicalFilterValues(values, ISSUE_SEVERITY_VALUES),
        }),
      onReset: () => onChange({ severity: defaults.severity }),
    },
    {
      id: "owner",
      label: "Owner",
      options: people,
      shortcuts: ownerShortcuts,
      searchPlaceholder: "Search people",
      selected: state.owner,
      valueLabel: describeSelection(state.owner, [
        ...ownerShortcuts,
        ...people,
      ]),
      atPreset: arraysEqual(state.owner, defaults.owner),
      onChange: (values) => onChange({ owner: canonicalOwnerValues(values) }),
      onReset: () => onChange({ owner: defaults.owner }),
    },
  ];
}
