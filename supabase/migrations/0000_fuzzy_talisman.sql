-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."activity_type" AS ENUM('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'COMMENTED', 'COMMENT_DELETED', 'ATTACHMENT_ADDED', 'MERGED', 'RESOLVED', 'REOPENED', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."commenter_type" AS ENUM('authenticated', 'anonymous');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_entity" AS ENUM('ISSUE', 'MACHINE', 'COMMENT', 'ORGANIZATION');--> statement-breakpoint
CREATE TYPE "public"."notification_frequency" AS ENUM('IMMEDIATE', 'DAILY', 'WEEKLY', 'NEVER');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('ISSUE_CREATED', 'ISSUE_UPDATED', 'ISSUE_ASSIGNED', 'ISSUE_COMMENTED', 'MACHINE_ASSIGNED', 'SYSTEM_ANNOUNCEMENT');--> statement-breakpoint
CREATE TYPE "public"."reporter_type" AS ENUM('authenticated', 'anonymous');--> statement-breakpoint
CREATE TYPE "public"."status_category" AS ENUM('NEW', 'IN_PROGRESS', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."voter_type" AS ENUM('authenticated', 'anonymous');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
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
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"bio" text,
	"profile_picture" text,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"push_notifications_enabled" boolean DEFAULT false NOT NULL,
	"notification_frequency" "notification_frequency" DEFAULT 'IMMEDIATE' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text,
	"manufacturer" text,
	"year" integer,
	"is_custom" boolean DEFAULT false NOT NULL,
	"ipdb_id" text,
	"opdb_id" text,
	"machine_type" text,
	"machine_display" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"ipdb_link" text,
	"opdb_img_url" text,
	"kineticist_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "models_ipdb_id_unique" UNIQUE("ipdb_id"),
	CONSTRAINT "models_opdb_id_unique" UNIQUE("opdb_id")
);
--> statement-breakpoint
ALTER TABLE "models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role_id" text NOT NULL,
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subdomain" text NOT NULL,
	"logo_url" text,
	"description" text,
	"website" text,
	"phone" text,
	"address" text,
	"allow_anonymous_issues" boolean DEFAULT true NOT NULL,
	"allow_anonymous_comments" boolean DEFAULT true NOT NULL,
	"allow_anonymous_upvotes" boolean DEFAULT true NOT NULL,
	"require_moderation_anonymous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"street" text,
	"city" text,
	"state" text,
	"zip" text,
	"phone" text,
	"website" text,
	"latitude" real,
	"longitude" real,
	"description" text,
	"pinball_map_id" integer,
	"region_id" text,
	"last_sync_at" timestamp,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "machines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"model_id" text NOT NULL,
	"owner_id" text,
	"owner_notifications_enabled" boolean DEFAULT true NOT NULL,
	"notify_on_new_issues" boolean DEFAULT true NOT NULL,
	"notify_on_status_changes" boolean DEFAULT true NOT NULL,
	"notify_on_comments" boolean DEFAULT false NOT NULL,
	"qr_code_id" text,
	"qr_code_url" text,
	"qr_code_generated_at" timestamp,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "machines_qr_code_id_unique" UNIQUE("qr_code_id")
);
--> statement-breakpoint
ALTER TABLE "machines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"consistency" text,
	"checklist" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"is_public" boolean DEFAULT true NOT NULL,
	"reporter_type" "reporter_type" DEFAULT 'authenticated' NOT NULL,
	"reporter_email" text,
	"submitter_name" text,
	"anonymous_session_id" varchar(255),
	"anonymous_contact_method" varchar(255),
	"moderation_status" "moderation_status" DEFAULT 'approved' NOT NULL,
	"organization_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"status_id" text NOT NULL,
	"priority_id" text NOT NULL,
	"created_by_id" text,
	"assigned_to_id" text
);
--> statement-breakpoint
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "priorities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"order" integer NOT NULL,
	"organization_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "priorities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issue_statuses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" "status_category" NOT NULL,
	"organization_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_statuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	"commenter_type" "commenter_type" DEFAULT 'authenticated' NOT NULL,
	"anonymous_session_id" varchar(255),
	"anonymous_display_name" varchar(100),
	"moderation_status" "moderation_status" DEFAULT 'approved' NOT NULL,
	"organization_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"author_id" text
);
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"issue_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "issue_history" (
	"id" text PRIMARY KEY NOT NULL,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text,
	"type" "activity_type" NOT NULL,
	"issue_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "upvotes" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"issue_id" text NOT NULL,
	"voter_type" "voter_type" DEFAULT 'authenticated' NOT NULL,
	"user_id" text,
	"anonymous_session_id" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "upvotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type_id" text NOT NULL,
	"location_id" text,
	"organization_id" text NOT NULL,
	"is_smart" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT true NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"filter_criteria" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collection_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"is_auto_generated" boolean DEFAULT false NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"source_field" text,
	"generation_rules" json,
	"display_name" text,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"entity_type" "notification_entity",
	"entity_id" text,
	"action_url" text,
	"organization_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pinball_map_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"api_enabled" boolean DEFAULT false NOT NULL,
	"api_key" text,
	"auto_sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_interval_hours" integer DEFAULT 24 NOT NULL,
	"last_global_sync" timestamp,
	"create_missing_models" boolean DEFAULT true NOT NULL,
	"update_existing_data" boolean DEFAULT false NOT NULL,
	CONSTRAINT "pinball_map_configs_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "pinball_map_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "anonymous_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"ip_address" text,
	"action_type" varchar(50) NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anonymous_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collection_machines" (
	"collection_id" text NOT NULL,
	"machine_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_machines_collection_id_machine_id_pk" PRIMARY KEY("collection_id","machine_id")
);
--> statement-breakpoint
ALTER TABLE "collection_machines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_org_email_idx" ON "invitations" USING btree ("organization_id" text_ops,"email" text_ops);--> statement-breakpoint
CREATE INDEX "invitations_organization_id_idx" ON "invitations" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "activity_log_action_idx" ON "activity_log" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity_type" text_ops,"entity_id" text_ops);--> statement-breakpoint
CREATE INDEX "activity_log_org_time_idx" ON "activity_log" USING btree ("organization_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "activity_log_user_id_idx" ON "activity_log" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions" USING btree ("permission_id" text_ops);--> statement-breakpoint
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions" USING btree ("role_id" text_ops);--> statement-breakpoint
CREATE INDEX "system_settings_org_key_idx" ON "system_settings" USING btree ("organization_id" text_ops,"setting_key" text_ops);--> statement-breakpoint
CREATE INDEX "system_settings_organization_id_idx" ON "system_settings" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "organizations_subdomain_idx" ON "organizations" USING btree ("subdomain" text_ops);--> statement-breakpoint
CREATE INDEX "memberships_organization_id_idx" ON "memberships" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "memberships_user_id_organization_id_idx" ON "memberships" USING btree ("user_id" text_ops,"organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "roles_organization_id_idx" ON "roles" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "locations_organization_id_idx" ON "locations" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "locations_public_org_idx" ON "locations" USING btree ("organization_id" text_ops,"is_public" text_ops);--> statement-breakpoint
CREATE INDEX "machines_location_id_idx" ON "machines" USING btree ("location_id" text_ops);--> statement-breakpoint
CREATE INDEX "machines_model_id_idx" ON "machines" USING btree ("model_id" text_ops);--> statement-breakpoint
CREATE INDEX "machines_organization_id_idx" ON "machines" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "machines_owner_id_idx" ON "machines" USING btree ("owner_id" text_ops);--> statement-breakpoint
CREATE INDEX "machines_public_org_idx" ON "machines" USING btree ("organization_id" text_ops,"is_public" text_ops);--> statement-breakpoint
CREATE INDEX "machines_qr_code_id_idx" ON "machines" USING btree ("qr_code_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_anon_session_idx" ON "issues" USING btree ("anonymous_session_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_assigned_to_id_idx" ON "issues" USING btree ("assigned_to_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_created_by_id_idx" ON "issues" USING btree ("created_by_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_machine_id_idx" ON "issues" USING btree ("machine_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_moderation_pending_idx" ON "issues" USING btree ("organization_id" text_ops,"moderation_status" enum_ops);--> statement-breakpoint
CREATE INDEX "issues_organization_id_idx" ON "issues" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_priority_id_idx" ON "issues" USING btree ("priority_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_public_org_idx" ON "issues" USING btree ("organization_id" bool_ops,"is_public" bool_ops);--> statement-breakpoint
CREATE INDEX "issues_reporter_type_idx" ON "issues" USING btree ("reporter_type" enum_ops,"organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "issues_status_id_idx" ON "issues" USING btree ("status_id" text_ops);--> statement-breakpoint
CREATE INDEX "priorities_organization_id_idx" ON "priorities" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "issue_statuses_organization_id_idx" ON "issue_statuses" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "comments_anon_session_idx" ON "comments" USING btree ("anonymous_session_id" text_ops);--> statement-breakpoint
CREATE INDEX "comments_author_id_idx" ON "comments" USING btree ("author_id" text_ops);--> statement-breakpoint
CREATE INDEX "comments_commenter_type_idx" ON "comments" USING btree ("commenter_type" text_ops,"issue_id" text_ops);--> statement-breakpoint
CREATE INDEX "comments_issue_id_idx" ON "comments" USING btree ("issue_id" text_ops);--> statement-breakpoint
CREATE INDEX "comments_moderation_pending_idx" ON "comments" USING btree ("issue_id" text_ops,"moderation_status" enum_ops);--> statement-breakpoint
CREATE INDEX "comments_organization_id_idx" ON "comments" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "attachments_issue_id_idx" ON "attachments" USING btree ("issue_id" text_ops);--> statement-breakpoint
CREATE INDEX "attachments_organization_id_idx" ON "attachments" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "issue_history_issue_id_idx" ON "issue_history" USING btree ("issue_id" text_ops);--> statement-breakpoint
CREATE INDEX "issue_history_organization_id_idx" ON "issue_history" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "issue_history_type_idx" ON "issue_history" USING btree ("type" enum_ops);--> statement-breakpoint
CREATE INDEX "upvotes_anon_session_issue_idx" ON "upvotes" USING btree ("issue_id" text_ops,"anonymous_session_id" text_ops);--> statement-breakpoint
CREATE INDEX "upvotes_issue_id_idx" ON "upvotes" USING btree ("issue_id" text_ops);--> statement-breakpoint
CREATE INDEX "upvotes_user_id_issue_id_idx" ON "upvotes" USING btree ("user_id" text_ops,"issue_id" text_ops);--> statement-breakpoint
CREATE INDEX "collections_location_id_idx" ON "collections" USING btree ("location_id" text_ops);--> statement-breakpoint
CREATE INDEX "collections_organization_id_idx" ON "collections" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "collections_type_id_idx" ON "collections" USING btree ("type_id" text_ops);--> statement-breakpoint
CREATE INDEX "collection_types_is_enabled_idx" ON "collection_types" USING btree ("is_enabled" bool_ops);--> statement-breakpoint
CREATE INDEX "collection_types_organization_id_idx" ON "collection_types" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "collection_types_sort_order_idx" ON "collection_types" USING btree ("sort_order" int4_ops);--> statement-breakpoint
CREATE INDEX "notifications_organization_id_idx" ON "notifications" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" USING btree ("user_id" timestamp_ops,"created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_idx" ON "notifications" USING btree ("user_id" text_ops,"read" text_ops);--> statement-breakpoint
CREATE INDEX "pinball_map_configs_organization_id_idx" ON "pinball_map_configs" USING btree ("organization_id" text_ops);--> statement-breakpoint
CREATE INDEX "rate_limits_cleanup_idx" ON "anonymous_rate_limits" USING btree ("created_at" timestamp_ops);--> statement-breakpoint
CREATE INDEX "rate_limits_session_org_action_idx" ON "anonymous_rate_limits" USING btree ("session_id" text_ops,"organization_id" text_ops,"action_type" text_ops);--> statement-breakpoint
CREATE INDEX "collection_machines_collection_id_idx" ON "collection_machines" USING btree ("collection_id" text_ops);--> statement-breakpoint
CREATE INDEX "collection_machines_machine_id_idx" ON "collection_machines" USING btree ("machine_id" text_ops);--> statement-breakpoint
CREATE POLICY "users_self_access" ON "users" AS PERMISSIVE FOR ALL TO "authenticated" USING ((id = (auth.uid())::text)) WITH CHECK ((id = (auth.uid())::text));--> statement-breakpoint
CREATE POLICY "users_no_anon_access" ON "users" AS PERMISSIVE FOR ALL TO "anon";--> statement-breakpoint
CREATE POLICY "models_global_read" ON "models" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "permissions_global_read" ON "permissions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "organizations_public_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "anon" USING (true);--> statement-breakpoint
CREATE POLICY "organizations_auth_read" ON "organizations" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "organizations_member_modify" ON "organizations" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "memberships_self_access" ON "memberships" AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = (auth.uid())::text)) WITH CHECK ((user_id = (auth.uid())::text));--> statement-breakpoint
CREATE POLICY "memberships_org_member_read" ON "memberships" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "roles_member_access" ON "roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "locations_public_read" ON "locations" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND ((is_public = true) OR (is_public IS NULL))));--> statement-breakpoint
CREATE POLICY "locations_member_modify" ON "locations" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "machines_public_read" ON "machines" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND ((is_public = true) OR (is_public IS NULL))));--> statement-breakpoint
CREATE POLICY "machines_member_all_access" ON "machines" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "issues_anon_create" ON "issues" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true))
	AND (reporter_type = 'anonymous'::reporter_type)
	AND (created_by_id IS NULL)
	AND (EXISTS ( SELECT 1 FROM organizations o WHERE (o.id = organization_id) AND (o.allow_anonymous_issues = TRUE)))
	AND (EXISTS ( SELECT 1 FROM machines m WHERE (m.id = issues.machine_id) AND (m.deleted_at IS NULL)))
));--> statement-breakpoint
CREATE POLICY "issues_public_read" ON "issues" AS PERMISSIVE FOR SELECT TO "anon", "authenticated";--> statement-breakpoint
CREATE POLICY "issues_member_access" ON "issues" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "priorities_member_access" ON "priorities" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "issue_statuses_member_access" ON "issue_statuses" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "comments_anon_create_public" ON "comments" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (((EXISTS ( SELECT 1
   FROM issues i
  WHERE ((i.id = comments.issue_id) AND (i.organization_id = current_setting('app.current_organization_id'::text, true)) AND ((i.is_public = true) OR (i.is_public IS NULL))))) AND (commenter_type = 'anonymous'::commenter_type) AND (author_id IS NULL)));--> statement-breakpoint
CREATE POLICY "comments_member_access" ON "comments" AS PERMISSIVE FOR ALL TO "authenticated";--> statement-breakpoint
CREATE POLICY "collections_member_access" ON "collections" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "collection_types_member_access" ON "collection_types" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "notifications_user_access" ON "notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING ((user_id = (auth.uid())::text)) WITH CHECK ((user_id = (auth.uid())::text));--> statement-breakpoint
CREATE POLICY "pinball_map_configs_member_access" ON "pinball_map_configs" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "anonymous_rate_limits_member_access" ON "anonymous_rate_limits" AS PERMISSIVE FOR ALL TO "authenticated" USING (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true))))))) WITH CHECK (((organization_id = current_setting('app.current_organization_id'::text, true)) AND (EXISTS ( SELECT 1
   FROM memberships m
  WHERE ((m.user_id = (auth.uid())::text) AND (m.organization_id = current_setting('app.current_organization_id'::text, true)))))));--> statement-breakpoint
CREATE POLICY "anonymous_rate_limits_system_insert" ON "anonymous_rate_limits" AS PERMISSIVE FOR INSERT TO "anon";
*/
