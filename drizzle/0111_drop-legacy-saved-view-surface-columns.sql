ALTER TABLE "machine_view_defaults" DROP CONSTRAINT "machine_view_defaults_legacy_surface_check";--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP CONSTRAINT "machine_view_saved_views_legacy_surface_check";--> statement-breakpoint
ALTER TABLE "machine_view_defaults" DROP CONSTRAINT "machine_view_defaults_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "machine_view_defaults" DROP CONSTRAINT "machine_view_defaults_owner_collection_user_id_user_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP CONSTRAINT "machine_view_saved_views_collection_id_collections_id_fk";
--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP CONSTRAINT "machine_view_saved_views_owner_collection_user_id_user_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ALTER COLUMN "host" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ALTER COLUMN "host" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "machine_view_defaults" DROP COLUMN "surface";--> statement-breakpoint
ALTER TABLE "machine_view_defaults" DROP COLUMN "collection_id";--> statement-breakpoint
ALTER TABLE "machine_view_defaults" DROP COLUMN "owner_collection_user_id";--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP COLUMN "surface";--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP COLUMN "collection_id";--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" DROP COLUMN "owner_collection_user_id";