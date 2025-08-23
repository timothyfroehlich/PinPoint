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
    id: text().primaryKey(),
    title: text().notNull(),
    description: text(),
    consistency: text(), // e.g., "Always", "Occasionally"

    // For V1.0 checklists
    checklist: json(), // Store checklist items as JSON: [{ text: "...", completed: false }]

    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
    resolvedAt: timestamp(),
    // Anonymous reporting support
    reporterEmail: text(), // For anonymous issue reporting
    submitterName: text(), // Optional name for anonymous issue reporting

    // Relations
    organizationId: text().notNull(),
    machineId: text().notNull(),
    statusId: text().notNull(),
    priorityId: text().notNull(),
    createdById: text(),
    assignedToId: text(),
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
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Low", "Medium", "High"
    order: integer().notNull(), // For sorting purposes
    organizationId: text().notNull(),
    isDefault: boolean().default(false).notNull(),
  },
  (table) => [index("priorities_organization_id_idx").on(table.organizationId)],
);

export const issueStatuses = pgTable(
  "issue_statuses",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Reported", "Diagnosing", "Awaiting Parts", "Fixed"
    category: statusCategoryEnum().notNull(), // "NEW", "IN_PROGRESS", "RESOLVED"
    organizationId: text().notNull(),
    isDefault: boolean().default(false).notNull(),
  },
  (table) => [
    index("issue_statuses_organization_id_idx").on(table.organizationId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text().primaryKey(),
    content: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),

    // Soft delete fields
    deletedAt: timestamp(), // Null = not deleted, Date = soft deleted
    deletedBy: text(), // Who deleted the comment (for audit trail)

    // Relations
    organizationId: text().notNull(),
    issueId: text().notNull(),
    authorId: text().notNull(),
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
    id: text().primaryKey(),
    url: text().notNull(),
    fileName: text().notNull(),
    fileType: text().notNull(),
    createdAt: timestamp().defaultNow().notNull(),

    // Add multi-tenancy
    organizationId: text().notNull(),

    // Relations
    issueId: text().notNull(),
  },
  (table) => [
    index("attachments_organization_id_idx").on(table.organizationId),
    index("attachments_issue_id_idx").on(table.issueId),
  ],
);

export const issueHistory = pgTable(
  "issue_history",
  {
    id: text().primaryKey(),
    field: text().notNull(), // e.g., "status", "assignee", "priority"
    oldValue: text(),
    newValue: text(),
    changedAt: timestamp().defaultNow().notNull(),

    // Add missing fields
    organizationId: text().notNull(), // For multi-tenancy
    actorId: text(), // Who performed the action (null for system actions)
    type: activityTypeEnum().notNull(), // Replace string with proper enum

    // Relations
    issueId: text().notNull(),
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
    id: text().primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    issueId: text().notNull(),
    userId: text().notNull(),
  },
  (table) => [
    index("upvotes_issue_id_idx").on(table.issueId),
    index("upvotes_user_id_issue_id_idx").on(table.userId, table.issueId),
  ],
);
