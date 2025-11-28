CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "priority" text DEFAULT 'low' NOT NULL;