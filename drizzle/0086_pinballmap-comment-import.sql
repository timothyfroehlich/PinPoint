CREATE TABLE "pinballmap_comments" (
	"condition_id" integer PRIMARY KEY NOT NULL,
	"location_id" integer NOT NULL,
	"pinballmap_machine_id" integer NOT NULL,
	"lmx_id" integer NOT NULL,
	"comment" text NOT NULL,
	"username" text,
	"commented_at" timestamp with time zone NOT NULL,
	"first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_issue_id" uuid,
	"converted_at" timestamp with time zone,
	"converted_by" uuid
);
--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "comments_baseline_location_id" integer;--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ADD CONSTRAINT "pinballmap_comments_converted_issue_id_issues_id_fk" FOREIGN KEY ("converted_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinballmap_comments" ADD CONSTRAINT "pinballmap_comments_converted_by_user_profiles_id_fk" FOREIGN KEY ("converted_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pinballmap_comments_converted_issue_idx" ON "pinballmap_comments" USING btree ("converted_issue_id") WHERE "pinballmap_comments"."converted_issue_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_timeline_events_pinballmap_comment" ON "timeline_events" USING btree ("machine_id",(("event_data"->>'conditionId'))) WHERE "timeline_events"."source_type" = 'pinballmap';