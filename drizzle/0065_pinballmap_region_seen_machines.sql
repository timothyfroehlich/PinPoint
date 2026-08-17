CREATE TABLE "pinballmap_region_seen_machines" (
	"region" text NOT NULL,
	"lmx_id" integer NOT NULL,
	"location_id" integer NOT NULL,
	"pinballmap_machine_id" integer NOT NULL,
	"location_name" text,
	"machine_name" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"announced_at" timestamp with time zone,
	CONSTRAINT "pinballmap_region_seen_machines_region_lmx_id_pk" PRIMARY KEY("region","lmx_id")
);
--> statement-breakpoint
ALTER TABLE "pinballmap_region_seen_machines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_pinballmap_region_seen_pending" ON "pinballmap_region_seen_machines" USING btree ("region","first_seen_at") WHERE announced_at is null;