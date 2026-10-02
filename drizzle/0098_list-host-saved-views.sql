-- PP-jb9v.3: Saved Views and Default Views belong to a List Host, not a Surface
-- (list-views §10.5, §10.7, §10.9, §10.10). Every row gains a host (existing
-- rows are machine views), Collection and owner-Collection views merge into
-- the account's machine set, and only Machines-page defaults survive.
--
-- Expand/contract, like 0097: the deployment still serving while Vercel builds
-- this one selects and filters on surface, collection_id, and
-- owner_collection_user_id, so those columns stay. Every row is moved onto the
-- Machines Surface and the legacy_surface checks pin it there, so the old
-- runtime sees the merged set on /m and nothing elsewhere, and cannot write a
-- Collection default that this runtime would read as the host default. A
-- follow-up contract migration (PP-jb9v.5) drops the three columns.
ALTER TABLE "machine_view_defaults" DROP CONSTRAINT "machine_view_defaults_surface_check";--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP CONSTRAINT "machine_view_saved_views_surface_check";--> statement-breakpoint
DROP INDEX "uq_machine_view_defaults_surface";--> statement-breakpoint
DROP INDEX "idx_machine_view_defaults_collection";--> statement-breakpoint
DROP INDEX "idx_machine_view_defaults_owner_collection";--> statement-breakpoint
DROP INDEX "uq_machine_view_saved_views_name";--> statement-breakpoint
DROP INDEX "idx_machine_view_saved_views_collection";--> statement-breakpoint
DROP INDEX "idx_machine_view_saved_views_owner_collection";--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ALTER COLUMN "surface" SET DEFAULT 'machines';--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ALTER COLUMN "surface" SET DEFAULT 'machines';--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD COLUMN "host" text DEFAULT 'machines' NOT NULL;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD COLUMN "host" text DEFAULT 'machines' NOT NULL;--> statement-breakpoint

-- Merge Collection and owner-Collection views into the account's machine set,
-- oldest first. A name that collides, ignoring case, with a view already in
-- the set gets the Collection's name appended ("Broken (Back room)"), then a
-- number while it still collides ("Broken (Back room) 2"). An owner
-- Collection is named the way its page titles it: "<owner>'s Machines".
DO $$
DECLARE
  merged record;
  candidate text;
  attempt integer;
BEGIN
  FOR merged IN
    SELECT v.id,
           v.user_id,
           v.name,
           coalesce(c.name, p.name || '''s Machines', 'Collection') AS surface_name
      FROM machine_view_saved_views v
      LEFT JOIN collections c ON c.id = v.collection_id
      LEFT JOIN user_profiles p ON p.id = v.owner_collection_user_id
     WHERE v.surface <> 'machines'
     ORDER BY v.created_at, v.id
  LOOP
    candidate := merged.name;
    attempt := 1;
    WHILE EXISTS (
      SELECT 1
        FROM machine_view_saved_views o
       WHERE o.user_id = merged.user_id
         AND o.surface = 'machines'
         AND lower(o.name) = lower(candidate)
    ) LOOP
      candidate := merged.name || ' (' || merged.surface_name || ')'
        || CASE WHEN attempt > 1 THEN ' ' || attempt ELSE '' END;
      attempt := attempt + 1;
    END LOOP;

    UPDATE machine_view_saved_views
       SET name = candidate,
           surface = 'machines',
           collection_id = NULL,
           owner_collection_user_id = NULL
     WHERE id = merged.id;
  END LOOP;
END $$;--> statement-breakpoint

-- A Default View opens only on the host's main page (§10.10), so Collection
-- and owner-Collection defaults have nothing left to do.
DELETE FROM "machine_view_defaults" WHERE "surface" <> 'machines';--> statement-breakpoint

CREATE UNIQUE INDEX "uq_machine_view_defaults_host" ON "machine_view_defaults" USING btree ("user_id","host");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_view_saved_views_host_name" ON "machine_view_saved_views" USING btree ("user_id","host",lower("name"));--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD CONSTRAINT "machine_view_defaults_host_check" CHECK ("machine_view_defaults"."host" IN ('machines', 'issues'));--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD CONSTRAINT "machine_view_defaults_legacy_surface_check" CHECK ("machine_view_defaults"."surface" = 'machines' AND "machine_view_defaults"."collection_id" IS NULL AND "machine_view_defaults"."owner_collection_user_id" IS NULL);--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_host_check" CHECK ("machine_view_saved_views"."host" IN ('machines', 'issues'));--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_legacy_surface_check" CHECK ("machine_view_saved_views"."surface" = 'machines' AND "machine_view_saved_views"."collection_id" IS NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NULL);
