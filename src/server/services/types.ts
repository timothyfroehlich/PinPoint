// Service layer type definitions
// Using Drizzle schema types for service layer

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

// Infer types from Drizzle schema
export type Collection = InferSelectModel<typeof collections>;
export type CollectionType = InferSelectModel<typeof collectionTypes>;
export type User = InferSelectModel<typeof users>;
export type IssueStatus = InferSelectModel<typeof issueStatuses>;
export type Notification = InferSelectModel<typeof notifications>;
export type Comment = InferSelectModel<typeof comments>;
export type Machine = InferSelectModel<typeof machines>;

// Export enum types
export { notificationTypeEnum, notificationEntityEnum, activityTypeEnum };
