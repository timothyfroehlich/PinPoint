CREATE TABLE "unconfirmed_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"name" text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'guest' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invite_sent_at" timestamp with time zone,
	CONSTRAINT "unconfirmed_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "unconfirmed_reported_by" uuid;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "unconfirmed_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_unconfirmed_reported_by_unconfirmed_users_id_fk" FOREIGN KEY ("unconfirmed_reported_by") REFERENCES "public"."unconfirmed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_unconfirmed_owner_id_unconfirmed_users_id_fk" FOREIGN KEY ("unconfirmed_owner_id") REFERENCES "public"."unconfirmed_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "reporter_check" CHECK ((reported_by IS NULL OR unconfirmed_reported_by IS NULL));--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "owner_check" CHECK ((owner_id IS NULL OR unconfirmed_owner_id IS NULL));
--> statement-breakpoint

-- Function to link unconfirmed users on signup
CREATE OR REPLACE FUNCTION link_unconfirmed_user()
RETURNS TRIGGER AS $$
DECLARE
  unconfirmed_user_id uuid;
  user_email text;
  user_role text;
BEGIN
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Find matching unconfirmed user
  SELECT id, role INTO unconfirmed_user_id, user_role
  FROM unconfirmed_users
  WHERE email = user_email;

  IF unconfirmed_user_id IS NOT NULL THEN
    -- Link machines
    UPDATE machines
    SET owner_id = NEW.id, unconfirmed_owner_id = NULL
    WHERE unconfirmed_owner_id = unconfirmed_user_id;

    -- Link issues
    UPDATE issues
    SET reported_by = NEW.id, unconfirmed_reported_by = NULL
    WHERE unconfirmed_reported_by = unconfirmed_user_id;

    -- Transfer role from unconfirmed user to profile
    UPDATE user_profiles
    SET role = user_role
    WHERE id = NEW.id;

    -- Cleanup: delete unconfirmed user record
    DELETE FROM unconfirmed_users WHERE id = unconfirmed_user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-link on user profile creation
DROP TRIGGER IF EXISTS link_unconfirmed_user_trigger ON user_profiles;
CREATE TRIGGER link_unconfirmed_user_trigger
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION link_unconfirmed_user();
