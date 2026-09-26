import type { IssueSeverity } from "./database";
import type { MachinePresenceStatus } from "~/lib/machines/presence";
import type { MachineStatus } from "~/lib/machines/status";

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
  | { kind: "manufacturer"; slug: string };

export type MachineViewSortDirection = "asc" | "desc";
export type MachineViewPageSize = 25 | 50 | 100;

export interface MachineViewState {
  q: string;
  presence: "all" | MachinePresenceStatus[];
  status: MachineStatus[];
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
  ownerName: string;
  presence: MachinePresenceStatus;
  createdAt: string;
  health?: MachineViewHealth;
  lastServicedAt?: string | null;
  lastActivityAt?: string | null;
}

export interface MachineViewResult {
  rows: MachineViewRow[];
  scopeCount: number;
  totalCount: number;
  state: MachineViewState;
  ownerOptions: MachineViewOwnerOption[];
  permittedFields: MachineViewFieldId[];
}

/**
 * The configuration a Saved View stores (spec §8.2): everything in
 * {@link MachineViewState} except the page number.
 */
export type MachineViewSavedState = Omit<MachineViewState, "page">;

/**
 * Where Machine View appears and where Saved Views belong (spec §1 Surface),
 * as the page and its Server Actions name it. A standard Collection is named
 * by the handle in its URL (its id or its view token), so a view-token visitor
 * never learns the internal id; the server resolves it and checks access.
 */
export type MachineViewSurfaceRef =
  | { kind: "machines" }
  | { kind: "collection"; handle: string }
  | { kind: "owner"; ownerId: string };

export interface MachineViewSavedViewSummary {
  id: string;
  name: string;
  state: MachineViewSavedState;
}

/** A Built-in View as the menu shows it (spec §9). */
export interface MachineViewBuiltInView {
  id: string;
  name: string;
  state: MachineViewSavedState;
}

/**
 * The views one Surface offers a viewer (spec §8, §9). `activeViewId` is the
 * validated `view` URL reference (§4.11) — an owned Saved View id or a
 * Built-in View id — or null, which means the Page Preset's baseline.
 * `defaultViewId` is the account's default on this Surface (§8.10).
 */
export interface MachineViewSavedViews {
  surface: MachineViewSurfaceRef;
  /** Whether the viewer can save, change, and choose defaults (§8.1). */
  canSave: boolean;
  builtInViews: MachineViewBuiltInView[];
  views: MachineViewSavedViewSummary[];
  defaultViewId: string | null;
  activeViewId: string | null;
}
