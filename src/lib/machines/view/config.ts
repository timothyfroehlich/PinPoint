import type {
  MachineViewFieldId,
  MachineViewPresetId,
  MachineViewSavedState,
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

/**
 * Built-in Views (spec machine-views.md §9): named configurations PinPoint
 * defines for each Page Preset, the same for every viewer. Ids are stable URL
 * `view` values; views that share a name share an id and appear in the same
 * order on every Surface (§9.6). Exactly one per preset is the Page Preset.
 */
export interface MachineViewBuiltInViewDefinition {
  id: string;
  name: string;
  state: MachineViewSavedState;
}

function builtIn(
  presetId: MachineViewPresetId,
  id: string,
  name: string,
  overrides: Partial<MachineViewSavedState>
): MachineViewBuiltInViewDefinition {
  const { page: _page, ...defaults } =
    MACHINE_VIEW_PRESETS[presetId].defaultState;
  return { id, name, state: { ...defaults, ...overrides } };
}

const NEEDS_ATTENTION: Partial<MachineViewSavedState> = {
  presence: ["on_the_floor"],
  status: ["needs_service", "unplayable"],
  sort: "playability",
  dir: "desc",
};

export const MACHINE_VIEW_BUILT_IN_VIEWS: Record<
  MachineViewPresetId,
  MachineViewBuiltInViewDefinition[]
> = {
  machines: [
    builtIn("machines", "on-the-floor", "On the floor", {}),
    builtIn("machines", "needs-attention", "Needs attention", NEEDS_ATTENTION),
    builtIn("machines", "service-due", "Service due", {
      presence: ["on_the_floor"],
      sort: "lastServiced",
      dir: "asc",
    }),
    builtIn("machines", "all-machines", "All machines", {
      presence: "all",
      columns: [...DEFAULT_COLUMNS, "presence"],
    }),
    builtIn("machines", "recently-added", "Recently added", {
      presence: "all",
      sort: "dateAdded",
      dir: "desc",
      columns: [...DEFAULT_COLUMNS, "presence", "dateAdded"],
    }),
  ],
  collection: [
    builtIn("collection", "on-the-floor", "On the floor", {
      presence: ["on_the_floor"],
    }),
    builtIn(
      "collection",
      "needs-attention",
      "Needs attention",
      NEEDS_ATTENTION
    ),
    builtIn("collection", "all-machines", "All machines", {}),
  ],
};

/** The Built-in View that is the Page Preset itself (spec §1, §9.1–§9.2). */
export const MACHINE_VIEW_PAGE_PRESET_VIEW_ID: Record<
  MachineViewPresetId,
  string
> = {
  machines: "on-the-floor",
  collection: "all-machines",
};

export function getMachineViewBuiltInViews(
  presetId: MachineViewPresetId
): MachineViewBuiltInViewDefinition[] {
  return MACHINE_VIEW_BUILT_IN_VIEWS[presetId];
}

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
