import { pgTable, text, timestamp, unique, boolean, integer, index, foreignKey, pgPolicy, real, json, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const activityType = pgEnum("activity_type", ['CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'COMMENTED', 'COMMENT_DELETED', 'ATTACHMENT_ADDED', 'MERGED', 'RESOLVED', 'REOPENED', 'SYSTEM'])
export const notificationEntity = pgEnum("notification_entity", ['ISSUE', 'MACHINE', 'COMMENT', 'ORGANIZATION'])
export const notificationFrequency = pgEnum("notification_frequency", ['IMMEDIATE', 'DAILY', 'WEEKLY', 'NEVER'])
export const notificationType = pgEnum("notification_type", ['ISSUE_CREATED', 'ISSUE_UPDATED', 'ISSUE_ASSIGNED', 'ISSUE_COMMENTED', 'MACHINE_ASSIGNED', 'SYSTEM_ANNOUNCEMENT'])
export const statusCategory = pgEnum("status_category", ['NEW', 'IN_PROGRESS', 'RESOLVED'])


export const accounts = pgTable("accounts", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	providerAccountId: text().notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
});

export const sessions = pgTable("sessions", {
	id: text().primaryKey().notNull(),
	sessionToken: text().notNull(),
	userId: text().notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	unique("sessions_sessionToken_unique").on(table.sessionToken),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	name: text(),
	email: text(),
	emailVerified: timestamp({ mode: 'string' }),
	image: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	bio: text(),
	profilePicture: text(),
	emailNotificationsEnabled: boolean().default(true).notNull(),
	pushNotificationsEnabled: boolean().default(false).notNull(),
	notificationFrequency: notificationFrequency().default('IMMEDIATE').notNull(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const verificationTokens = pgTable("verification_tokens", {
	identifier: text().notNull(),
	token: text().notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	unique("verification_tokens_token_unique").on(table.token),
]);

export const models = pgTable("models", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	organizationId: text(),
	manufacturer: text(),
	year: integer(),
	isCustom: boolean().default(false).notNull(),
	ipdbId: text(),
	opdbId: text(),
	machineType: text(),
	machineDisplay: text(),
	isActive: boolean().default(true).notNull(),
	ipdbLink: text(),
	opdbImgUrl: text(),
	kineticistUrl: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("models_ipdbId_unique").on(table.ipdbId),
	unique("models_opdbId_unique").on(table.opdbId),
]);

export const rolePermissions = pgTable("role_permissions", {
	a: text("A").notNull(),
	b: text("B").notNull(),
}, (table) => [
	index("role_permissions_permission_id_idx").using("btree", table.b.asc().nullsLast().op("text_ops")),
	index("role_permissions_role_id_idx").using("btree", table.a.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.a],
			foreignColumns: [roles.id],
			name: "role_permissions_A_roles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.b],
			foreignColumns: [permissions.id],
			name: "role_permissions_B_permissions_id_fk"
		}).onDelete("cascade"),
]);

export const permissions = pgTable("permissions", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
}, (table) => [
	unique("permissions_name_unique").on(table.name),
]);

export const organizations = pgTable("organizations", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	subdomain: text().notNull(),
	logoUrl: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("organizations_subdomain_idx").using("btree", table.subdomain.asc().nullsLast().op("text_ops")),
	unique("organizations_subdomain_unique").on(table.subdomain),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const memberships = pgTable("memberships", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	organizationId: text().notNull(),
	roleId: text().notNull(),
}, (table) => [
	index("memberships_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("memberships_user_id_organization_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const roles = pgTable("roles", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	organizationId: text().notNull(),
	isDefault: boolean().default(false).notNull(),
	isSystem: boolean().default(false).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("roles_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const locations = pgTable("locations", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	organizationId: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	street: text(),
	city: text(),
	state: text(),
	zip: text(),
	phone: text(),
	website: text(),
	latitude: real(),
	longitude: real(),
	description: text(),
	pinballMapId: integer(),
	regionId: text(),
	lastSyncAt: timestamp({ mode: 'string' }),
	syncEnabled: boolean().default(false).notNull(),
}, (table) => [
	index("locations_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const machines = pgTable("machines", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	organizationId: text().notNull(),
	locationId: text().notNull(),
	modelId: text().notNull(),
	ownerId: text(),
	ownerNotificationsEnabled: boolean().default(true).notNull(),
	notifyOnNewIssues: boolean().default(true).notNull(),
	notifyOnStatusChanges: boolean().default(true).notNull(),
	notifyOnComments: boolean().default(false).notNull(),
	qrCodeId: text(),
	qrCodeUrl: text(),
	qrCodeGeneratedAt: timestamp({ mode: 'string' }),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("machines_location_id_idx").using("btree", table.locationId.asc().nullsLast().op("text_ops")),
	index("machines_model_id_idx").using("btree", table.modelId.asc().nullsLast().op("text_ops")),
	index("machines_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("machines_owner_id_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
	index("machines_qr_code_id_idx").using("btree", table.qrCodeId.asc().nullsLast().op("text_ops")),
	unique("machines_qrCodeId_unique").on(table.qrCodeId),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const issues = pgTable("issues", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	consistency: text(),
	checklist: json(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	resolvedAt: timestamp({ mode: 'string' }),
	reporterEmail: text(),
	submitterName: text(),
	organizationId: text().notNull(),
	machineId: text().notNull(),
	statusId: text().notNull(),
	priorityId: text().notNull(),
	createdById: text(),
	assignedToId: text(),
}, (table) => [
	index("issues_assigned_to_id_idx").using("btree", table.assignedToId.asc().nullsLast().op("text_ops")),
	index("issues_created_by_id_idx").using("btree", table.createdById.asc().nullsLast().op("text_ops")),
	index("issues_machine_id_idx").using("btree", table.machineId.asc().nullsLast().op("text_ops")),
	index("issues_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("issues_priority_id_idx").using("btree", table.priorityId.asc().nullsLast().op("text_ops")),
	index("issues_status_id_idx").using("btree", table.statusId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const priorities = pgTable("priorities", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	order: integer().notNull(),
	organizationId: text().notNull(),
	isDefault: boolean().default(false).notNull(),
}, (table) => [
	index("priorities_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const issueStatuses = pgTable("issue_statuses", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	category: statusCategory().notNull(),
	organizationId: text().notNull(),
	isDefault: boolean().default(false).notNull(),
}, (table) => [
	index("issue_statuses_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const comments = pgTable("comments", {
	id: text().primaryKey().notNull(),
	content: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	deletedAt: timestamp({ mode: 'string' }),
	deletedBy: text(),
	organizationId: text().notNull(),
	issueId: text().notNull(),
	authorId: text().notNull(),
}, (table) => [
	index("comments_authorId_idx").using("btree", table.authorId.asc().nullsLast().op("text_ops")),
	index("comments_issueId_idx").using("btree", table.issueId.asc().nullsLast().op("text_ops")),
	index("comments_organizationId_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const attachments = pgTable("attachments", {
	id: text().primaryKey().notNull(),
	url: text().notNull(),
	fileName: text().notNull(),
	fileType: text().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	organizationId: text().notNull(),
	issueId: text().notNull(),
}, (table) => [
	index("attachments_issue_id_idx").using("btree", table.issueId.asc().nullsLast().op("text_ops")),
	index("attachments_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const issueHistory = pgTable("issue_history", {
	id: text().primaryKey().notNull(),
	field: text().notNull(),
	oldValue: text(),
	newValue: text(),
	changedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	organizationId: text().notNull(),
	actorId: text(),
	type: activityType().notNull(),
	issueId: text().notNull(),
}, (table) => [
	index("issue_history_issue_id_idx").using("btree", table.issueId.asc().nullsLast().op("text_ops")),
	index("issue_history_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("issue_history_type_idx").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const upvotes = pgTable("upvotes", {
	id: text().primaryKey().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	issueId: text().notNull(),
	userId: text().notNull(),
}, (table) => [
	index("upvotes_issue_id_idx").using("btree", table.issueId.asc().nullsLast().op("text_ops")),
	index("upvotes_user_id_issue_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.issueId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const collections = pgTable("collections", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	typeId: text().notNull(),
	locationId: text(),
	organizationId: text().notNull(),
	isSmart: boolean().default(false).notNull(),
	isManual: boolean().default(true).notNull(),
	description: text(),
	sortOrder: integer().default(0).notNull(),
	filterCriteria: json(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("collections_location_id_idx").using("btree", table.locationId.asc().nullsLast().op("text_ops")),
	index("collections_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("collections_type_id_idx").using("btree", table.typeId.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const collectionTypes = pgTable("collection_types", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	organizationId: text().notNull(),
	isAutoGenerated: boolean().default(false).notNull(),
	isEnabled: boolean().default(true).notNull(),
	sourceField: text(),
	generationRules: json(),
	displayName: text(),
	description: text(),
	sortOrder: integer().default(0).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("collection_types_is_enabled_idx").using("btree", table.isEnabled.asc().nullsLast().op("bool_ops")),
	index("collection_types_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("collection_types_sort_order_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const notifications = pgTable("notifications", {
	id: text().primaryKey().notNull(),
	message: text().notNull(),
	read: boolean().default(false).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	userId: text().notNull(),
	type: notificationType().notNull(),
	entityType: notificationEntity(),
	entityId: text(),
	actionUrl: text(),
	organizationId: text().notNull(),
}, (table) => [
	index("notifications_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	index("notifications_user_id_created_at_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("notifications_user_id_read_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.read.asc().nullsLast().op("text_ops")),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const pinballMapConfigs = pgTable("pinball_map_configs", {
	id: text().primaryKey().notNull(),
	organizationId: text().notNull(),
	apiEnabled: boolean().default(false).notNull(),
	apiKey: text(),
	autoSyncEnabled: boolean().default(false).notNull(),
	syncIntervalHours: integer().default(24).notNull(),
	lastGlobalSync: timestamp({ mode: 'string' }),
	createMissingModels: boolean().default(true).notNull(),
	updateExistingData: boolean().default(false).notNull(),
}, (table) => [
	index("pinball_map_configs_organization_id_idx").using("btree", table.organizationId.asc().nullsLast().op("text_ops")),
	unique("pinball_map_configs_organizationId_unique").on(table.organizationId),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);

export const collectionMachines = pgTable("collection_machines", {
	collectionId: text("collection_id").notNull(),
	machineId: text("machine_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("collection_machines_collection_id_idx").using("btree", table.collectionId.asc().nullsLast().op("text_ops")),
	index("collection_machines_machine_id_idx").using("btree", table.machineId.asc().nullsLast().op("text_ops")),
	primaryKey({ columns: [table.collectionId, table.machineId], name: "collection_machines_collection_id_machine_id_pk"}),
	pgPolicy("local_dev_allow_all", { as: "permissive", for: "all", to: ["authenticated"], using: sql`true` }),
]);
