import type {
  MachineViewFieldId,
  MachineViewPresetId,
  MachineViewSavedState,
  MachineViewSortDirection,
  MachineViewState,
} from "~/lib/types";
import { MACHINE_VIEW_FIELD_IDS } from "~/lib/types";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import {
  ME_PERSON_ID,
  ME_PERSON_NAME,
  UNASSIGNED_PERSON_ID,
  UNASSIGNED_PERSON_NAME,
} from "~/lib/list-view/url-state";

/**
 * Optional per-row enrichment a field needs before it can display or sort.
 * Health is not one: every load reads it, because the Summary Widgets
 * (machine-widgets §2.3) and the phone Compact row (machine-views §5.3)
 * always need it.
 */
export type MachineViewDependency = "service" | "activity";

/** The owner filter value for machines with no owner (machine-views §4.2). */
export const UNASSIGNED_OWNER_ID = UNASSIGNED_PERSON_ID;
/** How the Unassigned shortcut and an ownerless machine are named (§3.13). */
export const UNASSIGNED_OWNER_NAME = UNASSIGNED_PERSON_NAME;
/**
 * The owner filter value for whoever is viewing (machine-views §4.2). It is
 * resolved per viewer when the filter runs, so one URL or Saved View means
 * each signed-in person's own machines. For an anonymous visitor the filter
 * is dropped, so the list shows every machine in the rest of the view.
 */
export const ME_OWNER_ID = ME_PERSON_ID;
/** How the Me shortcut is named (machine-views §3.13). */
export const ME_OWNER_NAME = ME_PERSON_NAME;

type DirectionLabels = Record<MachineViewSortDirection, string>;

const ALPHABETICAL: DirectionLabels = { asc: "A–Z", desc: "Z–A" };
const DATES: DirectionLabels = { asc: "oldest", desc: "newest" };

export interface MachineViewFieldDefinition {
  id: MachineViewFieldId;
  label: string;
  /** How the sort control names the field, when not its label (§3.14). */
  sortLabel?: string;
  preferredDirection: MachineViewSortDirection;
  /** Each sort direction in words that fit the field's values (§3.14). */
  directionLabels: DirectionLabels;
  dependencies: MachineViewDependency[];
}

export const MACHINE_VIEW_FIELDS: Record<
  MachineViewFieldId,
  MachineViewFieldDefinition
> = {
  machine: {
    id: "machine",
    label: "Machine",
    sortLabel: "Name",
    preferredDirection: "asc",
    directionLabels: ALPHABETICAL,
    dependencies: [],
  },
  playability: {
    id: "playability",
    label: "Playability",
    preferredDirection: "desc",
    directionLabels: { asc: "best first", desc: "worst first" },
    dependencies: [],
  },
  openIssues: {
    id: "openIssues",
    label: "Open Issues",
    preferredDirection: "desc",
    directionLabels: { asc: "fewest", desc: "most" },
    dependencies: [],
  },
  lastServiced: {
    id: "lastServiced",
    label: "Last Serviced",
    preferredDirection: "desc",
    directionLabels: DATES,
    dependencies: ["service"],
  },
  presence: {
    id: "presence",
    label: "Presence",
    preferredDirection: "asc",
    directionLabels: { asc: "on the floor first", desc: "removed first" },
    dependencies: [],
  },
  owner: {
    id: "owner",
    label: "Owner",
    preferredDirection: "asc",
    directionLabels: ALPHABETICAL,
    dependencies: [],
  },
  manufacturer: {
    id: "manufacturer",
    label: "Manufacturer",
    preferredDirection: "asc",
    directionLabels: ALPHABETICAL,
    dependencies: [],
  },
  year: {
    id: "year",
    label: "Year",
    preferredDirection: "desc",
    directionLabels: DATES,
    dependencies: [],
  },
  oldestOpenIssue: {
    id: "oldestOpenIssue",
    label: "Oldest Open Issue",
    preferredDirection: "asc",
    directionLabels: DATES,
    dependencies: [],
  },
  lastActivity: {
    id: "lastActivity",
    label: "Last Activity",
    preferredDirection: "desc",
    directionLabels: DATES,
    dependencies: ["activity"],
  },
  dateAdded: {
    id: "dateAdded",
    label: "Date Added",
    preferredDirection: "desc",
    directionLabels: DATES,
    dependencies: [],
  },
};

/** Both Page Presets' displayed fields (machine-views §4.6). */
const DEFAULT_COLUMNS: MachineViewFieldId[] = [
  "machine",
  "playability",
  "presence",
  "openIssues",
  "lastServiced",
  "lastActivity",
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
      severity: [],
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
      presence: ["on_the_floor"],
      status: [],
      severity: [],
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
    }),
    builtIn("machines", "recently-added", "Recently added", {
      // Every presence state except Removed (machine-views §9.1).
      presence: VALID_MACHINE_PRESENCE_STATUSES.filter(
        (presence) => presence !== "removed"
      ),
      sort: "dateAdded",
      dir: "desc",
      columns: [...DEFAULT_COLUMNS, "dateAdded"],
    }),
  ],
  collection: [
    builtIn("collection", "on-the-floor", "On the floor", {}),
    builtIn(
      "collection",
      "needs-attention",
      "Needs attention",
      NEEDS_ATTENTION
    ),
    builtIn("collection", "all-machines", "All machines", {
      presence: "all",
    }),
  ],
};

/** The Built-in View that is the Page Preset itself (spec §1, §9.1–§9.2). */
export const MACHINE_VIEW_PAGE_PRESET_VIEW_ID: Record<
  MachineViewPresetId,
  string
> = {
  machines: "on-the-floor",
  collection: "on-the-floor",
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
  service: boolean;
  activity: boolean;
}

/**
 * The optional enrichment the displayed fields and the sort need. No filter
 * needs any: Playability and Open Issue Severity read health, which every
 * load includes.
 */
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

  return {
    service: dependencies.has("service"),
    activity: dependencies.has("activity"),
  };
}
