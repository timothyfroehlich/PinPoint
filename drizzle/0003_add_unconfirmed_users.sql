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
-- Custom trigger to auto-link machines and issues when unconfirmed user signs up
CREATE OR REPLACE FUNCTION public.handle_unconfirmed_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Update machines where the unconfirmed user was the owner
    UPDATE public.machines
    SET
        owner_id = NEW.id,
        unconfirmed_owner_id = NULL
    WHERE unconfirmed_owner_id = (
        SELECT id FROM public.unconfirmed_users WHERE email = NEW.email
    );

    -- Update issues where the unconfirmed user was the reporter
    UPDATE public.issues
    SET
        reported_by = NEW.id,
        unconfirmed_reported_by = NULL
    WHERE unconfirmed_reported_by = (
        SELECT id FROM public.unconfirmed_users WHERE email = NEW.email
    );

    -- Delete the unconfirmed user record
    DELETE FROM public.unconfirmed_users WHERE email = NEW.email;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_unconfirmed_user_signup
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_unconfirmed_user_signup();
