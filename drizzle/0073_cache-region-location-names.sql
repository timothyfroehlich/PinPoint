CREATE TABLE "pinballmap_region_location_names" (
	"region" text NOT NULL,
	"location_id" integer NOT NULL,
	"name" text NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pinballmap_region_location_names_region_location_id_pk" PRIMARY KEY("region","location_id")
);
--> statement-breakpoint
ALTER TABLE "pinballmap_region_location_names" ENABLE ROW LEVEL SECURITY;