CREATE TABLE "collection_collaborators" (
	"collection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid,
	CONSTRAINT "collection_collaborators_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "collection_collaborators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collection_collaborators" ADD CONSTRAINT "collection_collaborators_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_collaborators" ADD CONSTRAINT "collection_collaborators_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_collaborators" ADD CONSTRAINT "collection_collaborators_added_by_user_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_collection_collaborators_user" ON "collection_collaborators" USING btree ("user_id");