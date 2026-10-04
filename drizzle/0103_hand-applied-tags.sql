CREATE TABLE "machine_tags" (
	"machine_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"tag_type_id" uuid,
	"type_exclusive" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid,
	CONSTRAINT "machine_tags_machine_id_tag_id_pk" PRIMARY KEY("machine_id","tag_id"),
	CONSTRAINT "machine_tags_untyped_not_exclusive" CHECK ("machine_tags"."tag_type_id" IS NOT NULL OR NOT "machine_tags"."type_exclusive")
);
--> statement-breakpoint
ALTER TABLE "machine_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tag_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tag_types_slug" UNIQUE("slug"),
	CONSTRAINT "uq_tag_types_id_exclusive" UNIQUE("id","exclusive"),
	CONSTRAINT "tag_types_name_normalized" CHECK ("tag_types"."name" = btrim(regexp_replace("tag_types"."name", '\s+', ' ', 'g')) AND char_length("tag_types"."name") BETWEEN 1 AND 20),
	CONSTRAINT "tag_types_slug_format" CHECK ("tag_types"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "tag_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag_type_id" uuid,
	"type_exclusive" boolean DEFAULT false NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_tags_slug" UNIQUE("slug"),
	CONSTRAINT "uq_tags_id_type" UNIQUE("id","tag_type_id","type_exclusive"),
	CONSTRAINT "tags_name_normalized" CHECK ("tags"."name" = btrim(regexp_replace("tags"."name", '\s+', ' ', 'g')) AND char_length("tags"."name") BETWEEN 1 AND 20),
	CONSTRAINT "tags_slug_format" CHECK ("tags"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "tags_untyped_not_exclusive" CHECK ("tags"."tag_type_id" IS NOT NULL OR NOT "tags"."type_exclusive")
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_tags" ADD CONSTRAINT "machine_tags_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_tags" ADD CONSTRAINT "machine_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_tags" ADD CONSTRAINT "machine_tags_added_by_user_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_tags" ADD CONSTRAINT "machine_tags_tag_type_fk" FOREIGN KEY ("tag_id","tag_type_id","type_exclusive") REFERENCES "public"."tags"("id","tag_type_id","type_exclusive") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tag_type_fk" FOREIGN KEY ("tag_type_id","type_exclusive") REFERENCES "public"."tag_types"("id","exclusive") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_tags_exclusive_type" ON "machine_tags" USING btree ("machine_id","tag_type_id") WHERE "machine_tags"."type_exclusive";--> statement-breakpoint
CREATE INDEX "idx_machine_tags_tag" ON "machine_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tag_types_name" ON "tag_types" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tags_type_name" ON "tags" USING btree (coalesce("tag_type_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name"));--> statement-breakpoint
CREATE INDEX "idx_tags_tag_type" ON "tags" USING btree ("tag_type_id");