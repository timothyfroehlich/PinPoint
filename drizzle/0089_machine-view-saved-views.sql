CREATE TABLE "machine_view_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"collection_id" uuid,
	"owner_collection_user_id" uuid,
	"name" text NOT NULL,
	"state" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_view_saved_views_surface_check" CHECK (("machine_view_saved_views"."surface" = 'machines' AND "machine_view_saved_views"."collection_id" IS NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NULL)
        OR ("machine_view_saved_views"."surface" = 'collection' AND "machine_view_saved_views"."collection_id" IS NOT NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NULL)
        OR ("machine_view_saved_views"."surface" = 'owner' AND "machine_view_saved_views"."collection_id" IS NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NOT NULL)),
	CONSTRAINT "machine_view_saved_views_name_not_blank" CHECK (length(btrim("machine_view_saved_views"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_owner_collection_user_id_user_profiles_id_fk" FOREIGN KEY ("owner_collection_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_view_saved_views_name" ON "machine_view_saved_views" USING btree ("user_id","surface",coalesce("collection_id", "owner_collection_user_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_view_saved_views_default" ON "machine_view_saved_views" USING btree ("user_id","surface",coalesce("collection_id", "owner_collection_user_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "machine_view_saved_views"."is_default";--> statement-breakpoint
CREATE INDEX "idx_machine_view_saved_views_collection" ON "machine_view_saved_views" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_machine_view_saved_views_owner_collection" ON "machine_view_saved_views" USING btree ("owner_collection_user_id");