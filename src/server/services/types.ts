// Temporary type definitions for service layer
// These will be replaced by generated Prisma types once client generation is working

// Use the actual ExtendedPrismaClient from the db module
export type { ExtendedPrismaClient } from "../db";

export type {
  Collection,
  CollectionType,
  User,
  IssueStatus,
  Notification,
  Comment,
  Machine,
} from "@prisma/client";

export {
  NotificationType,
  NotificationEntity,
  ActivityType,
} from "@prisma/client";

// Re-export Prisma utility types
export { Prisma } from "@prisma/client";
