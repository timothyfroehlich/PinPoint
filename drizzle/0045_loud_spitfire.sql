ALTER TABLE "pinballmap_catalog" ADD COLUMN "machine_group_id" integer;--> statement-breakpoint
ALTER TABLE "pinballmap_catalog" ADD COLUMN "group_name" text;--> statement-breakpoint
CREATE INDEX "idx_pinballmap_catalog_group" ON "pinballmap_catalog" USING btree ("machine_group_id");