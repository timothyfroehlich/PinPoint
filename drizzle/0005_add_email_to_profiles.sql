ALTER TABLE "user_profiles" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_email_unique" UNIQUE("email");