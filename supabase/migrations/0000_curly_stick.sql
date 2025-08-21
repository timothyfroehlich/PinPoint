-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."activity_type" AS ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'COMMENTED', 'COMMENT_DELETED', 'ATTACHMENT_ADDED', 'MERGED', 'RESOLVED', 'REOPENED', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."notification_entity" AS ENUM('ISSUE', 'MACHINE', 'COMMENT', 'ORGANIZATION');--> statement-breakpoint
CREATE TYPE "public"."notification_frequency" AS ENUM('IMMEDIATE', 'DAILY', 'WEEKLY', 'NEVER');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ISSUE_CREATED', 'ISSUE_UPDATED', 'ISSUE_ASSIGNED', 'ISSUE_COMMENTED', 'MACHINE_ASSIGNED', 'SYSTEM_ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."status_category" AS ENUM('NEW', 'IN_PROGRESS', 'RESOLVED');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" timestamp,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionToken" text NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"bio" text,
	"profilePicture" text,
	"emailNotificationsEnabled" boolean DEFAULT true NOT NULL,
	"pushNotificationsEnabled" boolean DEFAULT false NOT NULL,
	"notificationFrequency" "notification_frequency" DEFAULT 'IMMEDIATE' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organizationId" text,
	"manufacturer" text,
	"year" integer,
	"isCustom" boolean DEFAULT false NOT NULL,
	"ipdbId" text,
	"opdbId" text,
	"machineType" text,
	"machineDisplay" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"ipdbLink" text,
	"opdbImgUrl" text,
	"kineticistUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_ipdbId_unique" UNIQUE("ipdbId"),
	CONSTRAINT "models_opdbId_unique" UNIQUE("opdbId")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"A" text NOT NULL,
	"B" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL,
	"logoUrl" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text NOT NULL,
	"roleId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organizationId" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL,
	"isSystem" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organizationId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"street" text,
	"city" text,
	"state" text,
	"zip" text,
	"phone" text,
	"website" text,
	"latitude" real,
	"longitude" real,
	"description" text,
	"pinballMapId" integer,
	"regionId" text,
	"lastSyncAt" timestamp,
	"syncEnabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "machines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organizationId" text NOT NULL,
	"locationId" text NOT NULL,
	"modelId" text NOT NULL,
	"ownerId" text,
	"ownerNotificationsEnabled" boolean DEFAULT true NOT NULL,
	"notifyOnNewIssues" boolean DEFAULT true NOT NULL,
	"notifyOnStatusChanges" boolean DEFAULT true NOT NULL,
	"notifyOnComments" boolean DEFAULT false NOT NULL,
	"qrCodeId" text,
	"qrCodeUrl" text,
	"qrCodeGeneratedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "machines_qrCodeId_unique" UNIQUE("qrCodeId")
);
--> statement-breakpoint
ALTER TABLE "machines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"consistency" text,
	"checklist" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"reporterEmail" text,
	"submitterName" text,
	"organizationId" text NOT NULL,
	"machineId" text NOT NULL,
	"statusId" text NOT NULL,
	"priorityId" text NOT NULL,
	"createdById" text,
	"assignedToId" text
);
--> statement-breakpoint
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "priorities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"organizationId" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "priorities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issue_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "status_category" NOT NULL,
	"organizationId" text NOT NULL,
	"isDefault" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_statuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	"deletedBy" text,
	"organizationId" text NOT NULL,
	"issueId" text NOT NULL,
	"authorId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"fileName" text NOT NULL,
	"fileType" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"organizationId" text NOT NULL,
	"issueId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issue_history" (
	"id" text PRIMARY KEY NOT NULL,
	"field" text NOT NULL,
	"oldValue" text,
	"newValue" text,
	"changedAt" timestamp DEFAULT now() NOT NULL,
	"organizationId" text NOT NULL,
	"actorId" text,
	"type" "activity_type" NOT NULL,
	"issueId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upvotes" (
	"id" text PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"issueId" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "upvotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"typeId" text NOT NULL,
	"locationId" text,
	"organizationId" text NOT NULL,
	"isSmart" boolean DEFAULT false NOT NULL,
	"isManual" boolean DEFAULT true NOT NULL,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"filterCriteria" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collection_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organizationId" text NOT NULL,
	"isAutoGenerated" boolean DEFAULT false NOT NULL,
	"isEnabled" boolean DEFAULT true NOT NULL,
	"sourceField" text,
	"generationRules" json,
	"displayName" text,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"userId" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"entityType" "notification_entity",
	"entityId" text,
	"actionUrl" text,
	"organizationId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pinball_map_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"organizationId" text NOT NULL,
	"apiEnabled" boolean DEFAULT false NOT NULL,
	"apiKey" text,
	"autoSyncEnabled" boolean DEFAULT false NOT NULL,
	"syncIntervalHours" integer DEFAULT 24 NOT NULL,
	"lastGlobalSync" timestamp,
	"createMissingModels" boolean DEFAULT true NOT NULL,
	"updateExistingData" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pinball_map_configs_organizationId_unique" UNIQUE("organizationId")
);
--> statement-breakpoint
ALTER TABLE "pinball_map_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collection_machines" (
	"collection_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_machines_collection_id_machine_id_pk" PRIMARY KEY("collection_id","machine_id")
);
--> statement-breakpoint
ALTER TABLE "collection_machines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_A_roles_id_fk" FOREIGN KEY ("A") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_B_permissions_id_fk" FOREIGN KEY ("B") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("B" text_ops);--> statement-breakpoint
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions" USING btree ("A" text_ops);--> statement-breakpoint
CREATE INDEX "organizations_subdomain_idx" ON "organizations" USING btree ("subdomain" text_ops);--> statement-breakpoint
CREATE INDEX "memberships_organization_id_idx" ON "memberships" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "memberships_user_id_organization_id_idx" ON "memberships" USING btree ("userId" text_ops,"organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "roles_organization_id_idx" ON "roles" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "locations_organization_id_idx" ON "locations" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "machines_location_id_idx" ON "machines" USING btree ("locationId" text_ops);--> statement-breakpoint
CREATE INDEX "machines_model_id_idx" ON "machines" USING btree ("modelId" text_ops);--> statement-breakpoint
CREATE INDEX "machines_organization_id_idx" ON "machines" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "machines_owner_id_idx" ON "machines" USING btree ("ownerId" text_ops);--> statement-breakpoint
CREATE INDEX "machines_qr_code_id_idx" ON "machines" USING btree ("qrCodeId" text_ops);--> statement-breakpoint
CREATE INDEX "issues_assigned_to_id_idx" ON "issues" USING btree ("assignedToId" text_ops);--> statement-breakpoint
CREATE INDEX "issues_created_by_id_idx" ON "issues" USING btree ("createdById" text_ops);--> statement-breakpoint
CREATE INDEX "issues_machine_id_idx" ON "issues" USING btree ("machineId" text_ops);--> statement-breakpoint
CREATE INDEX "issues_organization_id_idx" ON "issues" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "issues_priority_id_idx" ON "issues" USING btree ("priorityId" text_ops);--> statement-breakpoint
CREATE INDEX "issues_status_id_idx" ON "issues" USING btree ("statusId" text_ops);--> statement-breakpoint
CREATE INDEX "priorities_organization_id_idx" ON "priorities" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "issue_statuses_organization_id_idx" ON "issue_statuses" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "comments_authorId_idx" ON "comments" USING btree ("authorId" text_ops);--> statement-breakpoint
CREATE INDEX "comments_issueId_idx" ON "comments" USING btree ("issueId" text_ops);--> statement-breakpoint
CREATE INDEX "comments_organizationId_idx" ON "comments" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "attachments_issue_id_idx" ON "attachments" USING btree ("issueId" text_ops);--> statement-breakpoint
CREATE INDEX "attachments_organization_id_idx" ON "attachments" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "issue_history_issue_id_idx" ON "issue_history" USING btree ("issueId" text_ops);--> statement-breakpoint
CREATE INDEX "issue_history_organization_id_idx" ON "issue_history" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "issue_history_type_idx" ON "issue_history" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "upvotes_issue_id_idx" ON "upvotes" USING btree ("issueId" text_ops);--> statement-breakpoint
CREATE INDEX "upvotes_user_id_issue_id_idx" ON "upvotes" USING btree ("userId" text_ops,"issueId" text_ops);--> statement-breakpoint
CREATE INDEX "collections_location_id_idx" ON "collections" USING btree ("locationId" text_ops);--> statement-breakpoint
CREATE INDEX "collections_organization_id_idx" ON "collections" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "collections_type_id_idx" ON "collections" USING btree ("typeId" text_ops);--> statement-breakpoint
CREATE INDEX "collection_types_is_enabled_idx" ON "collection_types" USING btree ("isEnabled" bool_ops);--> statement-breakpoint
CREATE INDEX "collection_types_organization_id_idx" ON "collection_types" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "collection_types_sort_order_idx" ON "collection_types" USING btree ("sortOrder" int4_ops);--> statement-breakpoint
CREATE INDEX "notifications_organization_id_idx" ON "notifications" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("userId" timestamp_ops,"createdAt" timestamp_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_idx" ON "notifications" USING btree ("userId" text_ops,"read" text_ops);--> statement-breakpoint
CREATE INDEX "pinball_map_configs_organization_id_idx" ON "pinball_map_configs" USING btree ("organizationId" text_ops);--> statement-breakpoint
CREATE INDEX "collection_machines_collection_id_idx" ON "collection_machines" USING btree ("collection_id" text_ops);--> statement-breakpoint
CREATE INDEX "collection_machines_machine_id_idx" ON "collection_machines" USING btree ("machine_id" text_ops);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "organizations" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "memberships" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "locations" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "machines" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "issues" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "priorities" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "issue_statuses" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "comments" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "attachments" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "issue_history" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "upvotes" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "collections" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "collection_types" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "pinball_map_configs" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "local_dev_allow_all" ON "collection_machines" AS PERMISSIVE FOR ALL TO "authenticated" USING (true);
*/