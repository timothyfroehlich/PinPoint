CREATE TABLE "pinballmap_location_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" integer NOT NULL,
	"expected_location_id" integer,
	"expected_configuration_generation" integer NOT NULL,
	"expected_snapshot_revision" integer NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"checked_by" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pinballmap_location_checks_expiry_order_check" CHECK (expires_at > checked_at)
);
--> statement-breakpoint
ALTER TABLE "pinballmap_location_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "snapshot_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "pinballmap_location_checks_expires_at_idx" ON "pinballmap_location_checks" USING btree ("expires_at");