CREATE TABLE "opdb_machines" (
	"opdb_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"display" text,
	"player_count" integer,
	"people" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opdb_machines_type_check" CHECK (type IN ('em', 'ss', 'me')),
	CONSTRAINT "opdb_machines_display_check" CHECK (display IN ('reels', 'lights', 'alphanumeric', 'cga', 'dmd', 'lcd')),
	CONSTRAINT "opdb_machines_player_count_check" CHECK (player_count > 0)
);
--> statement-breakpoint
ALTER TABLE "opdb_machines" ENABLE ROW LEVEL SECURITY;