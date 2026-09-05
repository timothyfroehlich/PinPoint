/**
 * Database Type Exports
 *
 * Inferred types from Drizzle schema.
 * Use these types throughout the application (camelCase).
 * Schema uses snake_case (database convention).
 */

import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  userProfiles,
  machines,
  issues,
  issueComments,
  notifications,
  notificationPreferences,
  issueWatchers,
  issueImages,
  pinballmapCatalog,
  pinballmapRegionSeenMachines,
  pinballmapState,
} from "~/server/db/schema";

// Enum types for type safety (import/define before using in Issue type)
// Based on _issue-status-redesign/README.md - Final design with 11 statuses
import type { UserRole } from "./user";
import type { IssueStatus } from "~/lib/issues/status";

// Re-export types (IssueStatus comes from single source of truth)
export type { UserRole, IssueStatus };

/**
 * The severity/priority/frequency vocabularies as VALUE arrays, with the types
 * derived from them — the same array-is-the-source-of-truth shape
 * `ISSUE_STATUS_VALUES` uses in `~/lib/issues/status`.
 *
 * Runtime validators (Zod schemas, MCP tool inputs, URL filter parsers) need the
 * list of values, not just the type. When the type is hand-written each of those
 * sites re-types the literals, and adding a value to the type leaves every one
 * of them silently rejecting it — a valid severity the API refuses, with nothing
 * failing to compile. Spreading these arrays into `z.enum` instead makes the
 * type and the accepted set the same object.
 *
 * Severity uses the player-centric vocabulary (`pinpoint-design-bible`): never
 * low/medium/high, never "critical".
 */
export const ISSUE_SEVERITY_VALUES = [
  "cosmetic",
  "minor",
  "major",
  "unplayable",
] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITY_VALUES)[number];

export const ISSUE_PRIORITY_VALUES = ["low", "medium", "high"] as const;
export type IssuePriority = (typeof ISSUE_PRIORITY_VALUES)[number];

export const ISSUE_FREQUENCY_VALUES = [
  "intermittent",
  "frequent",
  "constant",
] as const;
export type IssueFrequency = (typeof ISSUE_FREQUENCY_VALUES)[number];

// Select types (full row from database)
export type UserProfile = InferSelectModel<typeof userProfiles>;
export type Machine = InferSelectModel<typeof machines>;

// Issue type with proper enum types (Drizzle infers text columns as string)
type DrizzleIssue = InferSelectModel<typeof issues>;
export type Issue = Omit<
  DrizzleIssue,
  "status" | "severity" | "priority" | "frequency" | "closedAt"
> & {
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssuePriority;
  frequency: IssueFrequency;
  closedAt: Date | null;
};

export type IssueComment = InferSelectModel<typeof issueComments>;

// Insert types (for creating new rows)
export type NewUserProfile = InferInsertModel<typeof userProfiles>;
export type NewMachine = InferInsertModel<typeof machines>;
export type NewIssue = InferInsertModel<typeof issues>;
export type NewIssueComment = InferInsertModel<typeof issueComments>;

export type Notification = InferSelectModel<typeof notifications>;
export type NotificationPreference = InferSelectModel<
  typeof notificationPreferences
>;
export type IssueWatcher = InferSelectModel<typeof issueWatchers>;
export type IssueImage = InferSelectModel<typeof issueImages>;

// PinballMap catalog mirror (bead B / PP-o355.2)
export type PinballmapCatalogEntry = InferSelectModel<typeof pinballmapCatalog>;
export type NewPinballmapCatalogEntry = InferInsertModel<
  typeof pinballmapCatalog
>;

// PinballMap integration state singleton (PP-o355.16)
export type PinballmapState = InferSelectModel<typeof pinballmapState>;
export type NewPinballmapState = InferInsertModel<typeof pinballmapState>;
export type PinballmapRuntimeState = Pick<
  PinballmapState,
  | "id"
  | "locationId"
  | "configurationGeneration"
  | "mutationLeaseId"
  | "mutationLeaseExpiresAt"
  | "snapshotJson"
  | "lastSyncedAt"
  | "lastSyncAttemptAt"
  | "lastSyncStatus"
  | "lastSyncError"
  | "refreshTokens"
  | "refreshTokensAt"
  | "outboundEmail"
  | "outboundTokenVaultId"
  | "updatedAt"
  | "updatedBy"
>;

// Region-wide seen-machine memory behind the new-machine alert (PP-o355.18)
export type PinballmapRegionSeenMachine = InferSelectModel<
  typeof pinballmapRegionSeenMachines
>;
export type NewPinballmapRegionSeenMachine = InferInsertModel<
  typeof pinballmapRegionSeenMachines
>;
