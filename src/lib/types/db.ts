/**
 * Database Model Types (snake_case)
 *
 * Centralized location for all Drizzle ORM types derived from schema.
 * Previously located in: src/server/db/types.ts
 * Import with: `import type { Db } from "~/lib/types"` or directly from here.
 */

import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import type {
  issues,
  machines,
  models,
  locations,
  users,
  priorities,
  issueStatuses,
  comments,
  attachments,
  issueHistory,
  upvotes,
  organizations,
  memberships,
  roles,
  permissions,
} from "~/server/db/schema";

// Issues
export type Issue = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;

// Machines
export type Machine = InferSelectModel<typeof machines>;
export type NewMachine = InferInsertModel<typeof machines>;

// Models
export type Model = InferSelectModel<typeof models>;
export type NewModel = InferInsertModel<typeof models>;

// Locations
export type Location = InferSelectModel<typeof locations>;
export type NewLocation = InferInsertModel<typeof locations>;

// Users
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Priorities
export type Priority = InferSelectModel<typeof priorities>;
export type NewPriority = InferInsertModel<typeof priorities>;

// Issue Statuses
export type IssueStatus = InferSelectModel<typeof issueStatuses>;
export type NewIssueStatus = InferInsertModel<typeof issueStatuses>;

// Comments
export type Comment = InferSelectModel<typeof comments>;
export type NewComment = InferInsertModel<typeof comments>;

// Attachments
export type Attachment = InferSelectModel<typeof attachments>;
export type NewAttachment = InferInsertModel<typeof attachments>;

// Issue History
export type IssueHistoryEntry = InferSelectModel<typeof issueHistory>;
export type NewIssueHistoryEntry = InferInsertModel<typeof issueHistory>;

// Upvotes
export type Upvote = InferSelectModel<typeof upvotes>;
export type NewUpvote = InferInsertModel<typeof upvotes>;

// Organizations
export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

// Memberships
export type Membership = InferSelectModel<typeof memberships>;
export type NewMembership = InferInsertModel<typeof memberships>;

// Roles
export type Role = InferSelectModel<typeof roles>;
export type NewRole = InferInsertModel<typeof roles>;

// Permissions
export type Permission = InferSelectModel<typeof permissions>;
export type NewPermission = InferInsertModel<typeof permissions>;
