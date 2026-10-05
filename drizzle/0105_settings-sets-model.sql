CREATE TABLE "machine_settings_set_tags" (
	"set_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid,
	CONSTRAINT "machine_settings_set_tags_set_id_tag_id_pk" PRIMARY KEY("set_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "machine_settings_set_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_settings_tags_slug" UNIQUE("slug"),
	CONSTRAINT "settings_tags_name_normalized" CHECK ("settings_tags"."name" = btrim(regexp_replace("settings_tags"."name", '\s+', ' ', 'g')) AND char_length("settings_tags"."name") BETWEEN 1 AND 20),
	CONSTRAINT "settings_tags_slug_format" CHECK ("settings_tags"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "settings_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD COLUMN "is_preferred_tournament" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machine_settings_sets" ADD COLUMN "is_community" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machine_settings_set_tags" ADD CONSTRAINT "machine_settings_set_tags_set_id_machine_settings_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."machine_settings_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_settings_set_tags" ADD CONSTRAINT "machine_settings_set_tags_tag_id_settings_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."settings_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_settings_set_tags" ADD CONSTRAINT "machine_settings_set_tags_added_by_user_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings_tags" ADD CONSTRAINT "settings_tags_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_machine_settings_set_tags_tag" ON "machine_settings_set_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_machine_settings_set_tags_added_by" ON "machine_settings_set_tags" USING btree ("added_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_settings_tags_name" ON "settings_tags" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "idx_settings_tags_created_by" ON "settings_tags" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_machine_settings_preferred_tournament" ON "machine_settings_sets" USING btree ("machine_id") WHERE "machine_settings_sets"."is_preferred_tournament";--> statement-breakpoint
-- Built-in settings tags (machine-settings spec §3.2).
INSERT INTO "settings_tags" ("slug", "name", "is_builtin") VALUES ('house', 'House', true), ('tournament', 'Tournament', true) ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
-- Kind: the Owner's default and public community sets become community sets;
-- owner sets and private drafts become their author's personal sets (§2, §4.2).
UPDATE "machine_settings_sets" SET "is_community" = ("is_preferred" OR (NOT "is_owner_set" AND "is_public"));--> statement-breakpoint
-- The Tournament flag becomes the Tournament tag; every other set, and the
-- Owner's default (now the preferred House set), carries the House tag (§2.1, §4.2).
INSERT INTO "machine_settings_set_tags" ("set_id", "tag_id", "added_by")
SELECT s."id", t."id", s."created_by" FROM "machine_settings_sets" s JOIN "settings_tags" t ON t."slug" = 'tournament' WHERE s."is_tournament";--> statement-breakpoint
INSERT INTO "machine_settings_set_tags" ("set_id", "tag_id", "added_by")
SELECT s."id", t."id", s."created_by" FROM "machine_settings_sets" s JOIN "settings_tags" t ON t."slug" = 'house' WHERE s."is_preferred" OR NOT s."is_tournament";--> statement-breakpoint
-- Settings edits move to their own timeline tag, hidden by default (§5.2).
UPDATE "timeline_events" SET "tag" = 'settings_edit' WHERE "tag" = 'settings' AND "event_data"->>'kind' = 'settings_set_updated';
