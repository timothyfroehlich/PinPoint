CREATE TABLE "machine_apron_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"name" text NOT NULL,
	"size" text NOT NULL,
	"use_custom_description" boolean DEFAULT false NOT NULL,
	"description" jsonb,
	"tip" jsonb,
	"tip_enabled" boolean DEFAULT false NOT NULL,
	"design_enabled" boolean DEFAULT true NOT NULL,
	"art_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_apron_cards_name_not_blank" CHECK (length(btrim("machine_apron_cards"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "machine_apron_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "machine_apron_cards" ADD CONSTRAINT "machine_apron_cards_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_machine_apron_cards_machine_name" ON "machine_apron_cards" USING btree ("machine_id","name");--> statement-breakpoint
-- Move each machine's saved card (spec apron-cards §11). Only machines with a
-- size ever produced a card; the rest have none to move. Card text becomes a
-- ProseMirror doc with one paragraph per non-empty line, which prints the same
-- paragraphs the plain-text card did. The old machines.apron_* columns stay
-- for now: the deployment serving during the build still selects them.
CREATE FUNCTION pg_temp.apron_text_to_doc(body text) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN body IS NULL OR btrim(body) = '' THEN NULL
    ELSE jsonb_build_object(
      'type', 'doc',
      'content', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'paragraph',
            'content', jsonb_build_array(
              jsonb_build_object('type', 'text', 'text', btrim(line))
            )
          )
          ORDER BY ord
        )
        FROM regexp_split_to_table(body, E'\\n+') WITH ORDINALITY AS l(line, ord)
        WHERE btrim(line) <> ''
      )
    )
  END
$$;--> statement-breakpoint
INSERT INTO "machine_apron_cards" (
	"machine_id", "name", "size", "use_custom_description", "description",
	"tip", "tip_enabled", "design_enabled", "art_enabled", "created_at",
	"updated_at"
)
SELECT
	"id", 'Card 1', "apron_size", "apron_use_custom_description",
	pg_temp.apron_text_to_doc("apron_description"),
	pg_temp.apron_text_to_doc("apron_tip"), "apron_tip_enabled",
	"apron_design_enabled", "apron_art_enabled",
	coalesce("apron_saved_at", now()), coalesce("apron_saved_at", now())
FROM "machines"
WHERE "apron_size" IS NOT NULL;
