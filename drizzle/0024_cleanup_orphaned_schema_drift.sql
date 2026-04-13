-- Migration 0024: Clean up orphaned columns and tables from unmerged feature branches.
--
-- Two feature branches (feature/opdb-model-integration, claude/integrate-pinball-map-api)
-- applied schema changes to production via drizzle-kit push before it was disabled.
-- Neither branch was merged to main. All orphaned data is confirmed NULL/empty.
--
-- All IF EXISTS: no-op on fresh/local databases, drops on production.

-- OPDB integration (feature/opdb-model-integration)
DROP INDEX IF EXISTS "idx_machines_opdb_id";

ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_id";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_title";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_manufacturer";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_year";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_image_url";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_machine_type";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "opdb_last_synced_at";

-- Pinball Map integration (claude/integrate-pinball-map-api)
ALTER TABLE "machines" DROP COLUMN IF EXISTS "pbm_machine_id";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "pbm_machine_name";
ALTER TABLE "machines" DROP COLUMN IF EXISTS "pbm_location_machine_xref_id";

-- CASCADE drops any RLS policies on the table
DROP TABLE IF EXISTS "pinball_map_config" CASCADE;
