CREATE TABLE "pintips" (
	"tip_id" integer PRIMARY KEY NOT NULL,
	"opdb_group_id" text NOT NULL,
	"category" text NOT NULL,
	"vote_total" integer NOT NULL,
	"text" text NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pintips_category_check" CHECK (category IN ('general', 'multiball', 'skillshot', 'wizard', 'secret'))
);
--> statement-breakpoint
ALTER TABLE "pintips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "idx_pintips_opdb_group_id" ON "pintips" USING btree ("opdb_group_id");