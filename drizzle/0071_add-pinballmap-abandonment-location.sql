-- The APC default is an expand-deploy compatibility shim: the previous runtime
-- remains live while Vercel applies this migration and omits location_id from
-- its abandonment insert. PP-o355.51.4.1 drops the default after this writer is
-- serving; new code always supplies the actual tracked location explicitly.
ALTER TABLE "pinballmap_abandoned_listings" ADD COLUMN "location_id" integer DEFAULT 26454 NOT NULL;
--> statement-breakpoint
-- Existing records all came from the singleton's tracked location. Replace the
-- compatibility default with that value when one is configured, retaining APC
-- only as the defensive fallback for a dormant singleton.
UPDATE "pinballmap_abandoned_listings"
SET "location_id" = COALESCE(
  (SELECT "location_id" FROM "pinballmap_state" WHERE "id" = 'singleton'),
  "location_id"
);
