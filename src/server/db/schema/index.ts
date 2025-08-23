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
} from "./issues";
import { locations, models, machines } from "./machines";
import {
  organizations,
  memberships,
  roles,
  permissions,
  rolePermissions,
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
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
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
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  role: one(roles, {
    fields: [memberships.roleId],
    references: [roles.id],
  }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [roles.organizationId],
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
      fields: [rolePermissions.roleId],
      references: [roles.id],
    }),
    permission: one(permissions, {
      fields: [rolePermissions.permissionId],
      references: [permissions.id],
    }),
  }),
);

// Machine Relations
export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.organizationId],
    references: [organizations.id],
  }),
  machines: many(machines),
  collections: many(collections),
}));

// Models Relations (OPDB + Future Custom Models)
export const modelsRelations = relations(models, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [models.organizationId],
    references: [organizations.id],
  }),
  machines: many(machines),
}));

export const machinesRelations = relations(machines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [machines.organizationId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [machines.locationId],
    references: [locations.id],
  }),
  // Model relation
  model: one(models, {
    fields: [machines.modelId],
    references: [models.id],
  }),
  owner: one(users, {
    fields: [machines.ownerId],
    references: [users.id],
  }),
  issues: many(issues),
  collectionMachines: many(collectionMachines),
}));

// Issue Relations
export const issuesRelations = relations(issues, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [issues.organizationId],
    references: [organizations.id],
  }),
  machine: one(machines, {
    fields: [issues.machineId],
    references: [machines.id],
  }),
  priority: one(priorities, {
    fields: [issues.priorityId],
    references: [priorities.id],
  }),
  status: one(issueStatuses, {
    fields: [issues.statusId],
    references: [issueStatuses.id],
  }),
  createdBy: one(users, {
    fields: [issues.createdById],
    references: [users.id],
    relationName: "CreatedBy",
  }),
  assignedTo: one(users, {
    fields: [issues.assignedToId],
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
    fields: [priorities.organizationId],
    references: [organizations.id],
  }),
  issues: many(issues),
}));

export const issueStatusesRelations = relations(
  issueStatuses,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [issueStatuses.organizationId],
      references: [organizations.id],
    }),
    issues: many(issues),
  }),
);

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  deleter: one(users, {
    fields: [comments.deletedBy],
    references: [users.id],
    relationName: "CommentDeleter",
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  issue: one(issues, {
    fields: [attachments.issueId],
    references: [issues.id],
  }),
  organization: one(organizations, {
    fields: [attachments.organizationId],
    references: [organizations.id],
  }),
}));

export const issueHistoryRelations = relations(issueHistory, ({ one }) => ({
  issue: one(issues, {
    fields: [issueHistory.issueId],
    references: [issues.id],
  }),
  organization: one(organizations, {
    fields: [issueHistory.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [issueHistory.actorId],
    references: [users.id],
  }),
}));

export const upvotesRelations = relations(upvotes, ({ one }) => ({
  issue: one(issues, {
    fields: [upvotes.issueId],
    references: [issues.id],
  }),
  user: one(users, {
    fields: [upvotes.userId],
    references: [users.id],
  }),
}));

// Collection Relations
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  type: one(collectionTypes, {
    fields: [collections.typeId],
    references: [collectionTypes.id],
  }),
  location: one(locations, {
    fields: [collections.locationId],
    references: [locations.id],
  }),
  collectionMachines: many(collectionMachines),
}));

export const collectionMachinesRelations = relations(
  collectionMachines,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionMachines.collectionId],
      references: [collections.id],
    }),
    machine: one(machines, {
      fields: [collectionMachines.machineId],
      references: [machines.id],
    }),
  }),
);

export const collectionTypesRelations = relations(
  collectionTypes,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [collectionTypes.organizationId],
      references: [organizations.id],
    }),
    collections: many(collections),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pinballMapConfigsRelations = relations(
  pinballMapConfigs,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [pinballMapConfigs.organizationId],
      references: [organizations.id],
    }),
  }),
);
