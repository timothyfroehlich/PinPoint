import type { IssueSeverity } from "./database";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { MachineStatus } from "~/lib/machines/status";
import type { TagTypeId } from "~/lib/tags/types";

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
  | { kind: "tag"; tagType: TagTypeId; slug: string };

export type MachineViewSortDirection = "asc" | "desc";
export type MachineViewPageSize = 25 | 50 | 100;

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
    /** Machines in the scope other than Removed ones (§3.1). */
    total: number;
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
}

/**
 * The configuration a Saved View stores (list-views §10.2): everything in
 * {@link MachineViewState} except the page number.
 */
export type MachineViewSavedState = Omit<MachineViewState, "page">;

export interface MachineViewSavedViewSummary {
  id: string;
  name: string;
  state: MachineViewSavedState;
}

/** A Built-in View as the menu shows it (machine-views §9). */
export interface MachineViewBuiltInView {
  id: string;
  name: string;
  state: MachineViewSavedState;
}

/**
 * The views one machine Surface offers a viewer (list-views §10,
 * machine-views §9): the Surface's Built-in Views and, for an account that can
 * save, every machine Saved View. `activeViewId` is the validated `view` URL
 * reference (list-views §9.6) — an owned Saved View id or a Built-in View id
 * — or null, which means the Page Preset's baseline. `defaultViewId` is the
 * account's machine Default View, which only the Machines page opens
 * (§10.10).
 */
export interface MachineViewSavedViews {
  /** Whether the viewer can save, change, and delete Saved Views (§10.1). */
  canSave: boolean;
  /**
   * Whether this Surface is the Machines page, where the Default View is
   * chosen and opens (§10.10); other Surfaces do not offer defaults.
   */
  offersDefault: boolean;
  builtInViews: MachineViewBuiltInView[];
  views: MachineViewSavedViewSummary[];
  defaultViewId: string | null;
  activeViewId: string | null;
}
