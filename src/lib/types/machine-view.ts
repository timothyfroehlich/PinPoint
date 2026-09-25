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
  | { kind: "tag"; tagType: "manufacturer"; slug: string };

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
