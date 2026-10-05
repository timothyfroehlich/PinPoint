ALTER TABLE "machine_settings_sets" DROP COLUMN "is_owner_set";--> statement-breakpoint
ALTER TABLE "machine_settings_sets" DROP COLUMN "is_public";--> statement-breakpoint
ALTER TABLE "machine_settings_sets" DROP COLUMN "is_tournament";--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD CONSTRAINT "machine_settings_sets_preferred_is_community" CHECK ("machine_settings_sets"."is_community" OR NOT ("machine_settings_sets"."is_preferred" OR "machine_settings_sets"."is_preferred_tournament"));