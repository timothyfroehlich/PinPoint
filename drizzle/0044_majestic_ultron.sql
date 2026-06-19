CREATE TABLE "pinballmap_catalog" (
	"pinballmap_machine_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"manufacturer" text,
	"year" integer,
	"opdb_id" text,
	"ipdb_id" integer,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "pinballmap_machine_id" integer;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "pinballmap_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "pinballmap_excluded_reason" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "manufacturer" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "opdb_id" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "ipdb_id" integer;--> statement-breakpoint
CREATE INDEX "idx_pinballmap_catalog_name" ON "pinballmap_catalog" USING btree ("name");--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_pinballmap_link_exclusive" CHECK (NOT (pinballmap_machine_id IS NOT NULL AND pinballmap_excluded));