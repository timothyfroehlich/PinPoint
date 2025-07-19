// Temporary type definitions for service layer
// These will be replaced by generated Prisma types once client generation is working

import type { PrismaClient } from "@prisma/client";

// Replace mock with actual Prisma Client
export type ExtendedPrismaClient = PrismaClient;

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
