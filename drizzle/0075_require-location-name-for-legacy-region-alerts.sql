ALTER TABLE "pinballmap_region_alert_events" ADD COLUMN "requires_location_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "pinballmap_region_alert_events"
SET "requires_location_name" = true
WHERE "event_type" = 'added'
  AND "generation" = 0
  AND "announced_at" IS NULL;
