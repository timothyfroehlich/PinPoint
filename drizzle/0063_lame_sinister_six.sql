CREATE TABLE "pinballmap_abandoned_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"lmx_id" integer NOT NULL,
	"pinballmap_machine_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pinballmap_abandoned_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pinballmap_abandoned_listings" ADD CONSTRAINT "pinballmap_abandoned_listings_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pinballmap_abandoned_listings_lmx_unique" ON "pinballmap_abandoned_listings" USING btree ("lmx_id");--> statement-breakpoint
CREATE INDEX "idx_pinballmap_abandoned_listings_machine" ON "pinballmap_abandoned_listings" USING btree ("machine_id");