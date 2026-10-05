import type { IssueSeverity } from "./database";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { MachineStatus } from "~/lib/machines/status";
import type { TagTypeId } from "~/lib/tags/types";
import type {
  ListBuiltInView,
  ListPageSize,
  ListSavedViews,
  ListSavedViewSummary,
} from "./list-view";

export const MACHINE_VIEW_FIELD_IDS = [
  "machine",
  "playability",
  "openIssues",
  "lastServiced",
  "presence",
  "owner",
  "manufacturer",
  "year",
  "oldestOpenIssue",
  "lastActivity",
  "dateAdded",
] as const;

export type MachineViewFieldId = (typeof MACHINE_VIEW_FIELD_IDS)[number];

export type MachineViewPresetId = "machines" | "collection";

export type MachineViewScope =
  | { kind: "all" }
  | { kind: "collection"; collectionId: string }
  | { kind: "owner"; ownerId: string }
  | { kind: "tag"; tagType: TagTypeId; slug: string }
  /** A hand-applied tag, by id (spec collections-and-tags §11). */
  | { kind: "handTag"; tagId: string };

export type MachineViewSortDirection = "asc" | "desc";
export type MachineViewPageSize = ListPageSize;

export interface MachineViewState {
  q: string;
  presence: "all" | MachinePresenceStatus[];
  status: MachineStatus[];
  severity: IssueSeverity[];
  owner: string[];
  sort: MachineViewFieldId;
  dir: MachineViewSortDirection;
  page: number;
  pageSize: MachineViewPageSize;
  columns: MachineViewFieldId[];
}

export interface MachineViewOwnerOption {
  id: string;
  name: string;
}

export interface MachineViewHealth {
  openIssues: number;
  bySeverity: Record<IssueSeverity, number>;
  worstSeverity: IssueSeverity | null;
  oldestOpenIssueAt: string | null;
  playability: MachineStatus;
}

export interface MachineViewRow {
  id: string;
  initials: string;
  title: string;
  manufacturer: string;
  year: number | null;
  /** The owner's display name, or "Unassigned"; never an email (CORE-SEC-007). */
  ownerName: string;
  /** False when the machine has no owner and `ownerName` is "Unassigned". */
  hasOwner: boolean;
  presence: MachinePresenceStatus;
  createdAt: string;
  health?: MachineViewHealth;
  lastServicedAt?: string | null;
  lastActivityAt?: string | null;
}

/** The presence states the Presence Widget counts: every one but Removed. */
export type MachinePresenceWidgetStatus = Exclude<
  MachinePresenceStatus,
  "removed"
>;

/**
 * Summary Widget counts (machine-widgets §3–§4), always over the route's
 * whole scope and every page (widgets §3.1, §4.1).
 */
export interface MachineViewSummary {
  presence: {
    /** Removed machines are not counted (§3.2). */
    byPresence: Record<MachinePresenceWidgetStatus, number>;
  };
  playability: {
    onTheFloor: number;
    byStatus: Record<MachineStatus, number>;
  };
}

export interface MachineViewResult {
  rows: MachineViewRow[];
  scopeCount: number;
  totalCount: number;
  summary: MachineViewSummary;
  state: MachineViewState;
  ownerOptions: MachineViewOwnerOption[];
  permittedFields: MachineViewFieldId[];
  /** Whether the Owner filter offers Me: the viewer is signed in (machine-views §3.13). */
  offersMe: boolean;
}

/**
 * The configuration a Saved View stores (list-views §10.2): everything in
 * {@link MachineViewState} except the page number.
 */
export type MachineViewSavedState = Omit<MachineViewState, "page">;

export type MachineViewSavedViewSummary =
  ListSavedViewSummary<MachineViewSavedState>;

/** A Built-in View as the menu shows it (machine-views §9). */
export type MachineViewBuiltInView = ListBuiltInView<MachineViewSavedState>;

/**
 * The views one machine Surface offers a viewer (list-views §10,
 * machine-views §9); only the Machines page offers the Default View.
 */
export type MachineViewSavedViews = ListSavedViews<MachineViewSavedState>;
