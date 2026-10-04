import {
  describeSelection,
  type ListFilterModel,
  type ListOption,
} from "~/components/list-view/types";
import { SEVERITY_CONFIG } from "~/lib/issues/status";
import {
  getMachinePresenceLabel,
  type MachinePresenceStatus,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
import {
  getMachineStatusLabel,
  MACHINE_STATUS_COLORS,
  type MachineStatus,
} from "~/lib/machines/status";
import {
  ISSUE_SEVERITY_VALUES,
  type IssueSeverity,
  type MachineViewOwnerOption,
  type MachineViewState,
} from "~/lib/types";

/** Owner sentinels (machine-views §4.2); the server owns the same values. */
export const ME_OWNER_VALUE = "me";
export const UNASSIGNED_OWNER_VALUE = "unassigned";

const STATUS_VALUES: readonly MachineStatus[] = [
  "operational",
  "needs_service",
  "unplayable",
];

function isPresence(value: string): value is MachinePresenceStatus {
  return VALID_MACHINE_PRESENCE_STATUSES.some((presence) => presence === value);
}

function isStatus(value: string): value is MachineStatus {
  return STATUS_VALUES.some((status) => status === value);
}

function isSeverity(value: string): value is IssueSeverity {
  return ISSUE_SEVERITY_VALUES.some((severity) => severity === value);
}

function sameValues(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function presenceEqual(
  left: MachineViewState["presence"],
  right: MachineViewState["presence"]
): boolean {
  if (left === "all" || right === "all") return left === right;
  return sameValues(left, right);
}

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
 * shortcuts (§3.13).
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
  const statusOptions: ListOption[] = STATUS_VALUES.map((value) => ({
    value,
    label: getMachineStatusLabel(value),
    textClassName: MACHINE_STATUS_COLORS[value].text,
  }));
  const severityOptions: ListOption[] = ISSUE_SEVERITY_VALUES.map((value) => ({
    value,
    label: SEVERITY_CONFIG[value].label,
  }));
  const ownerShortcuts: ListOption[] = [
    ...(offersMe ? [{ value: ME_OWNER_VALUE, label: "Me" }] : []),
    { value: UNASSIGNED_OWNER_VALUE, label: "Unassigned" },
  ];
  const people: ListOption[] = ownerOptions
    .filter(
      (owner) =>
        owner.id !== UNASSIGNED_OWNER_VALUE && owner.id !== ME_OWNER_VALUE
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
        const presence = values.filter(isPresence);
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
      atPreset: sameValues(state.status, defaults.status),
      onChange: (values) => onChange({ status: values.filter(isStatus) }),
      onReset: () => onChange({ status: defaults.status }),
    },
    {
      id: "severity",
      label: "Issue severity",
      options: severityOptions,
      selected: state.severity,
      valueLabel: describeSelection(state.severity, severityOptions),
      atPreset: sameValues(state.severity, defaults.severity),
      onChange: (values) => onChange({ severity: values.filter(isSeverity) }),
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
      atPreset: sameValues(state.owner, defaults.owner),
      onChange: (values) => onChange({ owner: values }),
      onReset: () => onChange({ owner: defaults.owner }),
    },
  ];
}
