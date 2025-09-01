/**
 * @fileoverview DEPRECATED: Service layer type definitions.
 * 
 * **THIS FILE IS DEPRECATED**
 * Types have been moved to `~/lib/types/api.ts` for centralization.
 * Please import from `~/lib/types` instead of this file.
 * 
 * Migration:
 * ```typescript
 * // OLD: import type { DrizzleClient } from "~/server/services/types";
 * // NEW: import type { DrizzleClient } from "~/lib/types";
 * ```
 * 
 * @deprecated Use `~/lib/types` instead
 * @see ~/lib/types/api.ts - New location for service layer types
 */

import type { InferSelectModel } from "drizzle-orm";
import type {
  collections,
  collectionTypes,
  users,
  issueStatuses,
  notifications,
  comments,
  machines,
} from "~/server/db/schema";
import {
  notificationTypeEnum,
  notificationEntityEnum,
} from "~/server/db/schema/collections";
import { activityTypeEnum } from "~/server/db/schema/issues";

// Types moved to ~/lib/types - keeping for internal compatibility only
// DO NOT add new exports to this file

import type { DrizzleClient } from "~/server/db/drizzle";

/**
 * Represents a raw, untransformed result from a database query.
 * Fields in this type are expected to be in snake_case, matching the database schema.
 * @template T - The base Drizzle-inferred type.
 */
type DatabaseResult<T> = T;

// == Database Types (snake_case) - Internal use only ==
// These types are inferred from the Drizzle schema and have snake_case fields.

type CollectionDb = DatabaseResult<InferSelectModel<typeof collections>>;
type CollectionTypeDb = DatabaseResult<
  InferSelectModel<typeof collectionTypes>
>;
type UserDb = DatabaseResult<InferSelectModel<typeof users>>;
type IssueStatusDb = DatabaseResult<
  InferSelectModel<typeof issueStatuses>
>;
type NotificationDb = DatabaseResult<
  InferSelectModel<typeof notifications>
>;
type CommentDb = DatabaseResult<InferSelectModel<typeof comments>>;
type MachineDb = DatabaseResult<InferSelectModel<typeof machines>>;

/**
 * Type guard to check if a database result has the expected snake_case structure.
 * This is a simple check for the presence of an underscore, useful for development assertions.
 * @param obj - The object to check.
 */
function isDatabaseResult(obj: unknown): obj is DatabaseResult<object> {
  if (typeof obj !== "object" || obj === null) return false;
  return Object.keys(obj).some((key) => key.includes("_"));
}

// == Deprecated Application Types - Internal use only ==
// These are kept for internal compatibility only

type Collection = InferSelectModel<typeof collections>;
type CollectionType = InferSelectModel<typeof collectionTypes>;
type User = InferSelectModel<typeof users>;
type IssueStatus = InferSelectModel<typeof issueStatuses>;
type Notification = InferSelectModel<typeof notifications>;
type Comment = InferSelectModel<typeof comments>;
type Machine = InferSelectModel<typeof machines>;

// Export enum types
export { notificationTypeEnum, notificationEntityEnum, activityTypeEnum };
