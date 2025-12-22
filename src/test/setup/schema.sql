CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL
);

CREATE TABLE "issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"author_id" uuid,
	"content" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "issue_watchers" (
	"issue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "issue_watchers_issue_id_user_id_pk" PRIMARY KEY("issue_id","user_id")
);

CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_initials" text NOT NULL,
	"issue_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'new' NOT NULL,
	"severity" text DEFAULT 'playable' NOT NULL,
	"priority" text DEFAULT 'low' NOT NULL,
	"reported_by" uuid,
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_issue_number" UNIQUE("machine_initials","issue_number")
);

CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"initials" text NOT NULL,
	"next_issue_number" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machines_initials_unique" UNIQUE("initials"),
	CONSTRAINT "initials_check" CHECK (initials ~ '^[A-Z0-9]{2,6}$')
);

CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"email_notify_on_assigned" boolean DEFAULT true NOT NULL,
	"in_app_notify_on_assigned" boolean DEFAULT true NOT NULL,
	"email_notify_on_status_change" boolean DEFAULT true NOT NULL,
	"in_app_notify_on_status_change" boolean DEFAULT true NOT NULL,
	"email_notify_on_new_comment" boolean DEFAULT true NOT NULL,
	"in_app_notify_on_new_comment" boolean DEFAULT true NOT NULL,
	"email_notify_on_new_issue" boolean DEFAULT true NOT NULL,
	"in_app_notify_on_new_issue" boolean DEFAULT true NOT NULL,
	"email_watch_new_issues_global" boolean DEFAULT false NOT NULL,
	"in_app_watch_new_issues_global" boolean DEFAULT false NOT NULL
);

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"name" text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED NOT NULL,
	"avatar_url" text,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_author_id_user_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "issues" ADD CONSTRAINT "issues_machine_initials_machines_initials_fk" FOREIGN KEY ("machine_initials") REFERENCES "public"."machines"("initials") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "issues" ADD CONSTRAINT "issues_reported_by_user_profiles_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "issues" ADD CONSTRAINT "issues_assigned_to_user_profiles_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "machines" ADD CONSTRAINT "machines_owner_id_user_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "idx_issue_comments_issue_id" ON "issue_comments" USING btree ("issue_id");
CREATE INDEX "idx_issue_watchers_issue_id" ON "issue_watchers" USING btree ("issue_id");
CREATE INDEX "idx_issues_assigned_to" ON "issues" USING btree ("assigned_to");
CREATE INDEX "idx_issues_reported_by" ON "issues" USING btree ("reported_by");
CREATE INDEX "idx_notif_prefs_global_watch_email" ON "notification_preferences" USING btree ("email_watch_new_issues_global");
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id","read_at","created_at");
