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

export const statusCategoryEnum = pgEnum("StatusCategory", [
  "NEW",
  "IN_PROGRESS",
  "RESOLVED",
]);

export const activityTypeEnum = pgEnum("ActivityType", [
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
  "Issue",
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
    organizationId: text("organizationId").notNull(),
    machineId: text("machineId").notNull(),
    statusId: text("statusId").notNull(),
    priorityId: text("priorityId").notNull(),
    createdById: text("createdById"),
    assignedToId: text("assignedToId"),
  },
  (table) => [
    // Multi-tenancy: organizationId filtering (most critical)
    index("Issue_organizationId_idx").on(table.organizationId),
    // Issue workflow: machine-specific issue lookups
    index("Issue_machineId_idx").on(table.machineId),
    // Issue workflow: status and priority filtering
    index("Issue_statusId_idx").on(table.statusId),
    index("Issue_priorityId_idx").on(table.priorityId),
    // Issue workflow: assignment tracking (nullable fields)
    index("Issue_assignedToId_idx").on(table.assignedToId),
    index("Issue_createdById_idx").on(table.createdById),
  ],
);

export const priorities = pgTable(
  "Priority",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g., "Low", "Medium", "High"
    order: integer("order").notNull(), // For sorting purposes
    organizationId: text("organizationId").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
  },
  (table) => [index("Priority_organizationId_idx").on(table.organizationId)],
);

export const issueStatuses = pgTable(
  "IssueStatus",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // e.g., "Reported", "Diagnosing", "Awaiting Parts", "Fixed"
    category: statusCategoryEnum("category").notNull(), // "NEW", "IN_PROGRESS", "RESOLVED"
    organizationId: text("organizationId").notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
  },
  (table) => [index("IssueStatus_organizationId_idx").on(table.organizationId)],
);

export const comments = pgTable(
  "Comment",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),

    // Soft delete fields
    deletedAt: timestamp("deletedAt"), // Null = not deleted, Date = soft deleted
    deletedBy: text("deletedBy"), // Who deleted the comment (for audit trail)

    // Relations
    issueId: text("issueId").notNull(),
    authorId: text("authorId").notNull(),
  },
  (table) => [
    // Comments: issue-specific lookups
    index("Comment_issueId_idx").on(table.issueId),
    index("Comment_authorId_idx").on(table.authorId),
  ],
);

export const attachments = pgTable(
  "Attachment",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull(),
    fileName: text("fileName").notNull(),
    fileType: text("fileType").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),

    // Add multi-tenancy
    organizationId: text("organizationId").notNull(),

    // Relations
    issueId: text("issueId").notNull(),
  },
  (table) => [
    index("Attachment_organizationId_idx").on(table.organizationId),
    index("Attachment_issueId_idx").on(table.issueId),
  ],
);

export const issueHistory = pgTable(
  "IssueHistory",
  {
    id: text("id").primaryKey(),
    field: text("field").notNull(), // e.g., "status", "assignee", "priority"
    oldValue: text("oldValue"),
    newValue: text("newValue"),
    changedAt: timestamp("changedAt").defaultNow().notNull(),

    // Add missing fields
    organizationId: text("organizationId").notNull(), // For multi-tenancy
    actorId: text("actorId"), // Who performed the action (null for system actions)
    type: activityTypeEnum("type").notNull(), // Replace string with proper enum

    // Relations
    issueId: text("issueId").notNull(),
  },
  (table) => [
    index("IssueHistory_organizationId_idx").on(table.organizationId),
    index("IssueHistory_issueId_idx").on(table.issueId),
    index("IssueHistory_type_idx").on(table.type),
  ],
);

export const upvotes = pgTable(
  "Upvote",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    issueId: text("issueId").notNull(),
    userId: text("userId").notNull(),
  },
  (table) => [
    index("Upvote_issueId_idx").on(table.issueId),
    index("Upvote_userId_issueId_idx").on(table.userId, table.issueId),
  ],
);
