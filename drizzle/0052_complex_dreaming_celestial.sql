CREATE TABLE "pinballmap_state" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"location_id" integer DEFAULT 26454 NOT NULL,
	"snapshot_json" jsonb,
	"last_synced_at" timestamp with time zone,
	"last_sync_status" text DEFAULT 'unknown' NOT NULL,
	"last_sync_error" text,
	"outbound_email" text,
	"outbound_token_vault_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "pinballmap_state_singleton" CHECK (id = 'singleton'),
	CONSTRAINT "pinballmap_state_sync_status_check" CHECK (last_sync_status IN ('unknown', 'ok', 'error'))
);
--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "pinballmap_lmx_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "machines_pinballmap_listed_unique" ON "machines" USING btree ("pinballmap_machine_id") WHERE pinballmap_listed;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_pinballmap_lmx_requires_link" CHECK (NOT (pinballmap_lmx_id IS NOT NULL AND pinballmap_machine_id IS NULL));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_pinballmap_lmx_requires_listed" CHECK (NOT (pinballmap_lmx_id IS NOT NULL AND NOT pinballmap_listed));