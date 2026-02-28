ALTER TABLE "machines" ADD COLUMN "opdb_id" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_title" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_manufacturer" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_year" integer;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_image_url" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_machine_type" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_last_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_machines_opdb_id" ON "machines" USING btree ("opdb_id");