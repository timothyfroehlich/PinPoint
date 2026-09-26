CREATE TABLE "machine_view_defaults" (
	"user_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"collection_id" uuid,
	"owner_collection_user_id" uuid,
	"saved_view_id" uuid,
	"built_in_view_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_view_defaults_surface_check" CHECK (("machine_view_defaults"."surface" = 'machines' AND "machine_view_defaults"."collection_id" IS NULL AND "machine_view_defaults"."owner_collection_user_id" IS NULL)
        OR ("machine_view_defaults"."surface" = 'collection' AND "machine_view_defaults"."collection_id" IS NOT NULL AND "machine_view_defaults"."owner_collection_user_id" IS NULL)
        OR ("machine_view_defaults"."surface" = 'owner' AND "machine_view_defaults"."collection_id" IS NULL AND "machine_view_defaults"."owner_collection_user_id" IS NOT NULL)),
	CONSTRAINT "machine_view_defaults_target_check" CHECK (("machine_view_defaults"."saved_view_id" IS NULL) <> ("machine_view_defaults"."built_in_view_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "machine_view_saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"collection_id" uuid,
	"owner_collection_user_id" uuid,
	"name" text NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_view_saved_views_surface_check" CHECK (("machine_view_saved_views"."surface" = 'machines' AND "machine_view_saved_views"."collection_id" IS NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NULL)
        OR ("machine_view_saved_views"."surface" = 'collection' AND "machine_view_saved_views"."collection_id" IS NOT NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NULL)
        OR ("machine_view_saved_views"."surface" = 'owner' AND "machine_view_saved_views"."collection_id" IS NULL AND "machine_view_saved_views"."owner_collection_user_id" IS NOT NULL)),
	CONSTRAINT "machine_view_saved_views_name_not_blank" CHECK (length(btrim("machine_view_saved_views"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD CONSTRAINT "machine_view_defaults_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD CONSTRAINT "machine_view_defaults_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD CONSTRAINT "machine_view_defaults_owner_collection_user_id_user_profiles_id_fk" FOREIGN KEY ("owner_collection_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_defaults" ADD CONSTRAINT "machine_view_defaults_saved_view_id_machine_view_saved_views_id_fk" FOREIGN KEY ("saved_view_id") REFERENCES "public"."machine_view_saved_views"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_view_saved_views" ADD CONSTRAINT "machine_view_saved_views_owner_collection_user_id_user_profiles_id_fk" FOREIGN KEY ("owner_collection_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_view_defaults_surface" ON "machine_view_defaults" USING btree ("user_id","surface",coalesce("collection_id", "owner_collection_user_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE INDEX "idx_machine_view_defaults_saved_view" ON "machine_view_defaults" USING btree ("saved_view_id");--> statement-breakpoint
CREATE INDEX "idx_machine_view_defaults_collection" ON "machine_view_defaults" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_machine_view_defaults_owner_collection" ON "machine_view_defaults" USING btree ("owner_collection_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_view_saved_views_name" ON "machine_view_saved_views" USING btree ("user_id","surface",coalesce("collection_id", "owner_collection_user_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
CREATE INDEX "idx_machine_view_saved_views_collection" ON "machine_view_saved_views" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_machine_view_saved_views_owner_collection" ON "machine_view_saved_views" USING btree ("owner_collection_user_id");