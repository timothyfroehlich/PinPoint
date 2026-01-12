ALTER TABLE "unconfirmed_users" RENAME TO "invited_users";--> statement-breakpoint
ALTER TABLE "invited_users" RENAME CONSTRAINT "unconfirmed_users_email_unique" TO "invited_users_email_unique";--> statement-breakpoint
ALTER TABLE "machines" RENAME COLUMN "unconfirmed_owner_id" TO "invited_owner_id";--> statement-breakpoint
ALTER TABLE "machines" RENAME CONSTRAINT "machines_unconfirmed_owner_id_unconfirmed_users_id_fk" TO "machines_invited_owner_id_invited_users_id_fk";--> statement-breakpoint
ALTER INDEX "idx_machines_unconfirmed_owner_id" RENAME TO "idx_machines_invited_owner_id";--> statement-breakpoint
ALTER TABLE "issues" RENAME COLUMN "unconfirmed_reported_by" TO "invited_reported_by";--> statement-breakpoint
ALTER TABLE "issues" RENAME CONSTRAINT "issues_unconfirmed_reported_by_unconfirmed_users_id_fk" TO "issues_invited_reported_by_invited_users_id_fk";--> statement-breakpoint
ALTER INDEX "idx_issues_unconfirmed_reported_by" RENAME TO "idx_issues_invited_reported_by";--> statement-breakpoint
ALTER TABLE "issues" DROP CONSTRAINT "reporter_check";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "reporter_name" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "reporter_email" text;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "reporter_check" CHECK (("issues"."reported_by" IS NULL AND "issues"."invited_reported_by" IS NULL) OR
          ("issues"."reported_by" IS NOT NULL AND "issues"."invited_reported_by" IS NULL AND "issues"."reporter_name" IS NULL AND "issues"."reporter_email" IS NULL) OR
          ("issues"."reported_by" IS NULL AND "issues"."invited_reported_by" IS NOT NULL AND "issues"."reporter_name" IS NULL AND "issues"."reporter_email" IS NULL));--> statement-breakpoint
ALTER TABLE "machines" DROP CONSTRAINT "owner_check";--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "owner_check" CHECK ( (owner_id IS NULL OR invited_owner_id IS NULL) );
