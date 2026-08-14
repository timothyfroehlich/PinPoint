-- PP-if48: OAuth signups landed with a blank name, and nothing forbade it.
--
-- `handle_new_user` read `raw_user_meta_data->>'first_name'` / `'last_name'` and
-- defaulted both to ''. Our own signup form supplies those keys, so email
-- signups were fine (0 of 31 affected on prod). No OAuth provider supplies them,
-- so Discord-only signups were not (3 of 4 affected).
--
-- The failure was silent because `user_profiles.name` is generated as
-- `first_name || ' ' || last_name`: a blank user's name was a single SPACE, not
-- NULL and not '', so every `?? "Anonymous"` fallback in the app stepped over it
-- and every owner/assignee picker — all of which filter on `name` — could match
-- him only if you typed a literal space. An APC member sat un-assignable for two
-- weeks that way.
--
-- Statements 3–6 below are drizzle-kit's output for the schema.ts change; the
-- rest is hand-written and must stay in this order — the backfill has to run
-- before the check, or the migration fails on any database seeded before the fix.

-- Mirrors src/lib/auth/derive-name.ts. The two run at different times for the
-- same user (trigger on insert, `ensureUserProfile` when auto-healing a missing
-- profile), so a divergence surfaces as a name that depends on which ran first.
--
-- `derived` reports whether we fell back to a provider handle rather than
-- something the user typed. Nothing reads it yet; it is returned because the
-- caller that will ask users to confirm a placeholder name needs it, and adding
-- it later would mean touching this function again.
CREATE OR REPLACE FUNCTION public.derive_profile_name(
  p_metadata jsonb,
  p_email    text,
  OUT first_name text,
  OUT last_name  text,
  OUT derived    boolean
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_explicit_first text := btrim(COALESCE(p_metadata->>'first_name', ''));
  v_explicit_last  text := btrim(COALESCE(p_metadata->>'last_name', ''));
  v_candidate      text;
  v_parts          text[];
BEGIN
  -- 1. The user typed it: our signup form, or an accepted invite.
  IF v_explicit_first <> '' THEN
    first_name := v_explicit_first;
    last_name  := v_explicit_last;
    derived    := false;
    RETURN;
  END IF;

  -- 2..4. Provider display name, best first. Discord nests the only field that
  -- usually holds a real name under custom_claims.global_name ("Paul Muntner");
  -- full_name is the account handle ("pmuntner") and name carries the legacy
  -- discriminator ("pmuntner#0"), which we strip.
  v_candidate := COALESCE(
    NULLIF(btrim(COALESCE(p_metadata->'custom_claims'->>'global_name', '')), ''),
    NULLIF(btrim(COALESCE(p_metadata->>'full_name', '')), ''),
    -- btrim BEFORE the strip, not after: the `$` anchor does not match across a
    -- trailing space, so "pmuntner#0 " would keep its discriminator here while
    -- deriveName() (which trims first) drops it.
    NULLIF(btrim(regexp_replace(btrim(COALESCE(p_metadata->>'name', '')), '#\d+$', '')), '')
  );

  IF v_candidate IS NOT NULL THEN
    -- Split on the FIRST whitespace run, so "Mary Anne van der Berg" keeps
    -- everything after "Mary" together as the surname.
    v_parts := regexp_split_to_array(btrim(v_candidate), '\s+');
    IF COALESCE(v_parts[1], '') <> '' THEN
      first_name := v_parts[1];
      last_name  := btrim(COALESCE(array_to_string(v_parts[2:], ' '), ''));
      derived    := true;
      RETURN;
    END IF;
  END IF;

  -- 5. Floor: the email local-part, then a literal. A signup must never fail
  -- because we could not name the account, so this chain cannot return ''.
  -- That is exactly what makes the check added below un-trippable.
  first_name := COALESCE(NULLIF(btrim(split_part(COALESCE(p_email, ''), '@', 1)), ''), 'Member');
  last_name  := '';
  derived    := true;
END;
$function$;
--> statement-breakpoint
-- Prod's three affected rows were repaired by hand before this migration was
-- written, so this is a no-op there. It is not a no-op for local databases,
-- preview branches, or any environment seeded before the fix — and the check
-- below would fail against those without it.
UPDATE public.user_profiles p
SET first_name = d.first_name,
    last_name  = d.last_name,
    updated_at = now()
FROM auth.users u,
     LATERAL public.derive_profile_name(u.raw_user_meta_data, u.email::text) d
WHERE u.id = p.id
  AND btrim(p.first_name) = '';
--> statement-breakpoint
-- A profile with no auth.users row should not exist, but the check is about to
-- become unconditional, so leave nothing behind that could fail it.
UPDATE public.user_profiles
SET first_name = COALESCE(NULLIF(btrim(split_part(email::text, '@', 1)), ''), 'Member'),
    updated_at = now()
WHERE btrim(first_name) = '';
--> statement-breakpoint
UPDATE public.invited_users
SET first_name = COALESCE(NULLIF(btrim(split_part(email::text, '@', 1)), ''), 'Member')
WHERE btrim(first_name) = '';
--> statement-breakpoint
-- A generated column's expression cannot be altered in place, so drop and
-- re-add. The column moves to the end of the table — everything reads it by
-- name, so that is invisible.
--
-- `public_profiles_view` selects user_profiles.name, so the drop fails with
-- "other objects depend on it" unless the view goes first. It is recreated
-- below, verbatim from 0017, and its two out-of-band settings are re-applied
-- with it: `security_invoker` (0034) and the SELECT grant (0018 — which exists
-- *because* 0016 recreated this view and silently dropped the grant, taking
-- email privacy with it). DROP ... CASCADE would have taken the view out and
-- left no trace; naming it here is what keeps that from happening again.
DROP VIEW IF EXISTS "public"."public_profiles_view";--> statement-breakpoint
ALTER TABLE "invited_users" drop column "name";--> statement-breakpoint
ALTER TABLE "invited_users" ADD COLUMN "name" text GENERATED ALWAYS AS (btrim(first_name || ' ' || last_name)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" drop column "name";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "name" text GENERATED ALWAYS AS (btrim(first_name || ' ' || last_name)) STORED NOT NULL;--> statement-breakpoint
-- Verbatim from 0017 — the email-masking CASE is CORE-SEC-007 enforcement and
-- must not be paraphrased while restoring it.
CREATE OR REPLACE VIEW "public_profiles_view" AS
SELECT
  id,
  first_name,
  last_name,
  name,
  avatar_url,
  role,
  created_at,
  updated_at,
  CASE
    WHEN NULLIF(current_setting('request.user_id', true), '') = id::text THEN email
    WHEN NULLIF(current_setting('request.user_role', true), '') = 'admin' THEN email
    WHEN (select auth.uid()) = id THEN email
    WHEN (select role from user_profiles where id = (select auth.uid())) = 'admin' THEN email
    ELSE NULL
  END AS email
FROM "user_profiles";--> statement-breakpoint
-- From 0034: without this the masking CASE evaluates as the view's owner and
-- every caller sees every email.
ALTER VIEW "public"."public_profiles_view" SET (security_invoker = true);--> statement-breakpoint
-- From 0018: a recreated view loses its grants.
GRANT SELECT ON "public_profiles_view" TO authenticated;--> statement-breakpoint
-- NOT NULL never forbade '', which is the whole reason this bug was possible.
-- Only the first name is required: a last name is genuinely optional (plenty of
-- people go by one name, and every OAuth fallback above produces a single
-- token), so it is left free to be ''.
ALTER TABLE "invited_users" ADD CONSTRAINT "invited_users_first_name_not_blank" CHECK (btrim(first_name) <> '');--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_first_name_not_blank" CHECK (btrim(first_name) <> '');--> statement-breakpoint
-- Body is unchanged from 0036 apart from the name derivation; the notification
-- defaults, guest-issue transfer and invited-user transfer are carried verbatim.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invited_user_id uuid;
  v_role text;
  v_first_name text;
  v_last_name text;
  v_derived boolean;
BEGIN
  -- Handle legacy invited_users (if any exist) first to get role
  SELECT id, role INTO v_invited_user_id, v_role
  FROM public.invited_users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Derive a usable name. Was COALESCE(...->>'first_name', ''), which no OAuth
  -- provider ever satisfies (PP-if48).
  SELECT d.first_name, d.last_name, d.derived
  INTO v_first_name, v_last_name, v_derived
  FROM public.derive_profile_name(NEW.raw_user_meta_data, NEW.email::text) d;

  -- An invited user was named by the admin who invited them; that beats anything
  -- we could derive from the provider, but not a name the user typed themselves.
  IF v_invited_user_id IS NOT NULL AND v_derived THEN
    SELECT iu.first_name, iu.last_name
    INTO v_first_name, v_last_name
    FROM public.invited_users iu
    WHERE iu.id = v_invited_user_id;
  END IF;

  INSERT INTO public.user_profiles (id, email, first_name, last_name, avatar_url, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    v_first_name,
    v_last_name,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(v_role, 'guest')
  );

  -- Create default notification preferences
  -- New user defaults: only assigned + new issue on owned machines (email) are ON.
  -- Discord columns (discord_enabled, discord_notify_on_*, discord_watch_*) are
  -- intentionally omitted from this column list — they pick up DB-level
  -- DEFAULTs (added in 0031, with new_issue tweaked in 0032).
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
  UPDATE public.issues
  SET
    reported_by = NEW.id,
    reporter_name = NULL,
    reporter_email = NULL
  WHERE lower(reporter_email) = lower(NEW.email)
    AND reported_by IS NULL
    AND invited_reported_by IS NULL;

  -- Handle legacy invited_users transfer
  IF v_invited_user_id IS NOT NULL THEN
    UPDATE public.machines
    SET
      owner_id = NEW.id,
      invited_owner_id = NULL
    WHERE invited_owner_id = v_invited_user_id;

    UPDATE public.issues
    SET
      reported_by = NEW.id,
      invited_reported_by = NULL,
      reporter_name = NULL,
      reporter_email = NULL
    WHERE invited_reported_by = v_invited_user_id;

    -- Must run BEFORE the invited_users DELETE: the ON DELETE RESTRICT FK on
    -- timeline_event_people.invited_id makes the delete fail otherwise (PP-tv9l).
    UPDATE public.timeline_event_people
    SET
      user_id = NEW.id,
      invited_id = NULL
    WHERE invited_id = v_invited_user_id;

    DELETE FROM public.invited_users
    WHERE id = v_invited_user_id;
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
-- 0035 locked handle_new_user down; re-assert after CREATE OR REPLACE.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.derive_profile_name(jsonb, text) FROM PUBLIC, anon, authenticated;
