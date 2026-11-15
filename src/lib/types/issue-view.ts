import type {
  IssueFrequency,
  IssuePriority,
  IssueSeverity,
  IssueStatus,
} from "./database";
import type { IssueListRow } from "./issue";
import type {
  ListBuiltInView,
  ListPageSize,
  ListSavedViews,
  ListSavedViewSummary,
} from "./list-view";
import type { IssueListSummary } from "./summary-widget";
import type { MachinePresenceStatus } from "~/lib/machines/presence";

/** Issue View sort fields (issues-list §5.1), as the `sort` parameter names them. */
export const ISSUE_VIEW_SORT_FIELDS = [
  "updated",
  "created",
  "id",
  "severity",
  "priority",
  "assignee",
] as const;

export type IssueViewSortField = (typeof ISSUE_VIEW_SORT_FIELDS)[number];

export type IssueViewSortDirection = "asc" | "desc";

/** A Created or Updated range; each end a calendar day (`YYYY-MM-DD`) or open. */
export interface IssueViewDateRange {
  from: string | null;
  to: string | null;
}

/**
 * Issue View's View Configuration plus page (issues-list §7.1). An empty
 * `status` or `presence` means every status or presence state; the Page
 * Preset's values are the Open statuses and On the Floor (§6.1). People are
 * stable ids plus the `me` and `unassigned` sentinels (§7.3).
 */
export interface IssueViewState {
  q: string;
  status: IssueStatus[];
  severity: IssueSeverity[];
  priority: IssuePriority[];
  /** Machine initials. */
  machine: string[];
  assignee: string[];
  presence: MachinePresenceStatus[];
  created: IssueViewDateRange;
  updated: IssueViewDateRange;
  frequency: IssueFrequency[];
  /** Machine owners. */
  owner: string[];
  reporter: string[];
  watching: boolean;
  sort: IssueViewSortField;
  dir: IssueViewSortDirection;
  page: number;
  pageSize: ListPageSize;
}

/** The configuration an issue Saved View stores (list-views §10.2). */
export type IssueViewSavedState = Omit<IssueViewState, "page">;

/**
 * Where Issue View appears (issues-list §2.1): `/issues`, the host's main
 * page, or the Issues tab of a Collection or Tag.
 */
export type IssueViewSurface = "issues" | "tab";

export interface IssueViewMachineOption {
  initials: string;
  name: string;
}

/** A person a filter or row offers, by display name only (CORE-SEC-007). */
export interface IssueViewPersonOption {
  id: string;
  name: string;
}

export interface IssueViewResult {
  rows: IssueListRow[];
  /** Issues matching the View Configuration within the scope. */
  totalCount: number;
  summary: IssueListSummary;
  /** The validated state, its page clamped to the last page (list-views §6.3). */
  state: IssueViewState;
  /** The machines the Machine filter offers (issues-list §4.5). */
  machineOptions: IssueViewMachineOption[];
  /** People the Assignee, Machine owner, and Reporter filters offer. */
  people: IssueViewPersonOption[];
  /** The viewer's machines other than Removed ones, for My machines (§4.5). */
  myMachines: string[];
  /** Whether the viewer is signed in: Me, My machines, and Watching (§4.9). */
  signedIn: boolean;
}

export type IssueViewSavedViewSummary =
  ListSavedViewSummary<IssueViewSavedState>;
export type IssueViewBuiltInView = ListBuiltInView<IssueViewSavedState>;
export type IssueViewSavedViews = ListSavedViews<IssueViewSavedState>;
