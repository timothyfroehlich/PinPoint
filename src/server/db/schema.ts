import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgSchema,
} from "drizzle-orm/pg-core";

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
  name: text("name").notNull(),
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
export const machines = pgTable("machines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: ["new", "in_progress", "resolved"] })
      .notNull()
      .default("new"),
    severity: text("severity", { enum: ["minor", "playable", "unplayable"] })
      .notNull()
      .default("playable"),
    reportedBy: uuid("reported_by").references(() => userProfiles.id),
    assignedTo: uuid("assigned_to").references(() => userProfiles.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
  // No additional table-level constraints needed; machineId is already NOT NULL.
);

/**
 * Issue Comments Table
 *
 * Comments on issues, including system-generated timeline events.
 */
export const issueComments = pgTable("issue_comments", {
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
});

/**
 * Relations
 */

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  reportedIssues: many(issues, { relationName: "reported_by" }),
  assignedIssues: many(issues, { relationName: "assigned_to" }),
  comments: many(issueComments),
}));

export const machinesRelations = relations(machines, ({ many }) => ({
  issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  machine: one(machines, {
    fields: [issues.machineId],
    references: [machines.id],
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
