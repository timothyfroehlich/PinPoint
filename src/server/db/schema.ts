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
import { citext } from "~/server/db/citext";
import { ISSUE_STATUS_VALUES, type IssueStatus } from "~/lib/issues/status";

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
  email: citext("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name")
    .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
    .notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["guest", "member", "admin"] })
    .notNull()
    .default("guest"), // Default for new signups (no invitation)
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Invited Users Table
 *
 * Tracks users who have been invited to join the platform but haven't signed up yet.
 * Linked to user_profiles automatically on signup via database trigger.
 */
export const invitedUsers = pgTable("invited_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  name: text("name")
    .generatedAlwaysAs(sql`first_name || ' ' || last_name`)
    .notNull(),
  email: citext("email").notNull().unique(),
  role: text("role", { enum: ["guest", "member", "admin"] })
    .notNull()
    .default("member"), // Default for invited users (trusted)
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
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
    invitedOwnerId: uuid("invited_owner_id").references(() => invitedUsers.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    description: text("description"),
    tournamentNotes: text("tournament_notes"),
    ownerRequirements: text("owner_requirements"),
    ownerNotes: text("owner_notes"),
    presenceStatus: text("presence_status", {
      enum: [
        "on_the_floor",
        "off_the_floor",
        "on_loan",
        "pending_arrival",
        "removed",
      ],
    })
      .notNull()
      .default("on_the_floor"),
  },
  (t) => ({
    initialsCheck: check("initials_check", sql`initials ~ '^[A-Z0-9]{2,6}$'`),
    ownerCheck: check(
      "owner_check",
      sql`(owner_id IS NULL OR invited_owner_id IS NULL)`
    ),
    ownerIdIdx: index("idx_machines_owner_id").on(t.ownerId),
    invitedOwnerIdIdx: index("idx_machines_invited_owner_id").on(
      t.invitedOwnerId
    ),
    nameIdx: index("idx_machines_name").on(t.name),
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
    // Status values imported from single source of truth
    // Based on _issue-status-redesign/README.md - Final design with 11 statuses
    status: text("status", {
      enum: ISSUE_STATUS_VALUES as unknown as [IssueStatus, ...IssueStatus[]],
    })
      .notNull()
      .default("new"),
    severity: text("severity", {
      enum: ["cosmetic", "minor", "major", "unplayable"],
    })
      .notNull()
      .default("minor"),
    priority: text("priority", { enum: ["low", "medium", "high"] })
      .notNull()
      .default("medium"),
    frequency: text("frequency", {
      enum: ["intermittent", "frequent", "constant"],
    })
      .notNull()
      .default("intermittent"),
    reportedBy: uuid("reported_by").references(() => userProfiles.id),
    invitedReportedBy: uuid("invited_reported_by").references(
      () => invitedUsers.id
    ),
    reporterName: text("reporter_name"),
    reporterEmail: citext("reporter_email"),
    assignedTo: uuid("assigned_to").references(() => userProfiles.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
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
    reporterCheck: check(
      "reporter_check",
      sql`(${t.reportedBy} IS NULL AND ${t.invitedReportedBy} IS NULL) OR
          (${t.reportedBy} IS NOT NULL AND ${t.invitedReportedBy} IS NULL AND ${t.reporterName} IS NULL AND ${t.reporterEmail} IS NULL) OR
          (${t.reportedBy} IS NULL AND ${t.invitedReportedBy} IS NOT NULL AND ${t.reporterName} IS NULL AND ${t.reporterEmail} IS NULL) OR
          (${t.reportedBy} IS NULL AND ${t.invitedReportedBy} IS NULL AND (${t.reporterName} IS NOT NULL OR ${t.reporterEmail} IS NOT NULL))`
    ),
    assignedToIdx: index("idx_issues_assigned_to").on(t.assignedTo),
    reportedByIdx: index("idx_issues_reported_by").on(t.reportedBy),
    statusIdx: index("idx_issues_status").on(t.status),
    createdAtIdx: index("idx_issues_created_at").on(t.createdAt),
    invitedReportedByIdx: index("idx_issues_invited_reported_by").on(
      t.invitedReportedBy
    ),
    // Index on severity to optimize "Unplayable Machines" dashboard query and issues filtering
    severityIdx: index("idx_issues_severity").on(t.severity),
    // Index on priority to optimize issues list filtering
    priorityIdx: index("idx_issues_priority").on(t.priority),
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
 * Machine Watchers Table
 *
 * Users watching a machine for notifications on all its issues.
 * Modes:
 * - notify: Get notified of new issues
 * - subscribe: Notify + auto-add to watchers for new issues
 */
export const machineWatchers = pgTable(
  "machine_watchers",
  {
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    watchMode: text("watch_mode", { enum: ["notify", "subscribe"] })
      .notNull()
      .default("notify"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.machineId, t.userId] }),
    userIdIdx: index("idx_machine_watchers_user_id").on(t.userId),
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
    issueIdCreatedAtIdx: index("idx_issue_comments_issue_id_created_at").on(
      t.issueId,
      t.createdAt
    ),
    authorIdIdx: index("idx_issue_comments_author_id").on(t.authorId),
  })
);

/**
 * Issue Images Table
 *
 * Images attached to issues and comments with soft-delete support.
 */
export const issueImages = pgTable(
  "issue_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => issueComments.id, {
      onDelete: "cascade",
    }),
    uploadedBy: uuid("uploaded_by").references(() => userProfiles.id, {
      onDelete: "no action",
    }),

    // Vercel Blob URLs
    fullImageUrl: text("full_image_url").notNull(),
    croppedImageUrl: text("cropped_image_url"),

    // For deletion from Blob
    fullBlobPathname: text("full_blob_pathname").notNull(),
    croppedBlobPathname: text("cropped_blob_pathname"),

    // Metadata
    fileSizeBytes: integer("file_size_bytes").notNull(),
    mimeType: text("mime_type").notNull(),
    originalFilename: text("original_filename"),

    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => userProfiles.id),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    issueIdIdx: index("idx_issue_images_issue_id").on(t.issueId),
    uploadedByIdx: index("idx_issue_images_uploaded_by").on(t.uploadedBy),
    deletedAtIdx: index("idx_issue_images_deleted_at").on(t.deletedAt),
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
        "machine_ownership_changed",
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

    // Suppress notifications for own actions (global toggle)
    suppressOwnActions: boolean("suppress_own_actions")
      .notNull()
      .default(false),

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
      .default(false),
    inAppNotifyOnStatusChange: boolean("in_app_notify_on_status_change")
      .notNull()
      .default(false),

    // New Comments
    emailNotifyOnNewComment: boolean("email_notify_on_new_comment")
      .notNull()
      .default(false),
    inAppNotifyOnNewComment: boolean("in_app_notify_on_new_comment")
      .notNull()
      .default(false),

    // New Issues (Owned Machines)
    emailNotifyOnNewIssue: boolean("email_notify_on_new_issue")
      .notNull()
      .default(true),
    inAppNotifyOnNewIssue: boolean("in_app_notify_on_new_issue")
      .notNull()
      .default(false),

    // Global New Issues (Watch All)
    emailWatchNewIssuesGlobal: boolean("email_watch_new_issues_global")
      .notNull()
      .default(false),
    inAppWatchNewIssuesGlobal: boolean("in_app_watch_new_issues_global")
      .notNull()
      .default(false),

    // Machine Ownership Changes
    emailNotifyOnMachineOwnershipChange: boolean(
      "email_notify_on_machine_ownership_change"
    )
      .notNull()
      .default(false),
    inAppNotifyOnMachineOwnershipChange: boolean(
      "in_app_notify_on_machine_ownership_change"
    )
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
    uploadedImages: many(issueImages),
    ownedMachines: many(machines, { relationName: "owner" }),
    notificationPreferences: one(notificationPreferences, {
      fields: [userProfiles.id],
      references: [notificationPreferences.userId],
    }),
    notifications: many(notifications),
    watchedIssues: many(issueWatchers),
    watchedMachines: many(machineWatchers),
  })
);

export const machinesRelations = relations(machines, ({ many, one }) => ({
  issues: many(issues),
  owner: one(userProfiles, {
    fields: [machines.ownerId],
    references: [userProfiles.id],
    relationName: "owner",
  }),
  invitedOwner: one(invitedUsers, {
    fields: [machines.invitedOwnerId],
    references: [invitedUsers.id],
    relationName: "invited_owner",
  }),
  watchers: many(machineWatchers),
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
  invitedReporter: one(invitedUsers, {
    fields: [issues.invitedReportedBy],
    references: [invitedUsers.id],
    relationName: "invited_reporter",
  }),
  comments: many(issueComments),
  images: many(issueImages),
  watchers: many(issueWatchers),
}));

export const invitedUsersRelations = relations(invitedUsers, ({ many }) => ({
  ownedMachines: many(machines, { relationName: "invited_owner" }),
  reportedIssues: many(issues, { relationName: "invited_reporter" }),
}));

export const issueCommentsRelations = relations(
  issueComments,
  ({ one, many }) => ({
    issue: one(issues, {
      fields: [issueComments.issueId],
      references: [issues.id],
    }),
    author: one(userProfiles, {
      fields: [issueComments.authorId],
      references: [userProfiles.id],
    }),
    images: many(issueImages),
  })
);

export const issueImagesRelations = relations(issueImages, ({ one }) => ({
  issue: one(issues, {
    fields: [issueImages.issueId],
    references: [issues.id],
  }),
  comment: one(issueComments, {
    fields: [issueImages.commentId],
    references: [issueComments.id],
  }),
  uploader: one(userProfiles, {
    fields: [issueImages.uploadedBy],
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

export const machineWatchersRelations = relations(
  machineWatchers,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineWatchers.machineId],
      references: [machines.id],
    }),
    user: one(userProfiles, {
      fields: [machineWatchers.userId],
      references: [userProfiles.id],
    }),
  })
);

/**
 * Type exports
 */
export type IssueImage = typeof issueImages.$inferSelect;
