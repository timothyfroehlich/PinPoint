import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgSchema,
  primaryKey,
  index,
  integer,
  check,
  unique,
} from "drizzle-orm/pg-core";

/**
 * ⚠️ IMPORTANT: When adding new tables to this schema file,
 * you MUST update the `tablesFilter` array in drizzle.config.ts
 * to include the new table name(s). Otherwise, drizzle-kit will not
 * be able to see or manage the new tables.
 *
 * Example: If you add `export const fooBar = pgTable("foo_bar", ...)`
 * then add "foo_bar" to the tablesFilter array.
 */

const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});

/**
 * User Profiles Table
 *
 * The id column references auth.users(id) from Supabase Auth (enforced by database FK).
 * Auto-created via database trigger (see supabase/seed.sql).
 *
 * Note: Drizzle doesn't support cross-schema references, so the FK constraint
 * is created manually in supabase/seed.sql (user_profiles.id -> auth.users.id).
 */
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name")
    .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
    .notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["guest", "member", "admin"] })
    .notNull()
    .default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Machines Table
 *
 * Pinball machines in the collection.
 */
export const machines = pgTable(
  "machines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    initials: text("initials").notNull().unique(),
    nextIssueNumber: integer("next_issue_number").notNull().default(1),
    name: text("name").notNull(),
    ownerId: uuid("owner_id").references(() => userProfiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    initialsCheck: check("initials_check", sql`initials ~ '^[A-Z0-9]{2,6}$'`),
    ownerIdIdx: index("idx_machines_owner_id").on(t.ownerId),
  })
);

/**
 * Issues Table
 *
 * Issues reported for pinball machines.
 * Every issue MUST have exactly one machine (enforced by CHECK constraint).
 */
export const issues = pgTable(
  "issues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    machineInitials: text("machine_initials")
      .notNull()
      .references(() => machines.initials, { onDelete: "cascade" }),
    issueNumber: integer("issue_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["new", "in_progress", "resolved"] })
      .notNull()
      .default("new"),
    severity: text("severity", { enum: ["minor", "playable", "unplayable"] })
      .notNull()
      .default("playable"),
    priority: text("priority", { enum: ["low", "medium", "high", "critical"] })
      .notNull()
      .default("low"),
    reportedBy: uuid("reported_by").references(() => userProfiles.id),
    assignedTo: uuid("assigned_to").references(() => userProfiles.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueIssueNumber: unique("unique_issue_number").on(
      t.machineInitials,
      t.issueNumber
    ),
    assignedToIdx: index("idx_issues_assigned_to").on(t.assignedTo),
    reportedByIdx: index("idx_issues_reported_by").on(t.reportedBy),
    statusIdx: index("idx_issues_status").on(t.status),
  })
);

/**
 * Issue Watchers Table
 *
 * Users watching an issue for notifications.
 */
export const issueWatchers = pgTable(
  "issue_watchers",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.issueId, t.userId] }),
    userIdIdx: index("idx_issue_watchers_user_id").on(t.userId),
  })
);

/**
 * Issue Comments Table
 *
 * Comments on issues, including system-generated timeline events.
 */
export const issueComments = pgTable(
  "issue_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => userProfiles.id),
    content: text("content").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    issueIdIdx: index("idx_issue_comments_issue_id").on(t.issueId),
  })
);

/**
 * Notifications Table
 *
 * In-app notifications for users.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: [
        "issue_assigned",
        "issue_status_changed",
        "new_comment",
        "new_issue",
      ],
    }).notNull(),
    resourceId: uuid("resource_id").notNull(), // Generic reference to issue or machine
    resourceType: text("resource_type", {
      enum: ["issue", "machine"],
    }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userUnreadIdx: index("idx_notifications_user_unread").on(
      t.userId,
      t.readAt,
      t.createdAt
    ),
  })
);

/**
 * Notification Preferences Table
 *
 * User preferences for notifications.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),

    // Assignment
    emailNotifyOnAssigned: boolean("email_notify_on_assigned")
      .notNull()
      .default(true),
    inAppNotifyOnAssigned: boolean("in_app_notify_on_assigned")
      .notNull()
      .default(true),

    // Status Changes
    emailNotifyOnStatusChange: boolean("email_notify_on_status_change")
      .notNull()
      .default(true),
    inAppNotifyOnStatusChange: boolean("in_app_notify_on_status_change")
      .notNull()
      .default(true),

    // New Comments
    emailNotifyOnNewComment: boolean("email_notify_on_new_comment")
      .notNull()
      .default(true),
    inAppNotifyOnNewComment: boolean("in_app_notify_on_new_comment")
      .notNull()
      .default(true),

    // New Issues (Owned Machines)
    emailNotifyOnNewIssue: boolean("email_notify_on_new_issue")
      .notNull()
      .default(true),
    inAppNotifyOnNewIssue: boolean("in_app_notify_on_new_issue")
      .notNull()
      .default(true),

    // Global New Issues (Watch All)
    emailWatchNewIssuesGlobal: boolean("email_watch_new_issues_global")
      .notNull()
      .default(false),
    inAppWatchNewIssuesGlobal: boolean("in_app_watch_new_issues_global")
      .notNull()
      .default(false),
  },
  (t) => ({
    globalWatchEmailIdx: index("idx_notif_prefs_global_watch_email").on(
      t.emailWatchNewIssuesGlobal
    ),
  })
);

/**
 * Relations
 */

export const userProfilesRelations = relations(
  userProfiles,
  ({ many, one }) => ({
    reportedIssues: many(issues, { relationName: "reported_by" }),
    assignedIssues: many(issues, { relationName: "assigned_to" }),
    comments: many(issueComments),
    ownedMachines: many(machines, { relationName: "owner" }),
    notificationPreferences: one(notificationPreferences, {
      fields: [userProfiles.id],
      references: [notificationPreferences.userId],
    }),
    notifications: many(notifications),
    watchedIssues: many(issueWatchers),
  })
);

export const machinesRelations = relations(machines, ({ many, one }) => ({
  issues: many(issues),
  owner: one(userProfiles, {
    fields: [machines.ownerId],
    references: [userProfiles.id],
    relationName: "owner",
  }),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  machine: one(machines, {
    fields: [issues.machineInitials],
    references: [machines.initials],
  }),
  reportedByUser: one(userProfiles, {
    fields: [issues.reportedBy],
    references: [userProfiles.id],
    relationName: "reported_by",
  }),
  assignedToUser: one(userProfiles, {
    fields: [issues.assignedTo],
    references: [userProfiles.id],
    relationName: "assigned_to",
  }),
  comments: many(issueComments),
  watchers: many(issueWatchers),
}));

export const issueCommentsRelations = relations(issueComments, ({ one }) => ({
  issue: one(issues, {
    fields: [issueComments.issueId],
    references: [issues.id],
  }),
  author: one(userProfiles, {
    fields: [issueComments.authorId],
    references: [userProfiles.id],
  }),
}));

export const issueWatchersRelations = relations(issueWatchers, ({ one }) => ({
  issue: one(issues, {
    fields: [issueWatchers.issueId],
    references: [issues.id],
  }),
  user: one(userProfiles, {
    fields: [issueWatchers.userId],
    references: [userProfiles.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(userProfiles, {
    fields: [notifications.userId],
    references: [userProfiles.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(userProfiles, {
      fields: [notificationPreferences.userId],
      references: [userProfiles.id],
    }),
  })
);
