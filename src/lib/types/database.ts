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
} from "~/server/db/schema";

// Enum types for type safety (import/define before using in Issue type)
// Based on _issue-status-redesign/README.md - Final design with 11 statuses
import type { UserRole } from "./user";
import type { IssueStatus } from "~/lib/issues/status";

// Re-export types (IssueStatus comes from single source of truth)
export type { UserRole, IssueStatus };

export type IssueSeverity = "cosmetic" | "minor" | "major" | "unplayable";
export type IssuePriority = "low" | "medium" | "high";
export type IssueFrequency = "intermittent" | "frequent" | "constant";

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
