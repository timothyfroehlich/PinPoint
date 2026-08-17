-- PP-o355.21: retire the boolean listing model that 0066 replaced.
--
-- Split from 0066 so the backfill there had `pinballmap_listed` still present to
-- read. Three things go, and the third is the point of the change:
--
--   * `pinballmap_lmx_id` — a per-cabinet copy of a per-ENTRY fact. Under the
--     coverage model several same-title cabinets can be On at once, so N rows
--     would each hold a handle only one of them ever wrote. Every consumer
--     already resolves the lmx by title from the stored snapshot
--     (`findLmxForMachine`), which is the one answer that cannot disagree with
--     itself. Entry identity over time gets a per-entry home in PP-o355.36.
--   * `machines_pinballmap_listed_unique` — one lister per title. Coverage says
--     the opposite: a lineup entry is covered by ANY same-title cabinet with
--     intent On, and comments fan out to all of them (spec §1, 7.1).
--   * `pinballmap_listed` and its two lmx CHECKs, all now unreachable.
--
-- `pinballmap_abandoned_listings.lmx_id` is untouched — that is a record of an
-- entry PinPoint walked away from, not a live handle.
ALTER TABLE "machines" DROP CONSTRAINT "machines_pinballmap_listed_requires_link";--> statement-breakpoint
ALTER TABLE "machines" DROP CONSTRAINT "machines_pinballmap_lmx_requires_link";--> statement-breakpoint
ALTER TABLE "machines" DROP CONSTRAINT "machines_pinballmap_lmx_requires_listed";--> statement-breakpoint
DROP INDEX "machines_pinballmap_listed_unique";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN "pinballmap_listed";--> statement-breakpoint
ALTER TABLE "machines" DROP COLUMN "pinballmap_lmx_id";