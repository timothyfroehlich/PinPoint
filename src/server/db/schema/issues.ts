import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  json,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { machines } from "./machines";
import { users } from "./auth";

// =================================
// ENUMS
// =================================

export const statusCategoryEnum = pgEnum("status_category", [
  "NEW",
  "IN_PROGRESS",
  "RESOLVED",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "CREATED", // Issue created
  "STATUS_CHANGED", // Status updated
  "ASSIGNED", // Assignee changed
  "PRIORITY_CHANGED", // Priority updated
  "COMMENTED", // Comment added
  "COMMENT_DELETED", // Comment deleted
  "ATTACHMENT_ADDED", // File attached
  "MERGED", // Issue merged (V1.0)
  "RESOLVED", // Issue resolved
  "REOPENED", // Issue reopened
  "SYSTEM", // System-generated activity
]);

// =================================
// ISSUE WORKFLOW TABLES
// =================================

export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    consistency: text("consistency"), // e.g., "Always", "Occasionally"

    // For V1.0 checklists
    checklist: json("checklist"), // Store checklist items as JSON: [{ text: "...", completed: false }]

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
    // Anonymous reporting support
    reporterEmail: text("reporterEmail"), // For anonymous issue reporting
    submitterName: text("submitterName"), // Optional name for anonymous issue reporting

    // Relations
    organizationId: text("organizationId")
      .notNull()
      .references(() => organizations.id),
    machineId: text("machineId")
      .notNull()
      .references(() => machines.id),
    statusId: text("statusId")
      .notNull()
      .references(() => issueStatuses.id),
    priorityId: text("priorityId")
      .notNull()
      .references(() => priorities.id),
    createdById: text("createdById").references(() => users.id),
    assignedToId: text("assignedToId").references(() => users.id),
  },
  (table) => [
    // Multi-tenancy: organizationId filtering (most critical)
    index("issues_organization_id_idx").on(table.organizationId),
    // Issue workflow: machine-specific issue lookups
    index("issues_machine_id_idx").on(table.machineId),
    // Issue workflow: status and priority filtering
    index("issues_status_id_idx").on(table.statusId),
    index("issues_priority_id_idx").on(table.priorityId),
    // Issue workflow: assignment tracking (nullable fields)
    index("issues_assigned_to_id_idx").on(table.assignedToId),
    index("issues_created_by_id_idx").on(table.createdById),
  ],
);

export const priorities = pgTable(
  "priorities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g., "Low", "Medium", "High"
    order: integer("order").notNull(), // For sorting purposes
    organizationId: text("organizationId").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
  },
  (table) => [index("priorities_organization_id_idx").on(table.organizationId)],
);

export const issueStatuses = pgTable(
  "issue_statuses",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g., "Reported", "Diagnosing", "Awaiting Parts", "Fixed"
    category: statusCategoryEnum("category").notNull(), // "NEW", "IN_PROGRESS", "RESOLVED"
    organizationId: text("organizationId").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
  },
  (table) => [
    index("issue_statuses_organization_id_idx").on(table.organizationId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),

    // Soft delete fields
    deletedAt: timestamp("deletedAt"), // Null = not deleted, Date = soft deleted
    deletedBy: text("deletedBy"), // Who deleted the comment (for audit trail)

    // Relations
    organizationId: text("organizationId")
      .notNull()
      .references(() => organizations.id),
    issueId: text("issueId")
      .notNull()
      .references(() => issues.id),
    authorId: text("authorId")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    // Comments: multi-tenancy and lookups
    index("comments_organizationId_idx").on(table.organizationId),
    index("comments_issueId_idx").on(table.issueId),
    index("comments_authorId_idx").on(table.authorId),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    fileName: text("fileName").notNull(),
    fileType: text("fileType").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),

    // Add multi-tenancy
    organizationId: text("organizationId").notNull(),

    // Relations
    issueId: text("issueId")
      .notNull()
      .references(() => issues.id),
  },
  (table) => [
    index("attachments_organization_id_idx").on(table.organizationId),
    index("attachments_issue_id_idx").on(table.issueId),
  ],
);

export const issueHistory = pgTable(
  "issue_history",
  {
    id: text("id").primaryKey(),
    field: text("field").notNull(), // e.g., "status", "assignee", "priority"
    oldValue: text("oldValue"),
    newValue: text("newValue"),
    changedAt: timestamp("changedAt").defaultNow().notNull(),

    // Add missing fields
    organizationId: text("organizationId").notNull(), // For multi-tenancy
    type: activityTypeEnum("type").notNull(), // Replace string with proper enum

    // Relations
    issueId: text("issueId")
      .notNull()
      .references(() => issues.id),
    actorId: text("actorId").references(() => users.id),
  },
  (table) => [
    index("issue_history_organization_id_idx").on(table.organizationId),
    index("issue_history_issue_id_idx").on(table.issueId),
    index("issue_history_type_idx").on(table.type),
  ],
);

export const upvotes = pgTable(
  "upvotes",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    issueId: text("issueId")
      .notNull()
      .references(() => issues.id),
    userId: text("userId")
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    index("upvotes_issue_id_idx").on(table.issueId),
    index("upvotes_user_id_issue_id_idx").on(table.userId, table.issueId),
  ],
);
