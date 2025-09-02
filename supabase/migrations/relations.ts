import { relations } from "drizzle-orm/relations";
import { organizations, invitations, roles, rolePermissions, permissions, systemSettings, activityLog } from "./schema";

export const invitationsRelations = relations(invitations, ({one}) => ({
	organization: one(organizations, {
		fields: [invitations.organizationId],
		references: [organizations.id]
	}),
	role: one(roles, {
		fields: [invitations.roleId],
		references: [roles.id]
	}),
}));

export const organizationsRelations = relations(organizations, ({many}) => ({
	invitations: many(invitations),
	systemSettings: many(systemSettings),
	activityLogs: many(activityLog),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	invitations: many(invitations),
	rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.roleId],
		references: [roles.id]
	}),
	permission: one(permissions, {
		fields: [rolePermissions.permissionId],
		references: [permissions.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const systemSettingsRelations = relations(systemSettings, ({one}) => ({
	organization: one(organizations, {
		fields: [systemSettings.organizationId],
		references: [organizations.id]
	}),
}));

export const activityLogRelations = relations(activityLog, ({one}) => ({
	organization: one(organizations, {
		fields: [activityLog.organizationId],
		references: [organizations.id]
	}),
}));