CREATE TABLE "pinballmap_region_alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"lmx_id" integer NOT NULL,
	"generation" integer NOT NULL,
	"event_type" text NOT NULL,
	"location_id" integer NOT NULL,
	"pinballmap_machine_id" integer NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"announced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pinballmap_region_alert_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pinballmap_region_alert_state" (
	"region" text PRIMARY KEY NOT NULL,
	"run_lease_id" uuid,
	"run_lease_expires_at" timestamp with time zone,
	CONSTRAINT "pinballmap_region_alert_state_run_lease_pair_check" CHECK ((run_lease_id IS NULL) = (run_lease_expires_at IS NULL))
);
--> statement-breakpoint
ALTER TABLE "pinballmap_region_alert_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pinballmap_region_seen_machines" ADD COLUMN "is_present" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_region_seen_machines" ADD COLUMN "missed_runs" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_region_seen_machines" ADD COLUMN "generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pinballmap_region_alert_events_transition_unique" ON "pinballmap_region_alert_events" USING btree ("region","lmx_id","generation","event_type");--> statement-breakpoint
INSERT INTO "pinballmap_region_alert_events" (
	"region",
	"lmx_id",
	"generation",
	"event_type",
	"location_id",
	"pinballmap_machine_id",
	"detected_at"
)
SELECT
	"region",
	"lmx_id",
	0,
	'added',
	"location_id",
	"pinballmap_machine_id",
	"first_seen_at"
FROM "pinballmap_region_seen_machines"
WHERE "announced_at" IS NULL
ON CONFLICT ("region", "lmx_id", "generation", "event_type") DO NOTHING;--> statement-breakpoint
CREATE INDEX "idx_pinballmap_region_alert_events_pending" ON "pinballmap_region_alert_events" USING btree ("region","detected_at") WHERE announced_at is null;
