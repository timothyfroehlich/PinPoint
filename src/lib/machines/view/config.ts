import type {
  MachineViewFieldId,
  MachineViewPresetId,
  MachineViewSortDirection,
  MachineViewState,
} from "~/lib/types";
import { MACHINE_VIEW_FIELD_IDS } from "~/lib/types";

export type MachineViewDependency = "health" | "service" | "activity";

export interface MachineViewFieldDefinition {
  id: MachineViewFieldId;
  label: string;
  preferredDirection: MachineViewSortDirection;
  dependencies: MachineViewDependency[];
}

export const MACHINE_VIEW_FIELDS: Record<
  MachineViewFieldId,
  MachineViewFieldDefinition
> = {
  machine: {
    id: "machine",
    label: "Machine",
    preferredDirection: "asc",
    dependencies: [],
  },
  playability: {
    id: "playability",
    label: "Playability",
    preferredDirection: "desc",
    dependencies: ["health"],
  },
  openIssues: {
    id: "openIssues",
    label: "Open Issues",
    preferredDirection: "desc",
    dependencies: ["health"],
  },
  lastServiced: {
    id: "lastServiced",
    label: "Last Serviced",
    preferredDirection: "desc",
    dependencies: ["service"],
  },
  presence: {
    id: "presence",
    label: "Presence",
    preferredDirection: "asc",
    dependencies: [],
  },
  owner: {
    id: "owner",
    label: "Owner",
    preferredDirection: "asc",
    dependencies: [],
  },
  manufacturer: {
    id: "manufacturer",
    label: "Manufacturer",
    preferredDirection: "asc",
    dependencies: [],
  },
  year: {
    id: "year",
    label: "Year",
    preferredDirection: "desc",
    dependencies: [],
  },
  oldestOpenIssue: {
    id: "oldestOpenIssue",
    label: "Oldest Open Issue",
    preferredDirection: "asc",
    dependencies: ["health"],
  },
  lastActivity: {
    id: "lastActivity",
    label: "Last Activity",
    preferredDirection: "desc",
    dependencies: ["activity"],
  },
  dateAdded: {
    id: "dateAdded",
    label: "Date Added",
    preferredDirection: "desc",
    dependencies: [],
  },
};

const DEFAULT_COLUMNS: MachineViewFieldId[] = [
  "machine",
  "playability",
  "openIssues",
  "lastServiced",
];

export interface MachineViewPreset {
  id: MachineViewPresetId;
  defaultState: MachineViewState;
  permittedFields: MachineViewFieldId[];
}

const PERMITTED_FIELDS: MachineViewFieldId[] = [...MACHINE_VIEW_FIELD_IDS];

export const MACHINE_VIEW_PRESETS: Record<
  MachineViewPresetId,
  MachineViewPreset
> = {
  machines: {
    id: "machines",
    permittedFields: PERMITTED_FIELDS,
    defaultState: {
      q: "",
      presence: ["on_the_floor"],
      status: [],
      owner: [],
      sort: "machine",
      dir: "asc",
      page: 1,
      pageSize: 25,
      columns: DEFAULT_COLUMNS,
    },
  },
  collection: {
    id: "collection",
    permittedFields: PERMITTED_FIELDS,
    defaultState: {
      q: "",
      presence: "all",
      status: [],
      owner: [],
      sort: "playability",
      dir: "desc",
      page: 1,
      pageSize: 25,
      columns: DEFAULT_COLUMNS,
    },
  },
};

export function getMachineViewPreset(
  preset: MachineViewPresetId
): MachineViewPreset {
  return MACHINE_VIEW_PRESETS[preset];
}

export interface MachineViewDependencyPlan {
  health: boolean;
  service: boolean;
  activity: boolean;
}

export function planMachineViewDependencies(
  state: MachineViewState
): MachineViewDependencyPlan {
  const activeFields = new Set<MachineViewFieldId>([
    ...state.columns,
    state.sort,
  ]);
  const dependencies = new Set<MachineViewDependency>();

  for (const field of activeFields) {
    for (const dependency of MACHINE_VIEW_FIELDS[field].dependencies) {
      dependencies.add(dependency);
    }
  }

  if (state.status.length > 0) dependencies.add("health");

  return {
    health: dependencies.has("health"),
    service: dependencies.has("service"),
    activity: dependencies.has("activity"),
  };
}
