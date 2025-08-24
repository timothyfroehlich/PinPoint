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

    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),
    resolved_at: timestamp(),
    // Anonymous reporting support
    reporter_email: text(), // For anonymous issue reporting
    submitter_name: text(), // Optional name for anonymous issue reporting

    // Relations
    organization_id: text().notNull(),
    machine_id: text().notNull(),
    status_id: text().notNull(),
    priority_id: text().notNull(),
    created_by_id: text(),
    assigned_to_id: text(),
  },
  (table) => [
    // Multi-tenancy: organization_id filtering (most critical)
    index("issues_organization_id_idx").on(table.organization_id),
    // Issue workflow: machine-specific issue lookups
    index("issues_machine_id_idx").on(table.machine_id),
    // Issue workflow: status and priority filtering
    index("issues_status_id_idx").on(table.status_id),
    index("issues_priority_id_idx").on(table.priority_id),
    // Issue workflow: assignment tracking (nullable fields)
    index("issues_assigned_to_id_idx").on(table.assigned_to_id),
    index("issues_created_by_id_idx").on(table.created_by_id),
  ],
);

export const priorities = pgTable(
  "priorities",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Low", "Medium", "High"
    order: integer().notNull(), // For sorting purposes
    organization_id: text().notNull(),
    is_default: boolean().default(false).notNull(),
  },
  (table) => [
    index("priorities_organization_id_idx").on(table.organization_id),
  ],
);

export const issueStatuses = pgTable(
  "issue_statuses",
  {
    id: text().primaryKey(),
    name: text().notNull(), // e.g., "Reported", "Diagnosing", "Awaiting Parts", "Fixed"
    category: statusCategoryEnum().notNull(), // "NEW", "IN_PROGRESS", "RESOLVED"
    organization_id: text().notNull(),
    is_default: boolean().default(false).notNull(),
  },
  (table) => [
    index("issue_statuses_organization_id_idx").on(table.organization_id),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: text().primaryKey(),
    content: text().notNull(),
    created_at: timestamp().defaultNow().notNull(),
    updated_at: timestamp().defaultNow().notNull(),

    // Soft delete fields
    deleted_at: timestamp(), // Null = not deleted, Date = soft deleted
    deleted_by: text(), // Who deleted the comment (for audit trail)

    // Relations
    organization_id: text().notNull(),
    issue_id: text().notNull(),
    author_id: text().notNull(),
  },
  (table) => [
    // Comments: multi-tenancy and lookups
    index("comments_organization_id_idx").on(table.organization_id),
    index("comments_issue_id_idx").on(table.issue_id),
    index("comments_author_id_idx").on(table.author_id),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: text().primaryKey(),
    url: text().notNull(),
    file_name: text().notNull(),
    file_type: text().notNull(),
    created_at: timestamp().defaultNow().notNull(),

    // Add multi-tenancy
    organization_id: text().notNull(),

    // Relations
    issue_id: text().notNull(),
  },
  (table) => [
    index("attachments_organization_id_idx").on(table.organization_id),
    index("attachments_issue_id_idx").on(table.issue_id),
  ],
);

export const issueHistory = pgTable(
  "issue_history",
  {
    id: text().primaryKey(),
    field: text().notNull(), // e.g., "status", "assignee", "priority"
    old_value: text(),
    new_value: text(),
    changed_at: timestamp().defaultNow().notNull(),

    // Add missing fields
    organization_id: text().notNull(), // For multi-tenancy
    actor_id: text(), // Who performed the action (null for system actions)
    type: activityTypeEnum().notNull(), // Replace string with proper enum

    // Relations
    issue_id: text().notNull(),
  },
  (table) => [
    index("issue_history_organization_id_idx").on(table.organization_id),
    index("issue_history_issue_id_idx").on(table.issue_id),
    index("issue_history_type_idx").on(table.type),
  ],
);

export const upvotes = pgTable(
  "upvotes",
  {
    id: text().primaryKey(),
    created_at: timestamp().defaultNow().notNull(),
    issue_id: text().notNull(),
    user_id: text().notNull(),
  },
  (table) => [
    index("upvotes_issue_id_idx").on(table.issue_id),
    index("upvotes_user_id_issue_id_idx").on(table.user_id, table.issue_id),
  ],
);
