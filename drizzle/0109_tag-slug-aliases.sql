CREATE TABLE "tag_slug_aliases" (
	"slug" text PRIMARY KEY NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_slug_aliases_slug_format" CHECK ("tag_slug_aliases"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "tag_slug_aliases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tag_slug_aliases" ADD CONSTRAINT "tag_slug_aliases_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tag_slug_aliases_tag" ON "tag_slug_aliases" USING btree ("tag_id");