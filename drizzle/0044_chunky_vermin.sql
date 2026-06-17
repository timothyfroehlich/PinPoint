CREATE TABLE "machine_settings_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" jsonb,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "settings_instructions" jsonb;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD CONSTRAINT "machine_settings_sets_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD CONSTRAINT "machine_settings_sets_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD CONSTRAINT "machine_settings_sets_updated_by_user_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_machine_settings_sets_machine" ON "machine_settings_sets" USING btree ("machine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_machine_settings_preferred" ON "machine_settings_sets" USING btree ("machine_id") WHERE "machine_settings_sets"."is_preferred";