import { relations } from "drizzle-orm";

// Import all table definitions
import * as auth from "./auth";
import * as collections from "./collections";
import * as issues from "./issues";
import * as machines from "./machines";
import * as organizations from "./organizations";

// =================================
// RELATIONS
// =================================

// Define relations for each schema area, importing tables from the modules
export const usersRelations = relations(auth.users, ({ many }) => ({
  accounts: many(auth.accounts),
  sessions: many(auth.sessions),
  memberships: many(organizations.memberships),
  ownedMachines: many(machines.machines),
  issuesCreated: many(issues.issues, { relationName: "CreatedBy" }),
  issuesAssigned: many(issues.issues, { relationName: "AssignedTo" }),
  comments: many(issues.comments),
  deletedComments: many(issues.comments, { relationName: "CommentDeleter" }),
  upvotes: many(issues.upvotes),
  activityHistory: many(issues.issueHistory),
  notifications: many(collections.notifications),
}));

export const accountsRelations = relations(auth.accounts, ({ one }) => ({
  user: one(auth.users, {
    fields: [auth.accounts.userId],
    references: [auth.users.id],
  }),
}));

export const sessionsRelations = relations(auth.sessions, ({ one }) => ({
  user: one(auth.users, {
    fields: [auth.sessions.userId],
    references: [auth.users.id],
  }),
}));

export const organizationsRelations = relations(
  organizations.organizations,
  ({ many }) => ({
    memberships: many(organizations.memberships),
    locations: many(machines.locations),
    roles: many(organizations.roles),
    machines: many(machines.machines),
    models: many(machines.models),
    issues: many(issues.issues),
    priorities: many(issues.priorities),
    issueStatuses: many(issues.issueStatuses),
    collectionTypes: many(collections.collectionTypes),
    issueHistory: many(issues.issueHistory),
    attachments: many(issues.attachments),
    pinballMapConfig: many(collections.pinballMapConfigs),
  }),
);

export const membershipsRelations = relations(
  organizations.memberships,
  ({ one }) => ({
    user: one(auth.users, {
      fields: [organizations.memberships.userId],
      references: [auth.users.id],
    }),
    organization: one(organizations.organizations, {
      fields: [organizations.memberships.organizationId],
      references: [organizations.organizations.id],
    }),
    role: one(organizations.roles, {
      fields: [organizations.memberships.roleId],
      references: [organizations.roles.id],
    }),
  }),
);

export const rolesRelations = relations(
  organizations.roles,
  ({ one, many }) => ({
    organization: one(organizations.organizations, {
      fields: [organizations.roles.organizationId],
      references: [organizations.organizations.id],
    }),
    memberships: many(organizations.memberships),
    rolePermissions: many(organizations.rolePermissions),
  }),
);

export const permissionsRelations = relations(
  organizations.permissions,
  ({ many }) => ({
    rolePermissions: many(organizations.rolePermissions),
  }),
);

export const rolePermissionsRelations = relations(
  organizations.rolePermissions,
  ({ one }) => ({
    role: one(organizations.roles, {
      fields: [organizations.rolePermissions.roleId],
      references: [organizations.roles.id],
    }),
    permission: one(organizations.permissions, {
      fields: [organizations.rolePermissions.permissionId],
      references: [organizations.permissions.id],
    }),
  }),
);

export const locationsRelations = relations(
  machines.locations,
  ({ one, many }) => ({
    organization: one(organizations.organizations, {
      fields: [machines.locations.organizationId],
      references: [organizations.organizations.id],
    }),
    machines: many(machines.machines),
    collections: many(collections.collections),
  }),
);

export const modelsRelations = relations(machines.models, ({ one, many }) => ({
  organization: one(organizations.organizations, {
    fields: [machines.models.organizationId],
    references: [organizations.organizations.id],
  }),
  machines: many(machines.machines),
}));

export const machinesRelations = relations(
  machines.machines,
  ({ one, many }) => ({
    organization: one(organizations.organizations, {
      fields: [machines.machines.organizationId],
      references: [organizations.organizations.id],
    }),
    location: one(machines.locations, {
      fields: [machines.machines.locationId],
      references: [machines.locations.id],
    }),
    model: one(machines.models, {
      fields: [machines.machines.modelId],
      references: [machines.models.id],
    }),
    owner: one(auth.users, {
      fields: [machines.machines.ownerId],
      references: [auth.users.id],
    }),
    issues: many(issues.issues),
    collectionMachines: many(collections.collectionMachines),
  }),
);

export const issuesRelations = relations(issues.issues, ({ one, many }) => ({
  organization: one(organizations.organizations, {
    fields: [issues.issues.organizationId],
    references: [organizations.organizations.id],
  }),
  machine: one(machines.machines, {
    fields: [issues.issues.machineId],
    references: [machines.machines.id],
  }),
  priority: one(issues.priorities, {
    fields: [issues.issues.priorityId],
    references: [issues.priorities.id],
  }),
  status: one(issues.issueStatuses, {
    fields: [issues.issues.statusId],
    references: [issues.issueStatuses.id],
  }),
  createdBy: one(auth.users, {
    fields: [issues.issues.createdById],
    references: [auth.users.id],
    relationName: "CreatedBy",
  }),
  assignedTo: one(auth.users, {
    fields: [issues.issues.assignedToId],
    references: [auth.users.id],
    relationName: "AssignedTo",
  }),
  comments: many(issues.comments),
  attachments: many(issues.attachments),
  history: many(issues.issueHistory),
  upvotes: many(issues.upvotes),
}));

export const prioritiesRelations = relations(
  issues.priorities,
  ({ one, many }) => ({
    organization: one(organizations.organizations, {
      fields: [issues.priorities.organizationId],
      references: [organizations.organizations.id],
    }),
    issues: many(issues.issues),
  }),
);

export const issueStatusesRelations = relations(
  issues.issueStatuses,
  ({ one, many }) => ({
    organization: one(organizations.organizations, {
      fields: [issues.issueStatuses.organizationId],
      references: [organizations.organizations.id],
    }),
    issues: many(issues.issues),
  }),
);

export const commentsRelations = relations(issues.comments, ({ one }) => ({
  issue: one(issues.issues, {
    fields: [issues.comments.issueId],
    references: [issues.issues.id],
  }),
  author: one(auth.users, {
    fields: [issues.comments.authorId],
    references: [auth.users.id],
  }),
  deleter: one(auth.users, {
    fields: [issues.comments.deletedBy],
    references: [auth.users.id],
    relationName: "CommentDeleter",
  }),
}));

export const attachmentsRelations = relations(
  issues.attachments,
  ({ one }) => ({
    issue: one(issues.issues, {
      fields: [issues.attachments.issueId],
      references: [issues.issues.id],
    }),
    organization: one(organizations.organizations, {
      fields: [issues.attachments.organizationId],
      references: [organizations.organizations.id],
    }),
  }),
);

export const issueHistoryRelations = relations(
  issues.issueHistory,
  ({ one }) => ({
    issue: one(issues.issues, {
      fields: [issues.issueHistory.issueId],
      references: [issues.issues.id],
    }),
    organization: one(organizations.organizations, {
      fields: [issues.issueHistory.organizationId],
      references: [organizations.organizations.id],
    }),
    actor: one(auth.users, {
      fields: [issues.issueHistory.actorId],
      references: [auth.users.id],
    }),
  }),
);

export const upvotesRelations = relations(issues.upvotes, ({ one }) => ({
  issue: one(issues.issues, {
    fields: [issues.upvotes.issueId],
    references: [issues.issues.id],
  }),
  user: one(auth.users, {
    fields: [issues.upvotes.userId],
    references: [auth.users.id],
  }),
}));

export const collectionsRelations = relations(
  collections.collections,
  ({ one, many }) => ({
    type: one(collections.collectionTypes, {
      fields: [collections.collections.typeId],
      references: [collections.collectionTypes.id],
    }),
    location: one(machines.locations, {
      fields: [collections.collections.locationId],
      references: [machines.locations.id],
    }),
    collectionMachines: many(collections.collectionMachines),
  }),
);

export const collectionMachinesRelations = relations(
  collections.collectionMachines,
  ({ one }) => ({
    collection: one(collections.collections, {
      fields: [collections.collectionMachines.collectionId],
      references: [collections.collections.id],
    }),
    machine: one(machines.machines, {
      fields: [collections.collectionMachines.machineId],
      references: [machines.machines.id],
    }),
  }),
);

export const collectionTypesRelations = relations(
  collections.collectionTypes,
  ({ one, many }) => ({
    organization: one(organizations.organizations, {
      fields: [collections.collectionTypes.organizationId],
      references: [organizations.organizations.id],
    }),
    collections: many(collections.collections),
  }),
);

export const notificationsRelations = relations(
  collections.notifications,
  ({ one }) => ({
    user: one(auth.users, {
      fields: [collections.notifications.userId],
      references: [auth.users.id],
    }),
  }),
);

export const pinballMapConfigsRelations = relations(
  collections.pinballMapConfigs,
  ({ one }) => ({
    organization: one(organizations.organizations, {
      fields: [collections.pinballMapConfigs.organizationId],
      references: [organizations.organizations.id],
    }),
  }),
);

// =================================
// EXPORTS
// =================================

// Re-export all tables for individual use
export * from "./auth";
export * from "./collections";
export * from "./issues";
export * from "./machines";
export * from "./organizations";

// Explicitly re-export permission-related tables to ensure they are available for mocks
export {
  roles,
  permissions,
  rolePermissions,
  memberships,
} from "./organizations";

// Consolidated schema object for Drizzle
export const schema = {
  ...auth,
  ...collections,
  ...issues,
  ...machines,
  ...organizations,
  // All relations
  usersRelations,
  accountsRelations,
  sessionsRelations,
  organizationsRelations,
  membershipsRelations,
  rolesRelations,
  permissionsRelations,
  rolePermissionsRelations,
  locationsRelations,
  modelsRelations,
  machinesRelations,
  issuesRelations,
  prioritiesRelations,
  issueStatusesRelations,
  commentsRelations,
  attachmentsRelations,
  issueHistoryRelations,
  upvotesRelations,
  collectionsRelations,
  collectionMachinesRelations,
  collectionTypesRelations,
  notificationsRelations,
  pinballMapConfigsRelations,
};
