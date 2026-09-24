ALTER TABLE "machines" ADD COLUMN "apron_size" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "apron_use_custom_description" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "apron_description" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "apron_tip" text;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "apron_tip_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "apron_saved_at" timestamp with time zone;