import {
  describeSelection,
  type ListDateRange,
  type ListFilterModel,
  type ListOption,
} from "~/components/list-view/types";
import { formatCalendarDay } from "~/lib/dates";
import {
  FREQUENCY_CONFIG,
  OPEN_STATUSES,
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  STATUS_GROUPS,
  STATUS_GROUP_LABELS,
} from "~/lib/issues/status";
import {
  canonicalMachineValues,
  ISSUE_STATUS_ORDER,
} from "~/lib/issues/view/state";
import {
  arraysEqual,
  canonicalFilterValues,
  canonicalPeopleValues,
  ME_PERSON_ID,
  ME_PERSON_NAME,
  UNASSIGNED_PERSON_ID,
  UNASSIGNED_PERSON_NAME,
} from "~/lib/list-view/url-state";
import {
  getMachinePresenceLabel,
  VALID_MACHINE_PRESENCE_STATUSES,
} from "~/lib/machines/presence";
import {
  ISSUE_FREQUENCY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_SEVERITY_VALUES,
  type IssueViewDateRange,
  type IssueViewMachineOption,
  type IssueViewPersonOption,
  type IssueViewState,
} from "~/lib/types";

/** The filters a person can change: everything but search, sort, and paging. */
export type IssueFilterPatch = Partial<
  Omit<IssueViewState, "q" | "sort" | "dir" | "page" | "pageSize">
>;

/** The value the Watching filter's one option carries. */
const WATCHING_VALUE = "watching";

/**
 * Status groups as the Status filter and the Status Widget name them
 * (issues-list §1, §4.4; issue-widgets §3.2): the New and In Progress groups
 * together are the Open statuses, so the New group is not called Open here.
 */
export const STATUS_FILTER_GROUP_NAMES: Record<
  keyof typeof STATUS_GROUPS,
  string
> = {
  new: "New",
  in_progress: STATUS_GROUP_LABELS.in_progress,
  closed: STATUS_GROUP_LABELS.closed,
};

/** The status groups in the Status filter's order. */
const STATUS_FILTER_GROUPS = ["new", "in_progress", "closed"] as const;

function formatDay(day: string): string {
  return formatCalendarDay(day) ?? day;
}

/** How a Created or Updated range reads on its control (list-views §4.3). */
export function describeRange(range: IssueViewDateRange): string | null {
  if (range.from !== null && range.to !== null) {
    return `${formatDay(range.from)} – ${formatDay(range.to)}`;
  }
  if (range.from !== null) return `Since ${formatDay(range.from)}`;
  if (range.to !== null) return `Until ${formatDay(range.to)}`;
  return null;
}

interface IssueFiltersInput {
  state: IssueViewState;
  /** The Page Preset's configuration (list-views §4.6, §4.9). */
  defaults: IssueViewState;
  machineOptions: readonly IssueViewMachineOption[];
  people: readonly IssueViewPersonOption[];
  /** The viewer's machines, for My machines (issues-list §4.5). */
  myMachines: readonly string[];
  /** Me, My machines, and Watching appear only to signed-in people (§4.9). */
  signedIn: boolean;
  onChange: (patch: IssueFilterPatch) => void;
}

/**
 * The people a filter offers, by name; the shortcuts are listed apart.
 * Names only, never emails (CORE-SEC-007).
 */
function peopleOptions(people: readonly IssueViewPersonOption[]): ListOption[] {
  return people
    .filter(
      (person) =>
        person.id !== ME_PERSON_ID && person.id !== UNASSIGNED_PERSON_ID
    )
    .map((person) => ({ value: person.id, label: person.name }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function rangeFilter({
  id,
  label,
  range,
  preset,
  onChange,
}: {
  id: "created" | "updated";
  label: string;
  range: IssueViewDateRange;
  preset: IssueViewDateRange;
  onChange: (range: ListDateRange) => void;
}): ListFilterModel {
  return {
    kind: "dateRange",
    id,
    label,
    range,
    valueLabel: describeRange(range),
    atPreset: range.from === preset.from && range.to === preset.to,
    onRangeChange: onChange,
    onReset: () => onChange(preset),
  };
}

/**
 * Issue View's filters (issues-list §4). The Primary Filters, in order, are
 * Status, Severity, Priority, Machine, Assignee, and Machine presence
 * (§4.2); the Secondary Filters, under More, are Created, Updated,
 * Frequency, Machine owner, Reporter, and Watching (§4.3). Every change is
 * put in the canonical order URL parsing uses, so a selection reads the same
 * however it was made.
 */
export function buildIssueFilters({
  state,
  defaults,
  machineOptions,
  people,
  myMachines,
  signedIn,
  onChange,
}: IssueFiltersInput): {
  primary: ListFilterModel[];
  secondary: ListFilterModel[];
} {
  const statusOptions: ListOption[] = STATUS_FILTER_GROUPS.flatMap((group) =>
    STATUS_GROUPS[group].map((value) => ({
      value,
      label: STATUS_CONFIG[value].label,
      textClassName: STATUS_CONFIG[value].iconColor,
      group: STATUS_FILTER_GROUP_NAMES[group],
    }))
  );
  const severityOptions: ListOption[] = ISSUE_SEVERITY_VALUES.map((value) => ({
    value,
    label: SEVERITY_CONFIG[value].label,
  }));
  const priorityOptions: ListOption[] = ISSUE_PRIORITY_VALUES.map((value) => ({
    value,
    label: PRIORITY_CONFIG[value].label,
  }));
  const frequencyOptions: ListOption[] = ISSUE_FREQUENCY_VALUES.map(
    (value) => ({ value, label: FREQUENCY_CONFIG[value].label })
  );
  const presenceOptions: ListOption[] = VALID_MACHINE_PRESENCE_STATUSES.map(
    (value) => ({ value, label: getMachinePresenceLabel(value) })
  );
  const machines: ListOption[] = machineOptions.map((machine) => ({
    value: machine.initials,
    label: machine.name,
    tag: machine.initials,
  }));
  const machineShortcuts: ListOption[] =
    signedIn && myMachines.length > 0
      ? [{ value: "my-machines", label: "My machines", values: myMachines }]
      : [];
  const person = peopleOptions(people);
  // Me appears only to signed-in people (§4.9). Assignee and Machine owner
  // offer Me and Unassigned; Reporter offers Me (§4.6, §4.10).
  const meShortcut: ListOption[] = signedIn
    ? [{ value: ME_PERSON_ID, label: ME_PERSON_NAME }]
    : [];
  const unassignedShortcut: ListOption = {
    value: UNASSIGNED_PERSON_ID,
    label: UNASSIGNED_PERSON_NAME,
  };
  const meAndUnassigned: ListOption[] = [...meShortcut, unassignedShortcut];
  // People values the shortcuts stand for, so a selected one reads by name.
  const personLabels: ListOption[] = [...meAndUnassigned, ...person];

  // The control reads "Open" when exactly the Open statuses are selected
  // (issues-list §4.4).
  const statusLabel = arraysEqual(state.status, OPEN_STATUSES)
    ? "Open"
    : describeSelection(state.status, statusOptions);

  const primary: ListFilterModel[] = [
    {
      id: "status",
      label: "Status",
      options: statusOptions,
      selected: state.status,
      valueLabel: statusLabel,
      atPreset: arraysEqual(state.status, defaults.status),
      // No status is every status, as `status=all` is.
      onChange: (values) =>
        onChange({ status: canonicalFilterValues(values, ISSUE_STATUS_ORDER) }),
      onReset: () => onChange({ status: defaults.status }),
    },
    {
      id: "severity",
      label: "Severity",
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
      id: "priority",
      label: "Priority",
      options: priorityOptions,
      selected: state.priority,
      valueLabel: describeSelection(state.priority, priorityOptions),
      atPreset: arraysEqual(state.priority, defaults.priority),
      onChange: (values) =>
        onChange({
          priority: canonicalFilterValues(values, ISSUE_PRIORITY_VALUES),
        }),
      onReset: () => onChange({ priority: defaults.priority }),
    },
    {
      id: "machine",
      label: "Machine",
      options: machines,
      shortcuts: machineShortcuts,
      searchPlaceholder: "Search machines or initials",
      selected: state.machine,
      valueLabel: describeSelection(state.machine, machines),
      atPreset: arraysEqual(state.machine, defaults.machine),
      onChange: (values) =>
        onChange({ machine: canonicalMachineValues(values) }),
      onReset: () => onChange({ machine: defaults.machine }),
    },
    {
      id: "assignee",
      label: "Assignee",
      options: person,
      shortcuts: meAndUnassigned,
      searchPlaceholder: "Search people",
      selected: state.assignee,
      valueLabel: describeSelection(state.assignee, personLabels),
      atPreset: arraysEqual(state.assignee, defaults.assignee),
      onChange: (values) =>
        onChange({ assignee: canonicalPeopleValues(values) }),
      onReset: () => onChange({ assignee: defaults.assignee }),
    },
    {
      id: "presence",
      label: "Machine presence",
      options: presenceOptions,
      selected: state.presence,
      valueLabel: describeSelection(state.presence, presenceOptions),
      atPreset: arraysEqual(state.presence, defaults.presence),
      // No presence is every presence state (issues-list §4.7).
      onChange: (values) =>
        onChange({
          presence: canonicalFilterValues(
            values,
            VALID_MACHINE_PRESENCE_STATUSES
          ),
        }),
      onReset: () => onChange({ presence: defaults.presence }),
    },
  ];

  const secondary: ListFilterModel[] = [
    rangeFilter({
      id: "created",
      label: "Created",
      range: state.created,
      preset: defaults.created,
      onChange: (created) => onChange({ created }),
    }),
    rangeFilter({
      id: "updated",
      label: "Updated",
      range: state.updated,
      preset: defaults.updated,
      onChange: (updated) => onChange({ updated }),
    }),
    {
      id: "frequency",
      label: "Frequency",
      options: frequencyOptions,
      selected: state.frequency,
      valueLabel: describeSelection(state.frequency, frequencyOptions),
      atPreset: arraysEqual(state.frequency, defaults.frequency),
      onChange: (values) =>
        onChange({
          frequency: canonicalFilterValues(values, ISSUE_FREQUENCY_VALUES),
        }),
      onReset: () => onChange({ frequency: defaults.frequency }),
    },
    {
      id: "owner",
      label: "Machine owner",
      options: person,
      shortcuts: meAndUnassigned,
      searchPlaceholder: "Search people",
      selected: state.owner,
      valueLabel: describeSelection(state.owner, personLabels),
      atPreset: arraysEqual(state.owner, defaults.owner),
      onChange: (values) => onChange({ owner: canonicalPeopleValues(values) }),
      onReset: () => onChange({ owner: defaults.owner }),
    },
    {
      id: "reporter",
      label: "Reporter",
      options: person,
      shortcuts: meShortcut,
      searchPlaceholder: "Search people",
      selected: state.reporter,
      valueLabel: describeSelection(state.reporter, personLabels),
      atPreset: arraysEqual(state.reporter, defaults.reporter),
      onChange: (values) =>
        onChange({ reporter: canonicalPeopleValues(values) }),
      onReset: () => onChange({ reporter: defaults.reporter }),
    },
  ];
  if (signedIn) {
    secondary.push({
      id: "watching",
      label: "Watching",
      options: [{ value: WATCHING_VALUE, label: "Only issues I watch" }],
      selected: state.watching ? [WATCHING_VALUE] : [],
      valueLabel: state.watching ? "On" : null,
      atPreset: state.watching === defaults.watching,
      onChange: (values) =>
        onChange({ watching: values.includes(WATCHING_VALUE) }),
      onReset: () => onChange({ watching: defaults.watching }),
    });
  }
  return { primary, secondary };
}

/** Every filter at its Page Preset value (list-views §7.5). */
export function presetFilters(defaults: IssueViewState): IssueFilterPatch {
  return {
    status: defaults.status,
    severity: defaults.severity,
    priority: defaults.priority,
    machine: defaults.machine,
    assignee: defaults.assignee,
    presence: defaults.presence,
    created: defaults.created,
    updated: defaults.updated,
    frequency: defaults.frequency,
    owner: defaults.owner,
    reporter: defaults.reporter,
    watching: defaults.watching,
  };
}
