import { OPEN_STATUSES } from "~/lib/issues/status";
import { ME_PERSON_ID, UNASSIGNED_PERSON_ID } from "~/lib/list-view/url-state";
import { VALID_MACHINE_PRESENCE_STATUSES } from "~/lib/machines/presence";
import type {
  IssueViewSavedState,
  IssueViewSortDirection,
  IssueViewSortField,
  IssueViewState,
} from "~/lib/types";

type DirectionLabels = Record<IssueViewSortDirection, string>;

export interface IssueViewSortDefinition {
  label: string;
  /** The direction a field sorts in when first chosen (list-views §9.8). */
  preferredDirection: IssueViewSortDirection;
  /** Each direction in words that fit the field's values. */
  directionLabels: DirectionLabels;
}

const DATES: DirectionLabels = { asc: "oldest", desc: "newest" };
const RANKS: DirectionLabels = { asc: "lowest", desc: "highest" };
const ALPHABETICAL: DirectionLabels = { asc: "A–Z", desc: "Z–A" };

/** The sort options (issues-list §5.1). */
export const ISSUE_VIEW_SORTS: Record<
  IssueViewSortField,
  IssueViewSortDefinition
> = {
  updated: {
    label: "Updated",
    preferredDirection: "desc",
    directionLabels: DATES,
  },
  created: {
    label: "Created",
    preferredDirection: "desc",
    directionLabels: DATES,
  },
  id: {
    label: "Issue ID",
    preferredDirection: "asc",
    directionLabels: ALPHABETICAL,
  },
  severity: {
    label: "Severity",
    preferredDirection: "desc",
    directionLabels: RANKS,
  },
  priority: {
    label: "Priority",
    preferredDirection: "desc",
    directionLabels: RANKS,
  },
  assignee: {
    label: "Assignee",
    preferredDirection: "asc",
    directionLabels: ALPHABETICAL,
  },
};

/** Every presence state except Removed (issues-list §6.2, §6.4). */
export const PRESENCE_EXCEPT_REMOVED = VALID_MACHINE_PRESENCE_STATUSES.filter(
  (presence) => presence !== "removed"
);

/**
 * The Page Preset, Open issues (issues-list §6.1): the Open statuses on
 * machines On the Floor, Updated newest first, 25 to a page. `/issues` and
 * every Issues tab share it.
 */
export const ISSUE_VIEW_PRESET: IssueViewState = {
  q: "",
  status: [...OPEN_STATUSES],
  severity: [],
  priority: [],
  machine: [],
  assignee: [],
  presence: ["on_the_floor"],
  created: { from: null, to: null },
  updated: { from: null, to: null },
  frequency: [],
  owner: [],
  reporter: [],
  watching: false,
  sort: "updated",
  dir: "desc",
  page: 1,
  pageSize: 25,
};

/** The Built-in View that is the Page Preset itself (list-views §1). */
export const ISSUE_VIEW_PAGE_PRESET_VIEW_ID = "open-issues";

export interface IssueViewBuiltInViewDefinition {
  id: string;
  name: string;
  state: IssueViewSavedState;
  /** Shown only to signed-in people (issues-list §6.3). */
  signedInOnly: boolean;
}

function builtIn(
  id: string,
  name: string,
  overrides: Partial<IssueViewSavedState>,
  signedInOnly = false
): IssueViewBuiltInViewDefinition {
  const { page: _page, ...defaults } = ISSUE_VIEW_PRESET;
  return { id, name, state: { ...defaults, ...overrides }, signedInOnly };
}

/**
 * The four Built-in Views, in order (issues-list §6.2). Ids are stable URL
 * `view` values. No Built-in View includes Removed machines (§6.4).
 */
const ISSUE_VIEW_BUILT_IN_VIEWS: readonly IssueViewBuiltInViewDefinition[] = [
  builtIn(ISSUE_VIEW_PAGE_PRESET_VIEW_ID, "Open issues", {}),
  builtIn(
    "my-issues",
    "My issues",
    { assignee: [ME_PERSON_ID], presence: PRESENCE_EXCEPT_REMOVED },
    true
  ),
  builtIn("unassigned", "Unassigned", { assignee: [UNASSIGNED_PERSON_ID] }),
  builtIn("recently-fixed", "Recently fixed", {
    status: ["fixed"],
    presence: PRESENCE_EXCEPT_REMOVED,
  }),
];

/** The Built-in Views a viewer is offered (issues-list §6.2, §6.3). */
export function getIssueViewBuiltInViews(
  signedIn: boolean
): IssueViewBuiltInViewDefinition[] {
  return ISSUE_VIEW_BUILT_IN_VIEWS.filter(
    (view) => signedIn || !view.signedInOnly
  );
}

/**
 * The Built-in Views that can be an account's Default View. Only signed-in
 * accounts have one, so every Built-in View qualifies.
 */
export function issueViewDefaultBuiltInIds(): string[] {
  return getIssueViewBuiltInViews(true).map(({ id }) => id);
}
