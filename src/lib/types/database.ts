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
} from "~/server/db/schema";

// Select types (full row from database)
export type UserProfile = InferSelectModel<typeof userProfiles>;
export type Machine = InferSelectModel<typeof machines>;
export type Issue = InferSelectModel<typeof issues>;
export type IssueComment = InferSelectModel<typeof issueComments>;

// Insert types (for creating new rows)
export type NewUserProfile = InferInsertModel<typeof userProfiles>;
export type NewMachine = InferInsertModel<typeof machines>;
export type NewIssue = InferInsertModel<typeof issues>;
export type NewIssueComment = InferInsertModel<typeof issueComments>;

// Enum types for type safety
import type { UserRole } from "./user";
export type { UserRole };
export type IssueStatus = "new" | "in_progress" | "resolved";
export type IssueSeverity = "minor" | "playable" | "unplayable";
export type IssuePriority = "low" | "medium" | "high" | "critical";

export type Notification = InferSelectModel<typeof notifications>;
export type NotificationPreference = InferSelectModel<
  typeof notificationPreferences
>;
export type IssueWatcher = InferSelectModel<typeof issueWatchers>;
