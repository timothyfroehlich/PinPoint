CREATE TABLE "timeline_event_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"role" text NOT NULL,
	"user_id" uuid,
	"invited_id" uuid,
	CONSTRAINT "timeline_event_people_person_check" CHECK (("timeline_event_people"."user_id" IS NULL OR "timeline_event_people"."invited_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_type" text NOT NULL,
	"tag" text NOT NULL,
	"author_id" uuid,
	"content" jsonb,
	"event_data" jsonb,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"sequence" bigserial NOT NULL
);
--> statement-breakpoint
ALTER TABLE "timeline_event_people" ADD CONSTRAINT "timeline_event_people_event_id_timeline_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_event_people" ADD CONSTRAINT "timeline_event_people_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_event_people" ADD CONSTRAINT "timeline_event_people_invited_id_invited_users_id_fk" FOREIGN KEY ("invited_id") REFERENCES "public"."invited_users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_author_id_user_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_deleted_by_user_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_timeline_event_people_event_id" ON "timeline_event_people" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_event_people_invited_id" ON "timeline_event_people" USING btree ("invited_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_events_machine_created" ON "timeline_events" USING btree ("machine_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_timeline_events_machine_tag" ON "timeline_events" USING btree ("machine_id","tag");--> statement-breakpoint
-- PP-tv9l: extend handle_new_user() so an invited person's timeline
-- person-references are rewritten invited->real at signup, exactly as the
-- function already rewrites machines.invited_owner_id and
-- issues.invited_reported_by. The timeline_event_people.invited_id FK is
-- ON DELETE RESTRICT, so the DELETE FROM invited_users below fails loudly if
-- any reference was missed — a recoverable failed signup rather than
-- permanent silent history loss.
--
-- This trigger SQL is folded into 0036 (not a separate `--custom` migration)
-- because drizzle-kit migrate skips a custom migration whose snapshot equals
-- the prior one — it would record as applied without ever running the SQL.
-- Appending to a migration that has a real schema diff guarantees execution
-- (same pattern as 0029_discord_config_role_check). CREATE OR REPLACE
-- preserves grants and runs after 0035's REVOKEs, so the lock survives; the
-- REVOKEs are re-issued below as idempotent, self-documenting insurance.
-- Body is the canonical handle_new_user (matching 0033 / supabase/seed.sql:
-- lower(email) normalization, guest-role default, the current
-- notification_preferences column set) with one added step — the
-- timeline_event_people rewrite. Do NOT base this on the older 0007 body.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_user_id uuid;
  v_role text;
BEGIN
  -- Handle legacy invited_users (if any exist) first to get role
  -- Find matching invited user by email
  SELECT id, role INTO v_invited_user_id, v_role
  FROM public.invited_users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Create user profile
  INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(v_role, 'guest') -- Use invited role if exists, else default to guest
  );

  -- Create default notification preferences
  -- New user defaults: only assigned + new issue on owned machines (email) are ON.
  -- Discord columns (discord_enabled, discord_notify_on_*, discord_watch_*) are
  -- intentionally omitted from this column list — they pick up DB-level
  -- DEFAULTs (added in 0031, with new_issue tweaked in 0032). The production
  -- trigger in 0033 follows the same pattern.
  INSERT INTO public.notification_preferences (
    user_id,
    email_enabled,
    in_app_enabled,
    suppress_own_actions,
    email_notify_on_assigned,
    in_app_notify_on_assigned,
    email_notify_on_status_change,
    in_app_notify_on_status_change,
    email_notify_on_new_comment,
    in_app_notify_on_new_comment,
    email_notify_on_new_issue,
    in_app_notify_on_new_issue,
    email_watch_new_issues_global,
    in_app_watch_new_issues_global
  )
  VALUES (
    NEW.id,
    true, true, -- Master switches
    false,      -- Suppress own actions (off by default)
    true, true, -- Assigned
    false, false, -- Status change
    false, false, -- New comment
    true, false,  -- New issue on owned machines (email on, in-app off)
    false, false  -- Global watch
  );

  -- Transfer guest issues to newly created account
  -- Link issues where reporter_email matches the new user's email
  UPDATE public.issues
  SET
    reported_by = NEW.id,
    reporter_name = NULL,
    reporter_email = NULL
  WHERE lower(reporter_email) = lower(NEW.email)
    AND reported_by IS NULL
    AND invited_reported_by IS NULL;

  -- Handle legacy invited_users transfer (v_invited_user_id already populated above)
  IF v_invited_user_id IS NOT NULL THEN
    -- Transfer machines owned by invited user
    UPDATE public.machines
    SET
      owner_id = NEW.id,
      invited_owner_id = NULL
    WHERE invited_owner_id = v_invited_user_id;

    -- Transfer issues reported by invited user
    UPDATE public.issues
    SET
      reported_by = NEW.id,
      invited_reported_by = NULL,
      reporter_name = NULL,
      reporter_email = NULL
    WHERE invited_reported_by = v_invited_user_id;

    -- Transfer timeline person-references owned by invited user (PP-tv9l).
    -- Must run BEFORE the invited_users DELETE: the ON DELETE RESTRICT FK on
    -- timeline_event_people.invited_id makes the delete fail otherwise.
    UPDATE public.timeline_event_people
    SET
      user_id = NEW.id,
      invited_id = NULL
    WHERE invited_id = v_invited_user_id;

    -- Delete the invited user record (no longer needed)
    DELETE FROM public.invited_users
    WHERE id = v_invited_user_id;
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;