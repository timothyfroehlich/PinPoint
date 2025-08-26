/**
 * @fileoverview Service layer type definitions.
 * This file defines types for two primary purposes:
 * 1.  **Database Types (snake_case):** Raw data structures returned from database queries.
 *     These types directly reflect the database schema and use snake_case for field names.
 *     They should be used within the server and service layers.
 * 2.  **Application Types (camelCase):** Data structures used by the application and API layers.
 *     These are derived from database types by transforming field names to camelCase.
 *
 * @see src/lib/utils/case-transformers.ts - for utilities to convert between cases.
 * @see src/server/db/schema/index.ts - for the database schema definitions.
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

export type { DrizzleClient } from "~/server/db/drizzle";

/**
 * Represents a raw, untransformed result from a database query.
 * Fields in this type are expected to be in snake_case, matching the database schema.
 * @template T - The base Drizzle-inferred type.
 */
export type DatabaseResult<T> = T;

// == Database Types (snake_case) ==
// These types are inferred from the Drizzle schema and have snake_case fields.

export type CollectionDb = DatabaseResult<InferSelectModel<typeof collections>>;
export type CollectionTypeDb = DatabaseResult<
  InferSelectModel<typeof collectionTypes>
>;
export type UserDb = DatabaseResult<InferSelectModel<typeof users>>;
export type IssueStatusDb = DatabaseResult<
  InferSelectModel<typeof issueStatuses>
>;
export type NotificationDb = DatabaseResult<
  InferSelectModel<typeof notifications>
>;
export type CommentDb = DatabaseResult<InferSelectModel<typeof comments>>;
export type MachineDb = DatabaseResult<InferSelectModel<typeof machines>>;

/**
 * Type guard to check if a database result has the expected snake_case structure.
 * This is a simple check for the presence of an underscore, useful for development assertions.
 * @param obj - The object to check.
 */
export function isDatabaseResult(obj: unknown): obj is DatabaseResult<object> {
  if (typeof obj !== "object" || obj === null) return false;
  return Object.keys(obj).some((key) => key.includes("_"));
}

// == Deprecated Application Types ==
// These are kept for compatibility but should be replaced with transformed types at the API boundary.

export type Collection = InferSelectModel<typeof collections>;
export type CollectionType = InferSelectModel<typeof collectionTypes>;
export type User = InferSelectModel<typeof users>;
export type IssueStatus = InferSelectModel<typeof issueStatuses>;
export type Notification = InferSelectModel<typeof notifications>;
export type Comment = InferSelectModel<typeof comments>;
export type Machine = InferSelectModel<typeof machines>;

// Export enum types
export { notificationTypeEnum, notificationEntityEnum, activityTypeEnum };
