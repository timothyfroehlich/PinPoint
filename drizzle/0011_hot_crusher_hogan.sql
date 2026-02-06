ALTER TABLE "invited_users" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "role" SET DEFAULT 'guest';