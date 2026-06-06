-- Migration: pin_search_path_owner_triggers
--
-- Purpose: Clear Supabase security advisor lint 0011_function_search_path_mutable
-- for three owner/demotion trigger functions originally defined in
-- 0027_machine_owner_member_invariant.sql:
--   - public.check_machine_owner_not_guest
--   - public.check_no_demotion_of_machine_owner
--   - public.check_no_demotion_of_invited_owner
--
-- Fix: CREATE OR REPLACE each function with an explicit, pinned search_path
-- (SET search_path = pg_catalog, public) so the resolved path is no longer
-- role-mutable. Function bodies are copied VERBATIM from 0027; the only change
-- is the added `SET search_path` clause. Triggers are left untouched — they
-- already reference these functions by name.
--
-- No Drizzle schema changes — raw SQL only. Snapshot is identical to 0037.

--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_machine_owner_not_guest() RETURNS TRIGGER
  SET search_path = pg_catalog, public
AS $$
DECLARE v_role text;
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    SELECT role INTO v_role FROM user_profiles WHERE id = NEW.owner_id;
    IF v_role = 'guest' THEN
      RAISE EXCEPTION 'Machine owner cannot be a guest (machine_id=%, owner_id=%)',
        NEW.id, NEW.owner_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.invited_owner_id IS NOT NULL THEN
    SELECT role INTO v_role FROM invited_users WHERE id = NEW.invited_owner_id;
    IF v_role = 'guest' THEN
      RAISE EXCEPTION 'Machine invited owner cannot be a guest (machine_id=%, invited_owner_id=%)',
        NEW.id, NEW.invited_owner_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_no_demotion_of_machine_owner() RETURNS TRIGGER
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.role <> 'guest' AND NEW.role = 'guest' THEN
    IF EXISTS (SELECT 1 FROM machines WHERE owner_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot demote user to guest while they own machines (user_id=%)',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION check_no_demotion_of_invited_owner() RETURNS TRIGGER
  SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.role <> 'guest' AND NEW.role = 'guest' THEN
    IF EXISTS (SELECT 1 FROM machines WHERE invited_owner_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot demote invited user to guest while they own machines (invited_id=%)',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
