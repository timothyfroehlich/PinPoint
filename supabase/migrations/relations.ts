import { relations } from "drizzle-orm/relations";
import {
  organizations,
  activityLog,
  invitations,
  roles,
  rolePermissions,
  permissions,
  systemSettings,
} from "./schema";

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [activityLog.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  activityLogs: many(activityLog),
  invitations: many(invitations),
  systemSettings: many(systemSettings),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  role: one(roles, {
    fields: [invitations.roleId],
    references: [roles.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  invitations: many(invitations),
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

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [systemSettings.organizationId],
    references: [organizations.id],
  }),
}));
