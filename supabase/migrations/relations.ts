import { relations } from "drizzle-orm/relations";
import { roles, rolePermissions, permissions } from "./schema";

export const rolePermissionsRelations = relations(rolePermissions, ({one}) => ({
	role: one(roles, {
		fields: [rolePermissions.a],
		references: [roles.id]
	}),
	permission: one(permissions, {
		fields: [rolePermissions.b],
		references: [permissions.id]
	}),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({many}) => ({
	rolePermissions: many(rolePermissions),
}));