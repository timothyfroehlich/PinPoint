-- Add the location stamp in three steps so existing rows survive: add it
-- nullable, backfill every row from the currently tracked location, then
-- enforce NOT NULL. Existing rows were all abandoned under the one location
-- PinPoint has ever tracked, so the singleton's `location_id` is the correct
-- fill; COALESCE to the APC default guards the (impossible-in-prod) case of a
-- missing singleton so the SET NOT NULL cannot fail. (PP-o355.8, spec 6.4.)
ALTER TABLE "pinballmap_abandoned_listings" ADD COLUMN "location_id" integer;
--> statement-breakpoint
UPDATE "pinballmap_abandoned_listings"
SET "location_id" = COALESCE(
  (SELECT "location_id" FROM "pinballmap_state" WHERE "id" = 'singleton'),
  26454
)
WHERE "location_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "pinballmap_abandoned_listings" ALTER COLUMN "location_id" SET NOT NULL;
