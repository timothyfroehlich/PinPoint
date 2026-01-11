ALTER TABLE "issues" DROP CONSTRAINT "reporter_check";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "reporter_name" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "reporter_email" text;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "reporter_check" CHECK (("issues"."reported_by" IS NULL AND "issues"."unconfirmed_reported_by" IS NULL) OR
          ("issues"."reported_by" IS NOT NULL AND "issues"."unconfirmed_reported_by" IS NULL AND "issues"."reporter_name" IS NULL AND "issues"."reporter_email" IS NULL) OR
          ("issues"."reported_by" IS NULL AND "issues"."unconfirmed_reported_by" IS NOT NULL AND "issues"."reporter_name" IS NULL AND "issues"."reporter_email" IS NULL));