ALTER TABLE "collections" ADD COLUMN "view_token" text;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_view_token_unique" UNIQUE("view_token");