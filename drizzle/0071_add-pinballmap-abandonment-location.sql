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
--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "configuration_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "mutation_lease_id" uuid;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD COLUMN "mutation_lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pinballmap_state" ADD CONSTRAINT "pinballmap_state_mutation_lease_pair_check" CHECK ((mutation_lease_id IS NULL) = (mutation_lease_expires_at IS NULL));
