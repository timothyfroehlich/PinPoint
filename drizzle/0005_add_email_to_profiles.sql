-- Step 1: Add column as nullable
ALTER TABLE "user_profiles" ADD COLUMN "email" text;

-- Step 2: Backfill data from auth.users
-- Note: This is an internal Supabase migration pattern. We use the join on id.
UPDATE "user_profiles" SET "email" = (SELECT email FROM auth.users WHERE auth.users.id = "user_profiles".id);

-- Step 3: Add NOT NULL and UNIQUE constraints
ALTER TABLE "user_profiles" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_email_unique" UNIQUE("email");
