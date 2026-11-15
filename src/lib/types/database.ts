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
  pinballmapRegionAlertEvents,
  pinballmapRegionSeenMachines,
  pinballmapState,
} from "~/server/db/schema";

// Enum types for type safety (import/define before using in Issue type)
// Based on _issue-status-redesign/README.md - Final design with 11 statuses
import type { UserRole } from "./user";
import type { IssueStatus } from "~/lib/issues/status";
import type {
  IssueSeverity,
  IssuePriority,
  IssueFrequency,
} from "./issue-values";

// Re-export types (IssueStatus comes from single source of truth)
export type { UserRole, IssueStatus };

export {
  ISSUE_SEVERITY_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_FREQUENCY_VALUES,
  type IssueSeverity,
  type IssuePriority,
  type IssueFrequency,
} from "./issue-values";

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
  | "snapshotRevision"
  | "lastSyncedAt"
  | "lastSyncAttemptAt"
  | "lastSyncStatus"
  | "lastSyncError"
  | "refreshTokens"
  | "refreshTokensAt"
  | "regionAlertRegion"
  | "regionAlertChannelId"
  | "regionAlertStatus"
  | "regionAlertLastPostAt"
  | "regionAlertLastStatusDetail"
  | "updatedAt"
  | "updatedBy"
>;

// Region-wide machine membership and delivery queue (PP-o355.18, PP-o355.51.9)
export type PinballmapRegionSeenMachine = InferSelectModel<
  typeof pinballmapRegionSeenMachines
>;
export type NewPinballmapRegionSeenMachine = InferInsertModel<
  typeof pinballmapRegionSeenMachines
>;
export type PinballmapRegionAlertEvent = InferSelectModel<
  typeof pinballmapRegionAlertEvents
>;
export type NewPinballmapRegionAlertEvent = InferInsertModel<
  typeof pinballmapRegionAlertEvents
>;
