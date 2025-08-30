import { relations } from "drizzle-orm";

import { users, accounts, sessions } from "./auth";
import {
  collections,
  collectionTypes,
  collectionMachines,
  notifications,
  pinballMapConfigs,
} from "./collections";
import {
  issues,
  priorities,
  issueStatuses,
  comments,
  attachments,
  issueHistory,
  upvotes,
  anonymousRateLimits,
} from "./issues";
import { locations, models, machines } from "./machines";
import {
  organizations,
  memberships,
  roles,
  permissions,
  rolePermissions,
  systemSettings,
  activityLog,
  invitations,
} from "./organizations";

// Import all tables
export * from "./auth";
export * from "./collections";
export * from "./issues";
export * from "./machines";
export * from "./organizations";

// =================================
// RELATIONS
// =================================

// Auth Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  memberships: many(memberships),
  ownedMachines: many(machines),
  issuesCreated: many(issues, { relationName: "CreatedBy" }),
  issuesAssigned: many(issues, { relationName: "AssignedTo" }),
  comments: many(comments),
  deletedComments: many(comments, { relationName: "CommentDeleter" }),
  upvotes: many(upvotes),
  activityHistory: many(issueHistory),
  notifications: many(notifications),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.user_id],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.user_id],
    references: [users.id],
  }),
}));

// Organization Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  locations: many(locations),
  roles: many(roles),
  machines: many(machines),
  models: many(models), // Organization-owned custom models (where organizationId IS NOT NULL)
  issues: many(issues),
  priorities: many(priorities),
  issueStatuses: many(issueStatuses),
  collectionTypes: many(collectionTypes),
  issueHistory: many(issueHistory),
  attachments: many(attachments),
  pinballMapConfig: many(pinballMapConfigs),
  anonymousRateLimits: many(anonymousRateLimits),
  // Phase 4B: Administrative relations
  systemSettings: many(systemSettings),
  activityLog: many(activityLog),
  invitations: many(invitations),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.user_id],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organization_id],
    references: [organizations.id],
  }),
  role: one(roles, {
    fields: [memberships.role_id],
    references: [roles.id],
  }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organization_id],
    references: [organizations.id],
  }),
  memberships: many(memberships),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(
  rolePermissions,
  ({ one }) => ({
    role: one(roles, {
      fields: [rolePermissions.role_id],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissions.permission_id],
      references: [permissions.id],
    }),
  }),
);

// Machine Relations
export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.organization_id],
    references: [organizations.id],
  }),
  machines: many(machines),
  collections: many(collections),
}));

// Models Relations (OPDB + Future Custom Models)
export const modelsRelations = relations(models, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [models.organization_id],
    references: [organizations.id],
  }),
  machines: many(machines),
}));

export const machinesRelations = relations(machines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [machines.organization_id],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [machines.location_id],
    references: [locations.id],
  }),
  // Model relation
  model: one(models, {
    fields: [machines.model_id],
    references: [models.id],
  }),
  owner: one(users, {
    fields: [machines.owner_id],
    references: [users.id],
  }),
  issues: many(issues),
  collectionMachines: many(collectionMachines),
}));

// Issue Relations
export const issuesRelations = relations(issues, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [issues.organization_id],
    references: [organizations.id],
  }),
  machine: one(machines, {
    fields: [issues.machine_id],
    references: [machines.id],
  }),
  priority: one(priorities, {
    fields: [issues.priority_id],
    references: [priorities.id],
  }),
  status: one(issueStatuses, {
    fields: [issues.status_id],
    references: [issueStatuses.id],
  }),
  createdBy: one(users, {
    fields: [issues.created_by_id],
    references: [users.id],
    relationName: "CreatedBy",
  }),
  assignedTo: one(users, {
    fields: [issues.assigned_to_id],
    references: [users.id],
    relationName: "AssignedTo",
  }),
  comments: many(comments),
  attachments: many(attachments),
  history: many(issueHistory),
  upvotes: many(upvotes),
}));

export const prioritiesRelations = relations(priorities, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [priorities.organization_id],
    references: [organizations.id],
  }),
  issues: many(issues),
}));

export const issueStatusesRelations = relations(
  issueStatuses,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [issueStatuses.organization_id],
      references: [organizations.id],
    }),
    issues: many(issues),
  }),
);

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issue_id],
    references: [issues.id],
  }),
  author: one(users, {
    fields: [comments.author_id],
    references: [users.id],
  }),
  deleter: one(users, {
    fields: [comments.deleted_by],
    references: [users.id],
    relationName: "CommentDeleter",
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  issue: one(issues, {
    fields: [attachments.issue_id],
    references: [issues.id],
  }),
  organization: one(organizations, {
    fields: [attachments.organization_id],
    references: [organizations.id],
  }),
}));

export const issueHistoryRelations = relations(issueHistory, ({ one }) => ({
  issue: one(issues, {
    fields: [issueHistory.issue_id],
    references: [issues.id],
  }),
  organization: one(organizations, {
    fields: [issueHistory.organization_id],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [issueHistory.actor_id],
    references: [users.id],
  }),
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  issue: one(issues, {
    fields: [upvotes.issue_id],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [upvotes.user_id],
    references: [users.id],
  }),
}));

// Collection Relations
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  type: one(collectionTypes, {
    fields: [collections.type_id],
    references: [collectionTypes.id],
  }),
  location: one(locations, {
    fields: [collections.location_id],
    references: [locations.id],
  }),
  collectionMachines: many(collectionMachines),
}));

export const collectionMachinesRelations = relations(
  collectionMachines,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionMachines.collection_id],
      references: [collections.id],
    }),
    machine: one(machines, {
      fields: [collectionMachines.machine_id],
      references: [machines.id],
    }),
  }),
);

export const collectionTypesRelations = relations(
  collectionTypes,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [collectionTypes.organization_id],
      references: [organizations.id],
    }),
    collections: many(collections),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
}));

export const pinballMapConfigsRelations = relations(
  pinballMapConfigs,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [pinballMapConfigs.organization_id],
      references: [organizations.id],
    }),
  }),
);

export const anonymousRateLimitsRelations = relations(
  anonymousRateLimits,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [anonymousRateLimits.organization_id],
      references: [organizations.id],
    }),
  }),
);

// =================================
// PHASE 4B: ADMINISTRATIVE RELATIONS
// =================================

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [systemSettings.organization_id],
    references: [organizations.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityLog.organization_id],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [activityLog.user_id],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organization_id],
    references: [organizations.id],
  }),
  role: one(roles, {
    fields: [invitations.role_id],
    references: [roles.id],
  }),
  invitedByUser: one(users, {
    fields: [invitations.invited_by],
    references: [users.id],
  }),
}));
