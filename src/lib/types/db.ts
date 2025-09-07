/**
 * Database Model Types (snake_case)
 *
 * Direct type definitions derived from schema for app layer consumption.
 * Import with: `import type { Db } from "~/lib/types"`.
 *
 * Note: These types are defined here to avoid importing from ~/server/db/types
 * per CORE-TS-003. App layer should use these canonical type definitions.
 */

import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// Note: Schema imports are allowed in lib/types for type definitions only
import type {
  // Auth
  users,
  accounts,
  sessions,
  // Collections
  collections,
  collectionTypes,
  collectionMachines,
  notifications,
  pinballMapConfigs,
  // Issues
  issues,
  priorities,
  issueStatuses,
  comments,
  attachments,
  issueHistory,
  upvotes,
  anonymousRateLimits,
  // Machines
  locations,
  models,
  machines,
  // Organizations
  organizations,
  memberships,
  roles,
  permissions,
  rolePermissions,
  systemSettings,
  activityLog,
  invitations,
} from "~/server/db/schema";

// Auth Types
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

// Collection Types
export type Collection = InferSelectModel<typeof collections>;
export type NewCollection = InferInsertModel<typeof collections>;
export type CollectionType = InferSelectModel<typeof collectionTypes>;
export type NewCollectionType = InferInsertModel<typeof collectionTypes>;
export type CollectionMachine = InferSelectModel<typeof collectionMachines>;
export type NewCollectionMachine = InferInsertModel<typeof collectionMachines>;
export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type PinballMapConfig = InferSelectModel<typeof pinballMapConfigs>;
export type NewPinballMapConfig = InferInsertModel<typeof pinballMapConfigs>;

// Issue Types
export type Issue = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;
export type Priority = InferSelectModel<typeof priorities>;
export type NewPriority = InferInsertModel<typeof priorities>;
export type IssueStatus = InferSelectModel<typeof issueStatuses>;
export type NewIssueStatus = InferInsertModel<typeof issueStatuses>;
export type Comment = InferSelectModel<typeof comments>;
export type NewComment = InferInsertModel<typeof comments>;
export type Attachment = InferSelectModel<typeof attachments>;
export type NewAttachment = InferInsertModel<typeof attachments>;
export type IssueHistoryEntry = InferSelectModel<typeof issueHistory>;
export type NewIssueHistoryEntry = InferInsertModel<typeof issueHistory>;
export type Upvote = InferSelectModel<typeof upvotes>;
export type NewUpvote = InferInsertModel<typeof upvotes>;
export type AnonymousRateLimit = InferSelectModel<typeof anonymousRateLimits>;
export type NewAnonymousRateLimit = InferInsertModel<
  typeof anonymousRateLimits
>;

// Machine Types
export type Location = InferSelectModel<typeof locations>;
export type NewLocation = InferInsertModel<typeof locations>;
export type Model = InferSelectModel<typeof models>;
export type NewModel = InferInsertModel<typeof models>;
export type Machine = InferSelectModel<typeof machines>;
export type NewMachine = InferInsertModel<typeof machines>;

// Organization Types
export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;
export type Membership = InferSelectModel<typeof memberships>;
export type NewMembership = InferInsertModel<typeof memberships>;
export type Role = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;
export type Permission = InferSelectModel<typeof permissions>;
export type NewPermission = InferInsertModel<typeof permissions>;
export type RolePermission = InferSelectModel<typeof rolePermissions>;
export type NewRolePermission = InferInsertModel<typeof rolePermissions>;
export type SystemSetting = InferSelectModel<typeof systemSettings>;
export type NewSystemSetting = InferInsertModel<typeof systemSettings>;
export type ActivityLogEntry = InferSelectModel<typeof activityLog>;
export type NewActivityLogEntry = InferInsertModel<typeof activityLog>;
export type Invitation = InferSelectModel<typeof invitations>;
export type NewInvitation = InferInsertModel<typeof invitations>;
